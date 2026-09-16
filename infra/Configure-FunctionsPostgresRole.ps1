#!/usr/bin/env pwsh
<#
.SYNOPSIS
Creates or updates the PostgreSQL role used by the Functions Container App system identity.

.DESCRIPTION
Run as the configured Microsoft Entra administrator for the PostgreSQL Flexible Server.
The script uses an Azure CLI database token and never requests or stores a database password.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$EntraAdminUser,

    [string]$Server = "bhs-postgres-sql.postgres.database.azure.com",
    [string]$Database = "bhs_dev",
    [string]$RoleName = "bhs-functions",
    [string]$ExistingOwnerRoleName,
    [string]$PrincipalId,
    [string]$ResourceGroup = "bhs",
    [string]$ContainerAppName = "bhs-functions"
)

$ErrorActionPreference = "Stop"
$env:AZURE_CORE_ONLY_SHOW_ERRORS = "true"

if ($RoleName -notmatch '^[A-Za-z0-9_-]+$') {
    throw "RoleName may contain only letters, numbers, underscores, and hyphens."
}
if (-not [string]::IsNullOrWhiteSpace($ExistingOwnerRoleName) -and $ExistingOwnerRoleName -notmatch '^[A-Za-z0-9_-]+$') {
    throw "ExistingOwnerRoleName may contain only letters, numbers, underscores, and hyphens."
}

$psql = Get-Command psql -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $psql) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Neither psql nor Docker was found. Install PostgreSQL client tools or Docker."
    }

    $psqlContainerImage = "postgres:16-alpine"
    docker image inspect $psqlContainerImage *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "psql was not found and Docker image $psqlContainerImage is not available locally."
    }
}

function Invoke-Psql {
    param(
        [Parameter(Mandatory)]
        [string]$Connection,
        [string[]]$Arguments = @(),
        [AllowNull()]
        [string]$InputText = $null
    )

    if ($psql) {
        $output = if ($null -eq $InputText) {
            @(& $psql $Connection @Arguments)
        }
        else {
            @($InputText | & $psql $Connection @Arguments)
        }
    }
    else {
        $dockerArguments = @(
            "run",
            "--rm",
            "--env", "PGPASSWORD"
        )
        if ($null -ne $InputText) {
            $dockerArguments += "--interactive"
        }
        $dockerArguments += @(
            $psqlContainerImage,
            "psql",
            $Connection
        ) + $Arguments
        $output = if ($null -eq $InputText) {
            @(& docker @dockerArguments)
        }
        else {
            @($InputText | & docker @dockerArguments)
        }
    }

    return [pscustomobject]@{
        ExitCode = $LASTEXITCODE
        Output = $output
    }
}

if ([string]::IsNullOrWhiteSpace($PrincipalId)) {
    $PrincipalId = az containerapp show `
        --resource-group $ResourceGroup `
        --name $ContainerAppName `
        --query identity.principalId `
        --output tsv
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($PrincipalId)) {
        throw "Unable to resolve the system-assigned identity for $ContainerAppName."
    }
}

try {
    $env:PGPASSWORD = az account get-access-token `
        --resource-type oss-rdbms `
        --query accessToken `
        --output tsv
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($env:PGPASSWORD)) {
        throw "Unable to acquire a PostgreSQL Microsoft Entra access token."
    }

    $connection = "host=$Server port=5432 user='$EntraAdminUser' sslmode=require"
    $roleQuery = Invoke-Psql `
        -Connection "$connection dbname=postgres" `
        -Arguments @("--tuples-only", "--no-align", "--command", "SELECT 1 FROM pg_roles WHERE rolname = '$RoleName';")
    if ($roleQuery.ExitCode -ne 0) {
        throw "Unable to inspect PostgreSQL roles. Confirm that $EntraAdminUser is the server's Microsoft Entra administrator."
    }

    if ([string]::IsNullOrWhiteSpace(($roleQuery.Output | Out-String))) {
        Write-Information "Creating PostgreSQL Entra role $RoleName..." -InformationAction Continue
        $createRole = Invoke-Psql `
            -Connection "$connection dbname=postgres" `
            -Arguments @("--set", "ON_ERROR_STOP=1", "--command", "SELECT * FROM pgaadauth_create_principal_with_oid('$RoleName', '$PrincipalId', 'service', false, false);")
        if ($createRole.ExitCode -ne 0) {
            throw "Failed to create PostgreSQL Entra role $RoleName."
        }
    }
    else {
        Write-Information "PostgreSQL role $RoleName already exists." -InformationAction Continue
    }

    $mapRole = Invoke-Psql `
        -Connection "$connection dbname=postgres" `
        -Arguments @("--set", "ON_ERROR_STOP=1", "--command", "SECURITY LABEL FOR pgaadauth ON ROLE `"$RoleName`" IS 'aadauth,oid=$PrincipalId,type=service';")
    if ($mapRole.ExitCode -ne 0) {
        throw "Failed to map PostgreSQL role $RoleName to principal $PrincipalId."
    }

    if ([string]::IsNullOrWhiteSpace($ExistingOwnerRoleName)) {
        $ownershipSql = @'
DO $body$
DECLARE
    database_object record;
BEGIN
    FOR database_object IN
        SELECT n.nspname AS schema_name, c.relname AS object_name, c.relkind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p', 'S')
          AND pg_get_userbyid(c.relowner) <> '__ROLE_NAME__'
    LOOP
        IF database_object.relkind = 'S' THEN
            EXECUTE format(
                'ALTER SEQUENCE %I.%I OWNER TO %I',
                database_object.schema_name,
                database_object.object_name,
                '__ROLE_NAME__');
        ELSE
            EXECUTE format(
                'ALTER TABLE %I.%I OWNER TO %I',
                database_object.schema_name,
                database_object.object_name,
                '__ROLE_NAME__');
        END IF;
    END LOOP;
END
$body$;
'@.Replace('__ROLE_NAME__', $RoleName)

        $transferOwnership = Invoke-Psql `
            -Connection "$connection dbname=$Database" `
            -Arguments @("--set", "ON_ERROR_STOP=1", "--command", $ownershipSql)
        if ($transferOwnership.ExitCode -ne 0) {
            throw "Failed to transfer PostgreSQL application object ownership to role $RoleName."
        }
    }
    else {
        Write-Information "Preserving ownership under $ExistingOwnerRoleName for side-by-side rollback." -InformationAction Continue
    }

    $ownerMembershipGrant = if ([string]::IsNullOrWhiteSpace($ExistingOwnerRoleName)) {
        ""
    }
    else {
        "GRANT `"$ExistingOwnerRoleName`" TO `"$RoleName`";"
    }
    $grants = @"
$ownerMembershipGrant
GRANT CONNECT ON DATABASE "$Database" TO "$RoleName";
GRANT USAGE, CREATE ON SCHEMA public TO "$RoleName";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "$RoleName";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "$RoleName";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "$RoleName";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "$RoleName";
"@

    $grantPermissions = Invoke-Psql `
        -Connection "$connection dbname=$Database" `
        -Arguments @("--set", "ON_ERROR_STOP=1") `
        -InputText $grants
    if ($grantPermissions.ExitCode -ne 0) {
        throw "Failed to grant application permissions to PostgreSQL role $RoleName."
    }

    $ownershipCheck = if ([string]::IsNullOrWhiteSpace($ExistingOwnerRoleName)) {
        "pg_get_userbyid(c.relowner) = '$RoleName' AND"
    }
    else {
        ""
    }
    $verifySql = @"
SELECT COUNT(*)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND NOT (
        $ownershipCheck
    has_table_privilege('$RoleName', c.oid, 'SELECT')
    AND has_table_privilege('$RoleName', c.oid, 'INSERT')
    AND has_table_privilege('$RoleName', c.oid, 'UPDATE')
    AND has_table_privilege('$RoleName', c.oid, 'DELETE')
  );
"@
    $permissionCheck = Invoke-Psql `
        -Connection "$connection dbname=$Database" `
        -Arguments @("--tuples-only", "--no-align", "--command", $verifySql)
    $missingTablePrivileges = ($permissionCheck.Output | Out-String).Trim()
    if ($permissionCheck.ExitCode -ne 0 -or $missingTablePrivileges -ne "0") {
        throw "PostgreSQL role $RoleName is missing required application access on $missingTablePrivileges public table(s)."
    }

    if (-not [string]::IsNullOrWhiteSpace($ExistingOwnerRoleName)) {
        $membershipCheck = Invoke-Psql `
            -Connection "$connection dbname=$Database" `
            -Arguments @(
                "--tuples-only",
                "--no-align",
                "--command",
                "SELECT pg_has_role('$RoleName', '$ExistingOwnerRoleName', 'MEMBER');"
            )
        $hasOwnerMembership = ($membershipCheck.Output | Out-String).Trim()
        if ($membershipCheck.ExitCode -ne 0 -or $hasOwnerMembership -ne "t") {
            throw "PostgreSQL role $RoleName does not inherit the existing owner role $ExistingOwnerRoleName."
        }
    }

    Write-Information "PostgreSQL role $RoleName is configured for principal $PrincipalId." -InformationAction Continue
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
