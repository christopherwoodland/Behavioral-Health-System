#!/usr/bin/env pwsh
<#
.SYNOPSIS
Builds and deploys the Behavioral Health System Functions Container App.

.DESCRIPTION
Builds an immutable image in the existing ACR, deploys the app with identity-based
Blob/Queue/Table access, bootstraps the PostgreSQL Entra role, and applies the final
PostgreSQL-backed configuration. Secrets are read from parameters or environment variables.
#>
[CmdletBinding()]
param(
    [string]$SubscriptionId = "6bf68138-6ea4-4272-a3db-78e737e132a6",
    [string]$TenantId = "16b3c013-d300-468d-ac64-7eda0820b6d3",
    [string]$ResourceGroup = "bhs",
    [string]$AppName = "bhs-functions",
    [string]$RegistryName = "bhsdam4hajt53n4i4pg",
    [string]$ImageTag = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss"),
    [string]$DamApiKey = $env:DAM_API_KEY,
    [string]$FunctionsApiKey = $env:FUNCTIONS_API_KEY,
    [string]$EntraClientId = $env:ENTRA_CLIENT_ID,
    [string]$PostgresEntraAdmin,
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$env:AZURE_CORE_ONLY_SHOW_ERRORS = "true"
$repoRoot = Split-Path $PSScriptRoot -Parent
$template = Join-Path $PSScriptRoot "functions-container-app.bicep"
$postgresScript = Join-Path $PSScriptRoot "Configure-FunctionsPostgresRole.ps1"
$deploymentName = "functions-container-app-$ImageTag"
$storageScope = "/subscriptions/$SubscriptionId/resourceGroups/DefaultResourceGroup-CCAN/providers/Microsoft.Storage/storageAccounts/cwacstest001"
$foundryScope = "/subscriptions/$SubscriptionId/resourceGroups/integration/providers/Microsoft.CognitiveServices/accounts/cwoodland-0035-test-002-resource"
$speechScope = "/subscriptions/$SubscriptionId/resourceGroups/integration/providers/Microsoft.CognitiveServices/accounts/bhs-transcription-eastus"
$foundryAgentConsumerRoleId = "eed3b665-ab3a-47b6-8f48-c9382fb1dad6"
$cognitiveServicesSpeechUserRoleId = "f2dc8367-1007-4938-bd23-fe263f013447"

function Invoke-Az {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)
    & az @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Azure CLI command failed: az $($Arguments[0..([Math]::Min(2, $Arguments.Count - 1))] -join ' ')"
    }
}

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw "Azure CLI was not found."
}
if ([string]::IsNullOrWhiteSpace($DamApiKey)) {
    throw "Set DAM_API_KEY or pass -DamApiKey."
}
if ([string]::IsNullOrWhiteSpace($FunctionsApiKey) -and [string]::IsNullOrWhiteSpace($EntraClientId)) {
    throw "Configure API authentication with FUNCTIONS_API_KEY or ENTRA_CLIENT_ID."
}
if (-not $WhatIf -and [string]::IsNullOrWhiteSpace($PostgresEntraAdmin)) {
    throw "Pass -PostgresEntraAdmin with the PostgreSQL server's Microsoft Entra administrator name."
}

Push-Location $repoRoot
try {
    Invoke-Az account set --subscription $SubscriptionId

    if (-not $SkipTests) {
        dotnet test .\BehavioralHealthSystem.Tests\BehavioralHealthSystem.Tests.csproj --nologo
        if ($LASTEXITCODE -ne 0) { throw "Tests failed." }
    }

    if (-not $SkipBuild) {
        $buildContext = Join-Path ([System.IO.Path]::GetTempPath()) "bhs-functions-acr-$ImageTag-$PID"
        try {
            New-Item -ItemType Directory -Path $buildContext -Force | Out-Null
            Copy-Item .\BehavioralHealthSystem.sln, .\.dockerignore -Destination $buildContext

            $projectDirectories = @(
                "BehavioralHealthSystem.Functions",
                "BehavioralHealthSystem.Helpers",
                "BehavioralHealthSystem.Agents",
                "BehavioralHealthSystem.Dam"
            )
            foreach ($projectDirectory in $projectDirectories) {
                Copy-Item ".\$projectDirectory" -Destination $buildContext -Recurse -Force
            }

            $seedDataRoot = Join-Path $buildContext "data\dsm5-data"
            New-Item -ItemType Directory -Path $seedDataRoot -Force | Out-Null
            Copy-Item .\data\dsm5-data\conditions -Destination $seedDataRoot -Recurse -Force

            Get-ChildItem $buildContext -Directory -Recurse -Force |
                Where-Object { $_.Name -in @("bin", "obj", "publish") } |
                Sort-Object FullName -Descending |
                Remove-Item -Recurse -Force
            Get-ChildItem $buildContext -File -Recurse -Force |
                Where-Object { $_.Name -eq "local.settings.json" -or $_.Name -like ".env*" } |
                Remove-Item -Force

            $contextFiles = @(Get-ChildItem $buildContext -File -Recurse -Force)
            $contextSizeMb = [Math]::Round((($contextFiles | Measure-Object Length -Sum).Sum / 1MB), 1)
            Write-Information "Building $RegistryName.azurecr.io/bhs-functions:$ImageTag from $($contextFiles.Count) files ($contextSizeMb MB)..." -InformationAction Continue
            Invoke-Az acr build `
                --registry $RegistryName `
                --image "bhs-functions:$ImageTag" `
                --file BehavioralHealthSystem.Functions/Dockerfile.prod `
                $buildContext
        }
        finally {
            Remove-Item $buildContext -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    $commonParameters = @(
        "appName=$AppName",
        "imageTag=$ImageTag",
        "tenantId=$TenantId",
        "entraClientId=$EntraClientId",
        "damApiKey=$DamApiKey",
        "functionsApiKey=$FunctionsApiKey"
    )

    Write-Information "Validating the final deployment..." -InformationAction Continue
    Invoke-Az deployment group validate `
        --resource-group $ResourceGroup `
        --template-file $template `
        --parameters @commonParameters `
        --parameters storageBackend=PostgreSQL `
        --output none

    if ($WhatIf) {
        Invoke-Az deployment group what-if `
            --resource-group $ResourceGroup `
            --template-file $template `
            --parameters @commonParameters `
            --parameters storageBackend=PostgreSQL
        return
    }

    Write-Information "Deploying identity and storage RBAC bootstrap..." -InformationAction Continue
    Invoke-Az deployment group create `
        --name "$deploymentName-bootstrap" `
        --resource-group $ResourceGroup `
        --template-file $template `
        --parameters @commonParameters `
        --parameters storageBackend=BlobStorage `
        --output none

    $principalId = az containerapp show --resource-group $ResourceGroup --name $AppName --query identity.principalId --output tsv
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($principalId)) {
        throw "The Container App system identity could not be resolved."
    }

    & $postgresScript `
        -EntraAdminUser $PostgresEntraAdmin `
        -RoleName $AppName `
        -PrincipalId $principalId
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL role configuration failed." }

    Write-Information "Applying final PostgreSQL configuration..." -InformationAction Continue
    Invoke-Az deployment group create `
        --name $deploymentName `
        --resource-group $ResourceGroup `
        --template-file $template `
        --parameters @commonParameters `
        --parameters storageBackend=PostgreSQL `
        --output none

    $requiredRoles = @(
        "Storage Blob Data Contributor",
        "Storage Queue Data Contributor",
        "Storage Table Data Contributor"
    )
    $rolesVerified = $false
    for ($attempt = 1; $attempt -le 12; $attempt++) {
        $assignedRoles = @(az role assignment list --assignee-object-id $principalId --scope $storageScope --query "[].roleDefinitionName" --output tsv)
        if ($LASTEXITCODE -ne 0) { throw "Unable to verify storage role assignments." }
        $missingRoles = @($requiredRoles | Where-Object { $assignedRoles -notcontains $_ })

        $foundryAssignments = az role assignment list --assignee-object-id $principalId --scope $foundryScope --output json | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw "Unable to verify the Foundry role assignment." }
        $foundryRoleVerified = @($foundryAssignments | Where-Object {
            $_.roleDefinitionId -match "/$foundryAgentConsumerRoleId$"
        }).Count -gt 0

        $speechAssignments = az role assignment list --assignee-object-id $principalId --scope $speechScope --output json | ConvertFrom-Json
        if ($LASTEXITCODE -ne 0) { throw "Unable to verify the Speech role assignment." }
        $speechRoleVerified = @($speechAssignments | Where-Object {
            $_.roleDefinitionId -match "/$cognitiveServicesSpeechUserRoleId$"
        }).Count -gt 0

        if ($missingRoles.Count -eq 0 -and $foundryRoleVerified -and $speechRoleVerified) {
            $rolesVerified = $true
            break
        }
        Start-Sleep -Seconds 10
    }
    if (-not $rolesVerified) {
        $missingAssignments = @($missingRoles)
        if (-not $foundryRoleVerified) {
            $missingAssignments += "Foundry Agent Consumer"
        }
        if (-not $speechRoleVerified) {
            $missingAssignments += "Cognitive Services Speech User"
        }
        throw "Missing required role assignments after waiting for propagation: $($missingAssignments -join ', ')."
    }

    $fqdn = az containerapp show --resource-group $ResourceGroup --name $AppName --query properties.configuration.ingress.fqdn --output tsv
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($fqdn)) {
        throw "Unable to resolve the Container App endpoint."
    }

    $healthUrl = "https://$fqdn/api/health"
    $health = $null
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        try {
            $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 30
            break
        }
        catch {
            if ($attempt -eq 30) {
                throw
            }
            Start-Sleep -Seconds 10
        }
    }
    if ($null -eq $health) {
        throw "The Functions health endpoint did not become ready: $healthUrl"
    }
    Write-Information "Deployment complete: https://$fqdn" -InformationAction Continue
    Write-Information "Health: $($health | ConvertTo-Json -Compress)" -InformationAction Continue
    Write-Information "Storage RBAC verified: $($requiredRoles -join ', ')" -InformationAction Continue
    Write-Information "Foundry RBAC verified: Foundry Agent Consumer" -InformationAction Continue
}
finally {
    Pop-Location
}
