<#
.SYNOPSIS
    Assigns RBAC roles to Function App managed identity for Azure service access

.DESCRIPTION
    This script assigns the necessary RBAC roles to the Function App's system-assigned
    managed identity, enabling it to access Azure OpenAI, Document Intelligence,
    Storage Account, and Key Vault without API keys.

.PARAMETER Environment
    Environment name (dev, staging, prod). Required.

.PARAMETER ResourceGroupName
    Optional custom resource group name. Defaults to bhs-{Environment}.

.PARAMETER FunctionAppName
    Optional Function App name. If not provided, will be retrieved from deployment outputs.

.PARAMETER OpenAIAccountName
    Optional Azure OpenAI account name. If not provided, will be auto-discovered.

.PARAMETER DocumentIntelligenceAccountName
    Optional Document Intelligence account name. If not provided, will be auto-discovered.

.PARAMETER StorageAccountName
    Optional Storage Account name. If not provided, will be auto-discovered.

.PARAMETER KeyVaultName
    Optional Key Vault name. If not provided, will be auto-discovered.

.EXAMPLE
    .\Set-ManagedIdentityRBAC-v2.ps1 -Environment dev

.EXAMPLE
    .\Set-ManagedIdentityRBAC-v2.ps1 -Environment dev -ResourceGroupName bhs-development

.EXAMPLE
    .\Set-ManagedIdentityRBAC-v2.ps1 -Environment dev -FunctionAppName bhs-dev-func-abc123

.EXAMPLE
    .\Set-ManagedIdentityRBAC-v2.ps1 -Environment dev -ResourceGroupName bhs-development -OpenAIAccountName openai-sesame-eastus-001 -StorageAccountName aistgvi -KeyVaultName bhs-dev-kv
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment,

    [Parameter(Mandatory = $false)]
    [string]$ResourceGroupName = "",

    [Parameter(Mandatory = $false)]
    [string]$FunctionAppName = "",

    [Parameter(Mandatory = $false)]
    [string]$OpenAIAccountName = "",

    [Parameter(Mandatory = $false)]
    [string]$DocumentIntelligenceAccountName = "",

    [Parameter(Mandatory = $false)]
    [string]$StorageAccountName = "",

    [Parameter(Mandatory = $false)]
    [string]$KeyVaultName = ""
)

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Azure Managed Identity RBAC Configuration" -ForegroundColor Cyan
Write-Host "  Behavioral Health System - $Environment Environment" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$rgName = if ($ResourceGroupName) { $ResourceGroupName } else { "bhs-$Environment" }

Write-Host "[*] Using resource group: $rgName" -ForegroundColor Yellow
Write-Host ""

if (-not $FunctionAppName) {
    Write-Host "[*] Looking up Function App name from deployment..." -ForegroundColor Yellow

    try {
        $deployment = az deployment group list --resource-group $rgName --query "[?contains(name, 'bhs-$Environment')].{name:name, timestamp:properties.timestamp}" --output json | ConvertFrom-Json | Sort-Object -Property timestamp -Descending | Select-Object -First 1

        if (-not $deployment) {
            Write-Host "[!] No deployment found in resource group $rgName" -ForegroundColor Red
            Write-Host "[!] Please specify Function App name manually with -FunctionAppName parameter" -ForegroundColor Red
            exit 1
        }

        $FunctionAppName = az deployment group show --resource-group $rgName --name $deployment.name --query "properties.outputs.functionAppName.value" --output tsv

        if (-not $FunctionAppName) {
            Write-Host "[!] Could not retrieve Function App name from deployment outputs" -ForegroundColor Red
            exit 1
        }

        Write-Host "[OK] Found Function App: $FunctionAppName" -ForegroundColor Green
    }
    catch {
        Write-Host "[!] Error retrieving Function App name: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[*] Retrieving managed identity principal ID..." -ForegroundColor Yellow

try {
    $principalId = az functionapp identity show --name $FunctionAppName --resource-group $rgName --query principalId --output tsv

    if (-not $principalId) {
        Write-Host "[!] Function App does not have a managed identity enabled" -ForegroundColor Red
        Write-Host "[!] Please enable system-assigned managed identity first" -ForegroundColor Red
        exit 1
    }

    Write-Host "[OK] Managed Identity Principal ID: $principalId" -ForegroundColor Green
}
catch {
    Write-Host "[!] Error retrieving managed identity: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Retrieving Azure Resource Information" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

if ($OpenAIAccountName) {
    Write-Host "[*] Using specified Azure OpenAI account: $OpenAIAccountName" -ForegroundColor Yellow
    $openaiAccountId = az cognitiveservices account show --name $OpenAIAccountName --resource-group $rgName --query id --output tsv
    if ($openaiAccountId) {
        Write-Host "[OK] Found OpenAI: $openaiAccountId" -ForegroundColor Green
    } else {
        Write-Host "[!] Azure OpenAI account '$OpenAIAccountName' not found" -ForegroundColor Red
    }
} else {
    Write-Host "[*] Auto-discovering Azure OpenAI account..." -ForegroundColor Yellow
    $openaiAccountId = az cognitiveservices account list --resource-group $rgName --query "[?kind=='OpenAI'].id | [0]" --output tsv
    if ($openaiAccountId) {
        Write-Host "[OK] Found OpenAI: $openaiAccountId" -ForegroundColor Green
    } else {
        Write-Host "[!] Azure OpenAI account not found" -ForegroundColor Red
    }
}

if ($DocumentIntelligenceAccountName) {
    Write-Host "[*] Using specified Document Intelligence account: $DocumentIntelligenceAccountName" -ForegroundColor Yellow
    $docIntelAccountId = az cognitiveservices account show --name $DocumentIntelligenceAccountName --resource-group $rgName --query id --output tsv
    if ($docIntelAccountId) {
        Write-Host "[OK] Found Document Intelligence: $docIntelAccountId" -ForegroundColor Green
    } else {
        Write-Host "[!] Document Intelligence account '$DocumentIntelligenceAccountName' not found" -ForegroundColor Red
    }
} else {
    Write-Host "[*] Auto-discovering Document Intelligence account..." -ForegroundColor Yellow
    $docIntelAccountId = az cognitiveservices account list --resource-group $rgName --query "[?kind=='FormRecognizer' || kind=='CognitiveServices'].id | [0]" --output tsv
    if ($docIntelAccountId) {
        Write-Host "[OK] Found Document Intelligence: $docIntelAccountId" -ForegroundColor Green
    } else {
        Write-Host "[!] Document Intelligence account not found" -ForegroundColor Red
    }
}

if ($StorageAccountName) {
    Write-Host "[*] Using specified Storage Account: $StorageAccountName" -ForegroundColor Yellow
    $storageAccountId = az storage account show --name $StorageAccountName --resource-group $rgName --query id --output tsv
    if ($storageAccountId) {
        Write-Host "[OK] Found Storage Account: $storageAccountId" -ForegroundColor Green
    } else {
        Write-Host "[!] Storage Account '$StorageAccountName' not found" -ForegroundColor Red
    }
} else {
    Write-Host "[*] Auto-discovering Storage Account..." -ForegroundColor Yellow
    $storageAccountId = az storage account list --resource-group $rgName --query "[0].id" --output tsv
    if ($storageAccountId) {
        Write-Host "[OK] Found Storage Account: $storageAccountId" -ForegroundColor Green
    } else {
        Write-Host "[!] Storage Account not found" -ForegroundColor Red
    }
}

if ($KeyVaultName) {
    Write-Host "[*] Using specified Key Vault: $KeyVaultName" -ForegroundColor Yellow
    $keyVaultId = az keyvault show --name $KeyVaultName --resource-group $rgName --query id --output tsv
    if ($keyVaultId) {
        Write-Host "[OK] Found Key Vault: $keyVaultId" -ForegroundColor Green
    } else {
        Write-Host "[!] Key Vault '$KeyVaultName' not found" -ForegroundColor Red
    }
} else {
    Write-Host "[*] Auto-discovering Key Vault..." -ForegroundColor Yellow
    $keyVaultId = az keyvault list --resource-group $rgName --query "[0].id" --output tsv
    if ($keyVaultId) {
        Write-Host "[OK] Found Key Vault: $keyVaultId" -ForegroundColor Green
    } else {
        Write-Host "[!] Key Vault not found" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Assigning RBAC Roles" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0
$skippedCount = 0

$roles = @{
    "Cognitive Services OpenAI User" = "5e0bd9bd-7b93-4f28-af87-19fc36ad61bd"
    "Cognitive Services User" = "a97b65f3-24c7-4388-baec-2e87135dc908"
    "Storage Blob Data Contributor" = "ba92f5b4-2d11-453d-a403-e96b0029c9fe"
    "Key Vault Secrets User" = "4633458b-17de-408a-b874-0445c86b69e6"
}

if ($openaiAccountId) {
    Write-Host "[*] Assigning 'Cognitive Services OpenAI User' role..." -ForegroundColor Yellow
    try {
        $null = az role assignment create --assignee $principalId --role $roles["Cognitive Services OpenAI User"] --scope $openaiAccountId --output none 2>&1
        Write-Host "[OK] Successfully assigned OpenAI access role" -ForegroundColor Green
        $successCount++
    }
    catch {
        if ($_.Exception.Message -match "already exists") {
            Write-Host "[>>] Role already assigned - skipping" -ForegroundColor Gray
            $skippedCount++
        } else {
            Write-Host "[!] Failed to assign OpenAI role: $_" -ForegroundColor Red
            $failCount++
        }
    }
    Write-Host ""
}

if ($docIntelAccountId) {
    Write-Host "[*] Assigning 'Cognitive Services User' role..." -ForegroundColor Yellow
    try {
        $null = az role assignment create --assignee $principalId --role $roles["Cognitive Services User"] --scope $docIntelAccountId --output none 2>&1
        Write-Host "[OK] Successfully assigned Document Intelligence access role" -ForegroundColor Green
        $successCount++
    }
    catch {
        if ($_.Exception.Message -match "already exists") {
            Write-Host "[>>] Role already assigned - skipping" -ForegroundColor Gray
            $skippedCount++
        } else {
            Write-Host "[!] Failed to assign Document Intelligence role: $_" -ForegroundColor Red
            $failCount++
        }
    }
    Write-Host ""
}

if ($storageAccountId) {
    Write-Host "[*] Assigning 'Storage Blob Data Contributor' role..." -ForegroundColor Yellow
    try {
        $null = az role assignment create --assignee $principalId --role $roles["Storage Blob Data Contributor"] --scope $storageAccountId --output none 2>&1
        Write-Host "[OK] Successfully assigned Storage access role" -ForegroundColor Green
        $successCount++
    }
    catch {
        if ($_.Exception.Message -match "already exists") {
            Write-Host "[>>] Role already assigned - skipping" -ForegroundColor Gray
            $skippedCount++
        } else {
            Write-Host "[!] Failed to assign Storage role: $_" -ForegroundColor Red
            $failCount++
        }
    }
    Write-Host ""
}

if ($keyVaultId) {
    Write-Host "[*] Assigning 'Key Vault Secrets User' role..." -ForegroundColor Yellow
    try {
        $null = az role assignment create --assignee $principalId --role $roles["Key Vault Secrets User"] --scope $keyVaultId --output none 2>&1
        Write-Host "[OK] Successfully assigned Key Vault access role" -ForegroundColor Green
        $successCount++
    }
    catch {
        if ($_.Exception.Message -match "already exists") {
            Write-Host "[>>] Role already assigned - skipping" -ForegroundColor Gray
            $skippedCount++
        } else {
            Write-Host "[!] Failed to assign Key Vault role: $_" -ForegroundColor Red
            $failCount++
        }
    }
    Write-Host ""
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Function App: $FunctionAppName" -ForegroundColor White
Write-Host "Principal ID: $principalId" -ForegroundColor White
Write-Host ""
Write-Host "Roles assigned successfully: $successCount" -ForegroundColor Green
if ($skippedCount -gt 0) {
    Write-Host "Roles already assigned: $skippedCount" -ForegroundColor Gray
}
if ($failCount -gt 0) {
    Write-Host "Roles failed: $failCount" -ForegroundColor Red
}
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "[+] Managed identity RBAC configuration complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Services now accessible via managed identity:" -ForegroundColor Cyan
    if ($openaiAccountId) { Write-Host "  + Azure OpenAI" -ForegroundColor Green }
    if ($docIntelAccountId) { Write-Host "  + Document Intelligence" -ForegroundColor Green }
    if ($storageAccountId) { Write-Host "  + Storage Account (Blob)" -ForegroundColor Green }
    if ($keyVaultId) { Write-Host "  + Key Vault (Secrets)" -ForegroundColor Green }
    Write-Host ""
    Write-Host "Note: RBAC role assignments may take 5-10 minutes to propagate." -ForegroundColor Yellow
} else {
    Write-Host "[!] Some role assignments failed. Please review errors above." -ForegroundColor Red
    exit 1
}

Write-Host ""
