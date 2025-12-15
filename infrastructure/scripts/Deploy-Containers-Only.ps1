<#
.SYNOPSIS
    Builds containers and deploys them to existing Azure Container Apps.

.DESCRIPTION
    This script builds Docker images, pushes them to ACR, and updates existing
    Container Apps with the new images. Use this when your Container Apps
    environment is already deployed and you just need to update the code.

.PARAMETER AcrName
    The name of the Azure Container Registry.

.PARAMETER ResourceGroupName
    The resource group containing the ACR and Container Apps.

.PARAMETER ImageTag
    The tag to use for the images. Defaults to 'latest'.

.PARAMETER UIAppName
    The name of the UI Container App. Defaults to auto-discovery.

.PARAMETER APIAppName
    The name of the API Container App. Defaults to auto-discovery.

.PARAMETER SkipBuild
    Skip building containers and just deploy existing images from ACR.

.PARAMETER UIOnly
    Only build and deploy the UI container.

.PARAMETER APIOnly
    Only build and deploy the API container.

.EXAMPLE
    .\Deploy-Containers-Only.ps1 -AcrName "bhsacr12345" -ResourceGroupName "bhs-prod"

.EXAMPLE
    .\Deploy-Containers-Only.ps1 -AcrName "bhsacr12345" -ResourceGroupName "bhs-prod" -ImageTag "v1.0.1"

.EXAMPLE
    .\Deploy-Containers-Only.ps1 -AcrName "bhsacr12345" -ResourceGroupName "bhs-prod" -UIOnly

.EXAMPLE
    .\Deploy-Containers-Only.ps1 -AcrName "bhsacr12345" -ResourceGroupName "bhs-prod" -SkipBuild -ImageTag "v1.0.0"
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $true)]
    [string]$AcrName,

    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory = $false)]
    [string]$ImageTag = "latest",

    [Parameter(Mandatory = $false)]
    [string]$UIAppName,

    [Parameter(Mandatory = $false)]
    [string]$APIAppName,

    [Parameter(Mandatory = $false)]
    [switch]$SkipBuild,

    [Parameter(Mandatory = $false)]
    [switch]$UIOnly,

    [Parameter(Mandatory = $false)]
    [switch]$APIOnly
)

$ErrorActionPreference = "Stop"

# Set the root directory
$RootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$UIDir = Join-Path $RootDir "BehavioralHealthSystem.Web"
$APIDir = Join-Path $RootDir "BehavioralHealthSystem.Functions"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Container Build & Deploy Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  ACR Name:        $AcrName"
Write-Host "  Resource Group:  $ResourceGroupName"
Write-Host "  Image Tag:       $ImageTag"
Write-Host "  Skip Build:      $SkipBuild"
Write-Host "  UI Only:         $UIOnly"
Write-Host "  API Only:        $APIOnly"
Write-Host ""

# Get ACR login server
Write-Host "[*] Getting ACR login server..." -ForegroundColor Yellow
$AcrLoginServer = az acr show --name $AcrName --resource-group $ResourceGroupName --query "loginServer" -o tsv
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to get ACR login server. Make sure ACR '$AcrName' exists in resource group '$ResourceGroupName'."
    exit 1
}
Write-Host "[OK] ACR Login Server: $AcrLoginServer" -ForegroundColor Green

# Login to ACR
Write-Host "[*] Logging into Azure Container Registry..." -ForegroundColor Yellow
az acr login --name $AcrName
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to login to ACR"
    exit 1
}
Write-Host "[OK] Logged in successfully" -ForegroundColor Green
Write-Host ""

# Auto-discover Container App names if not provided
if (-not $UIAppName -or -not $APIAppName) {
    Write-Host "[*] Discovering Container Apps..." -ForegroundColor Yellow
    $containerApps = az containerapp list --resource-group $ResourceGroupName --query "[].name" -o tsv

    if (-not $UIAppName) {
        $UIAppName = $containerApps | Where-Object { $_ -match "ui|web|frontend" } | Select-Object -First 1
    }
    if (-not $APIAppName) {
        $APIAppName = $containerApps | Where-Object { $_ -match "api|func|backend" } | Select-Object -First 1
    }

    Write-Host "[OK] UI Container App:  $UIAppName" -ForegroundColor Green
    Write-Host "[OK] API Container App: $APIAppName" -ForegroundColor Green
    Write-Host ""
}

$UIImage = "${AcrLoginServer}/bhs-ui:${ImageTag}"
$APIImage = "${AcrLoginServer}/bhs-api:${ImageTag}"

$deployUI = -not $APIOnly
$deployAPI = -not $UIOnly

# ========================================
# BUILD PHASE
# ========================================
if (-not $SkipBuild) {
    if ($deployUI) {
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Building UI Container" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan

        $UIDockerfile = Join-Path $UIDir "Dockerfile.prod"
        if (-not (Test-Path $UIDockerfile)) {
            Write-Error "UI Dockerfile.prod not found at $UIDir"
            exit 1
        }

        Push-Location $UIDir
        try {
            Write-Host "Building Docker image: $UIImage" -ForegroundColor Yellow
            docker build -f Dockerfile.prod -t $UIImage -t "${AcrLoginServer}/bhs-ui:latest" .
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to build UI Docker image"
                exit 1
            }
            Write-Host "[OK] UI image built successfully" -ForegroundColor Green
        }
        finally {
            Pop-Location
        }
        Write-Host ""
    }

    if ($deployAPI) {
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Building API Container" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan

        $APIDockerfile = Join-Path $APIDir "Dockerfile.prod"
        if (-not (Test-Path $APIDockerfile)) {
            Write-Error "API Dockerfile.prod not found at $APIDir"
            exit 1
        }

        Push-Location $RootDir
        try {
            Write-Host "Building Docker image: $APIImage" -ForegroundColor Yellow
            docker build -f BehavioralHealthSystem.Functions/Dockerfile.prod -t $APIImage -t "${AcrLoginServer}/bhs-api:latest" .
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to build API Docker image"
                exit 1
            }
            Write-Host "[OK] API image built successfully" -ForegroundColor Green
        }
        finally {
            Pop-Location
        }
        Write-Host ""
    }

    # ========================================
    # PUSH PHASE
    # ========================================
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Pushing Images to ACR" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    if ($deployUI) {
        Write-Host "Pushing UI image..." -ForegroundColor Yellow
        docker push $UIImage
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to push UI image"
            exit 1
        }
        docker push "${AcrLoginServer}/bhs-ui:latest"
        Write-Host "[OK] UI image pushed" -ForegroundColor Green
    }

    if ($deployAPI) {
        Write-Host "Pushing API image..." -ForegroundColor Yellow
        docker push $APIImage
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to push API image"
            exit 1
        }
        docker push "${AcrLoginServer}/bhs-api:latest"
        Write-Host "[OK] API image pushed" -ForegroundColor Green
    }
    Write-Host ""
}

# ========================================
# DEPLOY PHASE
# ========================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deploying to Container Apps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($deployUI -and $UIAppName) {
    Write-Host "Updating UI Container App: $UIAppName" -ForegroundColor Yellow
    az containerapp update `
        --name $UIAppName `
        --resource-group $ResourceGroupName `
        --image $UIImage
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to update UI Container App"
        exit 1
    }
    Write-Host "[OK] UI Container App updated" -ForegroundColor Green
}

if ($deployAPI -and $APIAppName) {
    Write-Host "Updating API Container App: $APIAppName" -ForegroundColor Yellow
    az containerapp update `
        --name $APIAppName `
        --resource-group $ResourceGroupName `
        --image $APIImage
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to update API Container App"
        exit 1
    }
    Write-Host "[OK] API Container App updated" -ForegroundColor Green
}

Write-Host ""

# ========================================
# SUMMARY
# ========================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($deployUI -and $UIAppName) {
    $uiUrl = az containerapp show --name $UIAppName --resource-group $ResourceGroupName --query "properties.configuration.ingress.fqdn" -o tsv
    Write-Host "UI Application:" -ForegroundColor Green
    Write-Host "  Name:  $UIAppName"
    Write-Host "  Image: $UIImage"
    Write-Host "  URL:   https://$uiUrl"
    Write-Host ""
}

if ($deployAPI -and $APIAppName) {
    $apiUrl = az containerapp show --name $APIAppName --resource-group $ResourceGroupName --query "properties.configuration.ingress.fqdn" -o tsv
    Write-Host "API Application:" -ForegroundColor Green
    Write-Host "  Name:  $APIAppName"
    Write-Host "  Image: $APIImage"
    Write-Host "  URL:   https://$apiUrl"
    Write-Host ""
}

Write-Host "To view logs:" -ForegroundColor Yellow
Write-Host "  az containerapp logs show --name $UIAppName --resource-group $ResourceGroupName --follow"
Write-Host "  az containerapp logs show --name $APIAppName --resource-group $ResourceGroupName --follow"
