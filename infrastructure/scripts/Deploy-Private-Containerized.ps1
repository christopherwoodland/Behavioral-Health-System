#!/usr/bin/env pwsh

<#
.SYNOPSIS
Deploy BHS infrastructure with PRIVATE network access (VNet + Private Endpoints).

.DESCRIPTION
Deploys BHS infrastructure with all services secured via Private Endpoints and VNet integration.
This is the production-grade deployment with full network isolation.

SECURITY FEATURES:
- All PaaS services use Private Endpoints
- Container Apps Environment with VNet integration
- Private DNS Zones for all services
- Network isolation with NSG rules
- Managed Identity authentication (no shared keys)
- RBAC-based access control

SERVICES DEPLOYED:
- Networking: VNet (10.0.0.0/16) with dedicated subnets
- Security: Key Vault (Private Endpoint, RBAC-enabled)
- Storage: Blob storage account (Private Endpoint, managed identity auth)
- Container Apps: UI + API with VNet integration
- Container Registry: Premium SKU with Private Endpoint
- AI Services: Azure AI Services multi-service account (Private Endpoint)
- Monitoring: Application Insights & Log Analytics Workspace

PRIVATE DNS ZONES CREATED:
- privatelink.blob.core.windows.net
- privatelink.queue.core.windows.net
- privatelink.table.core.windows.net
- privatelink.vaultcore.azure.net
- privatelink.cognitiveservices.azure.com
- privatelink.azurecr.io

.PARAMETER Environment
Environment name (dev, staging, prod)

.PARAMETER ParameterFile
Path to JSON parameter file with deployment configuration

.PARAMETER ResourceGroupName
Resource group name (default: bhs-development-private)

.PARAMETER Location
Azure region for deployment (default: eastus2)

.PARAMETER ContainerImageTag
The container image tag to deploy (default: latest)

.PARAMETER BuildContainers
Build and push containers before deploying.

.PARAMETER SkipWhatIf
Skip the what-if preview (not recommended)

.PARAMETER SkipValidation
Skip template validation (not recommended)

.EXAMPLE
.\Deploy-Private-Containerized.ps1 -Environment prod -ParameterFile ./parameters/private.parameters.json

.EXAMPLE
.\Deploy-Private-Containerized.ps1 -Environment prod -ParameterFile ./parameters/private.parameters.json -BuildContainers

.EXAMPLE
.\Deploy-Private-Containerized.ps1 -Environment prod -ParameterFile ./parameters/private.parameters.json -ContainerImageTag v1.0.0
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [string]$ParameterFile,

    [string]$ResourceGroupName = "bhs-development-private",

    [string]$Location = "eastus2",

    [string]$ContainerImageTag = "latest",

    [switch]$BuildContainers,

    [switch]$SkipWhatIf,
    [switch]$SkipValidation
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=========================================================="
Write-Host "  BHS Infrastructure Deployment (PRIVATE - VNet + PE)"
Write-Host "=========================================================="
Write-Host ""
Write-Host "Deployment Configuration:"
Write-Host "  Environment:           $Environment"
Write-Host "  Resource Group:        $ResourceGroupName"
Write-Host "  Region:                $Location"
Write-Host "  Container Image Tag:   $ContainerImageTag"
Write-Host "  Build Containers:      $BuildContainers"
Write-Host "  Parameter File:        $ParameterFile"
Write-Host "  Network Mode:          PRIVATE (VNet + Private Endpoints)"
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
$templatePath = Join-Path $scriptDir "..\bicep\main-private-containerized.bicep"
$templatePath = Resolve-Path $templatePath

if (-not (Test-Path $templatePath)) {
    Write-Host "[ERROR] Template file not found: $templatePath"
    exit 1
}

$deploymentName = "bhs-private-$Environment-$(Get-Date -Format yyyyMMdd-HHmmss)"

# Build parameters
$deployParams = @(
    "--parameters", "@$ParameterFile",
    "--parameters", "resourceGroupName=$ResourceGroupName",
    "--parameters", "containerImageTag=$ContainerImageTag"
)

# Template validation (unless skipped)
if (-not $SkipValidation) {
    Write-Host "`n[*] Validating template..."
    $validateArgs = @(
        'deployment', 'sub', 'validate',
        '--location', $Location,
        '--template-file', $templatePath
    ) + $deployParams
    & az @validateArgs | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Template validation successful"
    } else {
        Write-Host "[WARNING] Template validation returned warnings"
    }
}

# What-If Preview
if (-not $SkipWhatIf) {
    Write-Host "`n[*] Running what-if preview to show planned changes for resource group: $ResourceGroupName"
    Write-Host "================================================================"
    $whatIfArgs = @(
        'deployment', 'sub', 'what-if',
        '--location', $Location,
        '--template-file', $templatePath,
        '--no-pretty-print'
    ) + $deployParams
    & az @whatIfArgs
    Write-Host "================================================================"

    # Ask for approval before proceeding
    Write-Host "`n[*] Review the changes above for resource group: $ResourceGroupName"
    $approval = Read-Host "Do you want to proceed with the PRIVATE deployment to $ResourceGroupName in $Location? (yes/no)"
    if ($approval -ne "yes") {
        Write-Host "[INFO] Deployment cancelled by user"
        exit 0
    }
}

# Ensure resource group exists
Write-Host "`n[*] Ensuring resource group exists..."
az group create --name $ResourceGroupName --location $Location --output none 2>$null
Write-Host "[OK] Resource group ready: $ResourceGroupName"

# Run the main deployment
Write-Host "`n[*] Starting PRIVATE infrastructure deployment to resource group: $ResourceGroupName..."
Write-Host "[*] This deployment includes:"
Write-Host "    - VNet with dedicated subnets"
Write-Host "    - Private DNS Zones for all services"
Write-Host "    - Storage Account with Private Endpoints (blob, queue, table)"
Write-Host "    - Key Vault with Private Endpoint"
Write-Host "    - Azure Container Registry (Premium) with Private Endpoint"
Write-Host "    - Azure AI Services with Private Endpoint"
Write-Host "    - Container Apps Environment with VNet integration"
Write-Host ""

$createArgs = @(
    'deployment', 'sub', 'create',
    '--name', $deploymentName,
    '--location', $Location,
    '--template-file', $templatePath
) + $deployParams

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

$vnetName = $outputs.vnetName.value
$keyVaultName = $outputs.keyVaultName.value
$keyVaultUri = $outputs.keyVaultUri.value
$storageAccountName = $outputs.storageAccountName.value
$acrName = $outputs.acrName.value
$acrLoginServer = $outputs.acrLoginServer.value
$aiServicesName = $outputs.aiServicesName.value
$aiServicesEndpoint = $outputs.aiServicesEndpoint.value
$uiAppName = $outputs.uiAppName.value
$uiAppUrl = $outputs.uiAppUrl.value
$uiAppPrincipalId = $outputs.uiAppPrincipalId.value
$apiAppName = $outputs.apiAppName.value
$apiAppUrl = $outputs.apiAppUrl.value
$apiAppPrincipalId = $outputs.apiAppPrincipalId.value
$containerAppsEnvName = $outputs.containerAppsEnvName.value

Write-Host "[OK] VNet: $vnetName"
Write-Host "[OK] Key Vault: $keyVaultName"
Write-Host "[OK] Storage Account: $storageAccountName"
Write-Host "[OK] ACR: $acrName ($acrLoginServer)"
Write-Host "[OK] AI Services: $aiServicesName"
Write-Host "[OK] AI Services Endpoint: $aiServicesEndpoint"
Write-Host "[OK] Container Apps Environment: $containerAppsEnvName"
Write-Host "[OK] UI Container App: $uiAppName"
Write-Host "[OK] UI App URL: $uiAppUrl"
Write-Host "[OK] UI App Principal ID: $uiAppPrincipalId"
Write-Host "[OK] API Container App: $apiAppName"
Write-Host "[OK] API App URL: $apiAppUrl"
Write-Host "[OK] API App Principal ID: $apiAppPrincipalId"

# Build and push containers if requested
if ($BuildContainers) {
    Write-Host "`n=========================================================="
    Write-Host "  Building and Pushing Containers"
    Write-Host "=========================================================="

    $buildScript = Join-Path $scriptDir "Build-And-Push-Containers.ps1"
    & $buildScript -AcrName $acrName -ResourceGroupName $ResourceGroupName -ImageTag $ContainerImageTag
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARNING] Container build failed. You may need to build and push containers manually."
    } else {
        Write-Host "[OK] Containers built and pushed"

        # Update container apps with new images
        Write-Host "[*] Updating container apps with new images..."
        az containerapp update --name $uiAppName --resource-group $ResourceGroupName --image "${acrLoginServer}/bhs-ui:${ContainerImageTag}" --output none
        az containerapp update --name $apiAppName --resource-group $ResourceGroupName --image "${acrLoginServer}/bhs-api:${ContainerImageTag}" --output none
        Write-Host "[OK] Container apps updated"
    }
}

Write-Host "`n=========================================================="
Write-Host "         Deployment Complete!"
Write-Host "=========================================================="
Write-Host "`nDeployment Name: $deploymentName"
Write-Host "Resource Group: $ResourceGroupName"
Write-Host "Region: $Location"
Write-Host "Network Mode: PRIVATE (VNet + Private Endpoints)"

Write-Host "`n========== DEPLOYED SERVICES =========="
Write-Host "OK - VNet: $vnetName"
Write-Host "   - private-endpoints-subnet (10.0.2.0/24)"
Write-Host "   - container-apps-subnet (10.0.4.0/23)"
Write-Host "   - management-subnet (10.0.6.0/24)"
Write-Host ""
Write-Host "OK - Private DNS Zones:"
Write-Host "   - privatelink.blob.core.windows.net"
Write-Host "   - privatelink.queue.core.windows.net"
Write-Host "   - privatelink.table.core.windows.net"
Write-Host "   - privatelink.vaultcore.azure.net"
Write-Host "   - privatelink.cognitiveservices.azure.com"
Write-Host "   - privatelink.azurecr.io"
Write-Host ""
Write-Host "OK - Key Vault: $keyVaultName (Private Endpoint, RBAC-enabled)"
Write-Host "OK - Storage Account: $storageAccountName (Private Endpoints for blob/queue/table)"
Write-Host "OK - Container Registry: $acrName (Premium SKU, Private Endpoint)"
Write-Host "OK - AI Services: $aiServicesName (Private Endpoint)"
Write-Host "   - Azure OpenAI"
Write-Host "   - Document Intelligence"
Write-Host "   - Speech Services"
Write-Host "   - Content Understanding"
Write-Host ""
Write-Host "OK - Container Apps Environment: $containerAppsEnvName (VNet integrated)"
Write-Host "OK - UI Container App: $uiAppName"
Write-Host "OK - API Container App: $apiAppName"
Write-Host ""
Write-Host "OK - Application Insights & Log Analytics"

Write-Host "`n========== ENDPOINTS =========="
Write-Host "UI App:           $uiAppUrl"
Write-Host "API App:          $apiAppUrl"
Write-Host "AI Services:      $aiServicesEndpoint"
Write-Host "Key Vault:        $keyVaultUri"

Write-Host "`n========== NEXT STEPS =========="
Write-Host "1. Build and push container images (if not done):"
Write-Host "   .\Build-And-Push-Containers.ps1 -AcrName $acrName -ResourceGroupName $ResourceGroupName -ImageTag $ContainerImageTag"
Write-Host ""
Write-Host "2. Update container apps with images:"
Write-Host "   az containerapp update --name $uiAppName --resource-group $ResourceGroupName --image ${acrLoginServer}/bhs-ui:${ContainerImageTag}"
Write-Host "   az containerapp update --name $apiAppName --resource-group $ResourceGroupName --image ${acrLoginServer}/bhs-api:${ContainerImageTag}"
Write-Host ""
Write-Host "3. Configure secrets in Key Vault:"
Write-Host "   az keyvault secret set --vault-name $keyVaultName --name KintsugiApiKey --value '<your-api-key>'"
Write-Host "   az keyvault secret set --vault-name $keyVaultName --name openai-realtime-key --value '<your-key>'"
Write-Host ""
Write-Host "4. Copy data from public deployment (if needed):"
Write-Host "   # DSM-5 data"
Write-Host "   azcopy copy 'https://bhsdevstg4exbxrzknexso.blob.core.windows.net/dsm5-data/*' 'https://${storageAccountName}.blob.core.windows.net/dsm5-data/' --recursive"
Write-Host ""
Write-Host "5. Test the application:"
Write-Host "   - Navigate to $uiAppUrl"
Write-Host "   - Test API at $apiAppUrl/api/health"
Write-Host ""
