# Deploy Environment Variables to Azure Function App
# This script sets all required environment variables for the Behavioral Health System Function App

param(
    [Parameter(Mandatory=$true)]
    [string]$FunctionAppName,

    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId
)

# Set subscription if provided
if ($SubscriptionId) {
    Write-Host "Setting subscription to: $SubscriptionId" -ForegroundColor Green
    az account set --subscription $SubscriptionId
}

Write-Host "Deploying environment variables to Function App: $FunctionAppName" -ForegroundColor Green
Write-Host "Resource Group: $ResourceGroupName" -ForegroundColor Green

function Get-RequiredEnvVar {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Name
    )

    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Required environment variable is missing: $Name"
    }

    return $value
}

function Get-OptionalEnvVar {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Name,
        [Parameter(Mandatory=$false)]
        [string]$DefaultValue = ""
    )

    $value = [Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $DefaultValue
    }

    return $value
}

# Define environment variables from process environment (no hardcoded secrets)
$environmentVariables = @(
    "AzureWebJobsStorage=$(Get-RequiredEnvVar -Name 'AZURE_WEBJOBS_STORAGE')",
    "FUNCTIONS_WORKER_RUNTIME=dotnet-isolated",
    "KINTSUGI_API_KEY=$(Get-RequiredEnvVar -Name 'KINTSUGI_API_KEY')",
    "KINTSUGI_BASE_URL=$(Get-OptionalEnvVar -Name 'KINTSUGI_BASE_URL' -DefaultValue 'https://api.kintsugihealth.com/v2')",
    "WORKFLOW_MAX_RETRIES=$(Get-OptionalEnvVar -Name 'WORKFLOW_MAX_RETRIES' -DefaultValue '100')",
    "WORKFLOW_RETRY_DELAY_SECONDS=$(Get-OptionalEnvVar -Name 'WORKFLOW_RETRY_DELAY_SECONDS' -DefaultValue '30')",
    "KINTSUGI_AUTO_PROVIDE_CONSENT=$(Get-OptionalEnvVar -Name 'KINTSUGI_AUTO_PROVIDE_CONSENT' -DefaultValue 'false')",
    "AZURE_OPENAI_ENDPOINT=$(Get-RequiredEnvVar -Name 'AZURE_OPENAI_ENDPOINT')",
    "AZURE_OPENAI_API_KEY=$(Get-RequiredEnvVar -Name 'AZURE_OPENAI_API_KEY')",
    "AZURE_OPENAI_DEPLOYMENT=$(Get-OptionalEnvVar -Name 'AZURE_OPENAI_DEPLOYMENT' -DefaultValue 'gpt-4.1')",
    "AZURE_OPENAI_ENABLED=$(Get-OptionalEnvVar -Name 'AZURE_OPENAI_ENABLED' -DefaultValue 'true')",
    "AZURE_OPENAI_API_VERSION=$(Get-OptionalEnvVar -Name 'AZURE_OPENAI_API_VERSION' -DefaultValue '2024-12-01-preview')",
    "AUDIO_SAMPLE_RATE=$(Get-OptionalEnvVar -Name 'AUDIO_SAMPLE_RATE' -DefaultValue '24000')",
    "AUDIO_BITS_PER_SAMPLE=$(Get-OptionalEnvVar -Name 'AUDIO_BITS_PER_SAMPLE' -DefaultValue '16')",
    "AUDIO_CHANNELS=$(Get-OptionalEnvVar -Name 'AUDIO_CHANNELS' -DefaultValue '1')",
    "AUDIO_ENABLE_VAD=$(Get-OptionalEnvVar -Name 'AUDIO_ENABLE_VAD' -DefaultValue 'true')",
    "AUDIO_SILENCE_THRESHOLD=$(Get-OptionalEnvVar -Name 'AUDIO_SILENCE_THRESHOLD' -DefaultValue '0.01')",
    "AUDIO_SILENCE_DURATION_MS=$(Get-OptionalEnvVar -Name 'AUDIO_SILENCE_DURATION_MS' -DefaultValue '1000')",
    "EXTENDED_ASSESSMENT_OPENAI_ENDPOINT=$(Get-RequiredEnvVar -Name 'EXTENDED_ASSESSMENT_OPENAI_ENDPOINT')",
    "EXTENDED_ASSESSMENT_OPENAI_API_KEY=$(Get-RequiredEnvVar -Name 'EXTENDED_ASSESSMENT_OPENAI_API_KEY')",
    "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT=$(Get-OptionalEnvVar -Name 'EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT' -DefaultValue 'gpt-5')",
    "EXTENDED_ASSESSMENT_OPENAI_API_VERSION=$(Get-OptionalEnvVar -Name 'EXTENDED_ASSESSMENT_OPENAI_API_VERSION' -DefaultValue '2024-12-01-preview')",
    "EXTENDED_ASSESSMENT_OPENAI_ENABLED=$(Get-OptionalEnvVar -Name 'EXTENDED_ASSESSMENT_OPENAI_ENABLED' -DefaultValue 'true')",
    "EXTENDED_ASSESSMENT_USE_FALLBACK=$(Get-OptionalEnvVar -Name 'EXTENDED_ASSESSMENT_USE_FALLBACK' -DefaultValue 'false')",
    "DocumentIntelligenceEndpoint=$(Get-RequiredEnvVar -Name 'DOCUMENT_INTELLIGENCE_ENDPOINT')",
    "DocumentIntelligenceKey=$(Get-RequiredEnvVar -Name 'DOCUMENT_INTELLIGENCE_KEY')",
    "DSM5_DOCUMENT_INTELLIGENCE_ENDPOINT=$(Get-RequiredEnvVar -Name 'DSM5_DOCUMENT_INTELLIGENCE_ENDPOINT')",
    "DSM5_DOCUMENT_INTELLIGENCE_KEY=$(Get-RequiredEnvVar -Name 'DSM5_DOCUMENT_INTELLIGENCE_KEY')",
    "DSM5_STORAGE_ACCOUNT_NAME=$(Get-RequiredEnvVar -Name 'DSM5_STORAGE_ACCOUNT_NAME')",
    "DSM5_CONTAINER_NAME=$(Get-OptionalEnvVar -Name 'DSM5_CONTAINER_NAME' -DefaultValue 'dsm5-data')",
    "AZURE_CONTENT_UNDERSTANDING_ENDPOINT=$(Get-RequiredEnvVar -Name 'AZURE_CONTENT_UNDERSTANDING_ENDPOINT')",
    "AZURE_CONTENT_UNDERSTANDING_KEY=$(Get-RequiredEnvVar -Name 'AZURE_CONTENT_UNDERSTANDING_KEY')",
    "DSM5_EXTRACTION_METHOD=$(Get-OptionalEnvVar -Name 'DSM5_EXTRACTION_METHOD' -DefaultValue 'CONTENT_UNDERSTANDING')",
    "VITE_API_BASE_URL=$(Get-RequiredEnvVar -Name 'VITE_API_BASE_URL')"
)

Write-Host "Setting environment variables..." -ForegroundColor Yellow

try {
    # Set all environment variables at once
    az functionapp config appsettings set `
        --name $FunctionAppName `
        --resource-group $ResourceGroupName `
        --settings $environmentVariables `
        --output json | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS: Successfully deployed environment variables to $FunctionAppName" -ForegroundColor Green

        # Display the count of variables set
        $variableCount = $environmentVariables.Count
        Write-Host "STATS: Total variables set: $variableCount" -ForegroundColor Cyan

        # Optionally show all variables that were set
        Write-Host ""
        Write-Host "VARIABLES: Variables deployed:" -ForegroundColor Cyan
        foreach ($var in $environmentVariables) {
            $varName = $var.Split('=')[0]
            Write-Host "   -> $varName" -ForegroundColor Gray
        }
    } else {
        Write-Host "ERROR: Failed to deploy environment variables" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Error deploying environment variables: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "COMPLETED: Environment variable deployment completed!" -ForegroundColor Green
Write-Host "TIP: You can verify the settings in the Azure Portal under Function App > Configuration > Application settings" -ForegroundColor Yellow
