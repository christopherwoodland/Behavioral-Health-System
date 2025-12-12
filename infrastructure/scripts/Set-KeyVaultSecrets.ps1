<#
.SYNOPSIS
    Sets Kintsugi Health API key in Azure Key Vault

.DESCRIPTION
    This script sets the Kintsugi Health API key in Key Vault.
    Azure services use managed identity for other credentials.

.PARAMETER Environment
    Environment name (dev, staging, prod). Required.

.PARAMETER ResourceGroupName
    Optional custom resource group name. Defaults to bhs-{Environment}.

.PARAMETER KeyVaultName
    Optional Key Vault name. If not provided, will be auto-discovered from deployment.

.PARAMETER KintsugiApiKey
    Kintsugi Health API key for mental health risk assessment

.EXAMPLE
    .\Set-KeyVaultSecrets.ps1 -Environment dev

.EXAMPLE
    .\Set-KeyVaultSecrets.ps1 -Environment dev -ResourceGroupName bhs-development -KeyVaultName bhs-dev-kv -KintsugiApiKey "your-key"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment,

    [Parameter(Mandatory = $false)]
    [string]$ResourceGroupName = "",

    [Parameter(Mandatory = $false)]
    [string]$KeyVaultName = "",

    [Parameter(Mandatory = $false)]
    [string]$KintsugiApiKey = ""
)

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Kintsugi Health API Key Configuration" -ForegroundColor Cyan
Write-Host "  Behavioral Health System - $Environment Environment" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Determine resource group name
$rgName = if ($ResourceGroupName) { $ResourceGroupName } else { "bhs-$Environment" }

Write-Host "[*] Using resource group: $rgName" -ForegroundColor Yellow

if ($KeyVaultName) {
    Write-Host "[*] Using specified Key Vault: $KeyVaultName" -ForegroundColor Yellow
    $kvName = $KeyVaultName
} else {
    Write-Host "[*] Auto-discovering Key Vault name from deployment..." -ForegroundColor Yellow

    try {
        $deployment = az deployment group list --resource-group $rgName --query "[?contains(name, 'bhs-$Environment')].{name:name, timestamp:properties.timestamp}" --output json | ConvertFrom-Json | Sort-Object -Property timestamp -Descending | Select-Object -First 1

        if (-not $deployment) {
            Write-Host "[!] No deployment found in resource group $rgName" -ForegroundColor Red
            exit 1
        }

        $outputs = az deployment group show --resource-group $rgName --name $deployment.name --query "properties.outputs.keyVaultName.value" --output tsv

        if (-not $outputs) {
            Write-Host "[!] Could not retrieve Key Vault name from deployment outputs" -ForegroundColor Red
            exit 1
        }

        $kvName = $outputs
    }
    catch {
        Write-Host "[!] Error retrieving Key Vault name: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[OK] Found Key Vault: $kvName" -ForegroundColor Green
Write-Host ""
Write-Host "Note: Azure services use managed identity for authentication." -ForegroundColor Gray
Write-Host "Only Kintsugi Health API key needs to be set manually." -ForegroundColor Gray
Write-Host ""

function Get-SecretValue {
    param(
        [string]$SecretName,
        [string]$Description,
        [string]$ProvidedValue
    )

    if ($ProvidedValue) {
        return $ProvidedValue
    }

    do {
        $secret = Read-Host "Enter $Description" -AsSecureString
        $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
        $value = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

        if ([string]::IsNullOrWhiteSpace($value)) {
            Write-Host "[!] This secret is required. Please provide a value." -ForegroundColor Red
        }
    } while ([string]::IsNullOrWhiteSpace($value))

    return $value
}

Write-Host "Please provide the Kintsugi Health API key:" -ForegroundColor Cyan
Write-Host "(Secrets will not be displayed on screen)" -ForegroundColor Gray
Write-Host ""

$kintsugiValue = Get-SecretValue -SecretName 'KINTSUGI-API-KEY' -Description 'Kintsugi Health API Key' -ProvidedValue $KintsugiApiKey

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Setting Secret in Key Vault" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0

Write-Host "[*] Setting secret: KINTSUGI-API-KEY" -ForegroundColor Yellow

try {
    az keyvault secret set --vault-name $kvName --name KINTSUGI-API-KEY --value $kintsugiValue --output none
    Write-Host "[OK] Successfully set: KINTSUGI-API-KEY" -ForegroundColor Green
    $successCount++
}
catch {
    Write-Host "[!] Failed to set: KINTSUGI-API-KEY" -ForegroundColor Red
    Write-Host "    Error: $_" -ForegroundColor Red
    $failCount++
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Key Vault: $kvName" -ForegroundColor White
Write-Host "Secrets set successfully: $successCount / 1" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "Secrets failed: $failCount" -ForegroundColor Red
    exit 1
}
Write-Host ""
Write-Host "[OK] Kintsugi Health API key configured successfully!" -ForegroundColor Green
Write-Host ""
