#!/usr/bin/env pwsh

<#
.SYNOPSIS
Deploy BHS infrastructure with VNet integration and Function App RBAC setup.

.DESCRIPTION
Deploys BHS infrastructure, then configures Function App managed identity with Network Contributor
role on the VNet to enable VNet integration. Registers Microsoft.App provider if needed.

SERVICES DEPLOYED:
- Networking: VNet with delegated subnets for Function App and Web App integration
- Security: Key Vault with private endpoint and firewall
- Storage: Blob storage account with private endpoint
- Backend APIs: Flex Consumption Function App (.NET 8 isolated) with VNet integration
- Frontend UI: App Service (Linux Node.js 20) for React with VNet integration
- AI Services: Azure OpenAI, Document Intelligence, Content Understanding (all with private endpoints)
- Monitoring: Application Insights & Log Analytics Workspace
- Private DNS: DNS zones for all private endpoint resolutions

SERVICES NOT DEPLOYED (deploy separately):
- Container Apps (GitHub runners) - can be deployed with script flag

.PARAMETER Environment
Environment name (dev, staging, prod)

.PARAMETER ParameterFile
Path to JSON parameter file with deployment configuration

.PARAMETER DeploymentClientIP
Your public IP address in CIDR format (e.g., 1.2.3.4/32) for Key Vault firewall.
If not provided, the script will auto-detect your public IP.

.PARAMETER DeployContainerApps
Deploy Container Apps alongside the core infrastructure (for GitHub runners).
Default is $false. Set to $true to enable Container Apps deployment.

.EXAMPLE
.\Deploy-With-VNet-Integration.ps1 -Environment dev -ParameterFile ./parameters/dev.parameters.json

.EXAMPLE
.\Deploy-With-VNet-Integration.ps1 -Environment dev -ParameterFile ./parameters/dev.parameters.json -DeploymentClientIP "1.2.3.4/32"

.EXAMPLE
.\Deploy-With-VNet-Integration.ps1 -Environment dev -ParameterFile ./parameters/dev.parameters.json -DeployContainerApps $true
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [string]$ParameterFile,

    [string]$ResourceGroupName = "bhs-$Environment",

    [string]$DeploymentClientIP = "",

    [bool]$DeployContainerApps = $false,

    [switch]$SkipWhatIf,
    [switch]$SkipValidation
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=========================================================="
Write-Host "  BHS Infrastructure Deployment with VNet Integration"
Write-Host "=========================================================="
Write-Host ""
Write-Host "Deployment Configuration:"
Write-Host "  Environment:           $Environment"
Write-Host "  Resource Group:        $ResourceGroupName"
Write-Host "  Region:                eastus2"
Write-Host "  Parameter File:        $ParameterFile"
Write-Host "  Container Apps:        $(if ($DeployContainerApps) { 'ENABLED' } else { 'DISABLED' })"
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

# Auto-detect or validate deployment client IP
if ([string]::IsNullOrEmpty($DeploymentClientIP)) {
    Write-Host "`n[*] Auto-detecting your public IP address..."
    try {
        $ipResponse = Invoke-RestMethod -Uri 'https://api.ipify.org?format=json' -UseBasicParsing -TimeoutSec 10
        $DeploymentClientIP = "$($ipResponse.ip)/32"
        Write-Host "[OK] Detected IP: $DeploymentClientIP"
    } catch {
        Write-Host "[ERROR] Failed to auto-detect IP address. Please provide -DeploymentClientIP parameter."
        Write-Host "        Example: -DeploymentClientIP '1.2.3.4' or -DeploymentClientIP '1.2.3.4/32'"
        exit 1
    }
} else {
    Write-Host "`n[*] Using provided deployment client IP: $DeploymentClientIP"
    # Add /32 suffix if only IP address was provided
    if ($DeploymentClientIP -notmatch '/') {
        $DeploymentClientIP = "$DeploymentClientIP/32"
        Write-Host "[OK] Added /32 CIDR suffix: $DeploymentClientIP"
    }
    # Validate CIDR format
    if ($DeploymentClientIP -notmatch '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2}$') {
        Write-Host "[ERROR] Invalid IP address format. Expected format: 1.2.3.4 or 1.2.3.4/32"
        exit 1
    }
}

# Register Microsoft.App provider
Write-Host "`n[*] Registering Microsoft.App provider..."
az provider register --namespace Microsoft.App
Write-Host "[OK] Microsoft.App provider registration initiated"

# Wait for provider to be registered
Write-Host "[*] Waiting for Microsoft.App provider to be ready..."
$maxWait = 0
while ($maxWait -lt 60) {
    $state = az provider show --namespace Microsoft.App --query "registrationState" -o tsv
    if ($state -eq "Registered") {
        Write-Host "[OK] Microsoft.App provider is registered"
        break
    }
    Start-Sleep -Seconds 5
    $maxWait += 5
}

if ($state -ne "Registered") {
    Write-Host "[WARNING] Microsoft.App provider registration may still be pending. Proceeding anyway..."
}

# Construct template and deployment paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$templatePath = Join-Path $scriptDir "..\bicep\main.bicep"
$templatePath = Resolve-Path $templatePath

if (-not (Test-Path $templatePath)) {
    Write-Host "[ERROR] Template file not found: $templatePath"
    exit 1
}

$deploymentName = "bhs-$Environment-$(Get-Date -Format yyyyMMdd-HHmmss)"

# Template validation (unless skipped)
if (-not $SkipValidation) {
    Write-Host "`n[*] Validating template..."
    $validateArgs = @('deployment', 'sub', 'validate', '--location', 'eastus2', '--template-file', $templatePath, '--parameters', "@$ParameterFile", '--parameters', "resourceGroupName=$ResourceGroupName", '--parameters', "deploymentClientIP=$DeploymentClientIP", '--parameters', "deployContainerApps=$DeployContainerApps")
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
$whatIfArgs = @('deployment', 'sub', 'what-if', '--location', 'eastus2', '--template-file', $templatePath, '--parameters', "@$ParameterFile", '--parameters', "resourceGroupName=$ResourceGroupName", '--parameters', "deploymentClientIP=$DeploymentClientIP", '--parameters', "deployContainerApps=$DeployContainerApps", '--no-pretty-print')
& az @whatIfArgs
Write-Host "================================================================"

# Ask for approval before proceeding
Write-Host "`n[*] Review the changes above for resource group: $ResourceGroupName"
$approval = Read-Host "Do you want to proceed with the deployment to $ResourceGroupName in eastus2? (yes/no)"
if ($approval -ne "yes") {
    Write-Host "[INFO] Deployment cancelled by user"
    exit 0
}

# Run the main deployment
Write-Host "`n[*] Starting main infrastructure deployment to resource group: $ResourceGroupName..."
$createArgs = @(
    'deployment', 'sub', 'create',
    '--name', $deploymentName,
    '--location', 'eastus2',
    '--template-file', $templatePath,
    '--parameters', "@$ParameterFile",
    '--parameters', "resourceGroupName=$ResourceGroupName",
    '--parameters', "deploymentClientIP=$DeploymentClientIP",
    '--parameters', "deployContainerApps=$DeployContainerApps"
)

& az @createArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Deployment failed"
    exit 1
}

Write-Host "[OK] Deployment completed successfully"

# Get deployment outputs
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
$vnetId = $outputs.vnetId.value
$keyVaultName = $outputs.keyVaultName.value
$storageAccountName = $outputs.storageAccountName.value
$documentIntelligenceName = $outputs.documentIntelligenceName.value
$contentUnderstandingName = $outputs.contentUnderstandingName.value

Write-Host "[OK] Function App: $functionAppName"
Write-Host "[OK] Function App URL: $functionAppUrl"
Write-Host "[OK] Function App Principal ID: $functionAppPrincipalId"
Write-Host "[OK] Web App: $webAppName"
Write-Host "[OK] Web App URL: $webAppUrl"
Write-Host "[OK] Web App Principal ID: $webAppPrincipalId"
Write-Host "[OK] VNet ID: $vnetId"
Write-Host "[OK] Key Vault: $keyVaultName"
Write-Host "[OK] Storage Account: $storageAccountName"
Write-Host "[OK] Document Intelligence: $documentIntelligenceName"
Write-Host "[OK] Content Understanding: $contentUnderstandingName"

# ============================================
# POST-DEPLOYMENT RBAC CONFIGURATION
# ============================================
Write-Host "`n=========================================================="
Write-Host "  Configuring Additional RBAC Permissions"
Write-Host "=========================================================="

# Role definition IDs
$networkContributorRoleId = "4d97b98b-1d4f-4787-a291-c67834d212e7"
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
$docIntelAccountId = az cognitiveservices account show --name $documentIntelligenceName --resource-group $ResourceGroupName --query id -o tsv 2>$null
$contentAccountId = az cognitiveservices account show --name $contentUnderstandingName --resource-group $ResourceGroupName --query id -o tsv 2>$null

# Grant Network Contributor role to Function App on VNet (required for VNet integration)
if ($functionAppPrincipalId -and $vnetId) {
    Set-RoleAssignment -PrincipalId $functionAppPrincipalId -RoleId $networkContributorRoleId -Scope $vnetId -Description "Network Contributor to Function App for VNet"
}

# Grant Network Contributor role to Web App on VNet (required for VNet integration)
if ($webAppPrincipalId -and $vnetId) {
    Set-RoleAssignment -PrincipalId $webAppPrincipalId -RoleId $networkContributorRoleId -Scope $vnetId -Description "Network Contributor to Web App for VNet"
}

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

Write-Host "`n========== DEPLOYED SERVICES =========="
Write-Host "OK - Networking (VNet with delegated subnets)"
Write-Host "OK - Key Vault (with private endpoint)"
Write-Host "OK - Storage Account (with private endpoint)"
Write-Host "OK - Function App - Flex Consumption (FC1) with:"
Write-Host "     - .NET 8 isolated runtime"
Write-Host "     - VNet integration enabled"
Write-Host "     - Private endpoint"
Write-Host "     - System-assigned managed identity"
Write-Host "     - Network Contributor RBAC role"
Write-Host "OK - Web App (App Service) for React UI with:"
Write-Host "     - Linux Node.js 20 runtime"
Write-Host "     - VNet integration enabled"
Write-Host "     - MSAL authentication configured"
Write-Host "     - CORS configured for API access"
Write-Host "OK - Document Intelligence (with private endpoint)"
Write-Host "OK - Content Understanding API (with private endpoint)"
Write-Host "OK - Application Insights & Log Analytics"
Write-Host "OK - Private DNS Zones"

Write-Host "`n========== MANUAL DEPLOYMENT REQUIRED =========="
Write-Host "MANUAL - Azure OpenAI / AI Foundry Hub (deploy separately)"

Write-Host "`n========== NOT DEPLOYED =========="

if ($DeployContainerApps) {
    Write-Host "OK - Container Apps (GitHub runners) - deployed"
    Write-Host "     Location: container-apps-subnet (10.0.4.0/23)"
    Write-Host "     Purpose: Self-hosted GitHub Actions runners"
} else {
    Write-Host "SKIP - Container Apps (GitHub runners) - commented out"
    Write-Host "       To deploy: use -DeployContainerApps `$true flag"
    Write-Host "       Suitable for self-hosted GitHub Actions runners"
}

Write-Host "`n========== NEXT STEPS =========="
Write-Host "1. Deploy Azure OpenAI / AI Foundry Hub manually:"
Write-Host "   - Create Azure OpenAI or AI Foundry Hub resource"
Write-Host "   - Deploy gpt-4.1 model"
Write-Host "   - Deploy gpt-realtime model (if needed)"
Write-Host "   - Update Function App settings with AZURE_OPENAI_ENDPOINT"
Write-Host "   - Assign Cognitive Services OpenAI User role to Function App"
Write-Host "2. Build & publish Function App code"
Write-Host "3. Build & deploy React UI to Web App:"
Write-Host "   cd BehavioralHealthSystem.Web"
Write-Host "   npm run build"
Write-Host "   az webapp deploy --resource-group $ResourceGroupName --name <web-app-name> --src-path ./dist"
Write-Host "4. Configure secrets in Key Vault"
Write-Host "5. Test VNet integration and private endpoint access"
if (-not $DeployContainerApps) {
    Write-Host "5. Deploy Container Apps for GitHub runners (optional): -DeployContainerApps `$true"
    Write-Host "6. Set up CI/CD pipeline for deployments"
} else {
    Write-Host "5. Configure Container Apps for GitHub Actions runners"
    Write-Host "6. Set up CI/CD pipeline for deployments"
}
Write-Host ""
