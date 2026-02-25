#Requires -Version 5.1
<#
.SYNOPSIS
    Deploys BHS infrastructure integrated with existing landing zone VNets.

.DESCRIPTION
    This script deploys the Behavioral Health System to a new resource group,
    integrating with existing VNets and Private DNS Zones in the landing zone.

.PARAMETER Environment
    The environment to deploy to (dev, staging, prod). Default: dev

.PARAMETER ResourceGroupName
    Name for the BHS resource group. Default: bhs

.PARAMETER SkipRbac
    Skip RBAC role assignments. Default: false

.PARAMETER WhatIf
    Show what would be deployed without actually deploying

.EXAMPLE
    .\deploy-landingzone.ps1 -Environment dev -ResourceGroupName bhs -WhatIf
#>

[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment = 'dev',

    [Parameter()]
    [string]$Location = 'eastus2',

    [Parameter()]
    [string]$ResourceGroupName = 'bhs',

    [Parameter()]
    [string]$LandingZoneResourceGroup = 'rg-demo-network-landing',

    [Parameter()]
    [string]$SharedResourceGroup = 'shared',

    [Parameter()]
    [switch]$SkipRbac,

    [Parameter()]
    [string]$KintsugiApiKey = '',

    [Parameter()]
    [string]$ExistingUniqueSuffix = '',

    [Parameter()]
    [switch]$WhatIf
)

$ErrorActionPreference = 'Stop'
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$bicepPath = Join-Path $scriptPath '..\bicep'

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "BHS Landing Zone Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Environment:     $Environment" -ForegroundColor Yellow
Write-Host "Location:        $Location" -ForegroundColor Yellow
Write-Host "Resource Group:  $ResourceGroupName" -ForegroundColor Yellow
Write-Host "Landing Zone RG: $LandingZoneResourceGroup" -ForegroundColor Yellow
Write-Host "Shared RG:       $SharedResourceGroup" -ForegroundColor Yellow
Write-Host ""

# Check Azure CLI login
Write-Host "Checking Azure CLI login..." -ForegroundColor Gray
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Error "Not logged into Azure CLI. Please run 'az login' first."
    exit 1
}
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green
Write-Host "Subscription: $($account.name) ($($account.id))" -ForegroundColor Green
Write-Host ""

# Validate Landing Zone Resources
Write-Host "Validating landing zone resources..." -ForegroundColor Cyan

# Check VNets exist
$vnets = @('vnet-demo-apps-paarq', 'vnet-ai-spoke-paarq', 'vnet-hub-01-paarq')
foreach ($vnet in $vnets) {
    $exists = az network vnet show --resource-group $LandingZoneResourceGroup --name $vnet 2>$null
    if ($exists) {
        Write-Host "  [OK] VNet $vnet exists" -ForegroundColor Green
    }
    else {
        Write-Error "  [FAIL] VNet $vnet not found in $LandingZoneResourceGroup"
        exit 1
    }
}

# Check Front Door exists
$fdProfile = az afd profile show --resource-group $SharedResourceGroup --profile-name 'shared-fd-eastus2-001' 2>$null | ConvertFrom-Json
if ($fdProfile) {
    Write-Host "  [OK] Front Door shared-fd-eastus2-001 exists (SKU: $($fdProfile.sku.name))" -ForegroundColor Green
    if ($fdProfile.sku.name -ne 'Premium_AzureFrontDoor') {
        Write-Error "Front Door must be Premium SKU for Private Link support"
        exit 1
    }
}
else {
    Write-Error "  [FAIL] Front Door shared-fd-eastus2-001 not found in $SharedResourceGroup"
    exit 1
}

Write-Host ""

# Deploy Bicep Template
Write-Host "Deploying infrastructure..." -ForegroundColor Cyan

$deploymentName = "bhs-landingzone-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$templateFile = Join-Path $bicepPath 'main-landingzone.bicep'
$parametersFile = Join-Path $bicepPath 'parameters\landingzone.parameters.json'

# Build deployment parameters
$deployParams = @(
    '--name', $deploymentName,
    '--location', $Location,
    '--template-file', $templateFile,
    '--parameters', $parametersFile,
    '--parameters', "environment=$Environment",
    '--parameters', "location=$Location",
    '--parameters', "resourceGroupName=$ResourceGroupName"
)

if ($KintsugiApiKey) {
    $deployParams += @('--parameters', "kintsugiApiKey=$KintsugiApiKey")
}

if ($ExistingUniqueSuffix) {
    $deployParams += @('--parameters', "existingUniqueSuffix=$ExistingUniqueSuffix")
}

if ($WhatIf) {
    Write-Host "Running what-if analysis..." -ForegroundColor Yellow
    Write-Host "Command: az deployment sub what-if $($deployParams -join ' ')" -ForegroundColor Gray
    Write-Host ""
    az deployment sub what-if @deployParams
    Write-Host ""
    Write-Host "What-if analysis complete. No changes were made." -ForegroundColor Green
}
else {
    Write-Host "Starting deployment: $deploymentName" -ForegroundColor Yellow
    Write-Host ""

    $result = az deployment sub create @deployParams --output json

    if ($LASTEXITCODE -ne 0) {
        Write-Error "Deployment failed"
        exit 1
    }

    $deployment = $result | ConvertFrom-Json

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "Deployment Successful!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""

    $outputs = $deployment.properties.outputs
    if ($outputs) {
        Write-Host "Outputs:" -ForegroundColor Cyan
        Write-Host "  Resource Group:      $($outputs.resourceGroupName.value)" -ForegroundColor White
        Write-Host "  Storage Account:     $($outputs.storageAccountName.value)" -ForegroundColor White
        Write-Host "  Key Vault:           $($outputs.keyVaultName.value)" -ForegroundColor White
        Write-Host "  ACR:                 $($outputs.acrName.value)" -ForegroundColor White
        Write-Host "  AI Services:         $($outputs.aiServicesName.value)" -ForegroundColor White
        Write-Host "  Front Door Endpoint: $($outputs.frontDoorEndpoint.value)" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "IMPORTANT: Approve Private Link connections in Azure Portal" -ForegroundColor Yellow
    Write-Host "Navigate to Container Apps Environment > Private endpoint connections" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Cyan
