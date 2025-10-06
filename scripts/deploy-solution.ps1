# Solution-Level Deployment Script for Behavioral Health System
#
# This script provides comprehensive deployment with automatic path resolution.
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
# - Can be run from either the solution root OR the scripts directory
# - .NET 8 SDK installed
# - Azure CLI installed and authenticated
# - Azure Functions Core Tools v4 (for code deployment)
#
# PARAMETERS:
# ===========
# - ResourceGroupName: Target Azure Resource Group name (default: auto-generated as "rg-{FunctionAppName}")
# - FunctionAppName: Globally unique Function App name
# - WebAppName: Globally unique Web App name (default: auto-generated based on FunctionAppName)
# - KintsugiApiKey: Kintsugi Health API key for service integration
# - Location: Azure region (default: East US)
# - SubscriptionId: Azure subscription ID (optional)
# - QuickDeploy: Use auto-generated resource group name for rapid deployment
# - DeployCodeOnly: Deploy infrastructure and code (default: true for complete deployment)
# - SkipWebApp: Skip web application deployment (default: false)
#
# EXAMPLE USAGE:
# ==============
# FROM SCRIPTS DIRECTORY:
# .\deploy-solution.ps1 -FunctionAppName "myapp-func" -KintsugiApiKey "your-key" -QuickDeploy
#
# FROM SOLUTION ROOT:
# .\scripts\deploy-solution.ps1 -FunctionAppName "myapp-func" -KintsugiApiKey "your-key" -QuickDeploy
#
# CUSTOM DEPLOY (specify resource group):
# .\deploy-solution.ps1 -ResourceGroupName "myapp-rg" -FunctionAppName "myapp-func" -KintsugiApiKey "your-key"

param(
    [Parameter(Mandatory=$false, HelpMessage="Enter the Azure Resource Group name (auto-generated if using -QuickDeploy)")]
    [string]$ResourceGroupName = "",
    
    [Parameter(Mandatory=$true, HelpMessage="Enter a globally unique Function App name")]
    [ValidatePattern("^[a-zA-Z0-9\-]{3,60}$")]
    [string]$FunctionAppName,
    
    [Parameter(Mandatory=$false, HelpMessage="Enter a globally unique Web App name (auto-generated if not provided)")]
    [ValidatePattern("^[a-zA-Z0-9\-]{3,60}$")]
    [string]$WebAppName = "",
    
    [Parameter(Mandatory=$true, HelpMessage="Enter your Kintsugi Health API key")]
    [ValidateNotNullOrEmpty()]
    [string]$KintsugiApiKey,
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "East US",
    
    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId = $null,
    
    [Parameter(Mandatory=$false, HelpMessage="Enable quick deploy with auto-generated resource group")]
    [switch]$QuickDeploy,
    
    [Parameter(Mandatory=$false, HelpMessage="Deploy application code after infrastructure (default: true)")]
    [bool]$DeployCode = $true,
    
    [Parameter(Mandatory=$false, HelpMessage="Skip web application deployment")]
    [switch]$SkipWebApp
)

# Set error handling
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Handle QuickDeploy option - auto-generate resource group name
if ($QuickDeploy -or [string]::IsNullOrEmpty($ResourceGroupName)) {
    $ResourceGroupName = "rg-$FunctionAppName"
    Write-Host "🚀 QUICK DEPLOY MODE: Auto-generated resource group name: $ResourceGroupName" -ForegroundColor Magenta
}

# Auto-generate Web App name if not provided
if ([string]::IsNullOrEmpty($WebAppName)) {
    $WebAppName = $FunctionAppName -replace "cwbhi", "cwuibhi"
    if ($WebAppName -eq $FunctionAppName) {
        $WebAppName = $FunctionAppName + "-web"
    }
    Write-Host "🌐 AUTO-GENERATED: Web App name set to: $WebAppName" -ForegroundColor Magenta
}

Write-Host "================================================================================" -ForegroundColor Blue
Write-Host "                         SOLUTION DEPLOYMENT                                   " -ForegroundColor Blue
Write-Host "                     Behavioral Health System                                 " -ForegroundColor Blue
Write-Host "================================================================================" -ForegroundColor Blue
Write-Host ""

# Determine script and solution directories
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SolutionRoot = Split-Path -Parent $ScriptDir

# Validate solution structure
Write-Host "SOLUTION VALIDATION:" -ForegroundColor Yellow
$solutionFile = Join-Path $SolutionRoot "BehavioralHealthSystem.sln"
if (-not (Test-Path $solutionFile)) {
    Write-Host "   X Solution file not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "DIRECTORY REQUIREMENT:" -ForegroundColor Red
    Write-Host "   Expected solution file at: $solutionFile" -ForegroundColor Yellow
    Write-Host "   Current script directory: $ScriptDir" -ForegroundColor Gray
    Write-Host "   Calculated solution root: $SolutionRoot" -ForegroundColor Gray
    Write-Host ""
    Write-Host "USAGE:" -ForegroundColor Yellow
    Write-Host "   # Run from scripts directory:" -ForegroundColor Gray
    Write-Host "   .\scripts\deploy-solution.ps1 -ResourceGroupName 'your-rg' -FunctionAppName 'your-app' -KintsugiApiKey 'your-key'" -ForegroundColor Gray
    Write-Host "   # Or run from solution root:" -ForegroundColor Gray
    Write-Host "   .\scripts\deploy-solution.ps1 -ResourceGroupName 'your-rg' -FunctionAppName 'your-app' -KintsugiApiKey 'your-key'" -ForegroundColor Gray
    exit 1
}

Write-Host "   + Solution file found - ready to deploy" -ForegroundColor Green
Write-Host "   + Script directory: $ScriptDir" -ForegroundColor Gray
Write-Host "   + Solution root: $SolutionRoot" -ForegroundColor Gray

# Check for required project files
$requiredProjects = @(
    "BehavioralHealthSystem.Functions\BehavioralHealthSystem.Functions.csproj",
    "BehavioralHealthSystem.Helpers\BehavioralHealthSystem.Helpers.csproj"
)

foreach ($project in $requiredProjects) {
    $projectPath = Join-Path $SolutionRoot $project
    if (-not (Test-Path $projectPath)) {
        Write-Host "   X Required project not found: $projectPath" -ForegroundColor Red
        exit 1
    }
}
Write-Host "   + All required projects found" -ForegroundColor Green

# Build the solution
Write-Host ""
Write-Host "SOLUTION BUILD:" -ForegroundColor Yellow
Write-Host "   Building solution in Release configuration..." -ForegroundColor Cyan

# Change to solution root for build
Push-Location $SolutionRoot
try {
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
} finally {
    Pop-Location
}

# Call the deployment script
Write-Host ""
Write-Host "AZURE INFRASTRUCTURE DEPLOYMENT:" -ForegroundColor Yellow
Write-Host "   Deploying Azure resources using Bicep templates..." -ForegroundColor Cyan
$deployScript = Join-Path $SolutionRoot "BehavioralHealthSystem.Helpers\Deploy\deploy.ps1"

try {
    $deployParams = @{
        ResourceGroupName = $ResourceGroupName
        FunctionAppName = $FunctionAppName
        KintsugiApiKey = $KintsugiApiKey
        Location = $Location
    }
    
    # Add optional parameters
    if ($WebAppName) {
        $deployParams.WebAppName = $WebAppName
    }
    
    & $deployScript @deployParams

    if ($LASTEXITCODE -eq 0) {
        Write-Host "   + Infrastructure deployment completed successfully" -ForegroundColor Green
        
        # Deploy application code if requested
        if ($DeployCode) {
            Write-Host ""
            Write-Host "APPLICATION CODE DEPLOYMENT:" -ForegroundColor Yellow
            
            # Deploy environment variables to Function App
            Write-Host "   Deploying environment variables to Function App..." -ForegroundColor Cyan
            $envScript = Join-Path $ScriptDir "deploy-environment-variables.ps1"
            try {
                if ($SubscriptionId) {
                    & $envScript -FunctionAppName $FunctionAppName -ResourceGroupName $ResourceGroupName -SubscriptionId $SubscriptionId
                } else {
                    & $envScript -FunctionAppName $FunctionAppName -ResourceGroupName $ResourceGroupName
                }
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "   + Environment variables deployed successfully" -ForegroundColor Green
                } else {
                    Write-Host "   ! Environment variable deployment failed, but continuing..." -ForegroundColor Yellow
                }
            }
            catch {
                Write-Host "   ! Environment variable deployment error: $($_.Exception.Message)" -ForegroundColor Yellow
            }
            
            # Deploy Function App code
            Write-Host "   Deploying Function App code..." -ForegroundColor Cyan
            $codeScript = Join-Path $ScriptDir "deploy-code-only.ps1"
            try {
                & $codeScript -AppServiceName $WebAppName -ResourceGroupName $ResourceGroupName -TargetFunctionAppName $FunctionAppName
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "   + Function App code deployed successfully" -ForegroundColor Green
                } else {
                    Write-Host "   ! Function App deployment failed" -ForegroundColor Yellow
                }
            }
            catch {
                Write-Host "   ! Function App deployment error: $($_.Exception.Message)" -ForegroundColor Yellow
            }
            
            # Deploy Web App if not skipped
            if (-not $SkipWebApp) {
                Write-Host "   Deploying Web App..." -ForegroundColor Cyan
                $uiScript = Join-Path $ScriptDir "deploy-ui.ps1"
                try {
                    & $uiScript -DeploymentTarget "app-service" -ResourceName $WebAppName -ResourceGroupName $ResourceGroupName -FunctionAppName $FunctionAppName
                    
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "   + Web App deployed successfully" -ForegroundColor Green
                    } else {
                        Write-Host "   ! Web App deployment failed" -ForegroundColor Yellow
                    }
                }
                catch {
                    Write-Host "   ! Web App deployment error: $($_.Exception.Message)" -ForegroundColor Yellow
                }
            } else {
                Write-Host "   [SKIPPED] Web App deployment" -ForegroundColor Gray
            }
        }
        
        Write-Host ""
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host "                    SOLUTION DEPLOYMENT COMPLETE!                             " -ForegroundColor Green
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "DEPLOYMENT SUMMARY:" -ForegroundColor Yellow
        Write-Host "   Resource Group: $ResourceGroupName" -ForegroundColor White
        Write-Host "   Function App: $FunctionAppName" -ForegroundColor White
        if (-not $SkipWebApp) {
            Write-Host "   Web App: $WebAppName" -ForegroundColor White
        }
        Write-Host "   Location: $Location" -ForegroundColor White
        Write-Host ""
        Write-Host "APPLICATION ENDPOINTS:" -ForegroundColor Cyan
        Write-Host "   Function App API: https://$FunctionAppName.azurewebsites.net/api" -ForegroundColor White
        Write-Host "   Health Check: https://$FunctionAppName.azurewebsites.net/api/health" -ForegroundColor White
        if (-not $SkipWebApp) {
            Write-Host "   Web Application: https://$WebAppName.azurewebsites.net" -ForegroundColor White
        }
        Write-Host ""
        
        if ($DeployCode) {
            Write-Host "VERIFICATION STEPS:" -ForegroundColor Cyan
            Write-Host "   1. Test health endpoint:" -ForegroundColor Gray
            Write-Host "      curl https://$FunctionAppName.azurewebsites.net/api/health" -ForegroundColor Gray
            Write-Host ""
            Write-Host "   2. Test API connection:" -ForegroundColor Gray
            Write-Host "      curl -X POST https://$FunctionAppName.azurewebsites.net/api/TestKintsugiConnection" -ForegroundColor Gray
            Write-Host ""
            if (-not $SkipWebApp) {
                Write-Host "   3. Open web application:" -ForegroundColor Gray
                Write-Host "      https://$WebAppName.azurewebsites.net" -ForegroundColor Gray
                Write-Host ""
            }
        } else {
            Write-Host "MANUAL DEPLOYMENT STEPS (since -DeployCode was false):" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "   1. Deploy Function App Code:" -ForegroundColor Cyan
            Write-Host "      .\scripts\deploy-code-only.ps1 -FunctionAppName '$FunctionAppName' -ResourceGroupName '$ResourceGroupName'" -ForegroundColor Gray
            Write-Host ""
            Write-Host "   2. Deploy Environment Variables:" -ForegroundColor Cyan
            Write-Host "      .\scripts\deploy-environment-variables.ps1 -FunctionAppName '$FunctionAppName' -ResourceGroupName '$ResourceGroupName'" -ForegroundColor Gray
            Write-Host ""
            if (-not $SkipWebApp) {
                Write-Host "   3. Deploy Web App:" -ForegroundColor Cyan
                Write-Host "      .\scripts\deploy-ui.ps1 -DeploymentTarget 'app-service' -ResourceName '$WebAppName' -ResourceGroupName '$ResourceGroupName'" -ForegroundColor Gray
                Write-Host ""
            }
        }
        
        Write-Host "MONITORING & MANAGEMENT:" -ForegroundColor Cyan
        Write-Host "   • Azure Portal > Resource Groups > $ResourceGroupName" -ForegroundColor Gray
        Write-Host "   • Application Insights for logs and metrics" -ForegroundColor Gray
        Write-Host "   • Set up alerts for errors and performance issues" -ForegroundColor Gray
        Write-Host ""
        Write-Host "USEFUL RESOURCES:" -ForegroundColor Cyan
        Write-Host "   • API Usage Examples: sample-requests.md" -ForegroundColor White
        Write-Host "   • Local Development: README.md section" -ForegroundColor White
        Write-Host "   • Azure Functions Docs: https://docs.microsoft.com/azure/azure-functions/" -ForegroundColor White
        Write-Host ""
        Write-Host "🎉 Your Behavioral Health System is ready for production use!" -ForegroundColor Green
    } else {
        Write-Host "Infrastructure deployment failed" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "Deployment error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
