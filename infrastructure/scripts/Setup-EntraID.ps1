#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Configure Entra ID (Azure AD) app registrations for BHS.

.DESCRIPTION
    Idempotent script that performs all Entra ID setup required for the BHS
    authentication model.  Safe to re-run — existing configuration is left
    unchanged unless a flag is passed.

    Steps performed:
      1.  Create / find  "BHS Development UI"  SPA app registration
      2.  Create / find  "BHS Development API" API app registration
      3.  Ensure API identifierUris includes  api://{appId}  (custom-subdomain form)
      4.  Ensure API exposes  access_as_user  delegated scope
      5.  Define Admin + ControlPanel app roles on both registrations
      6.  Pre-authorize the UI client on the API so no user-consent prompt appears
      7.  Set SPA redirect URIs (moves any errant Web-platform URIs to SPA)
      8.  Assign a user to the Admin app role on the API enterprise app
          (optional — only when -AdminUserUpn is supplied)

    Tenant note: Microsoft corporate tenant (16b3c013-d300-468d-ac64-7eda0820b6d3)
    blocks tenant-wide admin consent and user consent for custom API scopes.
    Step 6 (pre-authorization) is the approved bypass: the API declares it
    trusts this specific client, so no consent dialog is shown.

.PARAMETER TenantId
    Entra ID tenant ID.  Defaults to the BHS development tenant.

.PARAMETER UiAppName
    Display name for the frontend SPA app registration.
    Default: "BHS Development UI"

.PARAMETER ApiAppName
    Display name for the backend API app registration.
    Default: "BHS Development API"

.PARAMETER RedirectUris
    SPA redirect URIs (must be under the SPA platform, NOT the Web platform).
    Defaults include localhost and the AKS dev ingress URL.

.PARAMETER AdminUserUpn
    Optional UPN of a user to assign the Admin app role on the API enterprise app.
    Example: "user@contoso.com"

.EXAMPLE
    # Idempotent setup using defaults — safe to run any time
    .\Setup-EntraID.ps1

.EXAMPLE
    # Also assign the Admin role to a specific user
    .\Setup-EntraID.ps1 -AdminUserUpn "cwoodland@microsoft.com"

.EXAMPLE
    # Override tenant for a different environment
    .\Setup-EntraID.ps1 -TenantId "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" -AdminUserUpn "admin@contoso.com"
#>
param(
    [string]$TenantId    = "16b3c013-d300-468d-ac64-7eda0820b6d3",

    [string]$UiAppName   = "BHS Development UI",
    [string]$ApiAppName  = "BHS Development API",

    [string[]]$RedirectUris = @(
        "http://localhost:5173",
        "https://localhost:5173",
        "https://bhs-dev-bhs.eastus2.cloudapp.azure.com"
    ),

    [string]$AdminUserUpn = ""
)

$ErrorActionPreference = "Stop"
$env:AZURE_CORE_ONLY_SHOW_ERRORS = "true"

# ─── Helpers ────────────────────────────────────────────────────────────────
function Write-Step  { param([string]$m) Write-Host "`n[*] $m" -ForegroundColor Cyan }
function Write-Ok    { param([string]$m) Write-Host "[OK] $m"  -ForegroundColor Green }
function Write-Skip  { param([string]$m) Write-Host "[--] $m"  -ForegroundColor DarkGray }
function Write-Warn  { param([string]$m) Write-Host "[!]  $m"  -ForegroundColor Yellow }

function Patch-Graph {
    param([string]$Uri, [string]$Body)
    $tmpFile = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $tmpFile -Value $Body -Encoding utf8 -NoNewline
    $result = az rest --method PATCH --uri $Uri --headers "Content-Type=application/json" --body "@$tmpFile" 2>&1
    Remove-Item $tmpFile -Force
    if ($LASTEXITCODE -ne 0) { throw "PATCH $Uri failed: $result" }
}

function Post-Graph {
    param([string]$Uri, [string]$Body)
    $tmpFile = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $tmpFile -Value $Body -Encoding utf8 -NoNewline
    $result = az rest --method POST --uri $Uri --headers "Content-Type=application/json" --body "@$tmpFile" 2>&1
    Remove-Item $tmpFile -Force
    if ($LASTEXITCODE -ne 0) { throw "POST $Uri failed: $result" }
    return ($result | ConvertFrom-Json)
}

# ─── Well-known IDs (stable; do not change without updating Bicep params) ────
$ACCESS_AS_USER_SCOPE_ID  = "a1111111-1111-1111-1111-111111111111"
$ROLE_ADMIN_ID            = "a1b2c3d4-0001-0001-0001-000000000001"
$ROLE_CONTROLPANEL_ID     = "a1b2c3d4-0002-0002-0002-000000000002"

# ─── Verify login ────────────────────────────────────────────────────────────
Write-Step "Verifying Azure CLI login..."
$account = az account show -o json 2>&1 | ConvertFrom-Json
if (-not $account) { Write-Error "Not logged in. Run: az login --tenant $TenantId"; exit 1 }
Write-Ok "Logged in as: $($account.user.name)  (tenant: $($account.tenantId))"

if ($account.tenantId -ne $TenantId) {
    Write-Warn "Current tenant $($account.tenantId) != expected $TenantId"
    Write-Warn "Re-run: az login --tenant $TenantId"
}

# ─── 1. Find or create UI app registration ──────────────────────────────────
Write-Step "Finding / creating '$UiAppName' app registration..."
$uiAppJson = az ad app list --display-name $UiAppName --query "[0]" -o json 2>&1
$uiApp = $uiAppJson | ConvertFrom-Json
if (-not $uiApp) {
    Write-Host "  Creating '$UiAppName'..."
    $uiApp = az ad app create --display-name $UiAppName --sign-in-audience AzureADMyOrg -o json 2>&1 | ConvertFrom-Json
    Write-Ok "Created: $($uiApp.appId)"
} else {
    Write-Ok "Found:   $($uiApp.appId)  (objectId: $($uiApp.id))"
}
$uiAppId  = $uiApp.appId
$uiObjId  = $uiApp.id

# ─── 2. Find or create API app registration ──────────────────────────────────
Write-Step "Finding / creating '$ApiAppName' app registration..."
$apiAppJson = az ad app list --display-name $ApiAppName --query "[0]" -o json 2>&1
$apiApp = $apiAppJson | ConvertFrom-Json
if (-not $apiApp) {
    Write-Host "  Creating '$ApiAppName'..."
    $apiApp = az ad app create --display-name $ApiAppName --sign-in-audience AzureADMyOrg -o json 2>&1 | ConvertFrom-Json
    Write-Ok "Created: $($apiApp.appId)"
} else {
    Write-Ok "Found:   $($apiApp.appId)  (objectId: $($apiApp.id))"
}
$apiAppId  = $apiApp.appId
$apiObjId  = $apiApp.id

# ─── 3. Ensure API identifierUris includes api://{appId} ────────────────────
#
# IMPORTANT: The URI api://{appId} (using the actual GUID) MUST be present as
# an identifierUri in addition to any friendly name like api://bhs-dev-api.
# If only the friendly name is present, MSAL requests that use the appId form
# will fail with AADSTS500011 "resource principal not found".
#
Write-Step "Ensuring API identifierUris includes api://$apiAppId..."
$currentUris = az ad app show --id $apiAppId --query "identifierUris" -o json 2>&1 | ConvertFrom-Json
$appIdUri    = "api://$apiAppId"
$friendlyUri = "api://bhs-dev-api"
$desiredUris = @($friendlyUri, $appIdUri) | Where-Object { $_ -ne "" } | Select-Object -Unique
$missingUris = $desiredUris | Where-Object { $currentUris -notcontains $_ }
if ($missingUris) {
    $merged = ($currentUris + $desiredUris | Select-Object -Unique)
    az ad app update --id $apiAppId --identifier-uris $merged 2>&1 | Out-Null
    Write-Ok "identifierUris updated: $($merged -join ', ')"
} else {
    Write-Skip "identifierUris already correct"
}

# ─── 4. Ensure access_as_user scope exists on the API ────────────────────────
#
# The scope value must be "access_as_user" (NOT "user_impersonation") because
# the resource was created without the default user_impersonation scope.
# All client-side MSAL requests must use api://{apiAppId}/access_as_user.
#
Write-Step "Ensuring 'access_as_user' delegated scope on API..."
$apiDetail  = az ad app show --id $apiAppId -o json 2>&1 | ConvertFrom-Json
$existScope = $apiDetail.api.oauth2PermissionScopes | Where-Object { $_.value -eq "access_as_user" }
if (-not $existScope) {
    Write-Host "  Adding access_as_user scope..."
    $scopeBody = @{
        api = @{
            oauth2PermissionScopes = @(
                @{
                    id                      = $ACCESS_AS_USER_SCOPE_ID
                    value                   = "access_as_user"
                    type                    = "User"
                    adminConsentDisplayName = "Access BHS API as signed-in user"
                    adminConsentDescription = "Allows the app to call the BHS API on behalf of the signed-in user."
                    userConsentDisplayName  = "Access BHS API"
                    userConsentDescription  = "Allows this app to access the BHS API on your behalf."
                    isEnabled               = $true
                }
            )
        }
    } | ConvertTo-Json -Depth 5 -Compress
    Patch-Graph "https://graph.microsoft.com/v1.0/applications/$apiObjId" $scopeBody
    Write-Ok "access_as_user scope added"
} else {
    Write-Skip "access_as_user scope already exists (id: $($existScope.id))"
    # Re-use whatever ID already exists so downstream steps stay consistent
    $ACCESS_AS_USER_SCOPE_ID = $existScope.id
}

# ─── 5. App roles on API app registration ────────────────────────────────────
#
# App roles carry the roles claim in the API access token.
# The assignedTo approach (role assigned to a user on the API enterprise app)
# puts roles in the access token obtained for api://{apiAppId}/access_as_user.
# UI reads roles by silently acquiring the API access token and decoding it.
#
Write-Step "Ensuring Admin and ControlPanel app roles on API..."
$apiDetail = az ad app show --id $apiAppId -o json 2>&1 | ConvertFrom-Json
$existingRoles = $apiDetail.appRoles | Select-Object -ExpandProperty id

$rolesToAdd = @()
if ($existingRoles -notcontains $ROLE_ADMIN_ID) {
    $rolesToAdd += @{
        id                  = $ROLE_ADMIN_ID
        displayName         = "Admin"
        description         = "Full administrative access to BHS"
        value               = "Admin"
        allowedMemberTypes  = @("User", "Application")
        isEnabled           = $true
    }
}
if ($existingRoles -notcontains $ROLE_CONTROLPANEL_ID) {
    $rolesToAdd += @{
        id                  = $ROLE_CONTROLPANEL_ID
        displayName         = "ControlPanel"
        description         = "Access to the BHS Control Panel"
        value               = "ControlPanel"
        allowedMemberTypes  = @("User", "Application")
        isEnabled           = $true
    }
}
if ($rolesToAdd.Count -gt 0) {
    $allRoles = @($apiDetail.appRoles) + $rolesToAdd
    $rolesBody = @{ appRoles = $allRoles } | ConvertTo-Json -Depth 5 -Compress
    Patch-Graph "https://graph.microsoft.com/v1.0/applications/$apiObjId" $rolesBody
    Write-Ok "App roles added: $($rolesToAdd.displayName -join ', ')"
} else {
    Write-Skip "Admin and ControlPanel roles already exist"
}

# Also ensure the UI app registration carries the same app roles (for future
# direct-to-UI role assignment if tenant policy allows).
Write-Step "Ensuring Admin and ControlPanel app roles on UI..."
$uiDetail = az ad app show --id $uiAppId -o json 2>&1 | ConvertFrom-Json
$uiExistingRoles = $uiDetail.appRoles | Select-Object -ExpandProperty id

$uiRolesToAdd = @()
if ($uiExistingRoles -notcontains $ROLE_ADMIN_ID) {
    $uiRolesToAdd += @{
        id                  = $ROLE_ADMIN_ID
        displayName         = "Admin"
        description         = "Full administrative access to BHS"
        value               = "Admin"
        allowedMemberTypes  = @("User", "Application")
        isEnabled           = $true
    }
}
if ($uiExistingRoles -notcontains $ROLE_CONTROLPANEL_ID) {
    $uiRolesToAdd += @{
        id                  = $ROLE_CONTROLPANEL_ID
        displayName         = "ControlPanel"
        description         = "Access to the BHS Control Panel"
        value               = "ControlPanel"
        allowedMemberTypes  = @("User", "Application")
        isEnabled           = $true
    }
}
if ($uiRolesToAdd.Count -gt 0) {
    $allUiRoles = @($uiDetail.appRoles) + $uiRolesToAdd
    $uiRolesBody = @{ appRoles = $allUiRoles } | ConvertTo-Json -Depth 5 -Compress
    Patch-Graph "https://graph.microsoft.com/v1.0/applications/$uiObjId" $uiRolesBody
    Write-Ok "App roles added to UI registration"
} else {
    Write-Skip "UI app roles already exist"
}

# ─── 6. Pre-authorize UI client on API ───────────────────────────────────────
#
# This is the critical step that bypasses the "Need admin approval" consent
# screen on Microsoft corporate tenants that block user consent for custom APIs.
# The API registration declares "I trust this specific client app" — AAD then
# issues the API token without any user-consent dialog.
#
Write-Step "Pre-authorizing UI ($uiAppId) on API..."
$apiDetail = az ad app show --id $apiAppId -o json 2>&1 | ConvertFrom-Json
$existingPreAuth = $apiDetail.api.preAuthorizedApplications | Where-Object { $_.appId -eq $uiAppId }
if (-not $existingPreAuth) {
    $preAuthBody = @{
        api = @{
            preAuthorizedApplications = @(
                @{
                    appId                  = $uiAppId
                    delegatedPermissionIds = @($ACCESS_AS_USER_SCOPE_ID)
                }
            )
        }
    } | ConvertTo-Json -Depth 5 -Compress
    Patch-Graph "https://graph.microsoft.com/v1.0/applications/$apiObjId" $preAuthBody
    Write-Ok "UI pre-authorized on API (consent dialog suppressed)"
} else {
    Write-Skip "UI already pre-authorized on API"
}

# ─── 7. SPA redirect URIs (must be under SPA platform, NOT Web platform) ──────
#
# AADSTS9002326 "cross-origin token redemption is permitted only for Single-Page
# Applications" occurs when redirect URIs are registered under the Web platform.
# They must be under the SPA platform.
#
Write-Step "Configuring SPA redirect URIs on UI app..."
$uiDetail  = az ad app show --id $uiAppId -o json 2>&1 | ConvertFrom-Json
$spaUris   = @($uiDetail.spa.redirectUris)
$webUris   = @($uiDetail.web.redirectUris)
$missingInSpa = $RedirectUris | Where-Object { $spaUris -notcontains $_ }
$wrongInWeb   = $RedirectUris | Where-Object { $webUris  -contains  $_ }

if ($missingInSpa -or $wrongInWeb) {
    $newSpaUris = ($spaUris + $RedirectUris | Select-Object -Unique)
    $newWebUris = $webUris | Where-Object { $RedirectUris -notcontains $_ }
    $spaBody = @{
        spa = @{ redirectUris = @($newSpaUris) }
        web = @{ redirectUris = @($newWebUris) }
    } | ConvertTo-Json -Depth 4 -Compress
    Patch-Graph "https://graph.microsoft.com/v1.0/applications/$uiObjId" $spaBody
    Write-Ok "SPA redirect URIs updated: $($newSpaUris -join ', ')"
    if ($wrongInWeb) { Write-Ok "Removed $($wrongInWeb.Count) URI(s) from Web platform" }
} else {
    Write-Skip "SPA redirect URIs already correct"
}

# ─── 8. Optional: Assign Admin role to a user on the API enterprise app ──────
if ($AdminUserUpn) {
    Write-Step "Assigning Admin role to $AdminUserUpn on API enterprise app..."

    # Ensure the API SP exists
    $apiSp = az ad sp list --filter "appId eq '$apiAppId'" --query "[0]" -o json 2>&1 | ConvertFrom-Json
    if (-not $apiSp) {
        Write-Host "  Creating API service principal..."
        $apiSp = az ad sp create --id $apiAppId -o json 2>&1 | ConvertFrom-Json
        Write-Ok "Service principal created: $($apiSp.id)"
    }
    $apiSpId = $apiSp.id

    # Get user object ID
    $userObj = az ad user show --id $AdminUserUpn --query "id" -o tsv 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Warn "User '$AdminUserUpn' not found - skipping role assignment"; }
    else {
        $existing = az rest --method GET `
            --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$apiSpId/appRoleAssignedTo" `
            -o json 2>&1 | ConvertFrom-Json
        $alreadyAssigned = $existing.value | Where-Object {
            $_.principalId -eq $userObj -and $_.appRoleId -eq $ROLE_ADMIN_ID
        }
        if (-not $alreadyAssigned) {
            $assignBody = @{
                principalId = $userObj
                resourceId  = $apiSpId
                appRoleId   = $ROLE_ADMIN_ID
            } | ConvertTo-Json -Compress
            Post-Graph "https://graph.microsoft.com/v1.0/users/$userObj/appRoleAssignments" $assignBody | Out-Null
            Write-Ok "Admin role assigned to $AdminUserUpn"
        } else {
            Write-Skip "Admin role already assigned to $AdminUserUpn"
        }
    }
}

# ─── Summary ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Entra ID Setup Complete" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  UI  app (BHS Development UI) :"
Write-Host "    appId    : $uiAppId"
Write-Host "    objectId : $uiObjId"
Write-Host ""
Write-Host "  API app (BHS Development API) :"
Write-Host "    appId    : $apiAppId"
Write-Host "    objectId : $apiObjId"
Write-Host ""
Write-Host "  Use these values in:"
Write-Host "    - infrastructure/bicep/parameters/aks-dev.parameters.json"
Write-Host "      azureAdClientId    = $uiAppId"
Write-Host "      azureAdApiClientId = $apiAppId"
Write-Host "    - BehavioralHealthSystem.Web/.env.development"
Write-Host "      VITE_AZURE_CLIENT_ID     = $uiAppId"
Write-Host "      VITE_AZURE_API_CLIENT_ID = $apiAppId"
Write-Host ""
Write-Host "  To assign Admin role to a user:" -ForegroundColor Yellow
Write-Host "    .\Setup-EntraID.ps1 -AdminUserUpn user@contoso.com" -ForegroundColor Yellow
