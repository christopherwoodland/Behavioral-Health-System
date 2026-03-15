#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Fixes (or creates) the bhs-api-dam Postgres role so its pgaadauth OID matches the
    current AKS UAMI.  Run after any deploy that recreates the UAMI.

.DESCRIPTION
    When the UAMI is recreated (e.g. full teardown + redeploy) the PostgreSQL role
    retains a stale `pgaadauth` OID.  This script drops and recreates the role with
    the correct OID and grants all required permissions.

.PARAMETER PgServer
    FQDN of the PostgreSQL Flexible Server.  Default: bhs-dev-postgres2.postgres.database.azure.com

.PARAMETER PgDatabase
    Application database name.  Default: bhs_dev

.PARAMETER PgAdminUser
    Entra ID display name of the admin user (must have Entra admin rights on the server).
    Default: Christopher Woodland

.PARAMETER UamiOid
    Object ID (principalId) of the AKS UAMI for the api workload.
    Default: debf1bc2-f14a-4eab-80e6-d38824a3bceb
    Retrieve with: az identity show -g bhs-aks -n <uami-name> --query principalId -o tsv

.EXAMPLE
    # Run with defaults (bhs-dev-postgres2 in bhs-aks)
    .\Fix-PostgresRole.ps1

.EXAMPLE
    # Run against a custom server
    .\Fix-PostgresRole.ps1 -PgServer myserver.postgres.database.azure.com -UamiOid <oid>
#>
param(
    [string]$PgServer   = "bhs-dev-postgres2.postgres.database.azure.com",
    [string]$PgDatabase = "bhs_dev",
    [string]$PgAdminUser = "Christopher Woodland",
    [string]$UamiOid    = "debf1bc2-f14a-4eab-80e6-d38824a3bceb"
)

$ErrorActionPreference = "Stop"
$env:AZURE_CORE_ONLY_SHOW_ERRORS = "true"

$pg_server   = $PgServer
$pg_database = $PgDatabase
$pg_user     = $PgAdminUser  # Entra admin user (display name matches UPN)
$uamiOid     = $UamiOid      # UAMI principalId
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
