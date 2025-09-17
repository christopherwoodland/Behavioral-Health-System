# Code-Only Deployment Script for Behavioral Health System
#
# This script deploys ONLY the application code to existing Azure resources.
# Use this for rapid code updates after the initial infrastructure deployment.
#
# WHAT THIS SCRIPT DOES:
# ======================
# - Builds the specified project in Release mode
# - Publishes the code to the existing Azure App Service or Function App
# - Updates application settings if needed
# - Verifies deployment success
#
# PREREQUISITES:
# ==============
# - Azure CLI installed and authenticated
# - For Function Apps: Azure Functions Core Tools installed
# - For Web Apps: Node.js and npm installed
# - Existing App Service or Function App infrastructure in Azure
#
# PARAMETERS:
# ===========
# - AppServiceName: Name of your existing App Service (for Web project)
# - FunctionAppName: Name of your existing Function App (for Functions project)
# - ResourceGroupName: Name of your existing Resource Group
# - KintsugiApiKey: (Optional) Update the API key if needed

param(
    [Parameter(Mandatory=$false)]
    [string]$AppServiceName = $null,
    
    [Parameter(Mandatory=$false)]
    [string]$FunctionAppName = $null,
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupName = "bhi",
    
    [Parameter(Mandatory=$false)]
    [string]$KintsugiApiKey = $null
)

# Set error handling
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Validate parameters
if (-not $AppServiceName -and -not $FunctionAppName) {
    Write-Host "ERROR: You must specify either -AppServiceName or -FunctionAppName" -ForegroundColor Red
    Write-Host ""
    Write-Host "USAGE EXAMPLES:" -ForegroundColor Yellow
    Write-Host "   .\deploy-code-only.ps1 -AppServiceName `"cwuibhieastus001`"" -ForegroundColor Gray
    Write-Host "   .\deploy-code-only.ps1 -FunctionAppName `"cwbhieastus001`"" -ForegroundColor Gray
    exit 1
}

if ($AppServiceName -and $FunctionAppName) {
    Write-Host "ERROR: You cannot specify both -AppServiceName and -FunctionAppName" -ForegroundColor Red
    Write-Host "Please specify only one deployment target" -ForegroundColor Yellow
    exit 1
}

# Determine deployment type and project paths
$DeploymentType = if ($AppServiceName) { "AppService" } else { "FunctionApp" }
$TargetName = if ($AppServiceName) { $AppServiceName } else { $FunctionAppName }

# Script directory and project paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SolutionDir = $ScriptDir  # Script is in the solution root directory

if ($DeploymentType -eq "AppService") {
    $ProjectDir = Join-Path $SolutionDir "BehavioralHealthSystem.Web"
    $ProjectName = "Web App Service"
} else {
    $ProjectDir = Join-Path $SolutionDir "BehavioralHealthSystem.Functions"
    $ProjectName = "Function App"
}

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "                        CODE DEPLOYMENT                                       " -ForegroundColor Cyan  
Write-Host "                     Behavioral Health System                                  " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "CODE DEPLOYMENT CONFIGURATION:" -ForegroundColor Yellow
Write-Host "   Deployment Type: $ProjectName" -ForegroundColor Green
Write-Host "   Target Resource: $TargetName" -ForegroundColor Green
Write-Host "   Resource Group: $ResourceGroupName" -ForegroundColor Green
Write-Host "   Project Directory: $ProjectDir" -ForegroundColor Green
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

# Verify Azure resource exists
Write-Host "Verifying $ProjectName exists..." -ForegroundColor Yellow
try {
    if ($DeploymentType -eq "AppService") {
        $resource = az webapp show --name $AppServiceName --resource-group $ResourceGroupName --output json | ConvertFrom-Json
        Write-Host "   [SUCCESS] App Service found: $($resource.defaultHostName)" -ForegroundColor Green
    } else {
        $resource = az functionapp show --name $FunctionAppName --resource-group $ResourceGroupName --output json | ConvertFrom-Json
        Write-Host "   [SUCCESS] Function App found: $($resource.defaultHostName)" -ForegroundColor Green
    }
}
catch {
    Write-Host "   [ERROR] $ProjectName '$TargetName' not found in resource group '$ResourceGroupName'" -ForegroundColor Red
    Write-Host "   Please check the names or deploy infrastructure first" -ForegroundColor Yellow
    exit 1
}

# Verify project directory exists
Write-Host "Checking project directory..." -ForegroundColor Yellow
if (-not (Test-Path $ProjectDir)) {
    Write-Host "   [ERROR] Project directory not found: $ProjectDir" -ForegroundColor Red
    exit 1
}
Write-Host "   [SUCCESS] Project directory found" -ForegroundColor Green

# Change to project directory
Write-Host "Navigating to project directory..." -ForegroundColor Yellow
Set-Location $ProjectDir

# Clean and build the project
if ($DeploymentType -eq "AppService") {
    # Web project uses npm/Vite build process
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    try {
        npm install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed with exit code $LASTEXITCODE"
        }
        Write-Host "   [SUCCESS] Dependencies installed" -ForegroundColor Green
    }
    catch {
        Write-Host "   [ERROR] npm install failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }

    Write-Host "Building Web project..." -ForegroundColor Yellow
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "npm run build failed with exit code $LASTEXITCODE"
        }
        Write-Host "   [SUCCESS] Web build completed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "   [ERROR] Web build failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
} else {
    # Function App uses dotnet build process
    Write-Host "Cleaning previous build..." -ForegroundColor Yellow
    try {
        dotnet clean --configuration Release --verbosity quiet
        Write-Host "   [SUCCESS] Clean completed" -ForegroundColor Green
    }
    catch {
        Write-Host "   [WARNING] Clean failed, continuing..." -ForegroundColor Yellow
    }

    Write-Host "Building $ProjectName..." -ForegroundColor Yellow
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
}

# Update application settings if API key provided
if ($KintsugiApiKey) {
    Write-Host "Updating application settings..." -ForegroundColor Yellow
    try {
        if ($DeploymentType -eq "AppService") {
            az webapp config appsettings set --name $AppServiceName --resource-group $ResourceGroupName --settings "KINTSUGI_API_KEY=$KintsugiApiKey" --output none
        } else {
            az functionapp config appsettings set --name $FunctionAppName --resource-group $ResourceGroupName --settings "KINTSUGI_API_KEY=$KintsugiApiKey" --output none
        }
        Write-Host "   [SUCCESS] API key updated" -ForegroundColor Green
    }
    catch {
        Write-Host "   [WARNING] Failed to update API key, continuing with deployment..." -ForegroundColor Yellow
    }
}

# Deploy the code
Write-Host "Deploying code to Azure $ProjectName..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes..." -ForegroundColor Gray

try {
    if ($DeploymentType -eq "AppService") {
        # Deploy Web App using az webapp deployment
        $distPath = Join-Path $ProjectDir "dist"
        
        # Verify dist folder exists
        if (-not (Test-Path $distPath)) {
            throw "Build output not found at $distPath. Make sure npm run build completed successfully."
        }
        
        # Create a zip file for deployment
        $zipPath = Join-Path $ProjectDir "deploy.zip"
        if (Test-Path $zipPath) {
            Remove-Item $zipPath -Force
        }
        
        # Compress the dist folder
        Compress-Archive -Path "$distPath\*" -DestinationPath $zipPath -Force
        
        # Deploy the zip file
        az webapp deploy --resource-group $ResourceGroupName --name $AppServiceName --src-path $zipPath --type zip
        
        # Clean up
        Remove-Item $zipPath -Force
    } else {
        # Use func command for Function App deployment
        func azure functionapp publish $FunctionAppName --force
    }
    
    if ($LASTEXITCODE -ne 0) {
        throw "Deployment failed with exit code $LASTEXITCODE"
    }
    
    Write-Host "   [SUCCESS] Code deployment completed successfully" -ForegroundColor Green
}
catch {
    Write-Host "   [ERROR] Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "TROUBLESHOOTING:" -ForegroundColor Yellow
    if ($DeploymentType -eq "AppService") {
        Write-Host "   - Check App Service status in Azure Portal" -ForegroundColor Gray
        Write-Host "   - Try restarting the App Service: az webapp restart --name $AppServiceName --resource-group $ResourceGroupName" -ForegroundColor Gray
    } else {
        Write-Host "   - Verify Azure Functions Core Tools are installed: func --version" -ForegroundColor Gray
        Write-Host "   - Check Function App status in Azure Portal" -ForegroundColor Gray
        Write-Host "   - Try restarting the Function App: az functionapp restart --name $FunctionAppName --resource-group $ResourceGroupName" -ForegroundColor Gray
    }
    exit 1
}

# Verify deployment
Write-Host "Verifying deployment..." -ForegroundColor Yellow
try {
    Start-Sleep -Seconds 10  # Give the app time to restart
    
    if ($DeploymentType -eq "AppService") {
        $healthUrl = "https://$AppServiceName.azurewebsites.net"
        Write-Host "   Testing App Service: $healthUrl" -ForegroundColor Gray
    } else {
        $healthUrl = "https://$FunctionAppName.azurewebsites.net/api/health"
        Write-Host "   Testing health endpoint: $healthUrl" -ForegroundColor Gray
    }
    
    $response = Invoke-WebRequest -Uri $healthUrl -Method GET -TimeoutSec 30 -UseBasicParsing
    
    if ($response.StatusCode -eq 200) {
        Write-Host "   [SUCCESS] Health check passed - $ProjectName is running" -ForegroundColor Green
    } else {
        Write-Host "   [WARNING] Health check returned status: $($response.StatusCode)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "   [WARNING] Health check failed, but deployment may still be successful" -ForegroundColor Yellow
    Write-Host "   $ProjectName may need a few more minutes to fully start" -ForegroundColor Gray
}

Write-Host ""
Write-Host "CODE DEPLOYMENT COMPLETED!" -ForegroundColor Green
Write-Host ""

if ($DeploymentType -eq "AppService") {
    Write-Host "APP SERVICE ENDPOINTS:" -ForegroundColor Cyan
    Write-Host "   Base URL: https://$AppServiceName.azurewebsites.net" -ForegroundColor White
    Write-Host "   Web Application: https://$AppServiceName.azurewebsites.net" -ForegroundColor White
} else {
    Write-Host "FUNCTION APP ENDPOINTS:" -ForegroundColor Cyan
    Write-Host "   Base URL: https://$FunctionAppName.azurewebsites.net" -ForegroundColor White
    Write-Host "   Health: https://$FunctionAppName.azurewebsites.net/api/health" -ForegroundColor White
    Write-Host "   Sessions Initiate: https://$FunctionAppName.azurewebsites.net/api/sessions/initiate" -ForegroundColor White
    Write-Host "   Predictions Submit: https://$FunctionAppName.azurewebsites.net/api/predictions/submit" -ForegroundColor White
}

Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
if ($DeploymentType -eq "AppService") {
    Write-Host "   1. Open your web application in a browser" -ForegroundColor Gray
    Write-Host "   2. Test the user interface and functionality" -ForegroundColor Gray
} else {
    Write-Host "   1. Test your endpoints using the sample-requests.md examples" -ForegroundColor Gray
    Write-Host "   2. Monitor logs in Azure Portal or Application Insights" -ForegroundColor Gray
}
Write-Host "   3. Your recent code changes are now live!" -ForegroundColor Gray
Write-Host ""
Write-Host "TIP: Use this script for future code-only deployments!" -ForegroundColor Cyan