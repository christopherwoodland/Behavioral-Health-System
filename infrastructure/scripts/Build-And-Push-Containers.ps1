<#
.SYNOPSIS
    Builds and pushes Docker containers to Azure Container Registry.

.DESCRIPTION
    This script builds Docker images for the BehavioralHealthSystem UI and API,
    then pushes them to Azure Container Registry.

.PARAMETER AcrName
    The name of the Azure Container Registry.

.PARAMETER ResourceGroupName
    The resource group containing the ACR.

.PARAMETER ImageTag
    The tag to use for the images. Defaults to 'latest'.

.PARAMETER BuildOnly
    If specified, only builds the images without pushing.

.PARAMETER PushOnly
    If specified, only pushes existing images without building.

.EXAMPLE
    .\Build-And-Push-Containers.ps1 -AcrName "bhsacr12345" -ResourceGroupName "bhs-rg"

.EXAMPLE
    .\Build-And-Push-Containers.ps1 -AcrName "bhsacr12345" -ResourceGroupName "bhs-rg" -ImageTag "v1.0.0"
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
    [switch]$BuildOnly,

    [Parameter(Mandatory = $false)]
    [switch]$PushOnly
)

$ErrorActionPreference = "Stop"

# Set the root directory
$RootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$UIDir = Join-Path $RootDir "BehavioralHealthSystem.Web"
$APIDir = Join-Path $RootDir "BehavioralHealthSystem.Functions"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Container Build & Push Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  ACR Name: $AcrName"
Write-Host "  Resource Group: $ResourceGroupName"
Write-Host "  Image Tag: $ImageTag"
Write-Host "  UI Directory: $UIDir"
Write-Host "  API Directory: $APIDir"
Write-Host ""

# Get ACR login server
Write-Host "Getting ACR login server..." -ForegroundColor Yellow
$AcrLoginServer = az acr show --name $AcrName --resource-group $ResourceGroupName --query "loginServer" -o tsv
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to get ACR login server"
    exit 1
}
Write-Host "  ACR Login Server: $AcrLoginServer" -ForegroundColor Green
Write-Host ""

# Login to ACR
Write-Host "Logging into Azure Container Registry..." -ForegroundColor Yellow
az acr login --name $AcrName
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to login to ACR"
    exit 1
}
Write-Host "  Logged in successfully" -ForegroundColor Green
Write-Host ""

$UIImage = "${AcrLoginServer}/bhs-ui:${ImageTag}"
$APIImage = "${AcrLoginServer}/bhs-api:${ImageTag}"

if (-not $PushOnly) {
    # Build UI Container
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
        Write-Host "  UI image built successfully" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
    Write-Host ""

    # Build API Container
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Building API Container" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    $APIDockerfile = Join-Path $APIDir "Dockerfile.prod"
    if (-not (Test-Path $APIDockerfile)) {
        Write-Error "API Dockerfile.prod not found at $APIDir"
        exit 1
    }

    # Build from root directory so we can copy the solution file
    Push-Location $RootDir
    try {
        Write-Host "Building Docker image: $APIImage" -ForegroundColor Yellow
        docker build -f BehavioralHealthSystem.Functions/Dockerfile.prod -t $APIImage -t "${AcrLoginServer}/bhs-api:latest" .
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to build API Docker image"
            exit 1
        }
        Write-Host "  API image built successfully" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
    Write-Host ""
}

if (-not $BuildOnly) {
    # Push Images
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Pushing Images to ACR" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    Write-Host "Pushing UI image..." -ForegroundColor Yellow
    docker push $UIImage
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to push UI image"
        exit 1
    }
    docker push "${AcrLoginServer}/bhs-ui:latest"
    Write-Host "  UI image pushed successfully" -ForegroundColor Green

    Write-Host "Pushing API image..." -ForegroundColor Yellow
    docker push $APIImage
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to push API image"
        exit 1
    }
    docker push "${AcrLoginServer}/bhs-api:latest"
    Write-Host "  API image pushed successfully" -ForegroundColor Green
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Container Operations Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Images:" -ForegroundColor Green
Write-Host "  UI:  $UIImage"
Write-Host "  API: $APIImage"
Write-Host ""
Write-Host "To deploy, run:" -ForegroundColor Yellow
Write-Host "  .\Deploy-No-VNet-Integration.ps1 -Environment dev -UseContainerApps -ContainerImageTag $ImageTag"
