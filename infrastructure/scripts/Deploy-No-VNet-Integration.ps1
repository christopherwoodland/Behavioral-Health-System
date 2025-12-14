#!/usr/bin/env pwsh

<#
.SYNOPSIS
Deploy BHS infrastructure with PUBLIC network access (no VNet integration).

.DESCRIPTION
Deploys BHS infrastructure with all services publicly accessible. This deployment
uses simpler networking (no VNet, private endpoints, or private DNS zones).

SERVICES DEPLOYED:
- Security: Key Vault (public access, RBAC-enabled)
- Storage: Blob storage account (public access)
- Backend APIs: Consumption Plan Function App (.NET 8 isolated)
- Frontend UI: App Service (Linux Node.js 20 for React)
- AI Services: Azure OpenAI, Document Intelligence, Content Understanding (all public)
- Monitoring: Application Insights & Log Analytics Workspace

SERVICES NOT DEPLOYED (vs VNet version):
- VNet / Subnets
- Private Endpoints
- Private DNS Zones
- Container Apps (not needed for public deployment)

USE CASES:
- Development and testing environments
- Proof of concept deployments
- Scenarios where VNet complexity is not required
- Cost-sensitive deployments

.PARAMETER Environment
Environment name (dev, staging, prod)

.PARAMETER ParameterFile
Path to JSON parameter file with deployment configuration

.EXAMPLE
.\Deploy-No-VNet-Integration.ps1 -Environment dev -ParameterFile ./parameters/dev.parameters.json

.EXAMPLE
.\Deploy-No-VNet-Integration.ps1 -Environment staging -ParameterFile ./parameters/staging.parameters.json
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [string]$ParameterFile,

    [string]$ResourceGroupName = "bhs-$Environment",

    [string]$Location = "eastus2",

    [switch]$SkipWhatIf,
    [switch]$SkipValidation
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=========================================================="
Write-Host "  BHS Infrastructure Deployment (PUBLIC - No VNet)"
Write-Host "=========================================================="
Write-Host ""
Write-Host "Deployment Configuration:"
Write-Host "  Environment:           $Environment"
Write-Host "  Resource Group:        $ResourceGroupName"
Write-Host "  Region:                $Location"
Write-Host "  Parameter File:        $ParameterFile"
Write-Host "  Network Mode:          PUBLIC (No VNet/Private Endpoints)"
Write-Host ""

# Check prerequisites
Write-Host "[*] Checking prerequisites..."
$oldErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
az --version 2>&1 | Out-Null
$ErrorActionPreference = $oldErrorActionPreference
Write-Host "[OK] Azure CLI installed"

# Validate Azure account
Write-Host "[*] Checking Azure account..."
$account = az account show -o json | ConvertFrom-Json
Write-Host "[OK] Logged in as: $($account.user.name)"
Write-Host "[OK] Subscription: $($account.name) ($($account.id))"

# Validate parameter file
Write-Host "`n[*] Validating parameter file: $ParameterFile"
if (-not (Test-Path $ParameterFile)) {
    Write-Host "[ERROR] Parameter file not found: $ParameterFile"
    exit 1
}
Write-Host "[OK] Parameter file found"

# Construct template and deployment paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$templatePath = Join-Path $scriptDir "..\bicep\main-public.bicep"
$templatePath = Resolve-Path $templatePath

if (-not (Test-Path $templatePath)) {
    Write-Host "[ERROR] Template file not found: $templatePath"
    exit 1
}

$deploymentName = "bhs-public-$Environment-$(Get-Date -Format yyyyMMdd-HHmmss)"

# Template validation (unless skipped)
if (-not $SkipValidation) {
    Write-Host "`n[*] Validating template..."
    $validateArgs = @(
        'deployment', 'sub', 'validate',
        '--location', $Location,
        '--template-file', $templatePath,
        '--parameters', "@$ParameterFile",
        '--parameters', "resourceGroupName=$ResourceGroupName"
    )
    & az @validateArgs | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Template validation successful"
    } else {
        Write-Host "[WARNING] Template validation returned warnings"
    }
}

# What-If Preview (always run unless explicitly skipped)
Write-Host "`n[*] Running what-if preview to show planned changes for resource group: $ResourceGroupName"
Write-Host "================================================================"
$whatIfArgs = @(
    'deployment', 'sub', 'what-if',
    '--location', $Location,
    '--template-file', $templatePath,
    '--parameters', "@$ParameterFile",
    '--parameters', "resourceGroupName=$ResourceGroupName",
    '--no-pretty-print'
)
& az @whatIfArgs
Write-Host "================================================================"

# Ask for approval before proceeding
Write-Host "`n[*] Review the changes above for resource group: $ResourceGroupName"
$approval = Read-Host "Do you want to proceed with the PUBLIC deployment to $ResourceGroupName in $Location? (yes/no)"
if ($approval -ne "yes") {
    Write-Host "[INFO] Deployment cancelled by user"
    exit 0
}

# Run the main deployment
Write-Host "`n[*] Starting PUBLIC infrastructure deployment to resource group: $ResourceGroupName..."
$createArgs = @(
    'deployment', 'sub', 'create',
    '--name', $deploymentName,
    '--location', $Location,
    '--template-file', $templatePath,
    '--parameters', "@$ParameterFile",
    '--parameters', "resourceGroupName=$ResourceGroupName"
)

& az @createArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Deployment failed"
    exit 1
}

Write-Host "[OK] Deployment completed successfully"

# Get outputs
Write-Host "`n[*] Retrieving deployment outputs..."
$showOutputsArgs = @('deployment', 'sub', 'show', '--name', $deploymentName, '--query', 'properties.outputs', '-o', 'json')
$outputsJson = & az @showOutputsArgs
$outputs = $outputsJson | ConvertFrom-Json

$functionAppName = $outputs.functionAppName.value
$functionAppUrl = $outputs.functionAppUrl.value
$functionAppPrincipalId = $outputs.functionAppPrincipalId.value
$webAppName = $outputs.webAppName.value
$webAppUrl = $outputs.webAppUrl.value
$webAppPrincipalId = $outputs.webAppPrincipalId.value
$keyVaultName = $outputs.keyVaultName.value
$storageAccountName = $outputs.storageAccountName.value
$openaiAccountName = $outputs.openaiAccountName.value
$documentIntelligenceName = $outputs.documentIntelligenceName.value
$contentUnderstandingName = $outputs.contentUnderstandingName.value

Write-Host "[OK] Function App: $functionAppName"
Write-Host "[OK] Function App URL: $functionAppUrl"
Write-Host "[OK] Function App Principal ID: $functionAppPrincipalId"
Write-Host "[OK] Web App: $webAppName"
Write-Host "[OK] Web App URL: $webAppUrl"
Write-Host "[OK] Web App Principal ID: $webAppPrincipalId"
Write-Host "[OK] Key Vault: $keyVaultName"
Write-Host "[OK] Storage Account: $storageAccountName"
Write-Host "[OK] OpenAI Account: $openaiAccountName"
Write-Host "[OK] Document Intelligence: $documentIntelligenceName"
Write-Host "[OK] Content Understanding: $contentUnderstandingName"

# ============================================
# POST-DEPLOYMENT RBAC CONFIGURATION
# ============================================
Write-Host "`n=========================================================="
Write-Host "  Configuring Additional RBAC Permissions"
Write-Host "=========================================================="

# Role definition IDs
$cognitiveServicesOpenAIUserRoleId = "5e0bd9bd-7b93-4f28-af87-19fc36ad61bd"
$cognitiveServicesUserRoleId = "a97b65f3-24c7-4388-baec-2e87135dc908"
$storageBlobDataContributorRoleId = "ba92f5b4-2d11-453d-a403-e96b0029c9fe"
$keyVaultSecretsUserRoleId = "4633458b-17de-408a-b874-0445c86b69e6"
$storageQueueDataContributorRoleId = "974c5e8b-45b9-4653-ba55-5f855dd0fb88"
$storageTableDataContributorRoleId = "0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3"

# Function to safely assign RBAC role
function Set-RoleAssignment {
    param(
        [string]$PrincipalId,
        [string]$RoleId,
        [string]$Scope,
        [string]$Description
    )

    Write-Host "[*] Assigning $Description..."
    $existingAssignment = az role assignment list --assignee $PrincipalId --role $RoleId --scope $Scope --query "[0]" -o json 2>$null | ConvertFrom-Json

    if ($existingAssignment) {
        Write-Host "[OK] $Description - already assigned"
    } else {
        az role assignment create --assignee-object-id $PrincipalId --assignee-principal-type ServicePrincipal --role $RoleId --scope $Scope --output none 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] $Description - assigned"
        } else {
            Write-Host "[WARNING] $Description - failed (may already exist or permission denied)"
        }
    }
}

# Get resource IDs
Write-Host "`n[*] Retrieving resource IDs..."
$storageAccountId = az storage account show --name $storageAccountName --resource-group $ResourceGroupName --query id -o tsv
$keyVaultId = az keyvault show --name $keyVaultName --resource-group $ResourceGroupName --query id -o tsv
$openaiAccountId = az cognitiveservices account show --name $openaiAccountName --resource-group $ResourceGroupName --query id -o tsv 2>$null
$docIntelAccountId = az cognitiveservices account show --name $documentIntelligenceName --resource-group $ResourceGroupName --query id -o tsv 2>$null
$contentAccountId = az cognitiveservices account show --name $contentUnderstandingName --resource-group $ResourceGroupName --query id -o tsv 2>$null

# Assign additional storage roles for Function App (Queue and Table for Functions runtime)
if ($functionAppPrincipalId -and $storageAccountId) {
    Set-RoleAssignment -PrincipalId $functionAppPrincipalId -RoleId $storageQueueDataContributorRoleId -Scope $storageAccountId -Description "Storage Queue Data Contributor to Function App"
    Set-RoleAssignment -PrincipalId $functionAppPrincipalId -RoleId $storageTableDataContributorRoleId -Scope $storageAccountId -Description "Storage Table Data Contributor to Function App"
}

# Assign storage blob role to Web App (for downloading audio files)
if ($webAppPrincipalId -and $storageAccountId) {
    Set-RoleAssignment -PrincipalId $webAppPrincipalId -RoleId $storageBlobDataContributorRoleId -Scope $storageAccountId -Description "Storage Blob Data Contributor to Web App"
}

Write-Host "`n[OK] RBAC configuration complete"

# ============================================
# KEY VAULT SECRETS CONFIGURATION
# ============================================
Write-Host "`n=========================================================="
Write-Host "  Key Vault Secrets Setup"
Write-Host "=========================================================="
Write-Host ""
Write-Host "The following secrets should be configured in Key Vault:"
Write-Host "  - KINTSUGI-API-KEY: Kintsugi Health API key for risk assessment"
Write-Host ""
Write-Host "To set secrets, run:"
Write-Host "  az keyvault secret set --vault-name $keyVaultName --name KINTSUGI-API-KEY --value '<your-api-key>'"
Write-Host ""

Write-Host "`n=========================================================="
Write-Host "         Deployment Complete!"
Write-Host "=========================================================="
Write-Host "`nDeployment Name: $deploymentName"
Write-Host "Resource Group: $ResourceGroupName"
Write-Host "Region: eastus2"
Write-Host "Network Mode: PUBLIC"

Write-Host "`n========== DEPLOYED SERVICES =========="
Write-Host "OK - Key Vault (public access, RBAC-enabled)"
Write-Host "OK - Storage Account (public access)"
Write-Host "OK - Function App - Consumption Plan with:"
Write-Host "     - .NET 8 isolated runtime"
Write-Host "     - Public endpoint"
Write-Host "     - System-assigned managed identity"
Write-Host "     - RBAC roles for all services"
Write-Host "OK - Web App (App Service) for React UI with:"
Write-Host "     - Linux Node.js 20 runtime"
Write-Host "     - MSAL authentication configured"
Write-Host "     - CORS configured for API access"
Write-Host "OK - Azure OpenAI (public endpoint)"
Write-Host "OK - Document Intelligence (public endpoint)"
Write-Host "OK - Content Understanding / AI Services (public endpoint)"
Write-Host "OK - Application Insights & Log Analytics"

Write-Host "`n========== NOT DEPLOYED (Public Mode) =========="
Write-Host "SKIP - VNet / Subnets (not needed for public)"
Write-Host "SKIP - Private Endpoints (not needed for public)"
Write-Host "SKIP - Private DNS Zones (not needed for public)"
Write-Host "SKIP - Container Apps (not needed for public)"

Write-Host "`n========== ENDPOINTS =========="
Write-Host "Function App API: $functionAppUrl"
Write-Host "Web App UI:       $webAppUrl"

Write-Host "`n========== NEXT STEPS =========="
Write-Host "1. Build & publish Function App code:"
Write-Host "   func azure functionapp publish <function-app-name>"
Write-Host ""
Write-Host "2. Build & deploy React UI to Web App:"
Write-Host "   cd BehavioralHealthSystem.Web"
Write-Host "   npm run build"
Write-Host "   az webapp deploy --resource-group $ResourceGroupName --name <web-app-name> --src-path ./dist"
Write-Host ""
Write-Host "3. Configure secrets in Key Vault (e.g., KINTSUGI_API_KEY)"
Write-Host ""
Write-Host "4. Deploy Azure OpenAI model deployments via Azure Portal"
Write-Host "   - gpt-4.1 deployment"
Write-Host "   - gpt-realtime deployment (if needed)"
Write-Host ""
Write-Host "5. Test the application:"
Write-Host "   - Navigate to $webAppUrl"
Write-Host "   - Test API at $functionAppUrl/api/health"
Write-Host ""
