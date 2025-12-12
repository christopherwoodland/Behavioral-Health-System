<#
.SYNOPSIS
Deploys the complete Behavioral Health System infrastructure to Azure using Bicep.

.DESCRIPTION
This script deploys all necessary Azure resources including:
- Virtual Network with private subnets and security
- Key Vault with private endpoints
- Storage Account with private endpoints
- Azure OpenAI with private endpoints
- Cognitive Services (Document Intelligence, Content Understanding) with private endpoints
- Azure Functions with VNet integration
- Static Web App for React frontend
- Application Insights and Log Analytics
- Private DNS zones for private endpoints

.PARAMETER Environment
The environment to deploy to (dev, staging, prod). Default is 'dev'.

.PARAMETER SubscriptionId
The Azure subscription ID to deploy to.

.PARAMETER Location
The Azure region for resources. Default is 'eastus2'.

.PARAMETER AppName
The application name prefix. Default is 'bhs'.

.EXAMPLE
.\Deploy-Infrastructure.ps1 -Environment dev -SubscriptionId "00000000-0000-0000-0000-000000000000"

.EXAMPLE
.\Deploy-Infrastructure.ps1 -Environment prod -SubscriptionId "00000000-0000-0000-0000-000000000000" -Location "eastus"

.EXAMPLE
.\Deploy-Infrastructure.ps1 -Environment dev -SubscriptionId "00000000-0000-0000-0000-000000000000" -ResourceGroupName "my-custom-rg"
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [string]$SubscriptionId,

    [Parameter(Mandatory = $false)]
    [string]$Location = 'eastus2',

    [Parameter(Mandatory = $false)]
    [string]$AppName = 'bhs',

    [Parameter(Mandatory = $false)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory = $false)]
    [switch]$DiagnosticOutput
)

# Set error action preference
$ErrorActionPreference = 'Stop'

# Colors for output
$Green = 'Green'
$Yellow = 'Yellow'
$Red = 'Red'

function Write-Status {
    param(
        [string]$Message,
        [string]$Color = 'Cyan'
    )
    Write-Host "[*] $Message" -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor $Green
}

function Write-ErrorMessage {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

try {
    if ($DiagnosticOutput) {
        Write-Host "DiagnosticOutput flag is set" -ForegroundColor Magenta
    }

    # Check prerequisites
    Write-Status "Checking prerequisites..."

    $azVersion = az version | ConvertFrom-Json
    if (-not $azVersion) {
        Write-ErrorMessage "Azure CLI is not installed. Please install it first."
        exit 1
    }
    Write-Success "Azure CLI is installed"

    # Set subscription
    Write-Status "Setting Azure subscription to: $SubscriptionId"
    az account set --subscription $SubscriptionId
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMessage "Failed to set subscription"
        exit 1
    }
    Write-Success "Subscription set"

    # Get current user IP address for Key Vault firewall
    Write-Status "Detecting your IP address for Key Vault firewall..."
    $deploymentClientIP = (Invoke-WebRequest -Uri 'https://api.ipify.org?format=json' -UseBasicParsing | ConvertFrom-Json).ip
    Write-Success "Detected IP: $deploymentClientIP"

    # Resolve template and parameters paths
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $infraDir = Split-Path -Parent $scriptDir
    $bicepDir = Join-Path $infraDir 'bicep'
    $templatePath = Join-Path $bicepDir 'main.bicep'
    $parametersDir = Join-Path $bicepDir 'parameters'
    $parametersPath = Join-Path $parametersDir "${Environment}.parameters.json"

    if ($DiagnosticOutput) {
        Write-Host "Script Dir: $scriptDir" -ForegroundColor Cyan
        Write-Host "Infra Dir: $infraDir" -ForegroundColor Cyan
        Write-Host "Template Path: $templatePath" -ForegroundColor Cyan
        Write-Host "Parameters Path: $parametersPath" -ForegroundColor Cyan
    }

    if (-not (Test-Path $templatePath)) {
        Write-ErrorMessage "Template file not found: $templatePath"
        exit 1
    }

    if (-not (Test-Path $parametersPath)) {
        Write-ErrorMessage "Parameters file not found: $parametersPath"
        exit 1
    }

    Write-Success "Template and parameters files found"

    # Build Bicep to ARM JSON to avoid CLI linting issues
    Write-Status "Compiling Bicep template to ARM JSON (warnings are OK)..."
    $compiledTemplatePath = Join-Path $env:TEMP "main.json"

    # Temporarily allow warnings to not throw exceptions
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'

    # Capture output but don't fail on warnings (exit code 0 even with warnings)
    $buildOutput = az bicep build --file $templatePath --outfile $compiledTemplatePath 2>&1 | Out-String

    # Restore error action preference
    $ErrorActionPreference = $previousErrorAction

    # Only check if the file was created (warnings won't prevent file creation)
    if (-not (Test-Path $compiledTemplatePath)) {
        Write-ErrorMessage "Failed to compile Bicep template"
        if ($DiagnosticOutput) {
            Write-Host "Build output:" -ForegroundColor Yellow
            Write-Host $buildOutput -ForegroundColor Yellow
        }
        exit 1
    }
    Write-Success "Bicep compiled successfully (linter warnings can be ignored)"

    # Build resource group name
    if ([string]::IsNullOrEmpty($ResourceGroupName)) {
        $resourceGroupName = "${AppName}-${Environment}-rg"
    } else {
        $resourceGroupName = $ResourceGroupName
    }

    # Deploy infrastructure (subscription-level deployment will create the resource group)
    Write-Status "Deploying infrastructure to Azure..."
    Write-Status "Resource group '$resourceGroupName' will be created in location '$Location'"
    Write-Status "This may take 10-15 minutes. Please be patient..."

    $deploymentName = "bhs-deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

    $azArgs = @(
        'deployment', 'sub', 'create',
        '--location', $Location,
        '--template-file', $compiledTemplatePath,
        '--parameters', $parametersPath,
        '--parameters', "environment=$Environment",
        '--parameters', "location=$Location",
        '--parameters', "appName=$AppName",
        '--parameters', "deploymentClientIP=$deploymentClientIP",
        '--parameters', "resourceGroupName=$resourceGroupName",
        '--name', $deploymentName,
        '--no-wait'
    )

    if ($DiagnosticOutput) {
        Write-Host "Deployment command: az $($azArgs -join ' ')" -ForegroundColor Cyan
    }

    & az @azArgs

    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMessage "Deployment failed to start"
        exit 1
    }

    Write-Success "Deployment started successfully"
    Write-Status "Waiting for deployment to complete..."
    Write-Status "Polling deployment status every 30 seconds..."

    # Poll deployment status
    $maxAttempts = 40  # 40 * 30 seconds = 20 minutes max
    $attempt = 0
    $deploymentComplete = $false

    while (-not $deploymentComplete -and $attempt -lt $maxAttempts) {
        Start-Sleep -Seconds 30
        $attempt++

        # Query deployment state (simpler query to avoid JSON parsing issues)
        $state = az deployment sub show --name $deploymentName --query "properties.provisioningState" -o tsv 2>&1

        if ($LASTEXITCODE -eq 0) {
            Write-Host "[Attempt $attempt/$maxAttempts] Deployment state: $state" -ForegroundColor Cyan

            if ($state -eq "Succeeded") {
                $deploymentComplete = $true
                Write-Success "Deployment completed successfully!"
            } elseif ($state -eq "Failed") {
                Write-ErrorMessage "Deployment failed"
                # Try to get error details
                az deployment sub show --name $deploymentName --query "properties.error" -o json 2>&1
                exit 1
            } elseif ($state -eq "Canceled") {
                Write-ErrorMessage "Deployment was canceled"
                exit 1
            }
            # Otherwise, continue polling (Running, Accepted, etc.)
        } else {
            Write-Host "[Attempt $attempt/$maxAttempts] Unable to query deployment status, retrying..." -ForegroundColor Yellow
        }
    }

    if (-not $deploymentComplete) {
        Write-ErrorMessage "Deployment timed out after 20 minutes"
        exit 1
    }

    Write-Success "Infrastructure deployed successfully!"

    # Get deployment outputs
    Write-Status "Retrieving deployment outputs..."
    $outputs = az deployment sub show `
        --name $deploymentName `
        --query properties.outputs `
        --output json | ConvertFrom-Json

    Write-Host ""
    Write-Host "" -ForegroundColor $Green
    Write-Host "             DEPLOYMENT COMPLETED SUCCESSFULLY                 " -ForegroundColor $Green
    Write-Host "" -ForegroundColor $Green
    Write-Host ""

    # Display key information
    Write-Host "INFO - Deployment Information:" -ForegroundColor $Green
    Write-Host "   Environment: $Environment"
    Write-Host "   Resource Group: $resourceGroupName"
    Write-Host "   Location: $Location"
    Write-Host ""

    Write-Host "KEY - Key Vault:" -ForegroundColor $Green
    Write-Host "   Name: $($outputs.keyVaultName.value)"
    Write-Host "   URI: $($outputs.keyVaultUri.value)"
    Write-Host ""

    Write-Host "STORAGE - Storage Account:" -ForegroundColor $Green
    Write-Host "   Name: $($outputs.storageAccountName.value)"
    Write-Host ""

    Write-Host "FUNCTIONS - Azure Functions:" -ForegroundColor $Green
    Write-Host "   Name: $($outputs.functionAppName.value)"
    Write-Host "   URL: $($outputs.functionAppUrl.value)"
    Write-Host "   Principal ID: $($outputs.functionAppPrincipalId.value)"
    Write-Host ""

    Write-Host "WEB - Static Web App:" -ForegroundColor $Green
    Write-Host "   Name: $($outputs.staticWebAppName.value)"
    Write-Host "   URL: https://$($outputs.staticWebAppUrl.value)"
    Write-Host ""

    Write-Host "AI - Azure OpenAI:" -ForegroundColor $Green
    Write-Host "   Endpoint: $($outputs.openaiEndpoint.value)"
    Write-Host ""

    Write-Host "DOC - Document Intelligence:" -ForegroundColor $Green
    Write-Host "   Endpoint: $($outputs.documentIntelligenceEndpoint.value)"
    Write-Host ""

    # Next steps
    Write-Host 'NEXT - Next Steps:' -ForegroundColor $Yellow
    Write-Host '   1. Run Configure-Secrets.ps1 to populate Key Vault with secrets'
    Write-Host '   2. Configure GitHub Actions for Static Web App deployment'
    Write-Host '   3. Update frontend environment variables'
    Write-Host '   4. Deploy code to Azure Functions'
    Write-Host ''

    Write-Host 'COMMANDS - Useful Commands:' -ForegroundColor $Yellow
    Write-Host '   View resources:'
    Write-Host "      az resource list --resource-group $resourceGroupName"
    Write-Host ''
    Write-Host '   View Key Vault secrets:'
    $kvCmd = "      az keyvault secret list --vault-name " + $outputs.keyVaultName.value
    Write-Host $kvCmd
    Write-Host ''
    Write-Host '   Delete resource group (cleanup):'
    $deleteCmd = "      az group delete --resource-group " + $resourceGroupName + " --yes"
    Write-Host $deleteCmd
    Write-Host ''

}
catch {
    Write-Host 'ERROR: Deployment failed' -ForegroundColor Red
    Write-Host "Error Message: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "At Line: $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Yellow
    Write-Host "Command: $($_.InvocationInfo.Line.Trim())" -ForegroundColor Yellow
    if ($DiagnosticOutput) {
        Write-Host "Full Error:" -ForegroundColor Yellow
        Write-Host $_ -ForegroundColor Yellow
        Write-Host $_.ScriptStackTrace -ForegroundColor Yellow
    }
    exit 1
}
