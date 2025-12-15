<#
.SYNOPSIS
    Docker Compose management script for BHS (Behavioral Health System)

.DESCRIPTION
    This script provides commands to manage Docker Compose environments for local and production.
    - Local: Uses docker-compose.local.yml with hardcoded dev values
    - Production: Uses docker-compose.prod.yml with .env.prod file (managed identity, no API keys)

.PARAMETER Action
    The action to perform: up, down, rebuild, logs, status, restart

.PARAMETER Environment
    The environment to target: local (default), prod

.PARAMETER Service
    Optional specific service to target: api, web, azurite (local only)

.EXAMPLE
    .\docker-manage.ps1 -Action up -Environment local
    Starts all local development containers

.EXAMPLE
    .\docker-manage.ps1 -Action rebuild -Environment local
    Tears down, rebuilds, and starts local containers

.EXAMPLE
    .\docker-manage.ps1 -Action logs -Service api
    Shows logs for the API container
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("up", "down", "rebuild", "logs", "status", "restart", "shell")]
    [string]$Action,

    [Parameter(Mandatory = $false)]
    [ValidateSet("local", "prod")]
    [string]$Environment = "local",

    [Parameter(Mandatory = $false)]
    [ValidateSet("api", "web", "azurite", "")]
    [string]$Service = ""
)

# Set strict mode
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Get script directory and navigate to solution root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SolutionRoot = Split-Path -Parent $ScriptDir
Push-Location $SolutionRoot

# Determine compose file based on environment
$ComposeFile = if ($Environment -eq "local") {
    "docker-compose.local.yml"
} else {
    "docker-compose.prod.yml"
}

$EnvFile = if ($Environment -eq "prod") { ".env.prod" } else { $null }

# Container name prefix
$ContainerPrefix = if ($Environment -eq "local") { "bhs" } else { "bhs" }

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " $Message" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-Host "[*] $Message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Get-ComposeCommand {
    $cmd = "docker compose -f $ComposeFile"
    if ($EnvFile -and (Test-Path $EnvFile)) {
        $cmd += " --env-file $EnvFile"
    }
    return $cmd
}

function Invoke-DockerUp {
    Write-Header "Starting $Environment Environment"

    if ($Environment -eq "prod" -and -not (Test-Path ".env.prod")) {
        Write-ErrorMsg ".env.prod file not found!"
        Write-Host "Copy .env.prod.template to .env.prod and fill in the values." -ForegroundColor Yellow
        return
    }

    $cmd = Get-ComposeCommand
    if ($Service) {
        Write-Step "Starting service: $Service"
        Invoke-Expression "$cmd up -d $Service"
    } else {
        Write-Step "Starting all services..."
        Invoke-Expression "$cmd up -d"
    }

    Write-Success "Services started!"
    Write-Host ""
    Invoke-DockerStatus
}

function Invoke-DockerDown {
    Write-Header "Stopping $Environment Environment"

    $cmd = Get-ComposeCommand
    Write-Step "Stopping containers..."
    Invoke-Expression "$cmd down --volumes"

    Write-Success "Containers stopped and volumes removed!"
}

function Invoke-DockerRebuild {
    Write-Header "Rebuilding $Environment Environment"

    if ($Environment -eq "prod" -and -not (Test-Path ".env.prod")) {
        Write-ErrorMsg ".env.prod file not found!"
        Write-Host "Copy .env.prod.template to .env.prod and fill in the values." -ForegroundColor Yellow
        return
    }

    $cmd = Get-ComposeCommand

    Write-Step "Stopping existing containers..."
    Invoke-Expression "$cmd down --volumes" 2>$null

    Write-Step "Pruning Docker build cache..."
    docker builder prune -f 2>$null

    Write-Step "Building and starting containers..."
    if ($Service) {
        Invoke-Expression "$cmd up -d --build $Service"
    } else {
        Invoke-Expression "$cmd up -d --build"
    }

    Write-Success "Rebuild complete!"
    Write-Host ""
    Invoke-DockerStatus
}

function Invoke-DockerLogs {
    Write-Header "Container Logs - $Environment"

    $cmd = Get-ComposeCommand
    if ($Service) {
        Write-Step "Showing logs for: $Service"
        Invoke-Expression "$cmd logs -f --tail 100 $Service"
    } else {
        Write-Step "Showing logs for all services..."
        Invoke-Expression "$cmd logs -f --tail 50"
    }
}

function Invoke-DockerStatus {
    Write-Header "Container Status - $Environment"

    Write-Step "Running containers:"
    docker ps --filter "name=$ContainerPrefix" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    Write-Host ""
    Write-Step "Health status:"
    $containers = docker ps --filter "name=$ContainerPrefix" --format "{{.Names}}"
    foreach ($container in $containers) {
        if ($container) {
            $format = '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}'
            $health = docker inspect --format $format $container 2>$null
            $color = switch ($health) {
                "healthy" { "Green" }
                "unhealthy" { "Red" }
                "starting" { "Yellow" }
                "no-healthcheck" { "Gray" }
                default { "White" }
            }
            Write-Host "  $container : $health" -ForegroundColor $color
        }
    }
}

function Invoke-DockerRestart {
    Write-Header "Restarting $Environment Environment"

    $cmd = Get-ComposeCommand
    if ($Service) {
        Write-Step "Restarting service: $Service"
        Invoke-Expression "$cmd restart $Service"
    } else {
        Write-Step "Restarting all services..."
        Invoke-Expression "$cmd restart"
    }

    Write-Success "Services restarted!"
    Write-Host ""
    Invoke-DockerStatus
}

function Invoke-DockerShell {
    if (-not $Service) {
        Write-ErrorMsg "Please specify a service with -Service parameter"
        return
    }

    Write-Header "Opening shell in $Service"

    $containerName = if ($Environment -eq "local") {
        "bhs-$Service"
    } else {
        "bhs-$Service-prod"
    }

    Write-Step "Connecting to $containerName..."
    docker exec -it $containerName /bin/sh
}

try {
    switch ($Action) {
        "up" { Invoke-DockerUp }
        "down" { Invoke-DockerDown }
        "rebuild" { Invoke-DockerRebuild }
        "logs" { Invoke-DockerLogs }
        "status" { Invoke-DockerStatus }
        "restart" { Invoke-DockerRestart }
        "shell" { Invoke-DockerShell }
    }
}
catch {
    Write-ErrorMsg "An error occurred: $_"
    exit 1
}
finally {
    Pop-Location
}
