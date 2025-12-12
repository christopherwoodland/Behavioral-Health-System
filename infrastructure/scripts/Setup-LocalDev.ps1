<#
.SYNOPSIS
Sets up local development environment with necessary configuration.

.DESCRIPTION
Configures the local development environment for the Behavioral Health System:
- Copies environment templates
- Sets up local.settings.json for Azure Functions
- Configures .env.local for React frontend
- Adds Key Vault references for local development

.PARAMETER KeyVaultName
The name of the Key Vault to reference for local development.

.PARAMETER ResourceGroupName
The name of the resource group.

.PARAMETER SubscriptionId
The Azure subscription ID.

.EXAMPLE
.\Setup-LocalDev.ps1 -KeyVaultName "bhs-dev-kv-abc123" -ResourceGroupName "bhs-dev-rg" -SubscriptionId "00000000-0000-0000-0000-000000000000"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$KeyVaultName,

    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,

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
    Write-Host "║         SETTING UP LOCAL DEVELOPMENT ENVIRONMENT              ║"
    Write-Host "╚════════════════════════════════════════════════════════════════╝"
    Write-Host ""

    # Get repository root
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)

    # Setup Azure Functions local.settings.json
    Write-Status "Configuring Azure Functions local.settings.json..."
    $functionsDir = Join-Path $repoRoot "BehavioralHealthSystem.Functions"
    $localSettingsPath = Join-Path $functionsDir "local.settings.json"
    $localSettingsTemplate = Join-Path $functionsDir "local.settings.json.template"

    # Get Key Vault URI
    $keyVaultUri = az keyvault show --name $KeyVaultName --query properties.vaultUri --output tsv

    if (Test-Path $localSettingsTemplate) {
        Write-Status "Using template: $localSettingsTemplate"
        Copy-Item -Path $localSettingsTemplate -Destination $localSettingsPath -Force

        # Update Key Vault reference in local.settings.json
        $settings = Get-Content $localSettingsPath | ConvertFrom-Json
        $settings.Values.KEY_VAULT_URI = $keyVaultUri
        $settings | ConvertTo-Json | Set-Content $localSettingsPath

        Write-Success "local.settings.json configured with Key Vault reference"
    } else {
        Write-Status "Template not found, using existing local.settings.json"
    }

    # Setup React frontend .env.local
    Write-Status "Configuring React frontend .env.local..."
    $webDir = Join-Path $repoRoot "BehavioralHealthSystem.Web"
    $envPath = Join-Path $webDir ".env.local"

    # Get Function App URL
    $functionApps = az functionapp list --resource-group $ResourceGroupName --query "[0]" --output json | ConvertFrom-Json
    $functionAppUrl = "https://$($functionApps.defaultHostName)/api"

    if (-not (Test-Path $envPath)) {
        Write-Status "Creating .env.local for React frontend..."
        $envContent = @"
# API Configuration
VITE_API_BASE_URL=$functionAppUrl

# Azure AD / Entra ID Authentication
VITE_ENABLE_ENTRA_AUTH=true
VITE_AZURE_CLIENT_ID=63e9b3fd-de9d-4083-879c-9c13f3aac54d
VITE_AZURE_TENANT_ID=3d6eb90f-fb5d-4624-99d7-1b8c4e077d07
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/3d6eb90f-fb5d-4624-99d7-1b8c4e077d07
VITE_AZURE_REDIRECT_URI=http://localhost:5173
VITE_AZURE_POST_LOGOUT_REDIRECT_URI=http://localhost:5173

# Agent Voice Configuration
VITE_TARS_VOICE=echo
VITE_JEKYLL_VOICE=shimmer
VITE_JEKYLL_PHQ2_THRESHOLD=1
VITE_MATRON_VOICE=coral
"@
        Set-Content -Path $envPath -Value $envContent
        Write-Success ".env.local created with recommended settings"
    } else {
        Write-Status "Updating existing .env.local with API URL..."
        $envContent = Get-Content $envPath
        $envContent = $envContent -replace 'VITE_API_BASE_URL=.*', "VITE_API_BASE_URL=$functionAppUrl"
        Set-Content -Path $envPath -Value $envContent
        Write-Success ".env.local updated"
    }

    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor $Green
    Write-Host "║        LOCAL DEVELOPMENT ENVIRONMENT CONFIGURED               ║" -ForegroundColor $Green
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor $Green
    Write-Host ""

    Write-Host "✓ Configuration Summary:" -ForegroundColor $Green
    Write-Host "  • Function App local.settings.json: $localSettingsPath"
    Write-Host "    - Key Vault URI: $keyVaultUri"
    Write-Host "  • React frontend .env.local: $envPath"
    Write-Host "    - API Base URL: $functionAppUrl"
    Write-Host ""

    Write-Host "📝 Next Steps:" -ForegroundColor $Yellow
    Write-Host "  1. For Azure Functions development:"
    Write-Host "     • Run: az login --use-device-code"
    Write-Host "     • This enables local DefaultAzureCredential to access Key Vault"
    Write-Host ""
    Write-Host "  2. For React frontend development:"
    Write-Host "     • Run: npm install"
    Write-Host "     • Run: npm run dev"
    Write-Host ""
    Write-Host "  3. Start Azure Functions locally:"
    Write-Host "     • Run: func start (from BehavioralHealthSystem.Functions)"
    Write-Host ""
    Write-Host "⚠️  Security Reminder:" -ForegroundColor $Yellow
    Write-Host "  • NEVER commit local.settings.json to git"
    Write-Host "  • .gitignore should already exclude it"
    Write-Host "  • Use Key Vault for all sensitive configuration"
    Write-Host ""
}
catch {
    Write-Host "✗ An error occurred: $_" -ForegroundColor 'Red'
    exit 1
}
