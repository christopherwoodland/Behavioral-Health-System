# UI Deployment Script for Behavioral Health System Web App
#
# This script builds and deploys the React/Vite web application
#
# PARAMETERS:
# ===========
# - DeploymentTarget: "static-web-app", "storage", or "app-service"
# - ResourceName: Name of your Azure resource
# - ResourceGroupName: Name of your Resource Group

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("static-web-app", "storage", "app-service")]
    [string]$DeploymentTarget,
    
    [Parameter(Mandatory=$true)]
    [string]$ResourceName,
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "bhi"
)

# Set error handling
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Script directory and paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SolutionRoot = Split-Path -Parent $ScriptDir
$WebProjectDir = Join-Path $SolutionRoot "BehavioralHealthSystem.Web"

Write-Host "=================================================================================" -ForegroundColor Cyan
Write-Host "                        UI DEPLOYMENT SCRIPT                                     " -ForegroundColor Cyan  
Write-Host "                     Behavioral Health System Web App                           " -ForegroundColor Cyan
Write-Host "=================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "UI DEPLOYMENT CONFIGURATION:" -ForegroundColor Yellow
Write-Host "   Target: $DeploymentTarget" -ForegroundColor Green
Write-Host "   Resource: $ResourceName" -ForegroundColor Green
Write-Host "   Resource Group: $ResourceGroupName" -ForegroundColor Green
Write-Host "   Project Directory: $WebProjectDir" -ForegroundColor Green
Write-Host ""

# Verify Azure CLI login
Write-Host "Checking Azure authentication..." -ForegroundColor Yellow
try {
    $account = az account show --output json 2>$null | ConvertFrom-Json
    if ($null -eq $account) {
        throw "Not authenticated"
    }
    Write-Host "   [SUCCESS] Authenticated as: $($account.user.name)" -ForegroundColor Green
}
catch {
    Write-Host "   [ERROR] Not authenticated with Azure CLI" -ForegroundColor Red
    Write-Host "   Please run: az login" -ForegroundColor Yellow
    exit 1
}

# Verify project directory exists
Write-Host "Checking web project directory..." -ForegroundColor Yellow
if (-not (Test-Path $WebProjectDir)) {
    Write-Host "   [ERROR] Web project directory not found: $WebProjectDir" -ForegroundColor Red
    exit 1
}
Write-Host "   [SUCCESS] Project directory found" -ForegroundColor Green

# Change to project directory
Write-Host "Navigating to web project directory..." -ForegroundColor Yellow
Push-Location $WebProjectDir

try {
    # Verify Node.js is available
    Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
    try {
        $nodeVersion = node --version 2>$null
        Write-Host "   [SUCCESS] Node.js version: $nodeVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "   [ERROR] Node.js not found. Please install Node.js" -ForegroundColor Red
        exit 1
    }

    # Install dependencies
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    try {
        npm install --silent
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed"
        }
        Write-Host "   [SUCCESS] Dependencies installed" -ForegroundColor Green
    }
    catch {
        Write-Host "   [ERROR] Failed to install dependencies: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }

    # Update environment variables for production
    Write-Host "Configuring production environment..." -ForegroundColor Yellow
    
    # Create production .env file
    $prodEnvContent = @"
# Production Environment Configuration
VITE_API_BASE_URL=https://cwbhieastus001.azurewebsites.net/api
VITE_AZURE_BLOB_SAS_URL=https://aistgvi.blob.core.windows.net/?sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiyx&se=2026-06-26T11:43:55Z&st=2025-09-06T03:28:55Z&spr=https&sig=jlfi75igY6qW805u%2FWErZpEu7AZSll5hJOdvSJU35%2Bo%3D
VITE_STORAGE_CONTAINER_NAME=audio-uploads
VITE_POLL_INTERVAL_MS=3000
VITE_ENABLE_FFMPEG_WORKER=true
VITE_ENABLE_DEBUG_LOGGING=false
"@
    
    # Backup existing .env and create production version
    if (Test-Path ".env") {
        Copy-Item ".env" ".env.backup" -Force
    }
    Set-Content ".env" $prodEnvContent -Encoding UTF8
    Write-Host "   [SUCCESS] Production environment configured" -ForegroundColor Green

    # Build the application
    Write-Host "Building web application..." -ForegroundColor Yellow
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed with exit code $LASTEXITCODE"
        }
        Write-Host "   [SUCCESS] Build completed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "   [ERROR] Build failed: $($_.Exception.Message)" -ForegroundColor Red
        
        # Restore original .env if backup exists
        if (Test-Path ".env.backup") {
            Move-Item ".env.backup" ".env" -Force
        }
        exit 1
    }

    # Deploy based on target
    Write-Host "Deploying to $DeploymentTarget..." -ForegroundColor Yellow

    switch ($DeploymentTarget) {
        "static-web-app" {
            try {
                # For Static Web Apps, we would typically use the SWA CLI or GitHub Actions
                Write-Host "   [INFO] Static Web App deployment requires SWA CLI or GitHub Actions" -ForegroundColor Yellow
                Write-Host "   [INFO] Manual upload of dist folder may be required" -ForegroundColor Yellow
                $deploymentUrl = "https://$ResourceName.azurestaticapps.net"
                Write-Host "   [SUCCESS] Build ready for Static Web App: $ResourceName" -ForegroundColor Green
            }
            catch {
                Write-Host "   [ERROR] Static Web App deployment failed: $($_.Exception.Message)" -ForegroundColor Red
                exit 1
            }
        }
        
        "storage" {
            try {
                # Deploy to Azure Storage static website
                az storage blob upload-batch --account-name $ResourceName --source "./dist" --destination '$web' --overwrite
                if ($LASTEXITCODE -ne 0) {
                    throw "Storage deployment failed"
                }
                $deploymentUrl = "https://$ResourceName.z13.web.core.windows.net"
                Write-Host "   [SUCCESS] Deployed to Storage Account: $ResourceName" -ForegroundColor Green
            }
            catch {
                Write-Host "   [ERROR] Storage deployment failed: $($_.Exception.Message)" -ForegroundColor Red
                exit 1
            }
        }
        
        "app-service" {
            try {
                # Deploy to Azure App Service
                Write-Host "   Deploying to App Service: $ResourceName" -ForegroundColor Gray
                
                # Configure app settings for the App Service
                Write-Host "   Configuring app settings..." -ForegroundColor Gray
                
                # Set app settings one by one to avoid shell interpretation issues
                az webapp config appsettings set --resource-group $ResourceGroupName --name $ResourceName --settings "WEBSITE_NODE_DEFAULT_VERSION=~22" --output none
                az webapp config appsettings set --resource-group $ResourceGroupName --name $ResourceName --settings "VITE_API_BASE_URL=https://cwbhieastus001.azurewebsites.net/api" --output none
                az webapp config appsettings set --resource-group $ResourceGroupName --name $ResourceName --settings "VITE_AZURE_BLOB_SAS_URL=https://aistgvi.blob.core.windows.net/?sv=2024-11-04&ss=bfqt&srt=sco&sp=rwdlacupiyx&se=2026-06-26T11:43:55Z&st=2025-09-06T03:28:55Z&spr=https&sig=jlfi75igY6qW805u%2FWErZpEu7AZSll5hJOdvSJU35%2Bo%3D" --output none
                az webapp config appsettings set --resource-group $ResourceGroupName --name $ResourceName --settings "VITE_STORAGE_CONTAINER_NAME=audio-uploads" --output none
                az webapp config appsettings set --resource-group $ResourceGroupName --name $ResourceName --settings "VITE_POLL_INTERVAL_MS=3000" --output none
                az webapp config appsettings set --resource-group $ResourceGroupName --name $ResourceName --settings "VITE_ENABLE_FFMPEG_WORKER=true" --output none
                az webapp config appsettings set --resource-group $ResourceGroupName --name $ResourceName --settings "VITE_ENABLE_DEBUG_LOGGING=false" --output none
                
                # Create deployment package
                Write-Host "   Creating deployment package..." -ForegroundColor Gray
                if (Test-Path "deploy.zip") {
                    Remove-Item "deploy.zip" -Force
                }
                
                # Compress the dist folder
                Compress-Archive -Path "dist\*" -DestinationPath "deploy.zip" -Force
                
                # Deploy using ZIP deployment
                Write-Host "   Uploading to App Service..." -ForegroundColor Gray
                az webapp deployment source config-zip --resource-group $ResourceGroupName --name $ResourceName --src "deploy.zip"
                
                if ($LASTEXITCODE -ne 0) {
                    throw "App Service deployment failed"
                }
                
                $deploymentUrl = "https://$ResourceName.azurewebsites.net"
                Write-Host "   [SUCCESS] Deployed to App Service: $ResourceName" -ForegroundColor Green
                
                # Clean up
                if (Test-Path "deploy.zip") {
                    Remove-Item "deploy.zip" -Force
                }
            }
            catch {
                Write-Host "   [ERROR] App Service deployment failed: $($_.Exception.Message)" -ForegroundColor Red
                exit 1
            }
        }
    }

    # Restore original .env if backup exists
    if (Test-Path ".env.backup") {
        Move-Item ".env.backup" ".env" -Force
        Write-Host "   [INFO] Restored original .env file" -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host "UI DEPLOYMENT COMPLETED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "APPLICATION ENDPOINTS:" -ForegroundColor Cyan
    Write-Host "   Web App: $deploymentUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "   1. Test your web application in a browser" -ForegroundColor Gray
    Write-Host "   2. Verify API connectivity to your Function App" -ForegroundColor Gray
    Write-Host "   3. Check browser console for any errors" -ForegroundColor Gray
    Write-Host ""
}
finally {
    # Always return to original directory
    Pop-Location
}