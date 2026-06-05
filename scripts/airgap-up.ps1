<#
.SYNOPSIS
    One-shot air-gap startup helper.

.DESCRIPTION
    Performs:
      1) airgap-bootstrap (env generation)
      2) optional offline dependency restore (NuGet + npm)
      3) optional FFmpeg core staging
      4) docker compose up using generated air-gap env file
#>
[CmdletBinding()]
param(
    [string]$EnvFile = (Join-Path $PSScriptRoot '..\docker.env.airgap'),
    [string]$ComposeFile = (Join-Path $PSScriptRoot '..\docker-compose.local.yml'),
    [switch]$SkipBootstrap,
    [switch]$SkipDependencyRestore,
    [switch]$SkipFfmpegStage,
    [switch]$AllowMissingFfmpegAssets,
    [string]$FfmpegTarballPath = ''
)

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$EnvFile = [System.IO.Path]::GetFullPath($EnvFile)
$ComposeFile = [System.IO.Path]::GetFullPath($ComposeFile)

if (-not $SkipBootstrap) {
    & (Join-Path $PSScriptRoot 'airgap-bootstrap.ps1') -OutputEnvFile $EnvFile
    if ($LASTEXITCODE -ne 0) { throw 'airgap-bootstrap failed' }
}

if (-not $SkipDependencyRestore) {
    & (Join-Path $PSScriptRoot 'vendor-offline\install-nuget-offline.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'install-nuget-offline failed' }

    & (Join-Path $PSScriptRoot 'vendor-offline\install-npm-offline.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'install-npm-offline failed' }
}

if (-not $SkipFfmpegStage) {
    $stageScript = Join-Path $PSScriptRoot 'vendor-offline\stage-ffmpeg-core.ps1'
    if ([string]::IsNullOrWhiteSpace($FfmpegTarballPath)) {
        $vendoredTarball = Get-ChildItem -Path (Join-Path $repoRoot 'vendor\\npm-tarballs') -Filter 'core-*.tgz' -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($vendoredTarball) {
            & $stageScript -TarballPath $vendoredTarball.FullName
        }
        else {
            if ($AllowMissingFfmpegAssets) {
                Write-Warning 'No vendored ffmpeg core tarball found (vendor/npm-tarballs/core-*.tgz). Skipping FFmpeg staging due to AllowMissingFfmpegAssets.'
            }
            else {
                throw 'No vendored ffmpeg core tarball found (vendor/npm-tarballs/core-*.tgz). Stage FFmpeg assets first or set -AllowMissingFfmpegAssets.'
            }
        }
    }
    else {
        & $stageScript -TarballPath $FfmpegTarballPath
    }

    if ($LASTEXITCODE -ne 0) { throw 'stage-ffmpeg-core failed' }
}

Push-Location $repoRoot
try {
    docker compose --env-file $EnvFile -f $ComposeFile up -d --build
    if ($LASTEXITCODE -ne 0) {
        throw 'docker compose up failed'
    }
}
finally {
    Pop-Location
}

Write-Host '[OK] Air-gap stack is up.' -ForegroundColor Green
