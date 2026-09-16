#!/usr/bin/env pwsh
<#
.SYNOPSIS
Builds and deploys the Behavioral Health System web UI to Azure Container Apps.

.DESCRIPTION
Builds an immutable image in the existing ACR, validates and deploys the web
Container App, adds its exact origin to Functions CORS and the Entra SPA redirect
list, and verifies the public UI and authenticated API preflight contract.
#>
[CmdletBinding()]
param(
    [string]$SubscriptionId = "6bf68138-6ea4-4272-a3db-78e737e132a6",
    [string]$ResourceGroup = "bhs",
    [string]$AppName = "bhs-web",
    [string]$FunctionsAppName = "bhs-functions",
    [string]$RegistryName = "bhsdam4hajt53n4i4pg",
    [string]$UiClientId = "16bd4645-402e-44ba-9c6f-414af87f7d6e",
    [string]$ImageTag = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss"),
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$env:AZURE_CORE_ONLY_SHOW_ERRORS = "true"
$repoRoot = Split-Path $PSScriptRoot -Parent
$webRoot = Join-Path $repoRoot "BehavioralHealthSystem.Web"
$template = Join-Path $PSScriptRoot "web-container-app.bicep"
$deploymentName = "web-container-app-$ImageTag"

function Invoke-Az {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)
    & az @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Azure CLI command failed: az $($Arguments[0..([Math]::Min(2, $Arguments.Count - 1))] -join ' ')"
    }
}

function Get-ResponseText {
    param([Parameter(Mandatory)]$Response)
    if ($Response.Content -is [byte[]]) {
        return [System.Text.Encoding]::UTF8.GetString($Response.Content)
    }
    return [string]$Response.Content
}

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw "Azure CLI was not found."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found."
}

Push-Location $repoRoot
try {
    Invoke-Az account set --subscription $SubscriptionId

    if (-not $SkipTests) {
        Push-Location $webRoot
        try {
            if (-not (Test-Path "node_modules")) {
                npm ci
                if ($LASTEXITCODE -ne 0) { throw "npm ci failed." }
            }
            npm run test:run
            if ($LASTEXITCODE -ne 0) { throw "Web tests failed." }
            npm run build
            if ($LASTEXITCODE -ne 0) { throw "Web build failed." }
        }
        finally {
            Pop-Location
        }
    }

    if (-not $SkipBuild) {
        Write-Information "Building $RegistryName.azurecr.io/bhs-web:$ImageTag..." -InformationAction Continue
        Invoke-Az acr build `
            --registry $RegistryName `
            --image "bhs-web:$ImageTag" `
            --file (Join-Path $webRoot "Dockerfile.prod") `
            $webRoot
    }

    $parameters = @(
        "appName=$AppName",
        "imageTag=$ImageTag",
        "uiClientId=$UiClientId"
    )

    Write-Information "Validating the web deployment..." -InformationAction Continue
    Invoke-Az deployment group validate `
        --resource-group $ResourceGroup `
        --template-file $template `
        --parameters @parameters `
        --output none

    if ($WhatIf) {
        Invoke-Az deployment group what-if `
            --resource-group $ResourceGroup `
            --template-file $template `
            --parameters @parameters
        return
    }

    Invoke-Az deployment group create `
        --name $deploymentName `
        --resource-group $ResourceGroup `
        --template-file $template `
        --parameters @parameters `
        --output none

    $webApp = az containerapp show --resource-group $ResourceGroup --name $AppName --output json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($webApp.properties.configuration.ingress.fqdn)) {
        throw "Unable to resolve the web Container App endpoint."
    }
    $webOrigin = "https://$($webApp.properties.configuration.ingress.fqdn)"

    $functionsApp = az containerapp show --resource-group $ResourceGroup --name $FunctionsAppName --output json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "Unable to read the Functions Container App." }
    $corsSetting = $functionsApp.properties.template.containers[0].env |
        Where-Object { $_.name -eq "ALLOWED_ORIGINS" } |
        Select-Object -First 1
    $allowedOrigins = @($corsSetting.value -split "," | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($allowedOrigins -notcontains $webOrigin) {
        $allowedOrigins = @($allowedOrigins + $webOrigin | Select-Object -Unique)
        Invoke-Az containerapp update `
            --resource-group $ResourceGroup `
            --name $FunctionsAppName `
            --set-env-vars "ALLOWED_ORIGINS=$($allowedOrigins -join ',')" `
            --output none
    }

    $uiApp = az ad app show --id $UiClientId --output json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "Unable to read the Entra SPA app registration." }
    $redirectUris = @($uiApp.spa.redirectUris)
    if ($redirectUris -notcontains $webOrigin) {
        $redirectUris = @($redirectUris + $webOrigin | Select-Object -Unique)
        $bodyPath = [System.IO.Path]::GetTempFileName()
        try {
            @{ spa = @{ redirectUris = $redirectUris } } |
                ConvertTo-Json -Depth 4 -Compress |
                Set-Content -Path $bodyPath -Encoding utf8 -NoNewline
            Invoke-Az rest `
                --method PATCH `
                --uri "https://graph.microsoft.com/v1.0/applications/$($uiApp.id)" `
                --headers "Content-Type=application/json" `
                --body "@$bodyPath" `
                --output none
        }
        finally {
            Remove-Item $bodyPath -Force -ErrorAction SilentlyContinue
        }
    }

    $health = $null
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        try {
            $health = Invoke-WebRequest -Uri "$webOrigin/health" -TimeoutSec 30
            break
        }
        catch {
            if ($attempt -eq 30) { throw }
            Start-Sleep -Seconds 10
        }
    }
    $healthContent = Get-ResponseText $health
    if ($health.StatusCode -ne 200 -or $healthContent.Trim() -ne "healthy") {
        throw "The web health endpoint returned an unexpected response."
    }

    $runtimeConfig = Invoke-WebRequest -Uri "$webOrigin/config.js" -TimeoutSec 30
    $runtimeConfigContent = Get-ResponseText $runtimeConfig
    if ($runtimeConfigContent -notmatch [regex]::Escape("https://bhs-functions.victorioussmoke-ce62b9bb.eastus.azurecontainerapps.io/api")) {
        throw "The runtime configuration does not reference the expected Azure Functions API."
    }
    if ($runtimeConfigContent -match "VITE_AZURE_BLOB_SAS_URL|DAM_API_KEY|FUNCTIONS_API_KEY") {
        throw "The browser runtime configuration contains a forbidden secret-bearing setting."
    }

    $functionsFqdn = $functionsApp.properties.configuration.ingress.fqdn
    $preflight = Invoke-WebRequest `
        -Uri "https://$functionsFqdn/api/health" `
        -Method Options `
        -Headers @{
            Origin = $webOrigin
            "Access-Control-Request-Method" = "GET"
            "Access-Control-Request-Headers" = "authorization,content-type"
        }
    if ($preflight.Headers["Access-Control-Allow-Origin"] -ne $webOrigin) {
        throw "Functions CORS did not allow the exact web origin."
    }

    Write-Information "Deployment complete: $webOrigin" -InformationAction Continue
    Write-Information "Functions API: https://$functionsFqdn/api" -InformationAction Continue
    Write-Information "Entra SPA redirect and exact-origin CORS verified." -InformationAction Continue
}
finally {
    Pop-Location
}
