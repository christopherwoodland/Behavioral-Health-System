#Requires -Version 5.1
<#
.SYNOPSIS
    Build and push Docker containers to Azure Container Registry.

.DESCRIPTION
    This script builds the UI and API Docker images locally and pushes them
    to the Azure Container Registry for deployment to Container Apps.

.PARAMETER AcrName
    The name of the Azure Container Registry. Defaults to bhsdevelopmentacr4znv2wxlxs4xq.

.PARAMETER Tag
    The image tag to use. Defaults to 'latest'.

.PARAMETER SkipUI
    Skip building the UI image.

.PARAMETER SkipAPI
    Skip building the API image.

.EXAMPLE
    .\build-and-push-containers.ps1

.EXAMPLE
    .\build-and-push-containers.ps1 -Tag "v1.0.0"

.EXAMPLE
    .\build-and-push-containers.ps1 -SkipUI
#>

param(
    [string]$AcrName = "bhsdevelopmentacr4znv2wxlxs4xq",
    [string]$Tag = "latest",
    [switch]$SkipUI,
    [switch]$SkipAPI
)

$ErrorActionPreference = "Stop"

# Get script directory and navigate to solution root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SolutionRoot = Split-Path -Parent $ScriptDir
Push-Location $SolutionRoot

try {
    $AcrLoginServer = "$AcrName.azurecr.io"

    Write-Host "========================================"  -ForegroundColor Cyan
    Write-Host "Build and Push Containers to ACR"  -ForegroundColor Cyan
    Write-Host "========================================"  -ForegroundColor Cyan
    Write-Host "ACR: $AcrLoginServer"  -ForegroundColor Gray
    Write-Host "Tag: $Tag"  -ForegroundColor Gray
    Write-Host ""

    # Login to ACR
    Write-Host "Logging in to Azure Container Registry..."  -ForegroundColor Yellow
    az acr login --name $AcrName
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to login to ACR"
    }
    Write-Host "Logged in to ACR"  -ForegroundColor Green
    Write-Host ""

    # Build and push UI
    if (-not $SkipUI) {
        Write-Host "========================================"  -ForegroundColor Cyan
        Write-Host "Building UI Image..."  -ForegroundColor Yellow
        Write-Host "========================================"  -ForegroundColor Cyan

        $UiImage = "$AcrLoginServer/bhs-ui:$Tag"
        docker build -f BehavioralHealthSystem.Web/Dockerfile.prod -t $UiImage BehavioralHealthSystem.Web
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to build UI image"
        }
        Write-Host "UI image built: $UiImage"  -ForegroundColor Green

        Write-Host "Pushing UI image..."  -ForegroundColor Yellow
        docker push $UiImage
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to push UI image"
        }
        Write-Host "UI image pushed"  -ForegroundColor Green
        Write-Host ""
    }

    # Build and push API
    if (-not $SkipAPI) {
        Write-Host "========================================"  -ForegroundColor Cyan
        Write-Host "Building API Image..."  -ForegroundColor Yellow
        Write-Host "========================================"  -ForegroundColor Cyan

        $ApiImage = "$AcrLoginServer/bhs-api:$Tag"
        docker build -f BehavioralHealthSystem.Functions/Dockerfile.prod -t $ApiImage .
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to build API image"
        }
        Write-Host "API image built: $ApiImage"  -ForegroundColor Green

        Write-Host "Pushing API image..."  -ForegroundColor Yellow
        docker push $ApiImage
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to push API image"
        }
        Write-Host "API image pushed"  -ForegroundColor Green
        Write-Host ""
    }

    Write-Host "========================================"  -ForegroundColor Green
    Write-Host "All images built and pushed successfully!"  -ForegroundColor Green
    Write-Host "========================================"  -ForegroundColor Green
    Write-Host ""
    Write-Host "Images:"  -ForegroundColor Cyan
    if (-not $SkipUI) {
        Write-Host "  - $AcrLoginServer/bhs-ui:$Tag"  -ForegroundColor White
    }
    if (-not $SkipAPI) {
        Write-Host "  - $AcrLoginServer/bhs-api:$Tag"  -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Next step: Deploy to Container Apps with:"  -ForegroundColor Yellow
    Write-Host "  az deployment group create --resource-group bhs-development-public --template-file infrastructure/bicep/update-container-apps.bicep"  -ForegroundColor Gray

}
catch {
    Write-Host "ERROR: $($_.Exception.Message)"  -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
