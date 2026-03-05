<#
.SYNOPSIS
    Seeds DSM-5 condition data into the PostgreSQL database.

.DESCRIPTION
    Loads DSM-5 diagnostic condition JSON files from data/dsm5-data/conditions/
    into the PostgreSQL dsm5_conditions table. This script:
    - Copies JSON files into the running PostgreSQL container
    - Executes the seed script inside the container
    - Cleans up temporary files afterward

    The script is idempotent - safe to run multiple times. Existing records
    are skipped (ON CONFLICT DO NOTHING).

.PARAMETER ContainerName
    Name of the PostgreSQL Docker container. Default: bhs-db-dev

.EXAMPLE
    .\seed-dsm5-data.ps1
    Seeds DSM-5 data into the default development container.

.EXAMPLE
    .\seed-dsm5-data.ps1 -ContainerName bhs-db-prod
    Seeds DSM-5 data into the production container.
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$ContainerName = "bhs-db-dev"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$DataDir = Join-Path $RepoRoot "data" "dsm5-data" "conditions"
$SeedScript = Join-Path $RepoRoot "data" "seed-dsm5-data.sh"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DSM-5 PostgreSQL Data Seeder" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verify prerequisites
if (-not (Test-Path $DataDir)) {
    Write-Host "[ERROR] DSM-5 data directory not found: $DataDir" -ForegroundColor Red
    exit 1
}

$jsonFiles = Get-ChildItem "$DataDir\*.json"
if ($jsonFiles.Count -eq 0) {
    Write-Host "[ERROR] No JSON files found in: $DataDir" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Found $($jsonFiles.Count) DSM-5 condition files" -ForegroundColor Green

# Check container is running
$containerStatus = docker inspect --format '{{.State.Running}}' $ContainerName 2>$null
if ($containerStatus -ne "true") {
    Write-Host "[ERROR] Container '$ContainerName' is not running." -ForegroundColor Red
    Write-Host "        Start the database first: docker compose --env-file docker.env -f docker-compose.development.yml up db -d" -ForegroundColor Yellow
    exit 1
}

Write-Host "[INFO] Container '$ContainerName' is running" -ForegroundColor Green

# Copy data files into container
Write-Host "[STEP] Copying DSM-5 JSON files into container..." -ForegroundColor Yellow
docker cp "$DataDir" "${ContainerName}:/tmp/dsm5-conditions" 2>$null
if ($LASTEXITCODE -ne 0 -and -not $?) {
    Write-Host "[ERROR] Failed to copy data files" -ForegroundColor Red
    exit 1
}

# Copy and run seed script
Write-Host "[STEP] Copying seed script into container..." -ForegroundColor Yellow
docker cp "$SeedScript" "${ContainerName}:/tmp/seed-dsm5-data.sh" 2>$null

Write-Host "[STEP] Running seed script..." -ForegroundColor Yellow
docker exec $ContainerName sh -c "chmod +x /tmp/seed-dsm5-data.sh && sed -i 's/\r$//' /tmp/seed-dsm5-data.sh && DATA_DIR=/tmp/dsm5-conditions sh /tmp/seed-dsm5-data.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Seed script failed" -ForegroundColor Red
    exit 1
}

# Clean up temp files in container
Write-Host "[STEP] Cleaning up temporary files..." -ForegroundColor Yellow
docker exec $ContainerName sh -c "rm -rf /tmp/dsm5-conditions /tmp/seed-dsm5-data.sh"

Write-Host ""
Write-Host "[DONE] DSM-5 data seeding complete!" -ForegroundColor Green
Write-Host ""
