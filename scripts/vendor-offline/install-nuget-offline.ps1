<#
.SYNOPSIS
    Restores the solution using a local offline NuGet feed.

.DESCRIPTION
    Run this script on an air-gapped machine after copying vendor/nuget-feed.
    It creates a temporary NuGet config that points only to the offline feed,
    then restores all projects from that source.
#>
[CmdletBinding()]
param(
    [string]$SolutionPath = (Join-Path $PSScriptRoot '..\..\BehavioralHealthSystem.sln'),
    [string]$FeedDir = (Join-Path $PSScriptRoot '..\..\vendor\nuget-feed'),
    [string]$OfflineConfigPath = (Join-Path $PSScriptRoot '..\..\vendor\nuget.offline.config'),
    [string]$PackageCacheDir = (Join-Path $PSScriptRoot '..\..\vendor\nuget-cache-airgap')
)

$ErrorActionPreference = 'Stop'

$SolutionPath = [System.IO.Path]::GetFullPath($SolutionPath)
$FeedDir = [System.IO.Path]::GetFullPath($FeedDir)
$OfflineConfigPath = [System.IO.Path]::GetFullPath($OfflineConfigPath)
$PackageCacheDir = [System.IO.Path]::GetFullPath($PackageCacheDir)

if (-not (Test-Path $SolutionPath)) {
    throw "Solution not found: $SolutionPath"
}

if (-not (Test-Path $FeedDir)) {
    throw "Offline feed directory not found: $FeedDir"
}

$pkgCount = (Get-ChildItem -Path $FeedDir -Filter '*.nupkg' -File | Measure-Object).Count
if ($pkgCount -eq 0) {
    throw "No .nupkg files found in offline feed: $FeedDir"
}

New-Item -ItemType Directory -Path (Split-Path -Parent $OfflineConfigPath) -Force | Out-Null
New-Item -ItemType Directory -Path $PackageCacheDir -Force | Out-Null

$offlineNugetConfig = @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="offline" value="$FeedDir" />
  </packageSources>
</configuration>
"@

Set-Content -Path $OfflineConfigPath -Value $offlineNugetConfig -Encoding UTF8

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host 'BHS Offline NuGet Restore' -ForegroundColor Cyan
Write-Host "Solution: $SolutionPath" -ForegroundColor Cyan
Write-Host "Feed    : $FeedDir ($pkgCount packages)" -ForegroundColor Cyan
Write-Host "Config  : $OfflineConfigPath" -ForegroundColor Cyan
Write-Host "Cache   : $PackageCacheDir" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

# Explicitly clear HTTP cache to avoid hidden online fallback assumptions.
dotnet nuget locals http-cache --clear | Out-Null

# Restore strictly using the generated offline config.
dotnet restore $SolutionPath --configfile $OfflineConfigPath --packages $PackageCacheDir --force
if ($LASTEXITCODE -ne 0) {
    throw 'Offline dotnet restore failed. Ensure all required packages were vendored.'
}

Write-Host ''
Write-Host '[OK] Offline NuGet restore completed successfully.' -ForegroundColor Green
