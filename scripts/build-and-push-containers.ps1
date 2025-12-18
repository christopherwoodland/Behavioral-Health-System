#Requires -Version 5.1
<#
.SYNOPSIS
    Build and push Docker containers to Azure Container Registry.

.DESCRIPTION
    This script builds the UI and API Docker images locally and pushes them
    to the Azure Container Registry for deployment to Container Apps.
    Supports three environments: local, development, and production.

.PARAMETER AcrName
    The name of the Azure Container Registry. Defaults to bhsdevelopmentacr4znv2wxlxs4xq.

.PARAMETER Tag
    The image tag to use. Defaults to 'latest'.

.PARAMETER Environment
    The target environment: local, development, or production. Defaults to 'development'.

.PARAMETER SkipUI
    Skip building the UI image.

.PARAMETER SkipAPI
    Skip building the API image.

.EXAMPLE
    .\build-and-push-containers.ps1

.EXAMPLE
    .\build-and-push-containers.ps1 -Environment production -Tag "v1.0.0"

.EXAMPLE
    .\build-and-push-containers.ps1 -Environment local -SkipUI

.EXAMPLE
    .\build-and-push-containers.ps1 -Environment development
#>

param(
    [string]$AcrName = "bhsdevelopmentacr4znv2wxlxs4xq",
    [string]$Tag = "latest",
    [ValidateSet("local", "development", "production")]
    [string]$Environment = "development",
    [switch]$SkipUI,
    [switch]$SkipAPI
)

$ErrorActionPreference = "Stop"

# Get script directory and navigate to solution root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SolutionRoot = Split-Path -Parent $ScriptDir
Push-Location $SolutionRoot

try {
    # Determine Dockerfile suffix based on environment
    $dockerfileSuffix = switch ($Environment) {
        "local" { "local" }
        "development" { "development" }
        "production" { "prod" }
    }

    Write-Host "========================================"  -ForegroundColor Cyan
    Write-Host "Build and Push Containers"  -ForegroundColor Cyan
    Write-Host "========================================"  -ForegroundColor Cyan
    Write-Host "Environment: $Environment"  -ForegroundColor Gray
    Write-Host "Tag: $Tag"  -ForegroundColor Gray

    if ($Environment -eq "local") {
        Write-Host "Note: Local builds are for docker-compose only, not pushed to ACR"  -ForegroundColor Yellow
    }
    else {
        $AcrLoginServer = "$AcrName.azurecr.io"
        Write-Host "ACR: $AcrLoginServer"  -ForegroundColor Gray
    }
    Write-Host ""

    # Login to ACR (skip for local)
    if ($Environment -ne "local") {
        Write-Host "Logging in to Azure Container Registry..."  -ForegroundColor Yellow
        az acr login --name $AcrName
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to login to ACR"
        }
        Write-Host "Logged in to ACR"  -ForegroundColor Green
        Write-Host ""
    }

    # Build and push UI
    if (-not $SkipUI) {
        Write-Host "========================================"  -ForegroundColor Cyan
        Write-Host "Building UI Image..."  -ForegroundColor Yellow
        Write-Host "========================================"  -ForegroundColor Cyan

        if ($Environment -eq "local") {
            $UiImage = "bhs-ui:$dockerfileSuffix"
        }
        else {
            $UiImage = "$AcrLoginServer/bhs-ui:$Tag"
        }

        docker build -f BehavioralHealthSystem.Web/Dockerfile.$dockerfileSuffix -t $UiImage BehavioralHealthSystem.Web
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to build UI image"
        }
        Write-Host "UI image built: $UiImage"  -ForegroundColor Green

        if ($Environment -ne "local") {
            Write-Host "Pushing UI image..."  -ForegroundColor Yellow
            docker push $UiImage
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to push UI image"
            }
            Write-Host "UI image pushed"  -ForegroundColor Green
        }
        Write-Host ""
    }

    # Build and push API
    if (-not $SkipAPI) {
        Write-Host "========================================"  -ForegroundColor Cyan
        Write-Host "Building API Image..."  -ForegroundColor Yellow
        Write-Host "========================================"  -ForegroundColor Cyan

        if ($Environment -eq "local") {
            $ApiImage = "bhs-api:$dockerfileSuffix"
        }
        else {
            $ApiImage = "$AcrLoginServer/bhs-api:$Tag"
        }

        docker build -f BehavioralHealthSystem.Functions/Dockerfile.$dockerfileSuffix -t $ApiImage .
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to build API image"
        }
        Write-Host "API image built: $ApiImage"  -ForegroundColor Green

        if ($Environment -ne "local") {
            Write-Host "Pushing API image..."  -ForegroundColor Yellow
            docker push $ApiImage
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to push API image"
            }
            Write-Host "API image pushed"  -ForegroundColor Green
        }
        Write-Host ""
    }

    Write-Host "========================================"  -ForegroundColor Green
    Write-Host "Build completed successfully!"  -ForegroundColor Green
    Write-Host "========================================"  -ForegroundColor Green
    Write-Host ""
    Write-Host "Images:"  -ForegroundColor Cyan
    if (-not $SkipUI) {
        if ($Environment -eq "local") {
            Write-Host "  - bhs-ui:$dockerfileSuffix"  -ForegroundColor White
        }
        else {
            Write-Host "  - $AcrLoginServer/bhs-ui:$Tag"  -ForegroundColor White
        }
    }
    if (-not $SkipAPI) {
        if ($Environment -eq "local") {
            Write-Host "  - bhs-api:$dockerfileSuffix"  -ForegroundColor White
        }
        else {
            Write-Host "  - $AcrLoginServer/bhs-api:$Tag"  -ForegroundColor White
        }
    }
    Write-Host ""

    if ($Environment -eq "local") {
        Write-Host "Next step: Run locally with:"  -ForegroundColor Yellow
        Write-Host "  docker-compose -f docker-compose.local.yml up"  -ForegroundColor Gray
    }
    elseif ($Environment -eq "development") {
        Write-Host "Next step: Deploy to Development with:"  -ForegroundColor Yellow
        Write-Host "  docker-compose -f docker-compose.development.yml up"  -ForegroundColor Gray
        Write-Host "  OR deploy to Azure Container Apps"  -ForegroundColor Gray
    }
    else {
        Write-Host "Next step: Deploy to Production Container Apps with:"  -ForegroundColor Yellow
        Write-Host "  az deployment group create --resource-group bhs-production-rg --template-file infrastructure/bicep/update-container-apps.bicep"  -ForegroundColor Gray
    }

}
catch {
    Write-Host "ERROR: $($_.Exception.Message)"  -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
