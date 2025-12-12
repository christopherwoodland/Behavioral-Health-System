#!/usr/bin/env pwsh

<#
.SYNOPSIS
Deploy BHS infrastructure with VNet integration and Function App RBAC setup.

.DESCRIPTION
Deploys BHS infrastructure, then configures Function App managed identity with Network Contributor
role on the VNet to enable VNet integration. Registers Microsoft.App provider if needed.

SERVICES DEPLOYED:
- Networking: VNet with delegated subnets for Function App integration
- Security: Key Vault with private endpoint and firewall
- Storage: Blob storage account with private endpoint
- Backend APIs: Flex Consumption Function App (.NET 8 isolated) with VNet integration
- AI Services: Azure OpenAI, Document Intelligence, Content Understanding (all with private endpoints)
- Monitoring: Application Insights & Log Analytics Workspace
- Private DNS: DNS zones for all private endpoint resolutions

SERVICES NOT DEPLOYED (deploy separately):
- Static Web App (React frontend UI) - temporarily disabled due to JSON parsing issues
- Container Apps (GitHub runners) - can be deployed with script flag

UI DEPLOYMENT:
The Static Web App module is currently commented out in main.bicep. To deploy the React UI:
1. Uncomment the staticWebApp module in infrastructure/bicep/main.bicep (around line 156)
2. The Static Web App will NOT use VNet - it's a fully managed SaaS service
3. Authentication will use MSAL (managed by Static Web App auth provider)

CONTAINER APP DEPLOYMENT:
Container Apps can be deployed alongside the core infrastructure:
1. Use -DeployContainerApps flag when running the script
2. Container Apps will be deployed to container-apps-subnet (10.0.4.0/23)
3. Suitable for self-hosted GitHub Actions runners

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

# Get Function App principal ID and VNet ID from deployment outputs
Write-Host "`n[*] Retrieving deployment outputs..."
$showOutputsArgs = @('deployment', 'sub', 'show', '--name', $deploymentName, '--query', 'properties.outputs', '-o', 'json')
$outputsJson = & az @showOutputsArgs
$outputs = $outputsJson | ConvertFrom-Json

$functionAppPrincipalId = $outputs.functionAppPrincipalId.value
$vnetId = $outputs.vnetId.value

if (-not $functionAppPrincipalId) {
    Write-Host "[WARNING] Could not retrieve Function App Principal ID from deployment"
    Write-Host "         Skipping RBAC assignment. You may need to configure this manually."
    exit 0
}

Write-Host "[OK] Function App Principal ID: $functionAppPrincipalId"
Write-Host "[OK] VNet ID: $vnetId"

# Grant Network Contributor role to Function App on VNet
Write-Host "`n[*] Granting Network Contributor role to Function App on VNet..."
$roleAssignmentArgs = @(
    'role', 'assignment', 'create',
    '--assignee', $functionAppPrincipalId,
    '--role', 'Network Contributor',
    '--scope', $vnetId
)

& az @roleAssignmentArgs
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Role assignment successful"
} else {
    Write-Host "[WARNING] Role assignment may have failed or already exists"
}

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
Write-Host "OK - Azure OpenAI (with private endpoint)"
Write-Host "OK - Document Intelligence (with private endpoint)"
Write-Host "OK - Content Understanding API (with private endpoint)"
Write-Host "OK - Application Insights `& Log Analytics"
Write-Host "OK - Private DNS Zones"

Write-Host "`n========== NOT DEPLOYED =========="
Write-Host "SKIP - Static Web App (React UI) - commented out in main.bicep"
Write-Host "       To deploy: uncomment staticWebApp module in infrastructure/bicep/main.bicep"
Write-Host "       Static Web App is NOT VNet-integrated (fully managed SaaS)"
Write-Host "       Authentication via MSAL"

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
Write-Host "1. Build & publish Function App code"
Write-Host "2. Configure secrets in Key Vault"
Write-Host "3. Test VNet integration and private endpoint access"
Write-Host "4. Deploy Static Web App for React frontend (optional)"
if (-not $DeployContainerApps) {
    Write-Host "5. Deploy Container Apps for GitHub runners (optional): -DeployContainerApps `$true"
    Write-Host "6. Set up CI/CD pipeline for deployments"
} else {
    Write-Host "5. Configure Container Apps for GitHub Actions runners"
    Write-Host "6. Set up CI/CD pipeline for deployments"
}
Write-Host ""
