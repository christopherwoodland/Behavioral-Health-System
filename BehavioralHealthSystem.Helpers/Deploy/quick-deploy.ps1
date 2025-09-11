# Quick Deployment Script for Behavioral Health System
#
# This is a simplified deployment script that uses sensible defaults for
# rapid deployment and testing. For production deployments with custom
# configurations, use the full deploy.ps1 script instead.
#
# WHAT THIS SCRIPT DOES:
# ======================
# - Creates a resource group named "rg-{FunctionAppName}"
# - Deploys to East US region by default
# - Uses the standard deployment template
# - Configures all required Azure resources
#
# PARAMETERS:
# ===========
# - FunctionAppName: Unique name for your Function App (will be part of URL)
# - KintsugiApiKey: Your Kintsugi Health API key
#
# EXAMPLE USAGE:
# ==============
# .\quick-deploy.ps1 -FunctionAppName "my-health-app" -KintsugiApiKey "your-api-key"
#
# RESOURCES CREATED:
# ==================
# - Resource Group: rg-{FunctionAppName}
# - Function App: {FunctionAppName}
# - Storage Account: storage{uniquestring}
# - Application Insights: {FunctionAppName}-ai
# - App Service Plan: {FunctionAppName}-plan

param(
    [Parameter(Mandatory=$true, HelpMessage="Enter a globally unique name for your Function App")]
    [ValidatePattern("^[a-zA-Z0-9\-]{3,60}$", ErrorMessage="Function App name must be 3-60 characters and contain only letters, numbers, and hyphens")]
    [string]$FunctionAppName,
    
    [Parameter(Mandatory=$true, HelpMessage="Enter your Kintsugi Health API key")]
    [ValidateNotNullOrEmpty()]
    [string]$KintsugiApiKey
)

# Set error handling
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Default configuration
$ResourceGroupName = "rg-$FunctionAppName"
$Location = "East US"

Write-Host "╔══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                    🚀 QUICK AZURE DEPLOYMENT 🚀                            ║" -ForegroundColor Cyan  
Write-Host "║                     Behavioral Health System                                 ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚡ QUICK DEPLOYMENT CONFIGURATION:" -ForegroundColor Yellow
Write-Host "   • Function App: $FunctionAppName" -ForegroundColor Green
Write-Host "   • Resource Group: $ResourceGroupName" -ForegroundColor Green
Write-Host "   • Location: $Location" -ForegroundColor Green
Write-Host "   • API Key: ***$(($KintsugiApiKey).Substring($KintsugiApiKey.Length - 4))" -ForegroundColor Green
Write-Host ""
Write-Host "🏃‍♂️ This will create all necessary Azure resources using sensible defaults." -ForegroundColor Cyan
Write-Host "   For custom configurations, use the full deploy.ps1 script instead." -ForegroundColor Gray
Write-Host ""

# Confirm before proceeding
Read-Host "Press Enter to continue or Ctrl+C to cancel"

Write-Host "🚀 Initiating deployment..." -ForegroundColor Yellow

# Call the main deployment script
try {
    & "$PSScriptRoot\deploy.ps1" -ResourceGroupName $ResourceGroupName -FunctionAppName $FunctionAppName -KintsugiApiKey $KintsugiApiKey -Location $Location
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "🎊 QUICK DEPLOYMENT COMPLETED SUCCESSFULLY! 🎊" -ForegroundColor Green
        Write-Host ""
        Write-Host "💡 QUICK START TIPS:" -ForegroundColor Cyan
        Write-Host "   • Your Function App will be available at: https://$FunctionAppName.azurewebsites.net" -ForegroundColor White
        Write-Host "   • Test the health endpoint: https://$FunctionAppName.azurewebsites.net/api/health" -ForegroundColor White
        Write-Host "   • Find API usage examples in the sample-requests.md file" -ForegroundColor White
        Write-Host ""
        Write-Host "📋 REMEMBER TO:" -ForegroundColor Yellow
        Write-Host "   1. Deploy your code using: func azure functionapp publish $FunctionAppName" -ForegroundColor Gray
        Write-Host "   2. Test your endpoints after code deployment" -ForegroundColor Gray
        Write-Host "   3. Set up monitoring alerts in Azure Portal" -ForegroundColor Gray
    }
}
catch {
    Write-Host "❌ Quick deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 TROUBLESHOOTING:" -ForegroundColor Yellow
    Write-Host "   • Try a different Function App name (must be globally unique)" -ForegroundColor Gray
    Write-Host "   • Check your Azure CLI login status: az account show" -ForegroundColor Gray
    Write-Host "   • Verify your subscription has sufficient quota" -ForegroundColor Gray
    exit 1
}
