<#
.SYNOPSIS
Configures Azure RBAC permissions for Managed Identity and services.

.DESCRIPTION
This script sets up role-based access control (RBAC) for:
- Function App Managed Identity to access storage, Key Vault, and cognitive services
- Deployment user permissions
- Cross-service access permissions

.PARAMETER ResourceGroupName
The name of the resource group containing the resources.

.PARAMETER FunctionAppPrincipalId
The principal ID of the Function App's Managed Identity.

.PARAMETER StorageAccountName
The name of the storage account.

.PARAMETER KeyVaultName
The name of the Key Vault.

.PARAMETER SubscriptionId
The Azure subscription ID.

.EXAMPLE
.\Configure-Permissions.ps1 `
    -ResourceGroupName "bhs-dev-rg" `
    -FunctionAppPrincipalId "00000000-0000-0000-0000-000000000000" `
    -StorageAccountName "bhsdevstg123abc" `
    -KeyVaultName "bhs-dev-kv-123abc" `
    -SubscriptionId "00000000-0000-0000-0000-000000000000"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory = $true)]
    [string]$FunctionAppPrincipalId,

    [Parameter(Mandatory = $true)]
    [string]$StorageAccountName,

    [Parameter(Mandatory = $true)]
    [string]$KeyVaultName,

    [Parameter(Mandatory = $true)]
    [string]$SubscriptionId
)

# Set error action preference
$ErrorActionPreference = 'Stop'

# Colors for output
$Green = 'Green'
$Yellow = 'Yellow'

function Write-Status {
    param(
        [string]$Message,
        [string]$Color = 'Cyan'
    )
    Write-Host "► $Message" -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor $Green
}

try {
    # Set subscription
    Write-Status "Setting subscription to: $SubscriptionId"
    az account set --subscription $SubscriptionId

    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗"
    Write-Host "║         CONFIGURING RBAC PERMISSIONS                          ║"
    Write-Host "╚════════════════════════════════════════════════════════════════╝"
    Write-Host ""

    # Get resource IDs
    Write-Status "Retrieving resource information..."
    $storageAccountId = az storage account show --name $StorageAccountName --resource-group $ResourceGroupName --query id --output tsv
    $keyVaultId = az keyvault show --name $KeyVaultName --query id --output tsv
    $subscriptionId = "/subscriptions/$SubscriptionId"

    # Storage Blob Data Contributor for Function App
    Write-Status "Assigning Storage Blob Data Contributor role to Function App Managed Identity..."
    az role assignment create `
        --assignee-object-id $FunctionAppPrincipalId `
        --role "Storage Blob Data Contributor" `
        --scope $storageAccountId
    Write-Success "Storage Blob Data Contributor role assigned"

    # Key Vault Secrets User for Function App
    Write-Status "Assigning Key Vault Secrets User role to Function App Managed Identity..."
    az role assignment create `
        --assignee-object-id $FunctionAppPrincipalId `
        --role "Key Vault Secrets User" `
        --scope $keyVaultId
    Write-Success "Key Vault Secrets User role assigned"

    # Cognitive Services User for OpenAI
    Write-Status "Assigning Cognitive Services User role for Azure OpenAI..."
    $openaiAccounts = az cognitiveservices account list --resource-group $ResourceGroupName --query "[?kind=='OpenAI']" --output json | ConvertFrom-Json
    foreach ($account in $openaiAccounts) {
        az role assignment create `
            --assignee-object-id $FunctionAppPrincipalId `
            --role "Cognitive Services User" `
            --scope $account.id
        Write-Success "Cognitive Services User role assigned for $($account.name)"
    }

    # Cognitive Services User for Document Intelligence
    Write-Status "Assigning Cognitive Services User role for Document Intelligence..."
    $docIntelAccounts = az cognitiveservices account list --resource-group $ResourceGroupName --query "[?kind=='FormRecognizer']" --output json | ConvertFrom-Json
    foreach ($account in $docIntelAccounts) {
        az role assignment create `
            --assignee-object-id $FunctionAppPrincipalId `
            --role "Cognitive Services User" `
            --scope $account.id
        Write-Success "Cognitive Services User role assigned for $($account.name)"
    }

    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor $Green
    Write-Host "║            RBAC PERMISSIONS CONFIGURED SUCCESSFULLY           ║" -ForegroundColor $Green
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor $Green
    Write-Host ""

    Write-Host "✓ Function App now has access to:" -ForegroundColor $Green
    Write-Host "  • Storage Account (Blob Data Contributor)"
    Write-Host "  • Key Vault (Secrets User)"
    Write-Host "  • Azure OpenAI (Cognitive Services User)"
    Write-Host "  • Document Intelligence (Cognitive Services User)"
    Write-Host ""
}
catch {
    Write-Host "✗ An error occurred: $_" -ForegroundColor 'Red'
    exit 1
}
