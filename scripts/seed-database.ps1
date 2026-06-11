<#
.SYNOPSIS
    Seeds reference data into the PostgreSQL database for any deployment mode.

.DESCRIPTION
    Creates required schema (if missing) and loads DSM-5 diagnostic condition data
    from JSON files into the database. Works across all deployment modes:
      - air-gap (docker.env.airgap, docker-compose.local.yml)
      - local   (docker.env, docker-compose.local.yml)
      - dev     (docker.env, docker-compose.development.yml)
      - prod    (docker.env, docker-compose.prod.yml)

    The script is idempotent - safe to run multiple times. Existing records
    are preserved (ON CONFLICT DO NOTHING).

    Schema creation: If the dsm5_conditions table does not exist, it will be
    created. Other tables are managed by EF Core on API startup.

.PARAMETER Mode
    Deployment mode. Determines container name and env file.
    Values: airgap, local, dev, prod. Default: local

.PARAMETER ContainerName
    Override the auto-detected PostgreSQL container name.

.PARAMETER DbUser
    PostgreSQL user. Default: read from env file or 'bhs_admin'.

.PARAMETER DbName
    PostgreSQL database name. Default: read from env file or 'bhs_dev'.

.PARAMETER DbPassword
    PostgreSQL password. Default: read from env file or 'changeme'.

.PARAMETER SkipSchemaCreate
    Skip DDL table creation (assume EF Core has already created the schema).

.PARAMETER WaitForContainer
    Wait up to N seconds for the DB container to become healthy. Default: 60.

.EXAMPLE
    .\seed-database.ps1
    Seeds data using default local mode.

.EXAMPLE
    .\seed-database.ps1 -Mode airgap
    Seeds data for air-gap deployment.

.EXAMPLE
    .\seed-database.ps1 -Mode dev -ContainerName bhs-db-dev
    Seeds data into the dev container.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("airgap", "local", "dev", "prod")]
    [string]$Mode = "local",

    [Parameter(Mandatory = $false)]
    [string]$ContainerName = "",

    [Parameter(Mandatory = $false)]
    [string]$DbUser = "",

    [Parameter(Mandatory = $false)]
    [string]$DbName = "",

    [Parameter(Mandatory = $false)]
    [string]$DbPassword = "",

    [switch]$SkipSchemaCreate,

    [Parameter(Mandatory = $false)]
    [int]$WaitForContainer = 60
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$DataDir = [System.IO.Path]::Combine($RepoRoot, "data", "dsm5-data", "conditions")

# ============================================================
# Mode-based defaults
# ============================================================
$containerMap = @{
    "airgap" = "bhs-db-local"
    "local"  = "bhs-db-local"
    "dev"    = "bhs-db-dev"
    "prod"   = "bhs-db-prod"
}

$envFileMap = @{
    "airgap" = Join-Path $RepoRoot "docker.env.airgap"
    "local"  = Join-Path $RepoRoot "docker.env"
    "dev"    = Join-Path $RepoRoot "docker.env"
    "prod"   = Join-Path $RepoRoot "docker.env"
}

# Auto-detect container name if not provided
if ([string]::IsNullOrWhiteSpace($ContainerName)) {
    $ContainerName = $containerMap[$Mode]
}

# Load env file values if user didn't provide overrides
$envFile = $envFileMap[$Mode]
if (Test-Path $envFile) {
    $envVars = @{}
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)=(.*)$') {
            $envVars[$Matches[1]] = $Matches[2]
        }
    }

    if ([string]::IsNullOrWhiteSpace($DbUser)) {
        $DbUser = if ($envVars.ContainsKey("POSTGRES_USER")) { $envVars["POSTGRES_USER"] } else { "bhs_admin" }
    }
    if ([string]::IsNullOrWhiteSpace($DbName)) {
        $DbName = if ($envVars.ContainsKey("POSTGRES_DB")) { $envVars["POSTGRES_DB"] } else { "bhs_dev" }
    }
    if ([string]::IsNullOrWhiteSpace($DbPassword)) {
        $DbPassword = if ($envVars.ContainsKey("POSTGRES_PASSWORD")) { $envVars["POSTGRES_PASSWORD"] } else { "changeme" }
    }
}
else {
    Write-Warning "Env file not found: $envFile - using defaults"
    if ([string]::IsNullOrWhiteSpace($DbUser)) { $DbUser = "bhs_admin" }
    if ([string]::IsNullOrWhiteSpace($DbName)) { $DbName = "bhs_dev" }
    if ([string]::IsNullOrWhiteSpace($DbPassword)) { $DbPassword = "changeme" }
}

# ============================================================
# Banner
# ============================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Behavioral Health System - Database Seeder" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Mode:       $Mode" -ForegroundColor White
Write-Host "  Container:  $ContainerName" -ForegroundColor White
Write-Host "  Database:   $DbName" -ForegroundColor White
Write-Host "  User:       $DbUser" -ForegroundColor White
Write-Host ""

# ============================================================
# Verify prerequisites
# ============================================================
if (-not (Test-Path $DataDir)) {
    Write-Host "[ERROR] DSM-5 data directory not found: $DataDir" -ForegroundColor Red
    Write-Host "        Expected: data/dsm5-data/conditions/*.json" -ForegroundColor Yellow
    exit 1
}

$jsonFiles = Get-ChildItem "$DataDir\*.json" -ErrorAction SilentlyContinue
if ($null -eq $jsonFiles -or $jsonFiles.Count -eq 0) {
    Write-Host "[ERROR] No JSON files found in: $DataDir" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Found $($jsonFiles.Count) DSM-5 condition files" -ForegroundColor Green

# ============================================================
# Wait for container to be running and healthy
# ============================================================
Write-Host "[STEP] Waiting for container '$ContainerName' to be ready..." -ForegroundColor Yellow

$elapsed = 0
$ready = $false
while ($elapsed -lt $WaitForContainer) {
    $status = docker inspect --format '{{.State.Running}}' $ContainerName 2>$null
    if ($status -eq "true") {
        # Check if pg_isready
        docker exec $ContainerName pg_isready -U $DbUser -d $DbName 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $ready = $true
            break
        }
    }
    Start-Sleep -Seconds 2
    $elapsed += 2
    Write-Host "  Waiting... ($elapsed/$WaitForContainer s)" -ForegroundColor DarkGray
}

if (-not $ready) {
    Write-Host "[ERROR] Container '$ContainerName' did not become ready within $WaitForContainer seconds." -ForegroundColor Red
    Write-Host "        Is the database running? Try:" -ForegroundColor Yellow
    Write-Host "        docker compose --env-file docker.env.airgap -f docker-compose.local.yml up db -d" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] Database is ready" -ForegroundColor Green

# ============================================================
# Schema creation (DDL)
# ============================================================
if (-not $SkipSchemaCreate) {
    Write-Host "[STEP] Ensuring dsm5_conditions table exists..." -ForegroundColor Yellow

    $ddl = @"
CREATE TABLE IF NOT EXISTS dsm5_conditions (
    "Id"                       TEXT PRIMARY KEY,
    "Name"                     TEXT NOT NULL,
    "Code"                     TEXT,
    "Category"                 TEXT,
    "Description"              TEXT DEFAULT '',
    "DiagnosticCriteria"       JSONB DEFAULT '[]'::jsonb,
    "DiagnosticFeatures"       TEXT,
    "AssociatedFeatures"       TEXT,
    "Prevalence"               TEXT,
    "DevelopmentAndCourse"     TEXT,
    "RiskAndPrognosticFactors" JSONB,
    "CultureRelatedIssues"    TEXT,
    "GenderRelatedIssues"     TEXT,
    "SuicideRisk"             TEXT,
    "FunctionalConsequences"  TEXT,
    "DifferentialDiagnosis"    JSONB DEFAULT '[]'::jsonb,
    "Comorbidity"             TEXT,
    "Specifiers"              JSONB DEFAULT '[]'::jsonb,
    "PageNumbers"             JSONB DEFAULT '[]'::jsonb,
    "PresentSections"         JSONB DEFAULT '[]'::jsonb,
    "MissingSections"         JSONB DEFAULT '[]'::jsonb,
    "IsAvailableForAssessment" BOOLEAN DEFAULT TRUE,
    "LastUpdated"             TIMESTAMPTZ DEFAULT NOW(),
    "ExtractionMetadata"      JSONB
);
"@

    $ddlResult = docker exec $ContainerName psql -U $DbUser -d $DbName -c $ddl 2>&1
    # psql returns 0 on success even with NOTICE messages
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to create dsm5_conditions table" -ForegroundColor Red
        Write-Host "  $ddlResult" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Schema verified" -ForegroundColor Green
}

# ============================================================
# Check current state
# ============================================================
$currentCount = docker exec $ContainerName psql -U $DbUser -d $DbName -t -A -c "SELECT COUNT(*) FROM dsm5_conditions;" 2>$null
$currentCount = [int]($currentCount.Trim())

Write-Host "[INFO] Current conditions in database: $currentCount" -ForegroundColor White

if ($currentCount -ge $jsonFiles.Count) {
    Write-Host "[OK] Database already has $currentCount conditions (>= $($jsonFiles.Count) files). Nothing to seed." -ForegroundColor Green
    Write-Host ""
    exit 0
}

# ============================================================
# Copy data into container and seed
# ============================================================
Write-Host "[STEP] Copying DSM-5 JSON files into container..." -ForegroundColor Yellow
docker exec $ContainerName sh -c "rm -rf /tmp/dsm5-seed && mkdir -p /tmp/dsm5-seed" 2>$null
docker cp "$DataDir/." "${ContainerName}:/tmp/dsm5-seed/" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to copy data files into container" -ForegroundColor Red
    exit 1
}

Write-Host "[STEP] Seeding DSM-5 conditions..." -ForegroundColor Yellow

# Write SQL to a temp file to preserve double-quoted identifiers through docker exec
$seedSqlContent = @'
DO $$
DECLARE
    f TEXT;
    raw_json JSONB;
    success_count INT := 0;
    error_count INT := 0;
    file_list TEXT[];
BEGIN
    SELECT array_agg(pg_ls_dir) INTO file_list
    FROM pg_ls_dir('/tmp/dsm5-seed')
    WHERE pg_ls_dir LIKE '%.json';

    IF file_list IS NULL THEN
        RAISE NOTICE 'No JSON files found in /tmp/dsm5-seed';
        RETURN;
    END IF;

    FOREACH f IN ARRAY file_list LOOP
        BEGIN
            raw_json := pg_read_file('/tmp/dsm5-seed/' || f)::jsonb;

            INSERT INTO dsm5_conditions (
                "Id", "Name", "Code", "Category", "Description",
                "DiagnosticCriteria", "DiagnosticFeatures", "AssociatedFeatures",
                "Prevalence", "DevelopmentAndCourse", "RiskAndPrognosticFactors",
                "CultureRelatedIssues", "GenderRelatedIssues", "SuicideRisk",
                "FunctionalConsequences", "DifferentialDiagnosis", "Comorbidity",
                "Specifiers", "PageNumbers", "PresentSections", "MissingSections",
                "IsAvailableForAssessment", "LastUpdated", "ExtractionMetadata"
            )
            VALUES (
                raw_json->>'id',
                raw_json->>'name',
                raw_json->>'code',
                raw_json->>'category',
                COALESCE(raw_json->>'description', ''),
                COALESCE(raw_json->'diagnosticCriteria', '[]'::jsonb),
                raw_json->>'diagnosticFeatures',
                raw_json->>'associatedFeatures',
                raw_json->>'prevalence',
                raw_json->>'developmentAndCourse',
                COALESCE(raw_json->'riskAndPrognosticFactors', 'null'::jsonb),
                raw_json->>'cultureRelatedIssues',
                raw_json->>'genderRelatedIssues',
                raw_json->>'suicideRisk',
                raw_json->>'functionalConsequences',
                COALESCE(raw_json->'differentialDiagnosis', '[]'::jsonb),
                raw_json->>'comorbidity',
                COALESCE(raw_json->'specifiers', '[]'::jsonb),
                COALESCE(raw_json->'pageNumbers', '[]'::jsonb),
                COALESCE(raw_json->'presentSections', '[]'::jsonb),
                COALESCE(raw_json->'missingSections', '[]'::jsonb),
                COALESCE((raw_json->>'isAvailableForAssessment')::boolean, true),
                COALESCE((raw_json->>'lastUpdated')::timestamptz, NOW()),
                raw_json->'extractionMetadata'
            )
            ON CONFLICT ("Id") DO NOTHING;

            success_count := success_count + 1;
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            RAISE NOTICE 'Error loading %: %', f, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'Seed complete: % success, % errors', success_count, error_count;
END $$;
'@

# Write to temp file, copy into container, execute there
$tempSqlFile = Join-Path $env:TEMP "bhs-seed-dsm5.sql"
[System.IO.File]::WriteAllText($tempSqlFile, $seedSqlContent, [System.Text.Encoding]::UTF8)
docker cp $tempSqlFile "${ContainerName}:/tmp/dsm5-seed.sql" 2>$null
Remove-Item $tempSqlFile -ErrorAction SilentlyContinue

docker exec $ContainerName psql -U $DbUser -d $DbName -f /tmp/dsm5-seed.sql 2>&1 | ForEach-Object {
    if ($_ -match "NOTICE:") {
        Write-Host "  $_" -ForegroundColor DarkGray
    }
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] Seed script reported errors (some may be expected for duplicates)" -ForegroundColor Yellow
}

# ============================================================
# Verify final state
# ============================================================
$finalCount = docker exec $ContainerName psql -U $DbUser -d $DbName -t -A -c "SELECT COUNT(*) FROM dsm5_conditions;" 2>$null
$finalCount = [int]($finalCount.Trim())
$inserted = $finalCount - $currentCount

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Seed Results" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  JSON files:     $($jsonFiles.Count)" -ForegroundColor White
Write-Host "  Previously in DB: $currentCount" -ForegroundColor White
Write-Host "  Newly inserted:   $inserted" -ForegroundColor White
Write-Host "  Total in DB:      $finalCount" -ForegroundColor Green
Write-Host ""

# ============================================================
# Cleanup temp files in container
# ============================================================
docker exec $ContainerName sh -c "rm -rf /tmp/dsm5-seed /tmp/dsm5-seed.sql" 2>$null

if ($finalCount -ge $jsonFiles.Count) {
    Write-Host "[DONE] Database seeded successfully!" -ForegroundColor Green
}
else {
    Write-Host "[WARN] Some conditions may not have loaded. Check NOTICE messages above." -ForegroundColor Yellow
}

Write-Host ""
