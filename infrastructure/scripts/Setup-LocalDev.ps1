<#
.SYNOPSIS
Sets up local development environment with necessary configuration.

.DESCRIPTION
Configures the local development environment for the Behavioral Health System:
- Copies environment templates
- Sets up local.settings.json for Azure Functions
- Configures .env.development for React frontend
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

    # Setup React frontend .env.development
    Write-Status "Configuring React frontend .env.development..."
    $webDir = Join-Path $repoRoot "BehavioralHealthSystem.Web"
    $envPath = Join-Path $webDir ".env.development"

    # Get Function App URL
    $functionApps = az functionapp list --resource-group $ResourceGroupName --query "[0]" --output json | ConvertFrom-Json
    $functionAppUrl = "https://$($functionApps.defaultHostName)/api"

    # Fetch Entra ID values from Bicep deployment outputs if available
    $entraClientId = ""
    $entraApiClientId = ""
    $entraTenantId = ""
    try {
        $latestDeploy = az deployment sub list --query "sort_by([?starts_with(name,'bhs-aks-')],&properties.timestamp)[-1].name" -o tsv 2>$null
        if ($latestDeploy) {
            $deployOutputs = az deployment sub show --name $latestDeploy --query "properties.outputs" -o json 2>$null | ConvertFrom-Json
            $entraClientId    = $deployOutputs.azureAdClientId.value
            $entraApiClientId = $deployOutputs.azureAdApiClientId.value
            $entraTenantId    = $deployOutputs.azureAdTenantId.value
        }
    } catch { }

    if (-not (Test-Path $envPath)) {
        Write-Status "Creating .env.development for React frontend..."
        $envContent = @"
# API Configuration
VITE_API_BASE_URL=$functionAppUrl

# Azure AD / Entra ID Authentication
# VITE_AZURE_CLIENT_ID   = BHS Development UI  app registration (frontend SPA)
# VITE_AZURE_API_CLIENT_ID = BHS Development API app registration (backend)
# Both must be created in the same Entra ID tenant.
# Run .\Setup-EntraID.ps1 to create / configure them if they don't exist.
VITE_ENABLE_ENTRA_AUTH=true
VITE_AZURE_CLIENT_ID=$entraClientId
VITE_AZURE_API_CLIENT_ID=$entraApiClientId
VITE_AZURE_TENANT_ID=$entraTenantId
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/$entraTenantId
VITE_AZURE_REDIRECT_URI=http://localhost:5173
VITE_AZURE_POST_LOGOUT_REDIRECT_URI=http://localhost:5173
"@
        Set-Content -Path $envPath -Value $envContent
        Write-Success ".env.development created with recommended settings"
    } else {
        Write-Status "Updating existing .env.development with API URL..."
        $envContent = Get-Content $envPath
        $envContent = $envContent -replace 'VITE_API_BASE_URL=.*', "VITE_API_BASE_URL=$functionAppUrl"
        Set-Content -Path $envPath -Value $envContent
        Write-Success ".env.development updated"
    }

    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor $Green
    Write-Host "║        LOCAL DEVELOPMENT ENVIRONMENT CONFIGURED               ║" -ForegroundColor $Green
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor $Green
    Write-Host ""

    Write-Host "✓ Configuration Summary:" -ForegroundColor $Green
    Write-Host "  • Function App local.settings.json: $localSettingsPath"
    Write-Host "    - Key Vault URI: $keyVaultUri"
    Write-Host "  • React frontend .env.development: $envPath"
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
