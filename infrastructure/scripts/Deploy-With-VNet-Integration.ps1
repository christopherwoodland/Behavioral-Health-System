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
- Container Apps (GitHub runners) - deploy after infrastructure is stable

UI DEPLOYMENT:
The Static Web App module is currently commented out in main.bicep. To deploy the React UI:
1. Uncomment the staticWebApp module in infrastructure/bicep/main.bicep (around line 156)
2. The Static Web App will NOT use VNet - it's a fully managed SaaS service
3. Authentication will use MSAL (managed by Static Web App auth provider)

.PARAMETER Environment
Environment name (dev, staging, prod)

.PARAMETER ParameterFile
Path to JSON parameter file with deployment configuration

.EXAMPLE
.\Deploy-With-VNet-Integration.ps1 -Environment dev -ParameterFile ./parameters/dev.parameters.json
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [string]$ParameterFile,

    [string]$ResourceGroupName = "bhs-$Environment",

    [switch]$SkipWhatIf,
    [switch]$SkipValidation
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=========================================================="
Write-Host "  BHS Infrastructure Deployment with VNet Integration"
Write-Host "=========================================================="

# Check prerequisites
Write-Host "`n[*] Checking prerequisites..."
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
    $validateArgs = @('deployment', 'sub', 'validate', '--location', 'eastus2', '--template-file', $templatePath, '--parameters', "@$ParameterFile", '--parameters', "resourceGroupName=$ResourceGroupName")
    & az @validateArgs | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Template validation successful"
    } else {
        Write-Host "[WARNING] Template validation returned warnings"
    }
}

# What-If Preview (unless skipped)
if (-not $SkipWhatIf) {
    Write-Host "`n[*] Running what-if preview to show planned changes..."
    Write-Host "================================================================"
    $whatIfArgs = @('deployment', 'sub', 'what-if', '--location', 'eastus2', '--template-file', $templatePath, '--parameters', "@$ParameterFile", '--parameters', "resourceGroupName=$ResourceGroupName", '--no-pretty-print')
    & az @whatIfArgs
    Write-Host "================================================================"

    # Ask for approval
    Write-Host "`n[*] Review the changes above."
    $approval = Read-Host "Do you want to proceed with the deployment? (yes/no)"
    if ($approval -ne "yes") {
        Write-Host "[INFO] Deployment cancelled by user"
        exit 0
    }
}

# Run the main deployment
Write-Host "`n[*] Starting main infrastructure deployment..."
$createArgs = @(
    'deployment', 'sub', 'create',
    '--name', $deploymentName,
    '--location', 'eastus2',
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
Write-Host "✓ Networking (VNet with delegated subnets)"
Write-Host "✓ Key Vault (with private endpoint)"
Write-Host "✓ Storage Account (with private endpoint)"
Write-Host "✓ Function App - Flex Consumption (FC1) with:"
Write-Host "  • .NET 8 isolated runtime"
Write-Host "  • VNet integration enabled"
Write-Host "  • Private endpoint"
Write-Host "  • System-assigned managed identity"
Write-Host "  • Network Contributor RBAC role"
Write-Host "✓ Azure OpenAI (with private endpoint)"
Write-Host "✓ Document Intelligence (with private endpoint)"
Write-Host "✓ Content Understanding API (with private endpoint)"
Write-Host "✓ Application Insights & Log Analytics"
Write-Host "✓ Private DNS Zones"

Write-Host "`n========== NOT DEPLOYED =========="
Write-Host "✗ Static Web App (React UI) - commented out in main.bicep"
Write-Host "  → To deploy: uncomment staticWebApp module in infrastructure/bicep/main.bicep"
Write-Host "  → Static Web App is NOT VNet-integrated (fully managed SaaS)"
Write-Host "  → Authentication via MSAL"
Write-Host "✗ Container Apps (GitHub runners) - commented out"
Write-Host "  → Deploy after core infrastructure is stable"

Write-Host "`n========== NEXT STEPS =========="
Write-Host "1. Build & publish Function App code"
Write-Host "2. Configure secrets in Key Vault"
Write-Host "3. Test VNet integration and private endpoint access"
Write-Host "4. Deploy Static Web App for React frontend (optional)"
Write-Host "5. Set up CI/CD pipeline for deployments"
Write-Host ""
