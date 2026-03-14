#!/usr/bin/env pwsh
# One-shot script: fixes the bhs-api-dam Postgres role OID to match the AKS UAMI.
# Run after deploy if you see "oid mismatch" errors in bhs-api pod logs.
# Requires: az CLI, psql on PATH (or in C:\Program Files\PostgreSQL\*\bin\)
#           Must be run as an Entra admin of the Postgres server.

$ErrorActionPreference = "Stop"
$env:AZURE_CORE_ONLY_SHOW_ERRORS = "true"

$pg_server   = "bhs-dev-postgres.postgres.database.azure.com"
$pg_database = "bhs_dev"
$pg_user     = "Christopher Woodland"  # Entra admin user (matches UPN)
$uamiOid     = "debf1bc2-f14a-4eab-80e6-d38824a3bceb"  # UAMI principalId
$roleName    = "bhs-api-dam"

# Find psql
$psql = Get-Command psql -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $psql) {
    $psql = Get-ChildItem "C:\Program Files\PostgreSQL" -Recurse -Filter psql.exe -ErrorAction SilentlyContinue |
            Select-Object -First 1 -ExpandProperty FullName
}
if (-not $psql) {
    Write-Error "psql not found. Install PostgreSQL client tools or add psql to PATH."
}
Write-Host "Using psql: $psql"

# Get Entra access token for Postgres
Write-Host "Getting access token..."
$env:PGPASSWORD = az account get-access-token --resource-type oss-rdbms --query accessToken --output tsv
if ($LASTEXITCODE -ne 0) { Write-Error "Failed to get access token" }

$sql = @"
-- Drop stale role (may fail if role owns objects - safe for clean dev envs)
DROP ROLE IF EXISTS "$roleName";

-- Recreate with Entra identity label
CREATE ROLE "$roleName" LOGIN;
SECURITY LABEL FOR "pgaadauth" ON ROLE "$roleName"
  IS 'aadauth,oid=$uamiOid,type=service';

-- Grant DB access
GRANT CONNECT ON DATABASE $pg_database TO "$roleName";
GRANT USAGE ON SCHEMA public TO "$roleName";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "$roleName";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "$roleName";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "$roleName";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO "$roleName";

-- Verify
SELECT r.rolname, sl.label
FROM pg_roles r
JOIN pg_seclabels sl ON sl.objoid = r.oid
WHERE r.rolname = '$roleName';
"@

Write-Host "Connecting to Postgres and applying fix..."
$sql | & $psql "host=$pg_server dbname=$pg_database user='$pg_user' sslmode=require" 2>&1
if ($LASTEXITCODE -ne 0) { Write-Error "psql failed (exit $LASTEXITCODE)" }

Write-Host ""
Write-Host "Done. Restart the bhs-api deployment to pick up the change:"
Write-Host "  kubectl rollout restart deployment/bhs-api -n bhs"
