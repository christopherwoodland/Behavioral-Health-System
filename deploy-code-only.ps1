# Code-Only Deployment Script for Behavioral Health System Functions
#
# This script deploys ONLY the Function App code to an existing Azure Function App.
# Use this for rapid code updates after the initial infrastructure deployment.
#
# WHAT THIS SCRIPT DOES:
# ======================
# - Builds the Function App project in Release mode
# - Publishes the code to the existing Azure Function App
# - Updates application settings if needed
# - Verifies deployment success
#
# PREREQUISITES:
# ==============
# - Azure CLI installed and authenticated
# - Azure Functions Core Tools installed
# - Existing Function App infrastructure in Azure
#
# PARAMETERS:
# ===========
# - FunctionAppName: Name of your existing Function App
# - ResourceGroupName: Name of your existing Resource Group
# - KintsugiApiKey: (Optional) Update the API key if needed

param(
    [Parameter(Mandatory=$false)]
    [string]$FunctionAppName = "cwbhieastus001",
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "bhi",
    
    [Parameter(Mandatory=$false)]
    [string]$KintsugiApiKey = $null
)

# Set error handling
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Script directory and project paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SolutionDir = $ScriptDir  # Script is in the solution root directory
$FunctionProjectDir = Join-Path $SolutionDir "BehavioralHealthSystem.Functions"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "                    FUNCTION APP CODE DEPLOYMENT                               " -ForegroundColor Cyan  
Write-Host "                     Behavioral Health System                                  " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "CODE DEPLOYMENT CONFIGURATION:" -ForegroundColor Yellow
Write-Host "   Function App: $FunctionAppName" -ForegroundColor Green
Write-Host "   Resource Group: $ResourceGroupName" -ForegroundColor Green
Write-Host "   Project Directory: $FunctionProjectDir" -ForegroundColor Green
if ($KintsugiApiKey) {
    Write-Host "   API Key: ***$(($KintsugiApiKey).Substring($KintsugiApiKey.Length - 4))" -ForegroundColor Green
}
Write-Host ""

# Verify Azure CLI login
Write-Host "Checking Azure authentication..." -ForegroundColor Yellow
try {
    $account = az account show --output json | ConvertFrom-Json
    Write-Host "   [SUCCESS] Authenticated as: $($account.user.name)" -ForegroundColor Green
}
catch {
    Write-Host "   [ERROR] Not authenticated with Azure CLI" -ForegroundColor Red
    Write-Host "   Please run: az login" -ForegroundColor Yellow
    exit 1
}

# Verify Function App exists
Write-Host "Verifying Function App exists..." -ForegroundColor Yellow
try {
    $functionApp = az functionapp show --name $FunctionAppName --resource-group $ResourceGroupName --output json | ConvertFrom-Json
    Write-Host "   [SUCCESS] Function App found: $($functionApp.defaultHostName)" -ForegroundColor Green
}
catch {
    Write-Host "   [ERROR] Function App '$FunctionAppName' not found in resource group '$ResourceGroupName'" -ForegroundColor Red
    Write-Host "   Please check the names or deploy infrastructure first" -ForegroundColor Yellow
    exit 1
}

# Verify project directory exists
Write-Host "Checking project directory..." -ForegroundColor Yellow
if (-not (Test-Path $FunctionProjectDir)) {
    Write-Host "   [ERROR] Function project directory not found: $FunctionProjectDir" -ForegroundColor Red
    exit 1
}
Write-Host "   [SUCCESS] Project directory found" -ForegroundColor Green

# Change to project directory
Write-Host "Navigating to project directory..." -ForegroundColor Yellow
Set-Location $FunctionProjectDir

# Clean and build the project
Write-Host "Cleaning previous build..." -ForegroundColor Yellow
try {
    dotnet clean --configuration Release --verbosity quiet
    Write-Host "   [SUCCESS] Clean completed" -ForegroundColor Green
}
catch {
    Write-Host "   [WARNING] Clean failed, continuing..." -ForegroundColor Yellow
}

Write-Host "Building Function App..." -ForegroundColor Yellow
try {
    dotnet build --configuration Release --no-restore --verbosity minimal
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed with exit code $LASTEXITCODE"
    }
    Write-Host "   [SUCCESS] Build completed successfully" -ForegroundColor Green
}
catch {
    Write-Host "   [ERROR] Build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Update application settings if API key provided
if ($KintsugiApiKey) {
    Write-Host "Updating application settings..." -ForegroundColor Yellow
    try {
        az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroupName --settings "KINTSUGI_API_KEY=$KintsugiApiKey" --output none
        Write-Host "   [SUCCESS] API key updated" -ForegroundColor Green
    }
    catch {
        Write-Host "   [WARNING] Failed to update API key, continuing with deployment..." -ForegroundColor Yellow
    }
}

# Deploy the code
Write-Host "Deploying code to Azure Function App..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes..." -ForegroundColor Gray

try {
    # Use func command for deployment
    func azure functionapp publish $FunctionAppName --force
    
    if ($LASTEXITCODE -ne 0) {
        throw "Deployment failed with exit code $LASTEXITCODE"
    }
    
    Write-Host "   [SUCCESS] Code deployment completed successfully" -ForegroundColor Green
}
catch {
    Write-Host "   [ERROR] Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "TROUBLESHOOTING:" -ForegroundColor Yellow
    Write-Host "   - Verify Azure Functions Core Tools are installed: func --version" -ForegroundColor Gray
    Write-Host "   - Check Function App status in Azure Portal" -ForegroundColor Gray
    Write-Host "   - Try restarting the Function App: az functionapp restart --name $FunctionAppName --resource-group $ResourceGroupName" -ForegroundColor Gray
    exit 1
}

# Verify deployment
Write-Host "Verifying deployment..." -ForegroundColor Yellow
try {
    Start-Sleep -Seconds 10  # Give the function app time to restart
    
    $healthUrl = "https://$FunctionAppName.azurewebsites.net/api/health"
    Write-Host "   Testing health endpoint: $healthUrl" -ForegroundColor Gray
    
    $response = Invoke-WebRequest -Uri $healthUrl -Method GET -TimeoutSec 30 -UseBasicParsing
    
    if ($response.StatusCode -eq 200) {
        Write-Host "   [SUCCESS] Health check passed - Function App is running" -ForegroundColor Green
    } else {
        Write-Host "   [WARNING] Health check returned status: $($response.StatusCode)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "   [WARNING] Health check failed, but deployment may still be successful" -ForegroundColor Yellow
    Write-Host "   Function App may need a few more minutes to fully start" -ForegroundColor Gray
}

Write-Host ""
Write-Host "CODE DEPLOYMENT COMPLETED!" -ForegroundColor Green
Write-Host ""
Write-Host "FUNCTION APP ENDPOINTS:" -ForegroundColor Cyan
Write-Host "   Base URL: https://$FunctionAppName.azurewebsites.net" -ForegroundColor White
Write-Host "   Health: https://$FunctionAppName.azurewebsites.net/api/health" -ForegroundColor White
Write-Host "   Sessions Initiate: https://$FunctionAppName.azurewebsites.net/api/sessions/initiate" -ForegroundColor White
Write-Host "   Predictions Submit: https://$FunctionAppName.azurewebsites.net/api/predictions/submit" -ForegroundColor White
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "   1. Test your endpoints using the sample-requests.md examples" -ForegroundColor Gray
Write-Host "   2. Monitor logs in Azure Portal or Application Insights" -ForegroundColor Gray
Write-Host "   3. Your recent code changes are now live!" -ForegroundColor Gray
Write-Host ""
Write-Host "TIP: Use this script for future code-only deployments!" -ForegroundColor Cyan