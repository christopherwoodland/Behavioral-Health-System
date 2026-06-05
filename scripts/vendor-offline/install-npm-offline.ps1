<#
.SYNOPSIS
    Installs npm dependencies from vendored tarballs on an air-gapped machine.
#>
[CmdletBinding()]
param(
    [string]$ProjectDir = (Join-Path $PSScriptRoot '..\..\BehavioralHealthSystem.Web'),
    [string]$TarballDir = (Join-Path $PSScriptRoot '..\..\vendor\npm-tarballs'),
    [string]$CacheDir = (Join-Path $PSScriptRoot '..\..\vendor\npm-cache-airgap')
)

$ErrorActionPreference = 'Stop'

$ProjectDir = [System.IO.Path]::GetFullPath($ProjectDir)
$TarballDir = [System.IO.Path]::GetFullPath($TarballDir)
$CacheDir = [System.IO.Path]::GetFullPath($CacheDir)

if (-not (Test-Path (Join-Path $ProjectDir 'package-lock.json'))) {
    throw "package-lock.json not found at $ProjectDir"
}

if (-not (Test-Path $TarballDir)) {
    throw "Tarball directory not found: $TarballDir"
}

$tarballs = Get-ChildItem -Path $TarballDir -Filter '*.tgz' -File
if ($tarballs.Count -eq 0) {
    throw "No .tgz tarballs found in $TarballDir"
}

New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host 'BHS Offline npm Install' -ForegroundColor Cyan
Write-Host "Project : $ProjectDir" -ForegroundColor Cyan
Write-Host "Tarballs: $TarballDir ($($tarballs.Count) files)" -ForegroundColor Cyan
Write-Host "Cache   : $CacheDir" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

foreach ($tgz in $tarballs) {
    npm cache add $tgz.FullName --cache $CacheDir
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to add tarball to npm cache: $($tgz.Name)"
    }
}

Push-Location $ProjectDir
try {
    npm ci --offline --cache $CacheDir
    if ($LASTEXITCODE -ne 0) {
        throw 'npm ci --offline failed'
    }
}
finally {
    Pop-Location
}

Write-Host '[OK] Offline npm install completed.' -ForegroundColor Green
