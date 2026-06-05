<#
.SYNOPSIS
    Vendors npm dependencies for offline install in air-gapped environments.

.DESCRIPTION
    Runs on a connected machine. It reads package-lock.json from the web project,
    downloads all resolved tarballs into vendor/npm-tarballs, and can later be used
    with install-npm-offline.ps1.
#>
[CmdletBinding()]
param(
    [string]$ProjectDir = (Join-Path $PSScriptRoot '..\..\BehavioralHealthSystem.Web'),
    [string]$TarballDir = (Join-Path $PSScriptRoot '..\..\vendor\npm-tarballs')
)

$ErrorActionPreference = 'Stop'

$ProjectDir = [System.IO.Path]::GetFullPath($ProjectDir)
$TarballDir = [System.IO.Path]::GetFullPath($TarballDir)
$lockFile = Join-Path $ProjectDir 'package-lock.json'

if (-not (Test-Path $lockFile)) {
    throw "package-lock.json not found at $lockFile"
}

New-Item -ItemType Directory -Path $TarballDir -Force | Out-Null

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host 'BHS Offline npm Vendoring' -ForegroundColor Cyan
Write-Host "Project : $ProjectDir" -ForegroundColor Cyan
Write-Host "Tarballs: $TarballDir" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

Push-Location $ProjectDir
try {
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw 'npm ci failed'
    }
}
finally {
    Pop-Location
}

$lockContent = Get-Content $lockFile -Raw | ConvertFrom-Json
$packages = $lockContent.packages.PSObject.Properties | Where-Object {
    $_.Value.resolved -and $_.Value.resolved -match '^https://'
}

$total = ($packages | Measure-Object).Count
$downloaded = 0
$skipped = 0

foreach ($entry in $packages) {
    $url = $entry.Value.resolved
    $filename = [System.IO.Path]::GetFileName(([Uri]$url).LocalPath)
    $dest = Join-Path $TarballDir $filename

    if (Test-Path $dest) {
        $skipped++
        continue
    }

    try {
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -ErrorAction Stop
        $downloaded++
    }
    catch {
        Write-Warning "Failed to download $url : $($_.Exception.Message)"
    }
}

$count = (Get-ChildItem -Path $TarballDir -Filter '*.tgz' -File | Measure-Object).Count
$bytes = (Get-ChildItem -Path $TarballDir -Filter '*.tgz' -File | Measure-Object -Property Length -Sum).Sum
$gb = [math]::Round($bytes / 1GB, 2)

Write-Host ''
Write-Host "Resolved entries: $total" -ForegroundColor White
Write-Host "Downloaded      : $downloaded" -ForegroundColor White
Write-Host "Skipped existing: $skipped" -ForegroundColor White
Write-Host "Tarballs total  : $count ($gb GB)" -ForegroundColor Green
