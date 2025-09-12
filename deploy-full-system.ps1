# Full Deployment Script for Behavioral Health System
#
# This script deploys both the Function App and the UI in sequence
#
# WHAT THIS SCRIPT DOES:
# ======================
# 1. Deploys Function App code to Azure Functions
# 2. Deploys UI code to Azure App Service
#
# PREREQUISITES:
# ==============
# - Azure CLI installed and authenticated
# - Azure Functions Core Tools installed
# - Node.js and npm installed
# - Both deploy-code-only.ps1 and deploy-ui.ps1 scripts exist

param(
    [Parameter(Mandatory=$false)]
    [switch]$SkipFunctionApp,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipUI,
    
    [Parameter(Mandatory=$false)]
    [string]$KintsugiApiKey = $null
)

# Set error handling
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Configuration
$FunctionAppName = "cwbhieastus001"
$UIResourceName = "cwuibhieastus001"
$ResourceGroupName = "bhi"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "                    FULL SYSTEM DEPLOYMENT                                     " -ForegroundColor Cyan  
Write-Host "                     Behavioral Health System                                  " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "DEPLOYMENT CONFIGURATION:" -ForegroundColor Yellow
Write-Host "   Function App: $FunctionAppName" -ForegroundColor Green
Write-Host "   UI App Service: $UIResourceName" -ForegroundColor Green
Write-Host "   Resource Group: $ResourceGroupName" -ForegroundColor Green
if ($KintsugiApiKey) {
    Write-Host "   API Key: ***$(($KintsugiApiKey).Substring($KintsugiApiKey.Length - 4))" -ForegroundColor Green
}
Write-Host ""

# Track overall success
$deploymentSuccess = $true
$deploymentErrors = @()

# Function App Deployment
if (-not $SkipFunctionApp) {
    Write-Host "STEP 1: DEPLOYING FUNCTION APP" -ForegroundColor Magenta
    Write-Host "================================================================================" -ForegroundColor Magenta
    Write-Host ""
    
    try {
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        $deployCodeScript = Join-Path $scriptDir "deploy-code-only.ps1"
        if ($KintsugiApiKey) {
            & $deployCodeScript -FunctionAppName $FunctionAppName -ResourceGroupName $ResourceGroupName -KintsugiApiKey $KintsugiApiKey
        } else {
            & $deployCodeScript -FunctionAppName $FunctionAppName -ResourceGroupName $ResourceGroupName
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "Function App deployment completed successfully!" -ForegroundColor Green
        } else {
            throw "Function App deployment failed with exit code $LASTEXITCODE"
        }
    }
    catch {
        $deploymentSuccess = $false
        $deploymentErrors += "Function App: $($_.Exception.Message)"
        Write-Host ""
        Write-Host "Function App deployment failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Continuing with UI deployment..." -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Waiting 30 seconds before UI deployment..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
    Write-Host ""
} else {
    Write-Host "Skipping Function App deployment (SkipFunctionApp flag set)" -ForegroundColor Yellow
    Write-Host ""
}

# UI Deployment
if (-not $SkipUI) {
    Write-Host "STEP 2: DEPLOYING UI APPLICATION" -ForegroundColor Magenta
    Write-Host "================================================================================" -ForegroundColor Magenta
    Write-Host ""
    
    try {
        $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
        $deployUIScript = Join-Path $scriptDir "deploy-ui.ps1"
        & $deployUIScript -DeploymentTarget "app-service" -ResourceName $UIResourceName -ResourceGroupName $ResourceGroupName
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "UI deployment completed successfully!" -ForegroundColor Green
        } else {
            throw "UI deployment failed with exit code $LASTEXITCODE"
        }
    }
    catch {
        $deploymentSuccess = $false
        $deploymentErrors += "UI App Service: $($_.Exception.Message)"
        Write-Host ""
        Write-Host "UI deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "Skipping UI deployment (SkipUI flag set)" -ForegroundColor Yellow
    Write-Host ""
}

# Final Results
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Gray
Write-Host ""

if ($deploymentSuccess) {
    Write-Host "FULL DEPLOYMENT COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host ""
    Write-Host "APPLICATION ENDPOINTS:" -ForegroundColor Cyan
    Write-Host "   Function App: https://$FunctionAppName.azurewebsites.net" -ForegroundColor White
    Write-Host "   UI Application: https://$UIResourceName.azurewebsites.net" -ForegroundColor White
    Write-Host ""
    Write-Host "QUICK LINKS:" -ForegroundColor Cyan
    Write-Host "   Function Health Check: https://$FunctionAppName.azurewebsites.net/api/health" -ForegroundColor White
    Write-Host "   Main Workflow API: https://$FunctionAppName.azurewebsites.net/api/KintsugiWorkflow" -ForegroundColor White
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "   1. Open the UI application in your browser" -ForegroundColor Gray
    Write-Host "   2. Test the health endpoints to verify functionality" -ForegroundColor Gray
    Write-Host "   3. Monitor logs in Azure Portal or Application Insights" -ForegroundColor Gray
    Write-Host "   4. Run end-to-end tests to validate the complete system" -ForegroundColor Gray
} else {
    Write-Host "DEPLOYMENT COMPLETED WITH ERRORS" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "FAILED COMPONENTS:" -ForegroundColor Red
    foreach ($deploymentError in $deploymentErrors) {
        Write-Host "   $deploymentError" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "TROUBLESHOOTING:" -ForegroundColor Yellow
    Write-Host "   1. Check Azure CLI authentication: az account show" -ForegroundColor Gray
    Write-Host "   2. Verify resource names and permissions" -ForegroundColor Gray
    Write-Host "   3. Check Azure Portal for resource status" -ForegroundColor Gray
    Write-Host "   4. Review individual deployment script logs above" -ForegroundColor Gray
    Write-Host ""
    Write-Host "RETRY OPTIONS:" -ForegroundColor Cyan
    if ($deploymentErrors -match "Function App") {
        Write-Host "   Retry Function App only: .\deploy-full-system.ps1 -SkipUI" -ForegroundColor White
    }
    if ($deploymentErrors -match "UI") {
        Write-Host "   Retry UI only: .\deploy-full-system.ps1 -SkipFunctionApp" -ForegroundColor White
    }
    Write-Host "   Retry full deployment: .\deploy-full-system.ps1" -ForegroundColor White
}

Write-Host ""
Write-Host "USAGE EXAMPLES:" -ForegroundColor Cyan
Write-Host "   Full deployment: .\deploy-full-system.ps1" -ForegroundColor Gray
Write-Host "   With API key: .\deploy-full-system.ps1 -KintsugiApiKey 'your-key'" -ForegroundColor Gray
Write-Host "   Function App only: .\deploy-full-system.ps1 -SkipUI" -ForegroundColor Gray
Write-Host "   UI only: .\deploy-full-system.ps1 -SkipFunctionApp" -ForegroundColor Gray
Write-Host ""

# Exit with appropriate code
if ($deploymentSuccess) {
    exit 0
} else {
    exit 1
}