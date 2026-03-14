#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build and push development Docker images to ACR for AKS deployment.

.DESCRIPTION
    Builds bhs-web and bhs-api using their Dockerfile.development definitions,
    tags them, and pushes to the shared ACR.

    The DAM image is NOT rebuilt — it is pulled directly from ACR as-is.

.PARAMETER AcrLoginServer
    ACR login server (e.g. bhsdevelopmentacr4znv2wxlxs4xq.azurecr.io).
    Default: read from aks-dev.parameters.json

.PARAMETER ImageTag
    Tag to apply to both images.  Default: development

.PARAMETER BuildOnly
    Build images but do not push.

.PARAMETER ApiOnly
    Build and push bhs-api only.

.PARAMETER WebOnly
    Build and push bhs-web only.

.EXAMPLE
    .\Build-And-Push-Containers-Dev.ps1

.EXAMPLE
    .\Build-And-Push-Containers-Dev.ps1 -AcrLoginServer bhsdevelopmentacr4znv2wxlxs4xq.azurecr.io -ImageTag development
#>
param(
    [string]$AcrLoginServer = "",
    [string]$ImageTag = "development",
    [switch]$BuildOnly,
    [switch]$ApiOnly,
    [switch]$WebOnly
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Resolve-Path (Join-Path $scriptDir "..\..")

# Resolve AcrLoginServer from parameters file if not passed
if (-not $AcrLoginServer) {
    $paramsFile = Join-Path $scriptDir "..\bicep\parameters\aks-dev.parameters.json"
    $paramsFile = Resolve-Path $paramsFile
    $params = Get-Content $paramsFile | ConvertFrom-Json
    $AcrLoginServer = $params.parameters.acrLoginServer.value
}

if (-not $AcrLoginServer) {
    Write-Host "[ERROR] AcrLoginServer could not be determined." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  BHS Dev Container Build & Push"                    -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  ACR:       $AcrLoginServer"
Write-Host "  Tag:       $ImageTag"
Write-Host "  Repo root: $repoRoot"
Write-Host ""

# Login to ACR (Managed Identity / Azure CLI credential — no password)
Write-Host "[*] Logging into ACR..." -ForegroundColor Yellow
$acrName = $AcrLoginServer.Split('.')[0]
az acr login --name $acrName --output none
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] ACR login failed." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] ACR login successful." -ForegroundColor Green

# ─── Build & push bhs-api ────────────────────────────────────────────────────
if (-not $WebOnly) {
    $apiImage = "$AcrLoginServer/bhs-api:$ImageTag"
    Write-Host "`n[*] Building bhs-api ($apiImage)..." -ForegroundColor Yellow
    $dockerfileApi = Join-Path $repoRoot "BehavioralHealthSystem.Functions\Dockerfile.development"

    docker build `
        --file $dockerfileApi `
        --tag $apiImage `
        $repoRoot

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] bhs-api build failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] bhs-api built: $apiImage" -ForegroundColor Green

    if (-not $BuildOnly) {
        Write-Host "[*] Pushing bhs-api..." -ForegroundColor Yellow
        docker push $apiImage
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] bhs-api push failed." -ForegroundColor Red
            exit 1
        }
        Write-Host "[OK] bhs-api pushed." -ForegroundColor Green
    }
}

# ─── Build & push bhs-web ────────────────────────────────────────────────────
if (-not $ApiOnly) {
    $webImage = "$AcrLoginServer/bhs-web:$ImageTag"
    Write-Host "`n[*] Building bhs-web ($webImage)..." -ForegroundColor Yellow
    $webContextDir = Join-Path $repoRoot "BehavioralHealthSystem.Web"
    $dockerfileWeb = Join-Path $webContextDir "Dockerfile.development"

    docker build `
        --file $dockerfileWeb `
        --tag $webImage `
        $webContextDir

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] bhs-web build failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] bhs-web built: $webImage" -ForegroundColor Green

    if (-not $BuildOnly) {
        Write-Host "[*] Pushing bhs-web..." -ForegroundColor Yellow
        docker push $webImage
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] bhs-web push failed." -ForegroundColor Red
            exit 1
        }
        Write-Host "[OK] bhs-web pushed." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "  Build Complete"                                     -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
if (-not $BuildOnly) {
    Write-Host "  Images pushed to $AcrLoginServer"
    Write-Host "    bhs-api:$ImageTag"
    Write-Host "    bhs-web:$ImageTag"
    Write-Host ""
    Write-Host "  DAM image is NOT rebuilt — pulled directly:"
    Write-Host "    $AcrLoginServer/bhs-dam-selfhost:latest"
}
Write-Host ""
