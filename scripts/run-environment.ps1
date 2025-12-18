#Requires -Version 5.1
<#
.SYNOPSIS
    Run the Behavioral Health System in a specific environment.

.DESCRIPTION
    This script runs the BHS application in one of three environments:
    - local: Offline mode with local models and infrastructure (Azurite, Ollama)
    - development: Azure development environment with Managed Identity
    - production: Azure production environment with Managed Identity

.PARAMETER Environment
    The target environment: local, development, or production. Required.

.PARAMETER Build
    Force rebuild of containers before starting.

.PARAMETER Down
    Stop and remove containers instead of starting them.

.PARAMETER Logs
    Show container logs after starting.

.EXAMPLE
    .\run-environment.ps1 -Environment local

.EXAMPLE
    .\run-environment.ps1 -Environment development -Build

.EXAMPLE
    .\run-environment.ps1 -Environment production -Down

.EXAMPLE
    .\run-environment.ps1 -Environment local -Logs
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("local", "development", "production")]
    [string]$Environment,

    [switch]$Build,
    [switch]$Down,
    [switch]$Logs
)

$ErrorActionPreference = "Stop"

# Get script directory and navigate to solution root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SolutionRoot = Split-Path -Parent $ScriptDir
Push-Location $SolutionRoot

try {
    # Determine docker-compose file
    $composeFile = switch ($Environment) {
        "local" { "docker-compose.local.yml" }
        "development" { "docker-compose.development.yml" }
        "production" { "docker-compose.prod.yml" }
    }

    Write-Host "========================================"  -ForegroundColor Cyan
    Write-Host "BHS Environment Manager"  -ForegroundColor Cyan
    Write-Host "========================================"  -ForegroundColor Cyan
    Write-Host "Environment: $Environment"  -ForegroundColor Gray
    Write-Host "Compose File: $composeFile"  -ForegroundColor Gray
    Write-Host ""

    if ($Down) {
        Write-Host "Stopping containers..."  -ForegroundColor Yellow
        docker-compose -f $composeFile down
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to stop containers"
        }
        Write-Host "Containers stopped"  -ForegroundColor Green
        return
    }

    # Environment-specific setup
    if ($Environment -eq "local") {
        Write-Host "LOCAL ENVIRONMENT SETUP"  -ForegroundColor Cyan
        Write-Host "----------------------"  -ForegroundColor Cyan
        Write-Host "This will run the application completely offline using:"  -ForegroundColor White
        Write-Host "  - Azurite (Azure Storage Emulator)"  -ForegroundColor Gray
        Write-Host "  - Ollama (Local LLM)"  -ForegroundColor Gray
        Write-Host "  - Mock Kintsugi API"  -ForegroundColor Gray
        Write-Host ""
        Write-Host "Make sure you have:"  -ForegroundColor Yellow
        Write-Host "  1. Docker Desktop running"  -ForegroundColor Gray
        Write-Host "  2. Ollama models downloaded (optional)"  -ForegroundColor Gray
        Write-Host ""
    }
    elseif ($Environment -eq "development") {
        Write-Host "DEVELOPMENT ENVIRONMENT SETUP"  -ForegroundColor Cyan
        Write-Host "----------------------------"  -ForegroundColor Cyan
        Write-Host "This will use Azure Development resources with Managed Identity"  -ForegroundColor White
        Write-Host ""
        Write-Host "Required environment variables:"  -ForegroundColor Yellow
        Write-Host "  - STORAGE_ACCOUNT_NAME"  -ForegroundColor Gray
        Write-Host "  - AZURE_OPENAI_ENDPOINT"  -ForegroundColor Gray
        Write-Host "  - APPLICATIONINSIGHTS_CONNECTION_STRING"  -ForegroundColor Gray
        Write-Host "  - KINTSUGI_API_KEY (from Key Vault)"  -ForegroundColor Gray
        Write-Host ""
        Write-Host "Make sure you:"  -ForegroundColor Yellow
        Write-Host "  1. Are authenticated to Azure (az login)"  -ForegroundColor Gray
        Write-Host "  2. Have set environment variables"  -ForegroundColor Gray
        Write-Host "  3. Have access to development resources"  -ForegroundColor Gray
        Write-Host ""
    }
    else {
        Write-Host "PRODUCTION ENVIRONMENT SETUP"  -ForegroundColor Cyan
        Write-Host "---------------------------"  -ForegroundColor Cyan
        Write-Host "This will use Azure Production resources with Managed Identity"  -ForegroundColor White
        Write-Host ""
        Write-Host "WARNING: This is for production deployment only!"  -ForegroundColor Red
        Write-Host ""
        Write-Host "Required environment variables:"  -ForegroundColor Yellow
        Write-Host "  - STORAGE_ACCOUNT_NAME"  -ForegroundColor Gray
        Write-Host "  - AZURE_OPENAI_ENDPOINT"  -ForegroundColor Gray
        Write-Host "  - APPLICATIONINSIGHTS_CONNECTION_STRING"  -ForegroundColor Gray
        Write-Host "  - KINTSUGI_API_KEY (from Key Vault)"  -ForegroundColor Gray
        Write-Host ""
    }

    # Build or start containers
    if ($Build) {
        Write-Host "Building and starting containers..."  -ForegroundColor Yellow
        docker-compose -f $composeFile up --build -d
    }
    else {
        Write-Host "Starting containers..."  -ForegroundColor Yellow
        docker-compose -f $composeFile up -d
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start containers"
    }

    Write-Host ""
    Write-Host "========================================"  -ForegroundColor Green
    Write-Host "Containers started successfully!"  -ForegroundColor Green
    Write-Host "========================================"  -ForegroundColor Green
    Write-Host ""

    # Show access URLs
    if ($Environment -eq "local") {
        Write-Host "Access the application at:"  -ForegroundColor Cyan
        Write-Host "  Web UI:  http://localhost:5173"  -ForegroundColor White
        Write-Host "  API:     http://localhost:7071"  -ForegroundColor White
        Write-Host "  Azurite: http://localhost:10000 (Blob)"  -ForegroundColor White
        Write-Host "  Ollama:  http://localhost:11434"  -ForegroundColor White
    }
    else {
        Write-Host "Access the application at:"  -ForegroundColor Cyan
        Write-Host "  Web UI:  http://localhost:5173"  -ForegroundColor White
        Write-Host "  API:     http://localhost:7071"  -ForegroundColor White
    }
    Write-Host ""

    Write-Host "Useful commands:"  -ForegroundColor Yellow
    Write-Host "  View logs:   docker-compose -f $composeFile logs -f"  -ForegroundColor Gray
    Write-Host "  Stop:        .\run-environment.ps1 -Environment $Environment -Down"  -ForegroundColor Gray
    Write-Host "  Rebuild:     .\run-environment.ps1 -Environment $Environment -Build"  -ForegroundColor Gray
    Write-Host ""

    if ($Logs) {
        Write-Host "Showing logs..."  -ForegroundColor Yellow
        docker-compose -f $composeFile logs -f
    }
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)"  -ForegroundColor Red
    exit 1
}
finally {
    Pop-Location
}
