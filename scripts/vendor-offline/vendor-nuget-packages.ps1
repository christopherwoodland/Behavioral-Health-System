<#
.SYNOPSIS
    Vendors NuGet packages for offline restore in an air-gapped environment.

.DESCRIPTION
    Run this script on an internet-connected machine. It restores all projects
    in the solution into a local package cache, then exports package .nupkg files
    into a local feed folder that can be copied to air-gapped environments.

    The output folder can be referenced with a nuget.config source such as:
      <add key="offline" value="C:\path\to\vendor\nuget-feed" />

.PARAMETER SolutionPath
    Path to the solution file.

.PARAMETER PackageCacheDir
    Path used for dotnet restore package cache.

.PARAMETER FeedDir
    Path where .nupkg files are copied for offline feed use.
#>
[CmdletBinding()]
param(
    [string]$SolutionPath = (Join-Path $PSScriptRoot '..\..\BehavioralHealthSystem.sln'),
    [string]$PackageCacheDir = (Join-Path $PSScriptRoot '..\..\vendor\nuget-cache'),
    [string]$FeedDir = (Join-Path $PSScriptRoot '..\..\vendor\nuget-feed')
)

$ErrorActionPreference = 'Stop'

$SolutionPath = [System.IO.Path]::GetFullPath($SolutionPath)
$PackageCacheDir = [System.IO.Path]::GetFullPath($PackageCacheDir)
$FeedDir = [System.IO.Path]::GetFullPath($FeedDir)

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host 'BHS Offline NuGet Vendoring' -ForegroundColor Cyan
Write-Host "Solution: $SolutionPath" -ForegroundColor Cyan
Write-Host "Cache   : $PackageCacheDir" -ForegroundColor Cyan
Write-Host "Feed    : $FeedDir" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if (-not (Test-Path $SolutionPath)) {
    throw "Solution not found: $SolutionPath"
}

New-Item -ItemType Directory -Path $PackageCacheDir -Force | Out-Null
New-Item -ItemType Directory -Path $FeedDir -Force | Out-Null

Write-Host ''
Write-Host '[1/2] Restoring solution into local package cache...' -ForegroundColor Yellow

dotnet restore $SolutionPath --packages $PackageCacheDir
if ($LASTEXITCODE -ne 0) {
    throw 'dotnet restore failed'
}

Write-Host ''
Write-Host '[2/2] Exporting package files to offline feed...' -ForegroundColor Yellow

$packageFiles = Get-ChildItem -Path $PackageCacheDir -Recurse -File | Where-Object {
    $_.Extension -eq '.nupkg'
}

foreach ($pkg in $packageFiles) {
    Copy-Item -Path $pkg.FullName -Destination (Join-Path $FeedDir $pkg.Name) -Force
}

$total = (Get-ChildItem -Path $FeedDir -Filter '*.nupkg' | Measure-Object).Count
$totalBytes = (Get-ChildItem -Path $FeedDir -Filter '*.nupkg' | Measure-Object -Property Length -Sum).Sum
$totalGb = [math]::Round($totalBytes / 1GB, 2)

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host "NuGet feed package count: $total" -ForegroundColor Cyan
Write-Host "NuGet feed size: $totalGb GB" -ForegroundColor Cyan
Write-Host "Offline feed ready at: $FeedDir" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
