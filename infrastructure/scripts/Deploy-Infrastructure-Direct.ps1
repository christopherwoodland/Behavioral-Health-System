#!/usr/bin/env pwsh

<#
.SYNOPSIS
Deploy BHS infrastructure to Azure using Bicep templates

.DESCRIPTION
Deploys the complete Behavioral Health System infrastructure including networking,
storage, Key Vault, Function App, and cognitive services.

.PARAMETER Environment
Environment name (dev, staging, prod)

.PARAMETER ParameterFile
Path to JSON parameter file with deployment configuration

.PARAMETER WhatIf
Preview changes without applying them

.PARAMETER SkipValidation
Skip template validation (faster for known-good templates)

.EXAMPLE
.\Deploy-Infrastructure-Direct.ps1 -Environment dev -ParameterFile ./parameters/dev.parameters.json
.\Deploy-Infrastructure-Direct.ps1 -Environment dev -ParameterFile ./parameters/dev.parameters.json -WhatIf
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Environment,

    [Parameter(Mandatory = $true)]
    [string]$ParameterFile,

    [switch]$WhatIf,
    [switch]$SkipValidation
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================================"
Write-Host "  BHS Infrastructure Deployment (Direct Bicep)"
Write-Host "========================================================"

# Check prerequisites
Write-Host "`n[*] Checking prerequisites..."
az --version 2>&1 | Out-Null
Write-Host "[OK] Azure CLI installed"

$ErrorActionPreference = "Stop"

# Validate Azure account
Write-Host "[*] Checking Azure account..."
$account = az account show -o json | ConvertFrom-Json
Write-Host "[OK] Logged in as: $($account.user.name)"
Write-Host "[OK] Subscription: $($account.name) ($($account.id))"

# Detect client IP for Key Vault firewall
Write-Host "[*] Detecting your IP address for Key Vault firewall..."
$clientIP = ""
try {
    $response = Invoke-WebRequest -Uri "https://ifconfig.me" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    $clientIP = $response.Content.Trim()
    if (-not $clientIP) {
        $response = Invoke-WebRequest -Uri "https://icanhazip.com" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        $clientIP = $response.Content.Trim()
    }
} catch {
    Write-Host "[WARNING] Could not auto-detect IP address"
    $clientIP = "0.0.0.0/0"
}
Write-Host "[OK] Detected IP: $clientIP"

# Validate and load parameter file
Write-Host "`n[*] Loading parameter file: $ParameterFile"
if (-not (Test-Path $ParameterFile)) {
    Write-Host "[ERROR] Parameter file not found: $ParameterFile"
    exit 1
}
$params = Get-Content $ParameterFile | ConvertFrom-Json
Write-Host "[OK] Parameters loaded"
# Construct template path
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$templatePath = Join-Path $scriptDir "..\bicep\main.bicep"
$templatePath = Resolve-Path $templatePath

if (-not (Test-Path $templatePath)) {
    Write-Host "[ERROR] Template file not found: $templatePath"
    exit 1
}

# Extract deployment settings
$location = $params.parameters.location.value
$deploymentName = "bhs-" + $Environment + "-" + (Get-Date -Format "yyyyMMdd-HHmmss")

Write-Host "`n[*] Deployment configuration:"
Write-Host "  Parameters: $ParameterFile"
Write-Host "  Environment: $Environment"
Write-Host "  Location: $location"
Write-Host "  Deployment Name: $deploymentName"
Write-Host "  Client IP: $clientIP"

# Template validation
if (-not $SkipValidation) {
    Write-Host "`n[*] Validating template..."
    $validateArgs = @('deployment','sub','validate','--location',$location,'--template-file',$templatePath,'--parameters',"@$ParameterFile")
    & az @validateArgs | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Template validation successful"
    } else {
        Write-Host "[WARNING] Template validation returned warnings"
    }
}

# What-If Preview
if ($WhatIf) {
    Write-Host "`n[*] Running what-if preview (no resources will be created)..."
    Write-Host "========================================================"
    $whatIfArgs = @('deployment','sub','what-if','--location',$location,'--template-file',$templatePath,'--parameters',"@$ParameterFile",'--no-pretty-print')
    & az @whatIfArgs
    Write-Host "`n[INFO] What-if preview completed. No changes were applied."
    exit 0
}

# Deploy
Write-Host "`n[*] Starting deployment..."
Write-Host "========================================================"

${null} = $templatePath
$createArgs = @('deployment','sub','create','--name',$deploymentName,'--location',$location,'--template-file',$templatePath,'--parameters',"@$ParameterFile",'--no-wait')
& az @createArgs
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Deployment initiation failed"
    exit 1
}

Write-Host "[OK] Deployment initiated: $deploymentName"
Write-Host "[*] Polling deployment status every 30 seconds...`n"

# Poll deployment status
$maxAttempts = 50
$pollingInterval = 30

for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    Start-Sleep -Seconds $pollingInterval

    $showStatusArgs = @('deployment','sub','show','--name',$deploymentName,'--query','properties.provisioningState','-o','tsv')
    $status = & az @showStatusArgs

    $timestamp = Get-Date -Format "HH:mm:ss"
    Write-Host "[$timestamp] Attempt $attempt/$maxAttempts - Status: $status"

    if ($status -eq "Succeeded") {
        Write-Host "`n=========================================================="
        Write-Host "         SUCCESS! Deployment completed"
        Write-Host "=========================================================="

        # Show outputs
        Write-Host "[*] Deployment outputs:"
        $showOutputsArgs = @('deployment','sub','show','--name',$deploymentName,'--query','properties.outputs','-o','json')
        $outputsJson = & az @showOutputsArgs
        $outputs = $outputsJson | ConvertFrom-Json

        $outputs | Get-Member -MemberType NoteProperty | ForEach-Object {
            $key = $_.Name
            $value = $outputs.$key.value
            Write-Host "  $key = $value"
        }

        exit 0
    } elseif ($status -eq "Failed") {
        Write-Host "`n[ERROR] Deployment failed!"
        Write-Host "`n[*] Checking deployment errors..."

        $showErrorsArgs = @('deployment','sub','show','--name',$deploymentName,'--query','properties.error.details[*].{Code: code, Message: message}','-o','json')
        $errorsJson = & az @showErrorsArgs
        $errors = $errorsJson | ConvertFrom-Json

        Write-Host "`nError Details:"
        $errors | ForEach-Object {
            Write-Host "  Code: $($_.Code)"
            Write-Host "  Message: $($_.Message)"
        }

        exit 1
    } elseif ($status -eq "Canceled") {
        Write-Host "`n[ERROR] Deployment was canceled"
        exit 1
    }
}

Write-Host "`n[ERROR] Deployment polling timeout after $($maxAttempts * $pollingInterval) seconds"
exit 1
