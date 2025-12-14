<#
.SYNOPSIS
    Sets required secrets in Azure Key Vault for the Behavioral Health System.

.DESCRIPTION
    This script stores sensitive configuration values as secrets in Azure Key Vault.
    The Function App uses managed identity to retrieve these secrets at runtime.

.PARAMETER Environment
    The environment name (e.g., 'dev', 'staging', 'prod'). Used to find the Key Vault.

.PARAMETER ResourceGroupName
    The Azure resource group containing the Key Vault.

.PARAMETER KeyVaultName
    Optional. Specify the Key Vault name directly. If not provided, it will be discovered.

.PARAMETER KintsugiApiKey
    The Kintsugi API key for voice analysis.

.PARAMETER AzureSpeechKey
    The Azure Speech Services subscription key.

.PARAMETER AzureSpeechRegion
    The Azure Speech Services region (e.g., 'eastus2').

.EXAMPLE
    .\Set-KeyVaultSecrets.ps1 -Environment dev -ResourceGroupName bhs-development-public -KintsugiApiKey "your-key"

.EXAMPLE
    .\Set-KeyVaultSecrets.ps1 -Environment dev -ResourceGroupName bhs-development-public -KintsugiApiKey "your-key" -AzureSpeechKey "speech-key" -AzureSpeechRegion "eastus2"
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'staging', 'prod', 'development', 'production')]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory = $false)]
    [string]$KeyVaultName,

    [Parameter(Mandatory = $false)]
    [string]$KintsugiApiKey,

    [Parameter(Mandatory = $false)]
    [string]$AzureSpeechKey,

    [Parameter(Mandatory = $false)]
    [string]$AzureSpeechRegion
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Set Key Vault Secrets                     " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Discover Key Vault name if not provided
if (-not $KeyVaultName) {
    Write-Host "[*] Discovering Key Vault in resource group '$ResourceGroupName'..."
    $KeyVaultName = az keyvault list --resource-group $ResourceGroupName --query "[0].name" -o tsv
    if (-not $KeyVaultName) {
        Write-Host "[ERROR] No Key Vault found in resource group '$ResourceGroupName'" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[OK] Using Key Vault: $KeyVaultName" -ForegroundColor Green
Write-Host ""

# Check if user has permissions
Write-Host "[*] Checking Key Vault access permissions..."
$canSetSecrets = $true
try {
    # Try to list secrets to check permissions
    az keyvault secret list --vault-name $KeyVaultName --query "[0].name" -o tsv 2>$null | Out-Null
} catch {
    $canSetSecrets = $false
}

if (-not $canSetSecrets) {
    Write-Host "[WARNING] You may not have permission to set secrets. Attempting to grant access..." -ForegroundColor Yellow
    $userId = az ad signed-in-user show --query id -o tsv
    $keyVaultId = az keyvault show --name $KeyVaultName --query id -o tsv

    # Grant Key Vault Secrets Officer role
    az role assignment create `
        --role "Key Vault Secrets Officer" `
        --assignee $userId `
        --scope $keyVaultId `
        --output none 2>$null

    Write-Host "[OK] Role assignment created. Waiting for propagation..." -ForegroundColor Green
    Start-Sleep -Seconds 10
}

# Track secrets set
$secretsSet = @()
$secretsFailed = @()

# Set Kintsugi API Key
if ($KintsugiApiKey) {
    Write-Host "[*] Setting KintsugiApiKey..."
    try {
        az keyvault secret set --vault-name $KeyVaultName --name "KintsugiApiKey" --value $KintsugiApiKey --output none
        $secretsSet += "KintsugiApiKey"
        Write-Host "[OK] KintsugiApiKey set successfully" -ForegroundColor Green
    } catch {
        $secretsFailed += "KintsugiApiKey"
        Write-Host "[ERROR] Failed to set KintsugiApiKey: $_" -ForegroundColor Red
    }
}

# Set Azure Speech Key
if ($AzureSpeechKey) {
    Write-Host "[*] Setting AzureSpeechKey..."
    try {
        az keyvault secret set --vault-name $KeyVaultName --name "AzureSpeechKey" --value $AzureSpeechKey --output none
        $secretsSet += "AzureSpeechKey"
        Write-Host "[OK] AzureSpeechKey set successfully" -ForegroundColor Green
    } catch {
        $secretsFailed += "AzureSpeechKey"
        Write-Host "[ERROR] Failed to set AzureSpeechKey: $_" -ForegroundColor Red
    }
}

# Set Azure Speech Region (not really a secret, but useful to have in Key Vault for consistency)
if ($AzureSpeechRegion) {
    Write-Host "[*] Setting AzureSpeechRegion..."
    try {
        az keyvault secret set --vault-name $KeyVaultName --name "AzureSpeechRegion" --value $AzureSpeechRegion --output none
        $secretsSet += "AzureSpeechRegion"
        Write-Host "[OK] AzureSpeechRegion set successfully" -ForegroundColor Green
    } catch {
        $secretsFailed += "AzureSpeechRegion"
        Write-Host "[ERROR] Failed to set AzureSpeechRegion: $_" -ForegroundColor Red
    }
}

# Summary
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Summary                                   " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Key Vault: $KeyVaultName"
Write-Host "Key Vault URI: https://$KeyVaultName.vault.azure.net/"
Write-Host ""

if ($secretsSet.Count -gt 0) {
    Write-Host "Secrets set successfully:" -ForegroundColor Green
    foreach ($secret in $secretsSet) {
        Write-Host "  - $secret" -ForegroundColor Green
    }
}

if ($secretsFailed.Count -gt 0) {
    Write-Host ""
    Write-Host "Secrets that failed:" -ForegroundColor Red
    foreach ($secret in $secretsFailed) {
        Write-Host "  - $secret" -ForegroundColor Red
    }
    exit 1
}

if ($secretsSet.Count -eq 0) {
    Write-Host "[INFO] No secrets were specified to set." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Available parameters:" -ForegroundColor Yellow
    Write-Host "  -KintsugiApiKey    : Kintsugi voice analysis API key"
    Write-Host "  -AzureSpeechKey    : Azure Speech Services subscription key"
    Write-Host "  -AzureSpeechRegion : Azure Speech Services region"
    Write-Host ""
    Write-Host "Example:" -ForegroundColor Cyan
    Write-Host "  .\Set-KeyVaultSecrets.ps1 -Environment dev -ResourceGroupName bhs-development-public -KintsugiApiKey 'your-key'"
}

Write-Host ""
Write-Host "[DONE] Key Vault secrets configuration complete." -ForegroundColor Green
