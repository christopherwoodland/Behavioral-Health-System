# Solution-Level Deployment Script for Behavioral Health System
#
# This script provides comprehensive deployment from the solution root directory.
# It builds the entire solution and then deploys all components to Azure.
#
# FEATURES:
# =========
# - Validates solution structure and prerequisites
# - Builds the complete solution in Release configuration
# - Deploys Azure infrastructure using ARM templates
# - Provides comprehensive deployment validation
# - Offers next-step guidance for code deployment
#
# REQUIREMENTS:
# =============
# - Must be run from the solution root directory (where BehavioralHealthSystem.sln exists)
# - .NET 8 SDK installed
# - Azure CLI installed and authenticated
# - Azure Functions Core Tools v4 (for code deployment)
#
# PARAMETERS:
# ===========
# - ResourceGroupName: Target Azure Resource Group name
# - FunctionAppName: Globally unique Function App name
# - KintsugiApiKey: Kintsugi Health API key for service integration
# - Location: Azure region (default: East US)
# - SubscriptionId: Azure subscription ID (optional)
#
# EXAMPLE USAGE:
# ==============
# From solution root:
# .\deploy-solution.ps1 -ResourceGroupName "myapp-rg" -FunctionAppName "myapp-func" -KintsugiApiKey "your-key"

param(
    [Parameter(Mandatory=$true, HelpMessage="Enter the Azure Resource Group name")]
    [ValidateNotNullOrEmpty()]
    [string]$ResourceGroupName,
    
    [Parameter(Mandatory=$true, HelpMessage="Enter a globally unique Function App name")]
    [ValidatePattern("^[a-zA-Z0-9\-]{3,60}$")]
    [string]$FunctionAppName,
    
    [Parameter(Mandatory=$true, HelpMessage="Enter your Kintsugi Health API key")]
    [ValidateNotNullOrEmpty()]
    [string]$KintsugiApiKey,
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "East US",
    
    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId = $null
)

# Set error handling
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "================================================================================" -ForegroundColor Blue
Write-Host "                         SOLUTION DEPLOYMENT                                   " -ForegroundColor Blue
Write-Host "                     Behavioral Health System                                 " -ForegroundColor Blue
Write-Host "================================================================================" -ForegroundColor Blue
Write-Host ""

# Validate solution structure
Write-Host "SOLUTION VALIDATION:" -ForegroundColor Yellow
if (-not (Test-Path "BehavioralHealthSystem.sln")) {
    Write-Host "   X Solution file not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "DIRECTORY REQUIREMENT:" -ForegroundColor Red
    Write-Host "   This script must be run from the solution root directory" -ForegroundColor Yellow
    Write-Host "   Current directory: $(Get-Location)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "USAGE:" -ForegroundColor Yellow
    Write-Host "   cd /path/to/BehavioralHealthSystem" -ForegroundColor Gray
    Write-Host "   .\deploy-solution.ps1 -ResourceGroupName 'your-rg' -FunctionAppName 'your-app' -KintsugiApiKey 'your-key'" -ForegroundColor Gray
    exit 1
}

Write-Host "   + Solution file found - ready to deploy" -ForegroundColor Green

# Check for required project files
$requiredProjects = @(
    "BehavioralHealthSystem.Functions\BehavioralHealthSystem.Functions.csproj",
    "BehavioralHealthSystem.Helpers\BehavioralHealthSystem.Helpers.csproj"
)

foreach ($project in $requiredProjects) {
    if (-not (Test-Path $project)) {
        Write-Host "   X Required project not found: $project" -ForegroundColor Red
        exit 1
    }
}
Write-Host "   + All required projects found" -ForegroundColor Green

# Build the solution
Write-Host ""
Write-Host "SOLUTION BUILD:" -ForegroundColor Yellow
Write-Host "   Building solution in Release configuration..." -ForegroundColor Cyan

dotnet build BehavioralHealthSystem.sln --configuration Release --verbosity minimal
if ($LASTEXITCODE -ne 0) {
    Write-Host "   X Failed to build solution" -ForegroundColor Red
    Write-Host ""
    Write-Host "BUILD TROUBLESHOOTING:" -ForegroundColor Red
    Write-Host "   • Check for compilation errors in your code" -ForegroundColor Yellow
    Write-Host "   • Ensure all NuGet packages are restored" -ForegroundColor Yellow
    Write-Host "   • Verify .NET 8 SDK is installed: dotnet --version" -ForegroundColor Yellow
    Write-Host "   • Try cleaning first: dotnet clean" -ForegroundColor Yellow
    exit 1
}
Write-Host "   + Solution built successfully" -ForegroundColor Green

# Call the deployment script
Write-Host ""
Write-Host "AZURE INFRASTRUCTURE DEPLOYMENT:" -ForegroundColor Yellow
Write-Host "   Deploying Azure resources using ARM templates..." -ForegroundColor Cyan
$deployScript = "BehavioralHealthSystem.Helpers\Deploy\deploy.ps1"

try {
    if ($SubscriptionId) {
        & $deployScript -ResourceGroupName $ResourceGroupName -FunctionAppName $FunctionAppName -KintsugiApiKey $KintsugiApiKey -Location $Location -SubscriptionId $SubscriptionId
    } else {
        & $deployScript -ResourceGroupName $ResourceGroupName -FunctionAppName $FunctionAppName -KintsugiApiKey $KintsugiApiKey -Location $Location
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host "                    SOLUTION DEPLOYMENT COMPLETE!                             " -ForegroundColor Green
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "FINAL DEPLOYMENT STEPS:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   1. Deploy Function App Code:" -ForegroundColor Cyan
        Write-Host "      cd BehavioralHealthSystem.Functions" -ForegroundColor Gray
        Write-Host "      func azure functionapp publish $FunctionAppName" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   2. Verify Deployment:" -ForegroundColor Cyan
        Write-Host "      # Test health endpoint" -ForegroundColor Gray
        Write-Host "      curl https://$FunctionAppName.azurewebsites.net/api/health" -ForegroundColor Gray
        Write-Host ""
        Write-Host "      # Test API connection" -ForegroundColor Gray
        Write-Host "      curl -X POST https://$FunctionAppName.azurewebsites.net/api/TestKintsugiConnection" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   3. Monitor Your Application:" -ForegroundColor Cyan
        Write-Host "      • Azure Portal > Function Apps > $FunctionAppName" -ForegroundColor Gray
        Write-Host "      • Application Insights for logs and metrics" -ForegroundColor Gray
        Write-Host "      • Set up alerts for errors and performance issues" -ForegroundColor Gray
        Write-Host ""
        Write-Host "USEFUL RESOURCES:" -ForegroundColor Cyan
        Write-Host "   • API Usage Examples: sample-requests.md" -ForegroundColor White
        Write-Host "   • Local Development: README.md section" -ForegroundColor White
        Write-Host "   • Azure Functions Docs: https://docs.microsoft.com/azure/azure-functions/" -ForegroundColor White
        Write-Host ""
        Write-Host "Your Behavioral Health System is ready for production use!" -ForegroundColor Green
    } else {
        Write-Host "Infrastructure deployment failed" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "Deployment error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
