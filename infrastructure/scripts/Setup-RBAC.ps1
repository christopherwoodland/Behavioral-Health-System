<#
.SYNOPSIS
    Sets up RBAC role assignments for the Behavioral Health System Azure resources.

.DESCRIPTION
    This script grants necessary Azure RBAC role assignments for:
    - Current user to manage Key Vault secrets
    - Function App managed identity to access resources
    - Web App managed identity to access resources (if applicable)

.PARAMETER Environment
    The environment name (e.g., 'dev', 'staging', 'prod').

.PARAMETER ResourceGroupName
    The Azure resource group containing the resources.

.PARAMETER GrantUserAccess
    If specified, grants the current signed-in user access to Key Vault.

.EXAMPLE
    .\Setup-RBAC.ps1 -Environment dev -ResourceGroupName bhs-development-public

.EXAMPLE
    .\Setup-RBAC.ps1 -Environment dev -ResourceGroupName bhs-development-public -GrantUserAccess
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'staging', 'prod', 'development', 'production')]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,

    [switch]$GrantUserAccess
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Setup RBAC Role Assignments               " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Azure RBAC Role Definition IDs
$roles = @{
    "KeyVaultSecretsOfficer" = "b86a8fe4-44ce-4948-aee5-eccb2c155cd7"
    "KeyVaultSecretsUser" = "4633458b-17de-408a-b874-0445c86b69e6"
    "CognitiveServicesUser" = "a97b65f3-24c7-4388-baec-2e87135dc908"
    "StorageBlobDataContributor" = "ba92f5b4-2d11-453d-a403-e96b0029c9fe"
    "StorageBlobDataReader" = "2a2b9908-6ea1-4ae2-8e65-a410df84e7d1"
}

Write-Host "[*] Discovering resources in '$ResourceGroupName'..."

# Get resource group ID
$rgId = az group show --name $ResourceGroupName --query id -o tsv
if (-not $rgId) {
    Write-Host "[ERROR] Resource group '$ResourceGroupName' not found" -ForegroundColor Red
    exit 1
}

# Discover resources
$keyVault = az keyvault list --resource-group $ResourceGroupName --query "[0]" -o json | ConvertFrom-Json
$functionApp = az functionapp list --resource-group $ResourceGroupName --query "[0]" -o json | ConvertFrom-Json
$webApp = az webapp list --resource-group $ResourceGroupName --query "[?kind=='app,linux']" -o json | ConvertFrom-Json | Select-Object -First 1
$storageAccount = az storage account list --resource-group $ResourceGroupName --query "[0]" -o json | ConvertFrom-Json
$cognitiveAccounts = az cognitiveservices account list --resource-group $ResourceGroupName -o json | ConvertFrom-Json

Write-Host ""
Write-Host "Discovered Resources:" -ForegroundColor Yellow
if ($keyVault) { Write-Host "  Key Vault:        $($keyVault.name)" }
if ($functionApp) { Write-Host "  Function App:     $($functionApp.name)" }
if ($webApp) { Write-Host "  Web App:          $($webApp.name)" }
if ($storageAccount) { Write-Host "  Storage Account:  $($storageAccount.name)" }
if ($cognitiveAccounts) {
    foreach ($cog in $cognitiveAccounts) {
        Write-Host "  Cognitive Svc:    $($cog.name) ($($cog.kind))"
    }
}
Write-Host ""

# Track assignments
$assignmentsCreated = @()
$assignmentsFailed = @()
$assignmentsSkipped = @()

function New-RoleAssignmentSafe {
    param(
        [string]$RoleName,
        [string]$RoleId,
        [string]$PrincipalId,
        [string]$PrincipalType,
        [string]$Scope,
        [string]$Description
    )

    Write-Host "[*] $Description..."

    # Check if assignment already exists
    $existing = az role assignment list --assignee $PrincipalId --role $RoleId --scope $Scope -o json 2>$null | ConvertFrom-Json

    if ($existing -and $existing.Count -gt 0) {
        Write-Host "    [SKIP] Role assignment already exists" -ForegroundColor DarkGray
        $script:assignmentsSkipped += $Description
        return $true
    }

    try {
        az role assignment create `
            --role $RoleId `
            --assignee-object-id $PrincipalId `
            --assignee-principal-type $PrincipalType `
            --scope $Scope `
            --output none 2>$null

        Write-Host "    [OK] Role assigned" -ForegroundColor Green
        $script:assignmentsCreated += $Description
        return $true
    } catch {
        Write-Host "    [ERROR] Failed: $_" -ForegroundColor Red
        $script:assignmentsFailed += $Description
        return $false
    }
}

# ============================================
# USER ACCESS (Optional)
# ============================================
if ($GrantUserAccess) {
    Write-Host ""
    Write-Host "--- User Access ---" -ForegroundColor Cyan

    $userId = az ad signed-in-user show --query id -o tsv
    $userName = az ad signed-in-user show --query userPrincipalName -o tsv
    Write-Host "Current User: $userName ($userId)"

    if ($keyVault) {
        New-RoleAssignmentSafe `
            -RoleName "KeyVaultSecretsOfficer" `
            -RoleId $roles.KeyVaultSecretsOfficer `
            -PrincipalId $userId `
            -PrincipalType "User" `
            -Scope $keyVault.id `
            -Description "User -> Key Vault Secrets Officer"
    }
}

# ============================================
# FUNCTION APP MANAGED IDENTITY
# ============================================
if ($functionApp) {
    Write-Host ""
    Write-Host "--- Function App Managed Identity ---" -ForegroundColor Cyan

    $funcPrincipalId = $functionApp.identity.principalId
    if (-not $funcPrincipalId) {
        Write-Host "[WARNING] Function App does not have a managed identity enabled" -ForegroundColor Yellow
    } else {
        Write-Host "Principal ID: $funcPrincipalId"

        # Key Vault Secrets User
        if ($keyVault) {
            New-RoleAssignmentSafe `
                -RoleName "KeyVaultSecretsUser" `
                -RoleId $roles.KeyVaultSecretsUser `
                -PrincipalId $funcPrincipalId `
                -PrincipalType "ServicePrincipal" `
                -Scope $keyVault.id `
                -Description "Function App -> Key Vault Secrets User"
        }

        # Storage Blob Data Contributor
        if ($storageAccount) {
            New-RoleAssignmentSafe `
                -RoleName "StorageBlobDataContributor" `
                -RoleId $roles.StorageBlobDataContributor `
                -PrincipalId $funcPrincipalId `
                -PrincipalType "ServicePrincipal" `
                -Scope $storageAccount.id `
                -Description "Function App -> Storage Blob Data Contributor"
        }

        # Cognitive Services User for each cognitive account
        foreach ($cog in $cognitiveAccounts) {
            New-RoleAssignmentSafe `
                -RoleName "CognitiveServicesUser" `
                -RoleId $roles.CognitiveServicesUser `
                -PrincipalId $funcPrincipalId `
                -PrincipalType "ServicePrincipal" `
                -Scope $cog.id `
                -Description "Function App -> Cognitive Services User ($($cog.name))"
        }
    }
}

# ============================================
# WEB APP MANAGED IDENTITY
# ============================================
if ($webApp) {
    Write-Host ""
    Write-Host "--- Web App Managed Identity ---" -ForegroundColor Cyan

    $webPrincipalId = $webApp.identity.principalId
    if (-not $webPrincipalId) {
        Write-Host "[WARNING] Web App does not have a managed identity enabled" -ForegroundColor Yellow
    } else {
        Write-Host "Principal ID: $webPrincipalId"

        # Key Vault Secrets User
        if ($keyVault) {
            New-RoleAssignmentSafe `
                -RoleName "KeyVaultSecretsUser" `
                -RoleId $roles.KeyVaultSecretsUser `
                -PrincipalId $webPrincipalId `
                -PrincipalType "ServicePrincipal" `
                -Scope $keyVault.id `
                -Description "Web App -> Key Vault Secrets User"
        }

        # Storage Blob Data Reader (read-only for web app)
        if ($storageAccount) {
            New-RoleAssignmentSafe `
                -RoleName "StorageBlobDataReader" `
                -RoleId $roles.StorageBlobDataReader `
                -PrincipalId $webPrincipalId `
                -PrincipalType "ServicePrincipal" `
                -Scope $storageAccount.id `
                -Description "Web App -> Storage Blob Data Reader"
        }
    }
}

# ============================================
# SUMMARY
# ============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Summary                                   " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if ($assignmentsCreated.Count -gt 0) {
    Write-Host "Role assignments created:" -ForegroundColor Green
    foreach ($a in $assignmentsCreated) {
        Write-Host "  [+] $a" -ForegroundColor Green
    }
}

if ($assignmentsSkipped.Count -gt 0) {
    Write-Host ""
    Write-Host "Role assignments already existed (skipped):" -ForegroundColor DarkGray
    foreach ($a in $assignmentsSkipped) {
        Write-Host "  [=] $a" -ForegroundColor DarkGray
    }
}

if ($assignmentsFailed.Count -gt 0) {
    Write-Host ""
    Write-Host "Role assignments failed:" -ForegroundColor Red
    foreach ($a in $assignmentsFailed) {
        Write-Host "  [-] $a" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "[DONE] RBAC setup complete." -ForegroundColor Green

# Note about propagation
if ($assignmentsCreated.Count -gt 0) {
    Write-Host ""
    Write-Host "[INFO] Note: RBAC role assignments may take 5-10 minutes to propagate." -ForegroundColor Yellow
}
