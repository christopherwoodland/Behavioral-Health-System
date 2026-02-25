<#
.SYNOPSIS
    Copy secrets from source Key Vault to destination Key Vault

.DESCRIPTION
    This script copies all secrets from bhs-dev-kv-4exbxrzknexso to bhs-dev-kv-rj77afv4h374e
    Run this from the jump box VM (vm-paarq) that has network access to both vaults.

.EXAMPLE
    .\copy-keyvault-secrets.ps1
#>

$ErrorActionPreference = "Stop"

$sourceVault = "bhs-dev-kv-4exbxrzknexso"
$destVault = "bhs-dev-kv-rj77afv4h374e"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Key Vault Secret Copy Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Source:      $sourceVault"
Write-Host "Destination: $destVault"
Write-Host ""

# Login to Azure if needed
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Logging in to Azure..." -ForegroundColor Yellow
    az login
}
else {
    Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green
}

# Get all secrets from source vault
Write-Host ""
Write-Host "Fetching secrets from source vault..." -ForegroundColor Yellow
$secretNames = az keyvault secret list --vault-name $sourceVault --query "[].name" --output tsv

if (-not $secretNames) {
    Write-Host "No secrets found in source vault or access denied." -ForegroundColor Red
    exit 1
}

$secrets = $secretNames -split "`n" | Where-Object { $_ -ne "" }
Write-Host "Found $($secrets.Count) secrets to copy:" -ForegroundColor Green
$secrets | ForEach-Object { Write-Host "  - $_" }

Write-Host ""
Write-Host "Copying secrets..." -ForegroundColor Yellow

$copied = 0
$failed = 0

foreach ($secretName in $secrets) {
    try {
        Write-Host "  Copying '$secretName'..." -NoNewline

        # Get secret value from source
        $secretValue = az keyvault secret show --vault-name $sourceVault --name $secretName --query "value" --output tsv

        if ($secretValue) {
            # Set secret in destination
            az keyvault secret set --vault-name $destVault --name $secretName --value $secretValue --output none 2>$null
            Write-Host " Done" -ForegroundColor Green
            $copied++
        }
        else {
            Write-Host " SKIPPED (empty value)" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host " FAILED: $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Copied: $copied" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "============================================" -ForegroundColor Cyan

# Verify secrets in destination
Write-Host ""
Write-Host "Verifying secrets in destination vault..." -ForegroundColor Yellow
$destSecrets = az keyvault secret list --vault-name $destVault --query "[].name" --output tsv
$destSecrets -split "`n" | Where-Object { $_ -ne "" } | ForEach-Object { Write-Host "  - $_" -ForegroundColor Green }

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
