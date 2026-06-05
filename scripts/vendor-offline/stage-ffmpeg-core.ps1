<#
.SYNOPSIS
    Stages FFmpeg core browser assets into BehavioralHealthSystem.Web/public/ffmpeg-core.

.DESCRIPTION
    Supports two modes:
      1) Connected machine: download @ffmpeg/core tarball via npm pack.
      2) Air-gapped machine: use a pre-downloaded tarball via -TarballPath.

    Copies ffmpeg-core.js and ffmpeg-core.wasm (and worker if present)
    to the destination directory used by VITE_FFMPEG_CORE_BASE_URL.
#>
[CmdletBinding()]
param(
    [string]$Version = '0.12.6',
    [string]$DestinationDir = (Join-Path $PSScriptRoot '..\..\BehavioralHealthSystem.Web\public\ffmpeg-core'),
    [string]$TarballPath = ''
)

$ErrorActionPreference = 'Stop'

$DestinationDir = [System.IO.Path]::GetFullPath($DestinationDir)

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("bhs-ffmpeg-core-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    if ([string]::IsNullOrWhiteSpace($TarballPath)) {
        Write-Host "Downloading @ffmpeg/core@$Version with npm pack..." -ForegroundColor Yellow
        npm pack "@ffmpeg/core@$Version" --pack-destination $tempDir | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw 'npm pack failed. Provide -TarballPath if running in air-gapped mode.'
        }

        $tgz = Get-ChildItem -Path $tempDir -Filter '*.tgz' | Select-Object -First 1
        if (-not $tgz) {
            throw 'Unable to find downloaded @ffmpeg/core tarball.'
        }
        $TarballPath = $tgz.FullName
    }
    else {
        $TarballPath = [System.IO.Path]::GetFullPath($TarballPath)
        if (-not (Test-Path $TarballPath)) {
            throw "Tarball not found: $TarballPath"
        }
    }

    $extractDir = Join-Path $tempDir 'extract'
    New-Item -ItemType Directory -Path $extractDir -Force | Out-Null

    tar -xf $TarballPath -C $extractDir
    if ($LASTEXITCODE -ne 0) {
        throw 'Failed to extract FFmpeg core tarball.'
    }

    $esmDir = Join-Path $extractDir 'package\dist\esm'
    if (-not (Test-Path $esmDir)) {
        throw "Expected dist/esm folder not found in package: $esmDir"
    }

    New-Item -ItemType Directory -Path $DestinationDir -Force | Out-Null

    $filesToCopy = @('ffmpeg-core.js', 'ffmpeg-core.wasm', 'ffmpeg-core.worker.js')
    foreach ($name in $filesToCopy) {
        $src = Join-Path $esmDir $name
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination (Join-Path $DestinationDir $name) -Force
        }
    }

    $coreJs = Join-Path $DestinationDir 'ffmpeg-core.js'
    $coreWasm = Join-Path $DestinationDir 'ffmpeg-core.wasm'

    if (-not (Test-Path $coreJs) -or -not (Test-Path $coreWasm)) {
        throw 'FFmpeg core staging incomplete. Required files missing (ffmpeg-core.js / ffmpeg-core.wasm).'
    }

    Write-Host '[OK] FFmpeg core assets staged successfully.' -ForegroundColor Green
    Write-Host "Destination: $DestinationDir" -ForegroundColor Green
}
finally {
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
