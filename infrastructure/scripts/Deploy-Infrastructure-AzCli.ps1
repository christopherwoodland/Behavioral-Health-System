<#
.SYNOPSIS
    Deploy Behavioral Health System infrastructure using pure Azure CLI commands (no Bicep)

.DESCRIPTION
    This script deploys all Azure resources using imperative Azure CLI commands instead of
    declarative Bicep templates. This avoids Bicep linting and JSON parsing issues.

.PARAMETER Environment
    The environment to deploy (dev, staging, prod)

.PARAMETER SubscriptionId
    Azure subscription ID

.PARAMETER Location
    Azure region for resources (default: eastus)

.PARAMETER ResourceGroupName
    Optional custom resource group name

.PARAMETER AppName
    Application name prefix (default: bhs)
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('dev', 'staging', 'prod')]
    [string]$Environment,

    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,

    [Parameter(Mandatory=$false)]
    [string]$Location = 'eastus',

    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory=$false)]
    [string]$AppName = 'bhs'
)

$ErrorActionPreference = 'Stop'

# Color output functions
function Write-Status { param([string]$Message) Write-Host "[*] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-ErrorMessage { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

try {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Azure Infrastructure Deployment (CLI)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    # Check prerequisites
    Write-Status "Checking prerequisites..."
    if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
        Write-ErrorMessage "Azure CLI is not installed. Please install it first."
        exit 1
    }
    Write-Success "Azure CLI is installed"

    # Set subscription
    Write-Status "Setting Azure subscription to: $SubscriptionId"
    az account set --subscription $SubscriptionId
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMessage "Failed to set subscription"
        exit 1
    }
    Write-Success "Subscription set"

    # Get current user IP for Key Vault firewall
    Write-Status "Detecting your IP address for Key Vault firewall..."
    $deploymentClientIP = (Invoke-WebRequest -Uri 'https://api.ipify.org?format=json' -UseBasicParsing | ConvertFrom-Json).ip
    Write-Success "Detected IP: $deploymentClientIP"

    # Build resource names
    if ([string]::IsNullOrEmpty($ResourceGroupName)) {
        $rgName = "${AppName}-${Environment}-rg"
    } else {
        $rgName = $ResourceGroupName
    }

    $vnetName = "${AppName}-${Environment}-vnet"
    $kvName = "${AppName}-${Environment}-kv-$(Get-Random -Minimum 10000 -Maximum 99999)"
    $storageAccountName = "${AppName}${Environment}st$(Get-Random -Minimum 1000 -Maximum 9999)"
    $openaiName = "${AppName}-${Environment}-openai"
    $docIntelName = "${AppName}-${Environment}-docintel"
    $contentName = "${AppName}-${Environment}-content"
    $lawName = "${AppName}-${Environment}-law"
    $appInsightsName = "${AppName}-${Environment}-ai"
    $functionAppName = "${AppName}-${Environment}-func"
    $functionPlanName = "${AppName}-${Environment}-plan"
    $staticWebAppName = "${AppName}-${Environment}-web"

    # Create Resource Group
    Write-Status "Creating resource group: $rgName"
    az group create --name $rgName --location $Location --tags Environment=$Environment Application=BehavioralHealth
    Write-Success "Resource group created"

    # Create Virtual Network
    Write-Status "Creating virtual network..."
    az network vnet create `
        --resource-group $rgName `
        --name $vnetName `
        --address-prefix 10.0.0.0/16 `
        --location $Location
    Write-Success "VNet created"

    # Create subnets
    Write-Status "Creating subnets..."

    az network vnet subnet create `
        --resource-group $rgName `
        --vnet-name $vnetName `
        --name app-subnet `
        --address-prefix 10.0.1.0/24

    az network vnet subnet create `
        --resource-group $rgName `
        --vnet-name $vnetName `
        --name private-endpoint-subnet `
        --address-prefix 10.0.2.0/24 `
        --disable-private-endpoint-network-policies true

    az network vnet subnet create `
        --resource-group $rgName `
        --vnet-name $vnetName `
        --name container-apps-subnet `
        --address-prefix 10.0.3.0/23 `
        --delegations Microsoft.App/environments

    Write-Success "Subnets created"

    # Create Log Analytics Workspace
    Write-Status "Creating Log Analytics workspace..."
    az monitor log-analytics workspace create `
        --resource-group $rgName `
        --workspace-name $lawName `
        --location $Location
    Write-Success "Log Analytics workspace created"

    # Create Application Insights
    Write-Status "Creating Application Insights..."
    az monitor app-insights component create `
        --resource-group $rgName `
        --app $appInsightsName `
        --location $Location `
        --workspace $lawName
    Write-Success "Application Insights created"

    # Get App Insights connection string
    $appInsightsConnString = az monitor app-insights component show `
        --resource-group $rgName `
        --app $appInsightsName `
        --query connectionString -o tsv

    # Create Storage Account
    Write-Status "Creating storage account..."
    az storage account create `
        --resource-group $rgName `
        --name $storageAccountName `
        --location $Location `
        --sku Standard_LRS `
        --kind StorageV2 `
        --https-only true `
        --min-tls-version TLS1_2 `
        --allow-blob-public-access false
    Write-Success "Storage account created"

    # Create Key Vault
    Write-Status "Creating Key Vault..."
    az keyvault create `
        --resource-group $rgName `
        --name $kvName `
        --location $Location `
        --sku standard `
        --enable-rbac-authorization true `
        --public-network-access Enabled

    # Add firewall rule for current IP
    az keyvault network-rule add `
        --resource-group $rgName `
        --name $kvName `
        --ip-address "$deploymentClientIP/32"

    Write-Success "Key Vault created"

    # Create Azure OpenAI / AI Foundry
    Write-Status "Creating Azure OpenAI account..."
    az cognitiveservices account create `
        --resource-group $rgName `
        --name $openaiName `
        --location $Location `
        --kind OpenAI `
        --sku S0 `
        --custom-domain $openaiName `
        --public-network-access Enabled
    Write-Success "Azure OpenAI account created"

    # Create Document Intelligence
    Write-Status "Creating Document Intelligence..."
    az cognitiveservices account create `
        --resource-group $rgName `
        --name $docIntelName `
        --location $Location `
        --kind FormRecognizer `
        --sku S0 `
        --custom-domain $docIntelName `
        --public-network-access Enabled
    Write-Success "Document Intelligence created"

    # Create Content Understanding (if available in region)
    Write-Status "Creating Content Understanding..."
    try {
        az cognitiveservices account create `
            --resource-group $rgName `
            --name $contentName `
            --location $Location `
            --kind ContentUnderstanding `
            --sku S0 `
            --custom-domain $contentName `
            --public-network-access Enabled
        Write-Success "Content Understanding created"
    } catch {
        Write-Host "   Content Understanding may not be available in this region, skipping..." -ForegroundColor Yellow
    }

    # Create Function App Plan (Flex Consumption)
    Write-Status "Creating Azure Functions plan..."
    az functionapp plan create `
        --resource-group $rgName `
        --name $functionPlanName `
        --location $Location `
        --sku FC1 `
        --is-linux
    Write-Success "Function App plan created"

    # Create Function App
    Write-Status "Creating Function App..."
    az functionapp create `
        --resource-group $rgName `
        --name $functionAppName `
        --plan $functionPlanName `
        --storage-account $storageAccountName `
        --runtime dotnet-isolated `
        --runtime-version 8 `
        --functions-version 4 `
        --assign-identity [system]

    # Configure Function App settings
    az functionapp config appsettings set `
        --resource-group $rgName `
        --name $functionAppName `
        --settings `
            "APPLICATIONINSIGHTS_CONNECTION_STRING=$appInsightsConnString" `
            "KeyVaultName=$kvName"

    Write-Success "Function App created"

    # Create Static Web App
    Write-Status "Creating Static Web App..."
    az staticwebapp create `
        --resource-group $rgName `
        --name $staticWebAppName `
        --location $Location `
        --sku Free
    Write-Success "Static Web App created"

    # Get Function App URL
    $functionAppUrl = "https://${functionAppName}.azurewebsites.net"

    # Display summary
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  DEPLOYMENT COMPLETED SUCCESSFULLY" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Deployment Information:" -ForegroundColor Green
    Write-Host "   Environment: $Environment"
    Write-Host "   Resource Group: $rgName"
    Write-Host "   Location: $Location"
    Write-Host ""
    Write-Host "Key Vault:" -ForegroundColor Green
    Write-Host "   Name: $kvName"
    Write-Host ""
    Write-Host "Storage Account:" -ForegroundColor Green
    Write-Host "   Name: $storageAccountName"
    Write-Host ""
    Write-Host "Function App:" -ForegroundColor Green
    Write-Host "   Name: $functionAppName"
    Write-Host "   URL: $functionAppUrl"
    Write-Host ""
    Write-Host "Static Web App:" -ForegroundColor Green
    Write-Host "   Name: $staticWebAppName"
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Run Configure-Secrets.ps1 to populate Key Vault"
    Write-Host "2. Run Configure-Permissions.ps1 to set up RBAC"
    Write-Host "3. Deploy your application code"
    Write-Host ""

} catch {
    Write-ErrorMessage "Deployment failed with error:"
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}
