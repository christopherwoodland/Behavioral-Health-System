# Azure Deployment Script for Behavioral Health System Functions
#
# Deploys a production-ready Azure Functions application that integrates with the
# Kintsugi Health API for behavioral health assessments and predictions.
#
# ARCHITECTURE OVERVIEW:
# =====================
# - Simplified HTTP Functions Architecture (no Durable Functions orchestration)
# - Single main endpoint: POST /api/KintsugiWorkflow
# - Direct service calls with built-in retry policies
# - Application Insights integration for comprehensive monitoring
# - Secure configuration management with Key Vault support
#
# ENDPOINTS DEPLOYED:
# ==================
# - POST /api/KintsugiWorkflow           - Main workflow: initiate session + submit prediction
# - POST /api/predictions/submit         - Submit prediction with session ID and audio URL
# - GET  /api/health                     - Health check with detailed service status
# - POST /api/TestKintsugiConnection     - Test API connectivity
# - GET  /api/predictions/{userId}       - Get all predictions for a user
# - GET  /api/predictions/sessions/{sessionId} - Get specific prediction by session ID
#
# SECURITY FEATURES:
# ==================
# - HTTPS only communication
# - Secure API key storage in Function App settings
# - TLS 1.2 minimum requirement
# - Storage account security hardening
#
# PREREQUISITES:
# ==============
# - Azure CLI installed (2.50.0 or later)
# - PowerShell 5.1 or PowerShell Core 7.x
# - Valid Azure subscription with appropriate permissions
# - Kintsugi Health API key with required scopes
#
# PARAMETERS:
# ===========
# - ResourceGroupName: Target Azure Resource Group (will be created if doesn't exist)
# - FunctionAppName: Globally unique name for the Function App
# - KintsugiApiKey: Secure API key for Kintsugi service integration
# - Location: Azure region for deployment (default: East US)
# - SubscriptionId: Azure subscription ID (optional, uses current if not specified)
param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$true)]
    [string]$FunctionAppName,
    
    [Parameter(Mandatory=$true)]
    [string]$KintsugiApiKey,
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "East US",
    
    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId = $null
)

# Set error action preference and strict mode
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "================================================================================" -ForegroundColor Green
Write-Host "             Azure Deployment - Behavioral Health System                     " -ForegroundColor Green  
Write-Host "                         Production-Ready Deployment                         " -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
Write-Host ""

# Display deployment parameters
Write-Host "DEPLOYMENT PARAMETERS:" -ForegroundColor Yellow
Write-Host "   • Resource Group: $ResourceGroupName" -ForegroundColor Cyan
Write-Host "   • Function App: $FunctionAppName" -ForegroundColor Cyan
Write-Host "   • Location: $Location" -ForegroundColor Cyan
Write-Host "   • API Key: ***$(($KintsugiApiKey).Substring($KintsugiApiKey.Length - 4))" -ForegroundColor Cyan
if ($SubscriptionId) {
    Write-Host "   • Subscription: $SubscriptionId" -ForegroundColor Cyan
}
Write-Host ""

# Check if Azure CLI is installed and get version
Write-Host "PREREQUISITES CHECK:" -ForegroundColor Yellow
try {
    $null = az version --output table 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   + Azure CLI is installed and ready" -ForegroundColor Green
    } else {
        throw "Azure CLI not found"
    }
}
catch {
    Write-Host "   X Azure CLI is not installed or not accessible" -ForegroundColor Red
    Write-Host ""
    Write-Host "INSTALLATION REQUIRED:" -ForegroundColor Red
    Write-Host "   Please install Azure CLI from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli" -ForegroundColor Yellow
    Write-Host "   Or use the MSI installer: https://aka.ms/installazurecliwindows" -ForegroundColor Yellow
    exit 1
}

# Login to Azure if not already logged in
Write-Host "AUTHENTICATION CHECK:" -ForegroundColor Yellow
$null = az account show --output json 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Not logged in to Azure. Initiating login..." -ForegroundColor Yellow
    az login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   X Failed to log in to Azure" -ForegroundColor Red
        exit 1
    }
    Write-Host "   + Successfully logged in to Azure" -ForegroundColor Green
} else {
    Write-Host "   + Already authenticated with Azure" -ForegroundColor Green
}

# Set subscription if provided
if ($SubscriptionId) {
    Write-Host ""
    Write-Host "SUBSCRIPTION CONFIGURATION:" -ForegroundColor Yellow
    Write-Host "   Setting subscription to: $SubscriptionId" -ForegroundColor Cyan
    az account set --subscription $SubscriptionId
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   X Failed to set subscription" -ForegroundColor Red
        exit 1
    }
    Write-Host "   + Subscription set successfully" -ForegroundColor Green
}

# Create resource group if it doesn't exist
Write-Host ""
Write-Host "RESOURCE GROUP SETUP:" -ForegroundColor Yellow
Write-Host "   Creating/verifying resource group: $ResourceGroupName" -ForegroundColor Cyan
az group create --name $ResourceGroupName --location $Location --output table
if ($LASTEXITCODE -ne 0) {
    Write-Host "   X Failed to create resource group" -ForegroundColor Red
    exit 1
}
Write-Host "   + Resource group ready" -ForegroundColor Green

# Deploy ARM template
Write-Host ""
Write-Host "AZURE INFRASTRUCTURE DEPLOYMENT:" -ForegroundColor Yellow
Write-Host "   Deploying Function App, Storage Account, and Application Insights..." -ForegroundColor Cyan
$deploymentName = "behavioral-health-deployment-$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Host "   Deployment Name: $deploymentName" -ForegroundColor Gray

az deployment group create `
    --resource-group $ResourceGroupName `
    --template-file "$PSScriptRoot/azuredeploy.json" `
    --parameters functionAppName=$FunctionAppName `
                location=$Location `
                kintsugiApiKey=$KintsugiApiKey `
    --name $deploymentName `
    --output table

if ($LASTEXITCODE -ne 0) {
    Write-Host "   X Failed to deploy Azure resources" -ForegroundColor Red
    Write-Host ""
    Write-Host "TROUBLESHOOTING TIPS:" -ForegroundColor Red
    Write-Host "   • Check if Function App name '$FunctionAppName' is globally unique" -ForegroundColor Yellow
    Write-Host "   • Verify you have sufficient permissions in the subscription" -ForegroundColor Yellow
    Write-Host "   • Ensure the location '$Location' supports all required services" -ForegroundColor Yellow
    exit 1
}

Write-Host "   + Azure infrastructure deployed successfully" -ForegroundColor Green

# Get deployment outputs
Write-Host ""
Write-Host "RETRIEVING DEPLOYMENT INFORMATION:" -ForegroundColor Yellow
$outputs = az deployment group show --resource-group $ResourceGroupName --name $deploymentName --query "properties.outputs" --output json | ConvertFrom-Json

$functionAppUrl = $outputs.functionAppUrl.value
$appInsightsConnectionString = $outputs.applicationInsightsConnectionString.value

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "                        DEPLOYMENT COMPLETED SUCCESSFULLY!                    " -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "DEPLOYMENT SUMMARY:" -ForegroundColor Cyan
Write-Host "   • Function App Name: $FunctionAppName" -ForegroundColor White
Write-Host "   • Function App URL: $functionAppUrl" -ForegroundColor White
Write-Host "   • Resource Group: $ResourceGroupName" -ForegroundColor White
Write-Host "   • Region: $Location" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT ENDPOINTS:" -ForegroundColor Cyan
Write-Host "   • Health Check: $functionAppUrl/api/health" -ForegroundColor Green
Write-Host "   • API Connection Test: $functionAppUrl/api/TestKintsugiConnection" -ForegroundColor Green
Write-Host "   • Main Workflow: $functionAppUrl/api/KintsugiWorkflow" -ForegroundColor Green
Write-Host "   • Submit Prediction: $functionAppUrl/api/predictions/submit" -ForegroundColor Green
Write-Host ""
Write-Host "MONITORING:" -ForegroundColor Cyan
Write-Host "   • Application Insights Connection String:" -ForegroundColor White
Write-Host "     $appInsightsConnectionString" -ForegroundColor Gray
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "   1. Build and publish your Function App code:" -ForegroundColor White
Write-Host "      cd ../../BehavioralHealthSystem.Functions" -ForegroundColor Gray
Write-Host "      dotnet publish --configuration Release" -ForegroundColor Gray
Write-Host "      func azure functionapp publish $FunctionAppName" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Test your deployment:" -ForegroundColor White
Write-Host "      # Test health check" -ForegroundColor Gray
Write-Host "      curl $functionAppUrl/api/health" -ForegroundColor Gray
Write-Host ""
Write-Host "      # Test API connection" -ForegroundColor Gray
Write-Host "      curl -X POST $functionAppUrl/api/TestKintsugiConnection" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. Monitor your application:" -ForegroundColor White
Write-Host "      • View logs and metrics in Azure Portal > Application Insights" -ForegroundColor Gray
Write-Host "      • Set up alerts for errors and performance issues" -ForegroundColor Gray
Write-Host "      • Use the connection string above for custom telemetry" -ForegroundColor Gray
Write-Host ""
Write-Host "   4. Reference documentation:" -ForegroundColor White
Write-Host "      • API usage examples in sample-requests.md" -ForegroundColor Gray
Write-Host "      • Local development setup in README.md" -ForegroundColor Gray
Write-Host ""
Write-Host "SECURITY REMINDERS:" -ForegroundColor Red
Write-Host "   • Your Kintsugi API key is securely stored in Function App settings" -ForegroundColor Yellow
Write-Host "   • All communication uses HTTPS only" -ForegroundColor Yellow
Write-Host "   • Application Insights data is encrypted at rest" -ForegroundColor Yellow
Write-Host ""

# Final success message
Write-Host "Your Behavioral Health System is now deployed and ready for use!" -ForegroundColor Green
