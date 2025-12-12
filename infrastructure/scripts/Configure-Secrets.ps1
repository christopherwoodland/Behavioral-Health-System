<#
.SYNOPSIS
Configures secrets and credentials in Azure Key Vault for the Behavioral Health System.

.DESCRIPTION
This script populates the Key Vault with all necessary secrets and API keys:
- Kintsugi API credentials
- Document Intelligence API keys
- Azure OpenAI credentials
- Application configuration values

.PARAMETER KeyVaultName
The name of the Key Vault to configure.

.PARAMETER SubscriptionId
The Azure subscription ID containing the Key Vault.

.EXAMPLE
.\Configure-Secrets.ps1 -KeyVaultName "bhs-dev-kv-abc123" -SubscriptionId "00000000-0000-0000-0000-000000000000"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$KeyVaultName,

    [Parameter(Mandatory = $true)]
    [string]$SubscriptionId,

    [Parameter(Mandatory = $false)]
    [string]$Environment = 'dev'
)

# Set error action preference
$ErrorActionPreference = 'Stop'

# Colors for output
$Green = 'Green'
$Yellow = 'Yellow'
$Red = 'Red'

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

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor $Red
}

function Get-SecureInput {
    param(
        [string]$Prompt
    )
    $credential = Read-Host -Prompt $Prompt -AsSecureString
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($credential))
}

try {
    # Set subscription
    Write-Status "Setting subscription to: $SubscriptionId"
    az account set --subscription $SubscriptionId
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to set subscription"
        exit 1
    }
    Write-Success "Subscription set"

    # Verify Key Vault exists
    Write-Status "Verifying Key Vault: $KeyVaultName"
    $kvExists = az keyvault show --name $KeyVaultName --query id --output tsv 2>$null
    if (-not $kvExists) {
        Write-Error "Key Vault not found: $KeyVaultName"
        exit 1
    }
    Write-Success "Key Vault found"

    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗"
    Write-Host "║         CONFIGURE KEY VAULT SECRETS                           ║"
    Write-Host "╚════════════════════════════════════════════════════════════════╝"
    Write-Host ""

    # Get and store secrets
    Write-Status "Enter your API credentials (these will be stored securely in Key Vault)"
    Write-Host ""

    # Kintsugi API Key
    Write-Host "🏥 Kintsugi API Configuration:" -ForegroundColor $Green
    $kintsugiApiKey = Get-SecureInput "Enter Kintsugi API Key"
    if ($kintsugiApiKey) {
        Write-Status "Setting Kintsugi API Key..."
        az keyvault secret set `
            --vault-name $KeyVaultName `
            --name "KintsugiApiKey" `
            --value $kintsugiApiKey
        Write-Success "Kintsugi API Key stored"
    }

    # Azure OpenAI Configuration
    Write-Host ""
    Write-Host "🤖 Azure OpenAI Configuration:" -ForegroundColor $Green
    $openaiEndpoint = Read-Host "Enter Azure OpenAI Endpoint (e.g., https://xxx.openai.azure.com/)"
    if ($openaiEndpoint) {
        Write-Status "Setting Azure OpenAI Endpoint..."
        az keyvault secret set `
            --vault-name $KeyVaultName `
            --name "AzureOpenAIEndpoint" `
            --value $openaiEndpoint
        Write-Success "Azure OpenAI Endpoint stored"
    }

    # Document Intelligence Configuration
    Write-Host ""
    Write-Host "📄 Document Intelligence Configuration:" -ForegroundColor $Green
    $docIntelEndpoint = Read-Host "Enter Document Intelligence Endpoint (e.g., https://xxx.cognitiveservices.azure.com/)"
    if ($docIntelEndpoint) {
        Write-Status "Setting Document Intelligence Endpoint..."
        az keyvault secret set `
            --vault-name $KeyVaultName `
            --name "DocumentIntelligenceEndpoint" `
            --value $docIntelEndpoint
        Write-Success "Document Intelligence Endpoint stored"
    }

    # Content Understanding Configuration
    Write-Host ""
    Write-Host "🔍 Content Understanding Configuration:" -ForegroundColor $Green
    $contentEndpoint = Read-Host "Enter Content Understanding Endpoint (e.g., https://xxx.services.ai.azure.com/)"
    if ($contentEndpoint) {
        Write-Status "Setting Content Understanding Endpoint..."
        az keyvault secret set `
            --vault-name $KeyVaultName `
            --name "ContentUnderstandingEndpoint" `
            --value $contentEndpoint
        Write-Success "Content Understanding Endpoint stored"
    }

    # GPT Realtime Configuration
    Write-Host ""
    Write-Host "🎤 GPT Realtime Configuration:" -ForegroundColor $Green
    $realtimeEndpoint = Read-Host "Enter GPT Realtime Endpoint (usually same as OpenAI endpoint)"
    if ($realtimeEndpoint) {
        Write-Status "Setting GPT Realtime Endpoint..."
        az keyvault secret set `
            --vault-name $KeyVaultName `
            --name "GPTRealtimeEndpoint" `
            --value $realtimeEndpoint
        Write-Success "GPT Realtime Endpoint stored"
    }

    # Azure AD Configuration
    Write-Host ""
    Write-Host "🔐 Azure AD Configuration:" -ForegroundColor $Green
    $azureClientId = Read-Host "Enter Azure Client ID (Azure AD App Registration ID)"
    if ($azureClientId) {
        Write-Status "Setting Azure Client ID..."
        az keyvault secret set `
            --vault-name $KeyVaultName `
            --name "AzureClientId" `
            --value $azureClientId
        Write-Success "Azure Client ID stored"
    }

    # Application Insights Configuration
    Write-Host ""
    Write-Host "📊 Application Insights Configuration:" -ForegroundColor $Green
    $appInsightsKey = Get-SecureInput "Enter Application Insights Instrumentation Key (optional, press Enter to skip)"
    if ($appInsightsKey) {
        Write-Status "Setting Application Insights Instrumentation Key..."
        az keyvault secret set `
            --vault-name $KeyVaultName `
            --name "ApplicationInsightsInstrumentationKey" `
            --value $appInsightsKey
        Write-Success "Application Insights Instrumentation Key stored"
    }

    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor $Green
    Write-Host "║            KEY VAULT CONFIGURATION COMPLETED                  ║" -ForegroundColor $Green
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor $Green
    Write-Host ""

    # List stored secrets
    Write-Status "Stored secrets in Key Vault:"
    az keyvault secret list --vault-name $KeyVaultName --query "[].name" --output table

    Write-Host ""
    Write-Host "✓ All secrets have been securely stored in Key Vault" -ForegroundColor $Green
    Write-Host ""
    Write-Host "🔒 Security Notes:" -ForegroundColor $Yellow
    Write-Host "   • Secrets are encrypted at rest in Azure Key Vault"
    Write-Host "   • Access is controlled via Azure RBAC"
    Write-Host "   • Function App uses Managed Identity to access secrets"
    Write-Host "   • No secrets are stored in application code or config files"
    Write-Host ""
}
catch {
    Write-Error "An error occurred: $_"
    exit 1
}
