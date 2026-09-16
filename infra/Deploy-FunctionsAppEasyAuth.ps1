#!/usr/bin/env pwsh
<#
.SYNOPSIS
Builds and deploys the additive EasyAuth-protected BHS Function App.

.DESCRIPTION
Builds an immutable Functions image in the existing ACR, validates and previews
the Central US Function App deployment, provisions managed identity and RBAC,
adds a side-by-side PostgreSQL Entra role without changing existing ownership,
and verifies the EasyAuth boundary. The existing bhs-functions Container App is
captured before deployment and must remain unchanged.
#>
[CmdletBinding()]
param(
    [string]$SubscriptionId = "6bf68138-6ea4-4272-a3db-78e737e132a6",
    [string]$TenantId = "16b3c013-d300-468d-ac64-7eda0820b6d3",
    [string]$ResourceGroup = "bhs",
    [string]$Location = "centralus",
    [string]$AppName = "bhs-functions-easyauth",
    [string]$RollbackContainerAppName = "bhs-functions",
    [string]$RegistryName = "bhsdam4hajt53n4i4pg",
    [string]$ImageTag = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss"),
    [string]$DamApiKey = $env:DAM_API_KEY,
    [string]$PostgresEntraAdmin,
    [string]$DelegatedAccessToken = $env:BHS_UI_ACCESS_TOKEN,
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$SkipRuntimeVerification,
    [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$env:AZURE_CORE_ONLY_SHOW_ERRORS = "true"
$repoRoot = Split-Path $PSScriptRoot -Parent
$template = Join-Path $PSScriptRoot "functions-app-easyauth.bicep"
$postgresScript = Join-Path $PSScriptRoot "Configure-FunctionsPostgresRole.ps1"
$deploymentName = "functions-app-easyauth-$ImageTag"
$storageScope = "/subscriptions/$SubscriptionId/resourceGroups/DefaultResourceGroup-CCAN/providers/Microsoft.Storage/storageAccounts/cwacstest001"
$foundryScope = "/subscriptions/$SubscriptionId/resourceGroups/integration/providers/Microsoft.CognitiveServices/accounts/cwoodland-0035-test-002-resource"
$speechScope = "/subscriptions/$SubscriptionId/resourceGroups/integration/providers/Microsoft.CognitiveServices/accounts/bhs-transcription-eastus"
$registryScope = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.ContainerRegistry/registries/$RegistryName"
$roleDefinitionIds = @{
    AcrPull = "7f951dda-4ed3-4680-a7ca-43fe172d538d"
    BlobDataContributor = "ba92f5b4-2d11-453d-a403-e96b0029c9fe"
    QueueDataContributor = "974c5e8b-45b9-4653-ba55-5f855dd0fb88"
    TableDataContributor = "0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3"
    FoundryAgentConsumer = "eed3b665-ab3a-47b6-8f48-c9382fb1dad6"
    SpeechUser = "f2dc8367-1007-4938-bd23-fe263f013447"
    MonitoringMetricsPublisher = "3913510d-42f4-4e42-8a64-420c390055eb"
}

function Invoke-Az {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)

    & az @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Azure CLI command failed: az $($Arguments[0..([Math]::Min(2, $Arguments.Count - 1))] -join ' ')"
    }
}

function Invoke-AzJson {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)

    $output = & az @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Azure CLI command failed: az $($Arguments[0..([Math]::Min(2, $Arguments.Count - 1))] -join ' ')"
    }

    return ($output | Out-String | ConvertFrom-Json)
}

function Invoke-AzTsv {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)

    $output = & az @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Azure CLI command failed: az $($Arguments[0..([Math]::Min(2, $Arguments.Count - 1))] -join ' ')"
    }

    return ($output | Out-String).Trim()
}

function Get-DeploymentParameterFile {
    param(
        [Parameter(Mandatory)]
        [ValidateSet("BlobStorage", "PostgreSQL")]
        [string]$StorageBackend,
        [Parameter(Mandatory)]
        [string]$ApiKey
    )

    $path = [System.IO.Path]::GetTempFileName()
    @{
        '$schema' = "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#"
        contentVersion = "1.0.0.0"
        parameters = @{
            location = @{ value = $Location }
            appName = @{ value = $AppName }
            imageTag = @{ value = $ImageTag }
            tenantId = @{ value = $TenantId }
            damApiKey = @{ value = $ApiKey }
            storageBackend = @{ value = $StorageBackend }
        }
    } | ConvertTo-Json -Depth 6 | Set-Content -Path $path -Encoding utf8 -NoNewline
    return $path
}

function Assert-RoleAssignment {
    param(
        [Parameter(Mandatory)][string]$PrincipalId,
        [Parameter(Mandatory)][string]$Scope,
        [Parameter(Mandatory)][string]$RoleDefinitionId,
        [Parameter(Mandatory)][string]$RoleName
    )

    $assignments = @(Invoke-AzJson role assignment list `
        --assignee-object-id $PrincipalId `
        --scope $Scope `
        --output json)
    $found = @($assignments | Where-Object {
        $_.roleDefinitionId -match "/$([regex]::Escape($RoleDefinitionId))$"
    }).Count -gt 0
    if (-not $found) {
        throw "Required role assignment was not found: $RoleName at $Scope."
    }
}

function Get-HttpResponse {
    param(
        [Parameter(Mandatory)][string]$Uri,
        [hashtable]$Headers = @{}
    )

    return Invoke-WebRequest `
        -Uri $Uri `
        -Method Get `
        -Headers $Headers `
        -SkipHttpErrorCheck `
        -TimeoutSec 120
}

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    throw "Azure CLI was not found."
}
if ($Location -ne "centralus") {
    throw "This migration was validated and approved for Central US. Pass -Location centralus."
}
if (-not $WhatIf -and [string]::IsNullOrWhiteSpace($PostgresEntraAdmin)) {
    throw "Pass -PostgresEntraAdmin with the PostgreSQL server's Microsoft Entra administrator name."
}

$parameterFiles = [System.Collections.Generic.List[string]]::new()
Push-Location $repoRoot
try {
    Invoke-Az account set --subscription $SubscriptionId

    $account = Invoke-AzJson account show --output json
    if ($account.id -ne $SubscriptionId -or $account.tenantId -ne $TenantId) {
        throw "Azure CLI is not using the approved subscription and tenant."
    }

    $rollbackBefore = Invoke-AzJson containerapp show `
        --resource-group $ResourceGroup `
        --name $RollbackContainerAppName `
        --query "{id:id,latestRevisionName:properties.latestRevisionName,image:properties.template.containers[0].image}" `
        --output json

    if (-not $SkipTests) {
        dotnet test .\BehavioralHealthSystem.Tests\BehavioralHealthSystem.Tests.csproj --nologo
        if ($LASTEXITCODE -ne 0) {
            throw "Functions regression tests failed."
        }

        Push-Location .\BehavioralHealthSystem.Web
        try {
            npm run test:run
            if ($LASTEXITCODE -ne 0) {
                throw "Web regression tests failed."
            }
            npm run build
            if ($LASTEXITCODE -ne 0) {
                throw "Web production build failed."
            }
        }
        finally {
            Pop-Location
        }
    }

    if ([string]::IsNullOrWhiteSpace($DamApiKey)) {
        if ($WhatIf) {
            $DamApiKey = "validation-placeholder"
        }
        else {
            $DamApiKey = Invoke-AzTsv containerapp secret list `
                --resource-group $ResourceGroup `
                --name $RollbackContainerAppName `
                --show-values `
                --query "[?name=='dam-api-key'].value | [0]" `
                --output tsv
            if ([string]::IsNullOrWhiteSpace($DamApiKey)) {
                throw "Set DAM_API_KEY; the existing DAM key could not be resolved."
            }
        }
    }

    if (-not $SkipBuild -and -not $WhatIf) {
        $buildContext = Join-Path ([System.IO.Path]::GetTempPath()) "bhs-functions-easyauth-acr-$ImageTag-$PID"
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

            Write-Information "Building $RegistryName.azurecr.io/bhs-functions:$ImageTag..." -InformationAction Continue
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

    $postgresParameters = Get-DeploymentParameterFile -StorageBackend PostgreSQL -ApiKey $DamApiKey
    $parameterFiles.Add($postgresParameters)

    Write-Information "Validating the additive Function App deployment..." -InformationAction Continue
    Invoke-Az deployment group validate `
        --resource-group $ResourceGroup `
        --name $deploymentName `
        --template-file $template `
        --parameters "@$postgresParameters" `
        --output none

    $preview = Invoke-AzJson deployment group what-if `
        --resource-group $ResourceGroup `
        --name $deploymentName `
        --template-file $template `
        --parameters "@$postgresParameters" `
        --result-format ResourceIdOnly `
        --no-pretty-print `
        --output json
    $changes = @($preview.changes)
    $destructiveChanges = @($changes | Where-Object { $_.changeType -eq "Delete" })
    $rollbackChanges = @($changes | Where-Object {
        $_.resourceId -eq $rollbackBefore.id -and $_.changeType -ne "Ignore"
    })
    if ($destructiveChanges.Count -gt 0 -or $rollbackChanges.Count -gt 0) {
        throw "What-if contains a delete or a change to the rollback Container App."
    }

    $changeSummary = $changes |
        Group-Object changeType |
        Sort-Object Name |
        ForEach-Object { "$($_.Name): $($_.Count)" }
    Write-Information "What-if passed ($($changeSummary -join ', ')); rollback Container App unchanged." -InformationAction Continue

    if ($WhatIf) {
        return
    }

    $bootstrapParameters = Get-DeploymentParameterFile -StorageBackend BlobStorage -ApiKey $DamApiKey
    $parameterFiles.Add($bootstrapParameters)

    Write-Information "Deploying the managed-identity bootstrap configuration..." -InformationAction Continue
    $bootstrap = Invoke-AzJson deployment group create `
        --name "$deploymentName-bootstrap" `
        --resource-group $ResourceGroup `
        --template-file $template `
        --parameters "@$bootstrapParameters" `
        --output json

    $principalId = $bootstrap.properties.outputs.appPrincipalId.value
    $appResourceId = $bootstrap.properties.outputs.appResourceId.value
    if ([string]::IsNullOrWhiteSpace($principalId) -or [string]::IsNullOrWhiteSpace($appResourceId)) {
        throw "The Function App system identity could not be resolved from deployment outputs."
    }

    & $postgresScript `
        -EntraAdminUser $PostgresEntraAdmin `
        -RoleName $AppName `
        -ExistingOwnerRoleName $RollbackContainerAppName `
        -PrincipalId $principalId
    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL side-by-side role configuration failed."
    }

    Write-Information "Applying the final PostgreSQL-backed configuration..." -InformationAction Continue
    $deployment = Invoke-AzJson deployment group create `
        --name $deploymentName `
        --resource-group $ResourceGroup `
        --template-file $template `
        --parameters "@$postgresParameters" `
        --output json

    $appUrl = $deployment.properties.outputs.appUrl.value
    $image = $deployment.properties.outputs.image.value
    $appInsightsScope = $deployment.properties.outputs.appInsightsResourceId.value

    Assert-RoleAssignment -PrincipalId $principalId -Scope $storageScope -RoleDefinitionId $roleDefinitionIds.BlobDataContributor -RoleName "Storage Blob Data Contributor"
    Assert-RoleAssignment -PrincipalId $principalId -Scope $storageScope -RoleDefinitionId $roleDefinitionIds.QueueDataContributor -RoleName "Storage Queue Data Contributor"
    Assert-RoleAssignment -PrincipalId $principalId -Scope $storageScope -RoleDefinitionId $roleDefinitionIds.TableDataContributor -RoleName "Storage Table Data Contributor"
    Assert-RoleAssignment -PrincipalId $principalId -Scope $foundryScope -RoleDefinitionId $roleDefinitionIds.FoundryAgentConsumer -RoleName "Azure AI User"
    Assert-RoleAssignment -PrincipalId $principalId -Scope $speechScope -RoleDefinitionId $roleDefinitionIds.SpeechUser -RoleName "Cognitive Services Speech User"
    Assert-RoleAssignment -PrincipalId $principalId -Scope $appInsightsScope -RoleDefinitionId $roleDefinitionIds.MonitoringMetricsPublisher -RoleName "Monitoring Metrics Publisher"

    $pullIdentityPrincipalId = Invoke-AzTsv identity show `
        --resource-group $ResourceGroup `
        --name "bhs-dam-pull" `
        --query principalId `
        --output tsv
    Assert-RoleAssignment -PrincipalId $pullIdentityPrincipalId -Scope $registryScope -RoleDefinitionId $roleDefinitionIds.AcrPull -RoleName "AcrPull"

    $auth = Invoke-AzJson rest `
        --method get `
        --uri "https://management.azure.com$appResourceId/config/authsettingsV2?api-version=2024-11-01"
    if (-not $auth.properties.platform.enabled `
        -or -not $auth.properties.globalValidation.requireAuthentication `
        -or $auth.properties.globalValidation.unauthenticatedClientAction -ne "Return401" `
        -or -not $auth.properties.identityProviders.azureActiveDirectory.enabled) {
        throw "The deployed EasyAuth configuration does not enforce Microsoft Entra authentication."
    }

    $settings = Invoke-AzJson functionapp config appsettings list `
        --resource-group $ResourceGroup `
        --name $AppName `
        --output json
    $settingsByName = @{}
    foreach ($setting in $settings) {
        $settingsByName[$setting.name] = $setting.value
    }
    if ($settingsByName.WEBSITE_AAD_ENABLE_MISE -ne "true" `
        -or $settingsByName.AzureFunctionsJobHost__extensions__durableTask__hubName -ne "KintsugiHealthEasyAuthHub" `
        -or $settingsByName.STORAGE_BACKEND -ne "PostgreSQL") {
        throw "The deployed Function App settings do not match the approved MISE configuration."
    }

    if (-not $SkipRuntimeVerification) {
        $healthResponse = Get-HttpResponse -Uri "$appUrl/api/health"
        if ($healthResponse.StatusCode -ne 200) {
            throw "The public health endpoint returned HTTP $($healthResponse.StatusCode)."
        }

        $anonymousResponse = Get-HttpResponse -Uri "$appUrl/api/transcribe-status"
        if ($anonymousResponse.StatusCode -ne 401) {
            throw "The protected endpoint returned HTTP $($anonymousResponse.StatusCode) without a token; expected 401."
        }

        if (-not [string]::IsNullOrWhiteSpace($DelegatedAccessToken)) {
            $delegatedHeaders = @{ Authorization = "Bearer $DelegatedAccessToken" }
            $authVersionResponse = Get-HttpResponse `
                -Uri "$appUrl/.auth/version" `
                -Headers $delegatedHeaders
            if ($authVersionResponse.StatusCode -ne 200) {
                throw "The authenticated EasyAuth version endpoint returned HTTP $($authVersionResponse.StatusCode)."
            }

            $authVersionPayload = $authVersionResponse.Content | ConvertFrom-Json
            $authVersion = [version]$authVersionPayload.version
            if ($authVersion -le [version]"1.8.2") {
                throw "EasyAuth runtime $authVersion does not satisfy the required version greater than 1.8.2."
            }
            Write-Information "EasyAuth runtime version: $authVersion" -InformationAction Continue

            $authenticatedResponse = Get-HttpResponse `
                -Uri "$appUrl/api/transcribe-status" `
                -Headers $delegatedHeaders
            if ($authenticatedResponse.StatusCode -ne 200) {
                throw "The delegated-token probe returned HTTP $($authenticatedResponse.StatusCode); expected 200."
            }
        }
        else {
            Write-Warning "BHS_UI_ACCESS_TOKEN is not set; concrete EasyAuth version, delegated-token, and MISE telemetry verification remain pending."
        }
    }

    $rollbackAfter = Invoke-AzJson containerapp show `
        --resource-group $ResourceGroup `
        --name $RollbackContainerAppName `
        --query "{id:id,latestRevisionName:properties.latestRevisionName,image:properties.template.containers[0].image}" `
        --output json
    if (($rollbackBefore | ConvertTo-Json -Compress) -ne ($rollbackAfter | ConvertTo-Json -Compress)) {
        throw "The rollback Container App changed during the additive deployment."
    }

    $imageDigest = Invoke-AzTsv acr manifest show-metadata `
        --registry $RegistryName `
        --name "bhs-functions:$ImageTag" `
        --query digest `
        --output tsv

    Write-Information "Deployment complete: $appUrl" -InformationAction Continue
    Write-Information "Image: $image ($imageDigest)" -InformationAction Continue
    Write-Information "EasyAuth, MISE setting, managed-identity RBAC, PostgreSQL role, and rollback preservation verified." -InformationAction Continue
}
finally {
    foreach ($parameterFile in $parameterFiles) {
        Remove-Item $parameterFile -Force -ErrorAction SilentlyContinue
    }
    Pop-Location
}
