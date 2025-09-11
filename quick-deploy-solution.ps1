# Quick Solution Deployment Script for Behavioral Health System
#
# This is the fastest way to deploy the entire Behavioral Health System to Azure.
# Perfect for demos, testing, and rapid prototyping with minimal configuration.
#
# WHAT THIS DOES:
# ===============
# - Validates solution structure from root directory
# - Builds the complete solution in Release mode
# - Creates resource group: "rg-{FunctionAppName}"
# - Deploys to East US region (optimal for most scenarios)
# - Configures all Azure resources with secure defaults
#
# REQUIREMENTS:
# =============
# - Run from solution root directory (where .sln file exists)
# - .NET 8 SDK installed
# - Azure CLI installed and logged in
# - Globally unique Function App name
#
# PARAMETERS:
# ===========
# - FunctionAppName: Unique name for your Function App (becomes part of URL)
# - KintsugiApiKey: Your Kintsugi Health API key
#
# EXAMPLE:
# ========
# .\quick-deploy-solution.ps1 -FunctionAppName "healthcare-demo-2024" -KintsugiApiKey "your-api-key"
#
# RESULT:
# =======
# - Function App URL: https://healthcare-demo-2024.azurewebsites.net
# - Resource Group: rg-healthcare-demo-2024
# - All monitoring and logging configured automatically

param(
    [Parameter(Mandatory=$true, HelpMessage="Enter a globally unique Function App name (3-60 characters)")]
    [ValidatePattern("^[a-zA-Z0-9\-]{3,60}$", ErrorMessage="Function App name must be 3-60 characters and contain only letters, numbers, and hyphens")]
    [string]$FunctionAppName,
    
    [Parameter(Mandatory=$true, HelpMessage="Enter your Kintsugi Health API key")]
    [ValidateNotNullOrEmpty()]
    [string]$KintsugiApiKey
)

# Set error handling
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Auto-generated configuration
$ResourceGroupName = "rg-$FunctionAppName"
$Location = "East US"

Write-Host "╔══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║                   ⚡ LIGHTNING FAST DEPLOYMENT ⚡                          ║" -ForegroundColor Magenta
Write-Host "║                    Behavioral Health System                                  ║" -ForegroundColor Magenta
Write-Host "║                      Complete Solution                                       ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "🚀 LIGHTNING DEPLOYMENT CONFIGURATION:" -ForegroundColor Yellow
Write-Host "   • Function App: $FunctionAppName" -ForegroundColor Green
Write-Host "   • Resource Group: $ResourceGroupName (auto-created)" -ForegroundColor Green
Write-Host "   • Location: $Location (optimized choice)" -ForegroundColor Green
Write-Host "   • API Key: ***$(($KintsugiApiKey).Substring($KintsugiApiKey.Length - 4))" -ForegroundColor Green
Write-Host ""
Write-Host "⚡ This will:" -ForegroundColor Cyan
Write-Host "   ✓ Build your complete solution" -ForegroundColor White
Write-Host "   ✓ Create all Azure resources" -ForegroundColor White
Write-Host "   ✓ Configure monitoring and logging" -ForegroundColor White
Write-Host "   ✓ Set up secure API integration" -ForegroundColor White
Write-Host ""
Write-Host "🕒 Estimated time: 3-5 minutes" -ForegroundColor Gray
Write-Host ""

# Confirm before proceeding
Write-Host "Ready to deploy? " -ForegroundColor Yellow -NoNewline
Write-Host "(Press Enter to continue or Ctrl+C to cancel)" -ForegroundColor Gray
Read-Host

Write-Host "🏗️ Starting complete solution deployment..." -ForegroundColor Yellow
Write-Host ""

# Call the main solution deployment script
try {
    & "$PSScriptRoot\deploy-solution.ps1" -ResourceGroupName $ResourceGroupName -FunctionAppName $FunctionAppName -KintsugiApiKey $KintsugiApiKey -Location $Location
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "╔══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
        Write-Host "║                      🚀 LIGHTNING DEPLOYMENT COMPLETE! 🚀                   ║" -ForegroundColor Green
        Write-Host "╚══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
        Write-Host ""
        Write-Host "🎯 YOUR APPLICATION IS LIVE AT:" -ForegroundColor Cyan
        Write-Host "   🌐 Function App URL: https://$FunctionAppName.azurewebsites.net" -ForegroundColor Green
        Write-Host "   🏥 Health Check: https://$FunctionAppName.azurewebsites.net/api/health" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚡ NEXT: Deploy your code in just one command:" -ForegroundColor Yellow
        Write-Host "   cd BehavioralHealthSystem.Functions && func azure functionapp publish $FunctionAppName" -ForegroundColor White
        Write-Host ""
        Write-Host "📱 QUICK TEST COMMANDS:" -ForegroundColor Cyan
        Write-Host "   curl https://$FunctionAppName.azurewebsites.net/api/health" -ForegroundColor Gray
        Write-Host "   curl -X POST https://$FunctionAppName.azurewebsites.net/api/TestKintsugiConnection" -ForegroundColor Gray
        Write-Host ""
        Write-Host "🎉 Congratulations! Your Behavioral Health System is ready! 🎉" -ForegroundColor Green
    }
}
catch {
    Write-Host ""
    Write-Host "❌ Lightning deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 QUICK FIXES TO TRY:" -ForegroundColor Yellow
    Write-Host "   • Choose a different Function App name (must be globally unique)" -ForegroundColor Gray
    Write-Host "   • Verify Azure CLI login: az account show" -ForegroundColor Gray
    Write-Host "   • Check solution builds: dotnet build BehavioralHealthSystem.sln" -ForegroundColor Gray
    Write-Host "   • Run from solution root (where .sln file exists)" -ForegroundColor Gray
    exit 1
}
