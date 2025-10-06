# Bicep Template Deployment Script for Behavioral Health System
#
# This script deploys the Azure infrastructure using modern Bicep templates
#
# PARAMETERS:
# - ResourceGroupName: Target Azure Resource Group name
# - FunctionAppName: Globally unique Function App name  
# - KintsugiApiKey: Kintsugi Health API key
# - Location: Azure region (default: East US)
# - WebAppName: Optional Web App name
# - AzureOpenAIEndpoint: Optional Azure OpenAI endpoint
# - AzureOpenAIApiKey: Optional Azure OpenAI API key

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
    [string]$WebAppName = "",
    
    [Parameter(Mandatory=$false)]
    [string]$AzureOpenAIEndpoint = "",
    
    [Parameter(Mandatory=$false)]
    [string]$AzureOpenAIApiKey = ""
)

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$bicepFile = Join-Path $ScriptDir "main.bicep"

Write-Host "BICEP TEMPLATE DEPLOYMENT:" -ForegroundColor Yellow
Write-Host "   Resource Group: $ResourceGroupName" -ForegroundColor Gray
Write-Host "   Function App: $FunctionAppName" -ForegroundColor Gray
if ($WebAppName) {
    Write-Host "   Web App: $WebAppName" -ForegroundColor Gray
}
Write-Host "   Location: $Location" -ForegroundColor Gray
Write-Host "   Bicep Template: $bicepFile" -ForegroundColor Gray

# Check if Bicep template exists
if (-not (Test-Path $bicepFile)) {
    Write-Host "   X Bicep template not found: $bicepFile" -ForegroundColor Red
    exit 1
}

# Check if resource group exists, create if it doesn't
Write-Host "   Checking resource group..." -ForegroundColor Cyan
$rgExists = az group exists --name $ResourceGroupName --output tsv
if ($rgExists -eq "false") {
    Write-Host "   Creating resource group: $ResourceGroupName" -ForegroundColor Cyan
    az group create --name $ResourceGroupName --location $Location --output none
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   X Failed to create resource group" -ForegroundColor Red
        exit 1
    }
    Write-Host "   + Resource group created successfully" -ForegroundColor Green
} else {
    Write-Host "   + Resource group already exists" -ForegroundColor Green
}

# Build deployment parameters
$deploymentName = "BehavioralHealthSystem-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$deploymentParams = @(
    "functionAppName='$FunctionAppName'",
    "location='$Location'",
    "kintsugiApiKey='$KintsugiApiKey'"
)

# Add optional parameters
if ($WebAppName) {
    $deploymentParams += "webAppName='$WebAppName'"
}
if ($AzureOpenAIEndpoint) {
    $deploymentParams += "azureOpenAIEndpoint='$AzureOpenAIEndpoint'"
}
if ($AzureOpenAIApiKey) {
    $deploymentParams += "azureOpenAIApiKey='$AzureOpenAIApiKey'"
}

# Deploy Bicep template
Write-Host "   Deploying Bicep template..." -ForegroundColor Cyan

try {
    $paramString = $deploymentParams -join " "
    $cmd = "az deployment group create --resource-group '$ResourceGroupName' --name '$deploymentName' --template-file `"$bicepFile`" --parameters $paramString --output none"
    
    Invoke-Expression $cmd

    if ($LASTEXITCODE -eq 0) {
        Write-Host "   + Bicep template deployment completed successfully" -ForegroundColor Green
        
        # Get deployment outputs
        Write-Host "   Retrieving deployment outputs..." -ForegroundColor Cyan
        try {
            $outputsJson = az deployment group show --resource-group $ResourceGroupName --name $deploymentName --query "properties.outputs" --output json
            if ($outputsJson -and $outputsJson -ne "null") {
                $outputs = $outputsJson | ConvertFrom-Json
                
                Write-Host ""
                Write-Host "DEPLOYMENT OUTPUTS:" -ForegroundColor Yellow
                
                # Display outputs
                if ($outputs.PSObject.Properties['functionAppName']) {
                    Write-Host "   Function App Name: $($outputs.functionAppName.value)" -ForegroundColor Green
                }
                if ($outputs.PSObject.Properties['functionAppUrl']) {
                    Write-Host "   Function App URL: $($outputs.functionAppUrl.value)" -ForegroundColor Green
                }
                if ($outputs.PSObject.Properties['webAppName'] -and $outputs.webAppName.value) {
                    Write-Host "   Web App Name: $($outputs.webAppName.value)" -ForegroundColor Green
                }
                if ($outputs.PSObject.Properties['webAppUrl'] -and $outputs.webAppUrl.value) {
                    Write-Host "   Web App URL: $($outputs.webAppUrl.value)" -ForegroundColor Green
                }
                if ($outputs.PSObject.Properties['storageAccountName']) {
                    Write-Host "   Storage Account: $($outputs.storageAccountName.value)" -ForegroundColor Green
                }
                if ($outputs.PSObject.Properties['appInsightsName']) {
                    Write-Host "   Application Insights: $($outputs.appInsightsName.value)" -ForegroundColor Green
                }
            } else {
                Write-Host "   No deployment outputs available" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "   Warning: Could not retrieve deployment outputs (deployment still successful)" -ForegroundColor Yellow
        }
        
        exit 0
    } else {
        Write-Host "   X Bicep template deployment failed" -ForegroundColor Red
        Write-Host ""
        Write-Host "TROUBLESHOOTING:" -ForegroundColor Red
        Write-Host "   • Check Azure CLI is logged in: az account show" -ForegroundColor Yellow
        Write-Host "   • Verify Bicep is installed: az bicep version" -ForegroundColor Yellow
        Write-Host "   • Check resource group permissions" -ForegroundColor Yellow
        Write-Host "   • Verify function app name is globally unique" -ForegroundColor Yellow
        Write-Host "   • Review deployment logs in Azure Portal" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "   X Bicep template deployment failed with exception: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}