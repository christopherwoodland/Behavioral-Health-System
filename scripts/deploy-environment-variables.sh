#!/bin/bash

# Deploy Environment Variables to Azure Function App
# This script sets all required environment variables for the Behavioral Health System Function App

# Function to display usage
usage() {
    echo "Usage: $0 -f <function-app-name> -g <resource-group-name> [-s <subscription-id>]"
    echo "  -f: Function App name (required)"
    echo "  -g: Resource Group name (required)"
    echo "  -s: Subscription ID (optional)"
    exit 1
}

# Parse command line arguments
while getopts "f:g:s:h" opt; do
    case $opt in
        f) FUNCTION_APP_NAME="$OPTARG" ;;
        g) RESOURCE_GROUP_NAME="$OPTARG" ;;
        s) SUBSCRIPTION_ID="$OPTARG" ;;
        h) usage ;;
        *) usage ;;
    esac
done

# Check required parameters
if [ -z "$FUNCTION_APP_NAME" ] || [ -z "$RESOURCE_GROUP_NAME" ]; then
    echo "❌ Error: Function App name and Resource Group name are required"
    usage
fi

# Set subscription if provided
if [ -n "$SUBSCRIPTION_ID" ]; then
    echo "🔧 Setting subscription to: $SUBSCRIPTION_ID"
    az account set --subscription "$SUBSCRIPTION_ID"
fi

echo "🚀 Deploying environment variables to Function App: $FUNCTION_APP_NAME"
echo "📁 Resource Group: $RESOURCE_GROUP_NAME"

# Define all environment variables from local.settings.json
echo "⚙️  Setting environment variables..."

az functionapp config appsettings set \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --settings \
        "FUNCTIONS_WORKER_RUNTIME=dotnet-isolated" \
        "KINTSUGI_API_KEY=87ea6a21350e42c5bf60eb6eb30cbb8e" \
        "KINTSUGI_BASE_URL=https://api.kintsugihealth.com/v2" \
        "WORKFLOW_MAX_RETRIES=100" \
        "WORKFLOW_RETRY_DELAY_SECONDS=30" \
        "KINTSUGI_AUTO_PROVIDE_CONSENT=false" \
        "AZURE_OPENAI_ENDPOINT=https://openai-sesame-eastus-001.openai.azure.com/" \
        "AZURE_OPENAI_API_KEY=89a35462495b4448b433e57d092397e3" \
        "AZURE_OPENAI_DEPLOYMENT=gpt-4.1" \
        "AZURE_OPENAI_ENABLED=true" \
        "AZURE_OPENAI_API_VERSION=2024-12-01-preview" \
        "GPT_REALTIME_ENDPOINT=https://cdc-traci-aif-002.cognitiveservices.azure.com/openai/realtime" \
        "GPT_REALTIME_API_KEY=89a35462495b4448b433e57d092397e3" \
        "GPT_REALTIME_DEPLOYMENT=gpt-realtime" \
        "GPT_REALTIME_API_VERSION=2024-10-01-preview" \
        "AUDIO_SAMPLE_RATE=24000" \
        "AUDIO_BITS_PER_SAMPLE=16" \
        "AUDIO_CHANNELS=1" \
        "AUDIO_ENABLE_VAD=true" \
        "AUDIO_SILENCE_THRESHOLD=0.01" \
        "AUDIO_SILENCE_DURATION_MS=1000" \
        "EXTENDED_ASSESSMENT_OPENAI_ENDPOINT=https://openai-sesame-eastus-001.openai.azure.com/" \
        "EXTENDED_ASSESSMENT_OPENAI_API_KEY=89a35462495b4448b433e57d092397e3" \
        "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT=gpt-5" \
        "EXTENDED_ASSESSMENT_OPENAI_API_VERSION=2024-12-01-preview" \
        "EXTENDED_ASSESSMENT_OPENAI_ENABLED=true" \
        "EXTENDED_ASSESSMENT_USE_FALLBACK=false" \
        "DocumentIntelligenceEndpoint=https://doc-intel-behavioral-health.cognitiveservices.azure.com/" \
        "DocumentIntelligenceKey=7iu1BRT94gZM6wdg0g6FOkWiqOAaalKrVRUDzUxgwULm7mVA3Hg7JQQJ99BJACYeBjFXJ3w3AAALACOGFbH7" \
        "DSM5_DOCUMENT_INTELLIGENCE_ENDPOINT=https://doc-intel-behavioral-health.cognitiveservices.azure.com/" \
        "DSM5_DOCUMENT_INTELLIGENCE_KEY=7iu1BRT94gZM6wdg0g6FOkWiqOAaalKrVRUDzUxgwULm7mVA3Hg7JQQJ99BJACYeBjFXJ3w3AAALACOGFbH7" \
        "DSM5_STORAGE_ACCOUNT_NAME=aistgvi" \
        "DSM5_CONTAINER_NAME=dsm5-data" \
        "AZURE_CONTENT_UNDERSTANDING_ENDPOINT=https://csaifcontentunderstanding.services.ai.azure.com/" \
        "AZURE_CONTENT_UNDERSTANDING_KEY=DnmuyhZo4jNfj9Mrzas1qinOY6XQbwa4OGfJp6piii0yfFvIsvYOJQQJ99BJAC4f1cMXJ3w3AAAAACOGHFZS" \
        "DSM5_EXTRACTION_METHOD=CONTENT_UNDERSTANDING" \
    --output json

if [ $? -eq 0 ]; then
    echo "✅ Successfully deployed environment variables to $FUNCTION_APP_NAME"
    echo "📊 Total variables set: 33"
    echo ""
    echo "📋 Variables deployed:"
    echo "   ✓ FUNCTIONS_WORKER_RUNTIME"
    echo "   ✓ KINTSUGI_API_KEY"
    echo "   ✓ KINTSUGI_BASE_URL"
    echo "   ✓ WORKFLOW_MAX_RETRIES"
    echo "   ✓ WORKFLOW_RETRY_DELAY_SECONDS"
    echo "   ✓ KINTSUGI_AUTO_PROVIDE_CONSENT"
    echo "   ✓ AZURE_OPENAI_ENDPOINT"
    echo "   ✓ AZURE_OPENAI_API_KEY"
    echo "   ✓ AZURE_OPENAI_DEPLOYMENT"
    echo "   ✓ AZURE_OPENAI_ENABLED"
    echo "   ✓ AZURE_OPENAI_API_VERSION"
    echo "   ✓ GPT_REALTIME_ENDPOINT"
    echo "   ✓ GPT_REALTIME_API_KEY"
    echo "   ✓ GPT_REALTIME_DEPLOYMENT"
    echo "   ✓ GPT_REALTIME_API_VERSION"
    echo "   ✓ AUDIO_SAMPLE_RATE"
    echo "   ✓ AUDIO_BITS_PER_SAMPLE"
    echo "   ✓ AUDIO_CHANNELS"
    echo "   ✓ AUDIO_ENABLE_VAD"
    echo "   ✓ AUDIO_SILENCE_THRESHOLD"
    echo "   ✓ AUDIO_SILENCE_DURATION_MS"
    echo "   ✓ EXTENDED_ASSESSMENT_OPENAI_ENDPOINT"
    echo "   ✓ EXTENDED_ASSESSMENT_OPENAI_API_KEY"
    echo "   ✓ EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT"
    echo "   ✓ EXTENDED_ASSESSMENT_OPENAI_API_VERSION"
    echo "   ✓ EXTENDED_ASSESSMENT_OPENAI_ENABLED"
    echo "   ✓ EXTENDED_ASSESSMENT_USE_FALLBACK"
    echo "   ✓ DocumentIntelligenceEndpoint"
    echo "   ✓ DocumentIntelligenceKey"
    echo "   ✓ DSM5_DOCUMENT_INTELLIGENCE_ENDPOINT"
    echo "   ✓ DSM5_DOCUMENT_INTELLIGENCE_KEY"
    echo "   ✓ DSM5_STORAGE_ACCOUNT_NAME"
    echo "   ✓ DSM5_CONTAINER_NAME"
    echo "   ✓ AZURE_CONTENT_UNDERSTANDING_ENDPOINT"
    echo "   ✓ AZURE_CONTENT_UNDERSTANDING_KEY"
    echo "   ✓ DSM5_EXTRACTION_METHOD"
    echo ""
    echo "🎉 Environment variable deployment completed!"
    echo "💡 You can verify the settings in the Azure Portal under Function App > Configuration > Application settings"
else
    echo "❌ Failed to deploy environment variables"
    exit 1
fi