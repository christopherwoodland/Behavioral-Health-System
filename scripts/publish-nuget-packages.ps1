#Requires -Version 5.1
<#
.SYNOPSIS
    Pack and publish BehavioralHealthSystem NuGet packages to GitHub Packages.

.DESCRIPTION
    Packs the Dam and Helpers class libraries as NuGet packages and publishes
    them to the GitHub Packages NuGet registry. Helpers is packed first because
    Dam depends on it.

    Requires a GitHub Personal Access Token (PAT) with write:packages scope.
    Set $env:GITHUB_TOKEN before running, or pass -GitHubToken.

.PARAMETER Version
    The package version to publish (e.g. 1.0.0, 1.1.0-beta). Defaults to 1.0.0.

.PARAMETER GitHubOwner
    The GitHub user or org that owns the packages. Defaults to christopherwoodland.

.PARAMETER GitHubToken
    GitHub PAT with write:packages scope. Falls back to $env:GITHUB_TOKEN.

.PARAMETER PackOnly
    Pack without pushing to the registry.

.PARAMETER Configuration
    Build configuration (Release or Debug). Defaults to Release.

.EXAMPLE
    .\publish-nuget-packages.ps1

.EXAMPLE
    .\publish-nuget-packages.ps1 -Version 1.2.0

.EXAMPLE
    .\publish-nuget-packages.ps1 -PackOnly

.EXAMPLE
    .\publish-nuget-packages.ps1 -Version 2.0.0-beta -GitHubToken $token
#>

param(
    [string]$Version = "1.0.0",
    [string]$GitHubOwner = "christopherwoodland",
    [string]$GitHubToken = $env:GITHUB_TOKEN,
    [switch]$PackOnly,
    [ValidateSet("Release", "Debug")]
    [string]$Configuration = "Release"
)

$ErrorActionPreference = "Stop"

# Validate token unless pack-only
if (-not $PackOnly -and [string]::IsNullOrWhiteSpace($GitHubToken)) {
    Write-Host "ERROR: GitHub token required. Set `$env:GITHUB_TOKEN or pass -GitHubToken." -ForegroundColor Red
    exit 1
}

# Navigate to solution root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SolutionRoot = Split-Path -Parent $ScriptDir
Push-Location $SolutionRoot

try {
    $OutputDir = Join-Path $SolutionRoot "nupkg"
    $Source = "https://nuget.pkg.github.com/$GitHubOwner/index.json"

    # Projects to pack (order matters — Helpers first, Dam depends on it)
    $Projects = @(
        @{ Name = "BehavioralHealthSystem.Helpers"; Path = "BehavioralHealthSystem.Helpers" },
        @{ Name = "BehavioralHealthSystem.Dam";     Path = "BehavioralHealthSystem.Dam" }
    )

    Write-Host "========================================"  -ForegroundColor Cyan
    Write-Host "NuGet Package Publish"  -ForegroundColor Cyan
    Write-Host "========================================"  -ForegroundColor Cyan
    Write-Host "Version:       $Version"  -ForegroundColor Gray
    Write-Host "Configuration: $Configuration"  -ForegroundColor Gray
    Write-Host "Output:        $OutputDir"  -ForegroundColor Gray
    if (-not $PackOnly) {
        Write-Host "Registry:      $Source"  -ForegroundColor Gray
    } else {
        Write-Host "Mode:          Pack only (no push)"  -ForegroundColor Gray
    }
    Write-Host ""

    # Clean previous packages
    if (Test-Path $OutputDir) {
        Remove-Item "$OutputDir\*.nupkg" -Force -ErrorAction SilentlyContinue
    }

    # Pack each project
    foreach ($proj in $Projects) {
        Write-Host "Packing $($proj.Name) v$Version..."  -ForegroundColor Yellow
        dotnet pack $proj.Path -c $Configuration -o $OutputDir /p:Version=$Version
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to pack $($proj.Name)"
        }
        Write-Host "$($proj.Name).$Version.nupkg created"  -ForegroundColor Green
        Write-Host ""
    }

    # Push to GitHub Packages
    if (-not $PackOnly) {
        foreach ($proj in $Projects) {
            $nupkg = Join-Path $OutputDir "$($proj.Name).$Version.nupkg"
            Write-Host "Pushing $($proj.Name) v$Version to GitHub Packages..."  -ForegroundColor Yellow
            dotnet nuget push $nupkg --source $Source --api-key $GitHubToken --skip-duplicate
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to push $($proj.Name)"
            }
            Write-Host "$($proj.Name) pushed"  -ForegroundColor Green
            Write-Host ""
        }
    }

    Write-Host "========================================"  -ForegroundColor Green
    Write-Host "Done!"  -ForegroundColor Green
    Write-Host "========================================"  -ForegroundColor Green
    Write-Host ""
    Write-Host "Packages:"  -ForegroundColor Cyan
    foreach ($proj in $Projects) {
        Write-Host "  - $($proj.Name) v$Version"  -ForegroundColor White
    }

    if (-not $PackOnly) {
        Write-Host ""
        Write-Host "Consume in another project:"  -ForegroundColor Yellow
        Write-Host "  dotnet add package BehavioralHealthSystem.Dam --version $Version --source github"  -ForegroundColor Gray
    }
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)"  -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
