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

# Define all environment variables from local.settings.json
$environmentVariables = @(
    "AzureWebJobsStorage=DefaultEndpointsProtocol=https;AccountName=aistgvi;AccountKey=BdeUlkAARVe/ZvpBz+diTgN2yiW8szxtStXRfVsd/Kc5AsgIbXFvoUZb2BDL2YWq03/GVHqsOixJ+ASts4wA8Q==;EndpointSuffix=core.windows.net",
    "FUNCTIONS_WORKER_RUNTIME=dotnet-isolated",
    "KINTSUGI_API_KEY=87ea6a21350e42c5bf60eb6eb30cbb8e",
    "KINTSUGI_BASE_URL=https://api.kintsugihealth.com/v2",
    "WORKFLOW_MAX_RETRIES=100",
    "WORKFLOW_RETRY_DELAY_SECONDS=30",
    "KINTSUGI_AUTO_PROVIDE_CONSENT=false",
    "AZURE_OPENAI_ENDPOINT=https://openai-sesame-eastus-001.openai.azure.com/",
    "AZURE_OPENAI_API_KEY=89a35462495b4448b433e57d092397e3",
    "AZURE_OPENAI_DEPLOYMENT=gpt-4.1",
    "AZURE_OPENAI_ENABLED=true",
    "AZURE_OPENAI_API_VERSION=2024-12-01-preview",
    "GPT_REALTIME_ENDPOINT=https://cdc-traci-aif-002.cognitiveservices.azure.com/openai/realtime",
    "GPT_REALTIME_API_KEY=89a35462495b4448b433e57d092397e3",
    "GPT_REALTIME_DEPLOYMENT=gpt-realtime",
    "GPT_REALTIME_API_VERSION=2024-10-01-preview",
    "AUDIO_SAMPLE_RATE=24000",
    "AUDIO_BITS_PER_SAMPLE=16",
    "AUDIO_CHANNELS=1",
    "AUDIO_ENABLE_VAD=true",
    "AUDIO_SILENCE_THRESHOLD=0.01",
    "AUDIO_SILENCE_DURATION_MS=1000",
    "EXTENDED_ASSESSMENT_OPENAI_ENDPOINT=https://openai-sesame-eastus-001.openai.azure.com/",
    "EXTENDED_ASSESSMENT_OPENAI_API_KEY=89a35462495b4448b433e57d092397e3",
    "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT=gpt-5",
    "EXTENDED_ASSESSMENT_OPENAI_API_VERSION=2024-12-01-preview",
    "EXTENDED_ASSESSMENT_OPENAI_ENABLED=true",
    "EXTENDED_ASSESSMENT_USE_FALLBACK=false",
    "DocumentIntelligenceEndpoint=https://doc-intel-behavioral-health.cognitiveservices.azure.com/",
    "DocumentIntelligenceKey=7iu1BRT94gZM6wdg0g6FOkWiqOAaalKrVRUDzUxgwULm7mVA3Hg7JQQJ99BJACYeBjFXJ3w3AAALACOGFbH7",
    "DSM5_DOCUMENT_INTELLIGENCE_ENDPOINT=https://doc-intel-behavioral-health.cognitiveservices.azure.com/",
    "DSM5_DOCUMENT_INTELLIGENCE_KEY=7iu1BRT94gZM6wdg0g6FOkWiqOAaalKrVRUDzUxgwULm7mVA3Hg7JQQJ99BJACYeBjFXJ3w3AAALACOGFbH7",
    "DSM5_STORAGE_ACCOUNT_NAME=aistgvi",
    "DSM5_CONTAINER_NAME=dsm5-data",
    "AZURE_CONTENT_UNDERSTANDING_ENDPOINT=https://csaifcontentunderstanding.services.ai.azure.com/",
    "AZURE_CONTENT_UNDERSTANDING_KEY=DnmuyhZo4jNfj9Mrzas1qinOY6XQbwa4OGfJp6piii0yfFvIsvYOJQQJ99BJAC4f1cMXJ3w3AAAAACOGHFZS",
    "DSM5_EXTRACTION_METHOD=CONTENT_UNDERSTANDING"
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