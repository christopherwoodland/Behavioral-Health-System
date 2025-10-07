# Azure OpenAI Realtime Deployment Troubleshooting

## Current Error

```
POST https://cdc-traci-aif-002.cognitiveservices.azure.com/openai/realtime?api-version=2024-10-01-preview&deployment=gpt-4o-realtime-preview 404 (Not Found)
Error: Azure OpenAI API error: 404 - {"error":{"code":"404","message": "Resource not found"}}
```

## Problem Analysis

The 404 error means one of the following:

1. ❌ The deployment name `gpt-4o-realtime-preview` doesn't exist in your Azure OpenAI resource
2. ❌ The resource `cdc-traci-aif-002` is not an Azure OpenAI resource (it might be Azure Speech Service)
3. ❌ The API version `2024-10-01-preview` is not supported
4. ❌ The Azure OpenAI Realtime API is not enabled for this resource

## Important Distinction

You have two Azure Cognitive Services resources configured:

### 1. Azure Speech Service (cdc-traci-aif-002)
```bash
# This appears to be Azure Speech Service, NOT Azure OpenAI
VITE_AZURE_SPEECH_ENDPOINT=https://cdc-traci-aif-002.cognitiveservices.azure.com/
VITE_AZURE_SPEECH_API_KEY=7fGpwV46...

# Commented line shows Speech Service realtime endpoint:
#cdc-traci-aif-002.cognitiveservices.azure.com/voice-live/realtime?api-version=2025-05-01-preview
```

**Path:** `/voice-live/realtime` (Azure Speech Service)

### 2. Azure OpenAI Service (ai-cwoodland7702ai873683272520)
```bash
# This is clearly Azure OpenAI (has /openai/ in the path)
VITE_OPENAI_TRANSCRIPTION_ENDPOINT=https://ai-cwoodland7702ai873683272520.cognitiveservices.azure.com/openai/deployments/gpt-4o-transcribe/audio/transcriptions
VITE_OPENAI_TRANSCRIPTION_API_KEY=F0jHoSspZZ8u...
```

**Path:** `/openai/deployments/...` (Azure OpenAI Service)

## Solution Options

### Option 1: Use Your Existing Azure OpenAI Resource (RECOMMENDED)

Update `.env.local` to use the Azure OpenAI resource that you know has deployments:

```bash
# Azure OpenAI Realtime API Configuration
VITE_AZURE_OPENAI_REALTIME_ENDPOINT=https://ai-cwoodland7702ai873683272520.cognitiveservices.azure.com
VITE_AZURE_OPENAI_REALTIME_KEY=F0jHoSspZZ8uSPYf2mD91iaPUrxik1jbSMeEbXt0Yj004iPWj737JQQJ99BIACHYHv6XJ3w3AAAAACOGDXWB
VITE_AZURE_OPENAI_REALTIME_DEPLOYMENT=gpt-4o-realtime-preview
VITE_AZURE_OPENAI_API_VERSION=2024-10-01-preview
```

**Then verify the deployment exists:**

1. Go to Azure Portal
2. Navigate to your Azure OpenAI resource: `ai-cwoodland7702ai873683272520`
3. Click "Model deployments" or "Deployments"
4. Check if `gpt-4o-realtime-preview` exists
5. If not, create it or use the actual deployment name

### Option 2: Verify Deployments in cdc-traci-aif-002

If `cdc-traci-aif-002` IS an Azure OpenAI resource (not just Speech Service):

1. Go to Azure Portal
2. Navigate to resource: `cdc-traci-aif-002`
3. Check the resource type - is it "Azure OpenAI" or "Speech Service"?
4. If Azure OpenAI, go to "Model deployments"
5. Note the **exact deployment name** (it might be different than expected)

### Option 3: Create Realtime Deployment

If you don't have a realtime deployment yet:

1. Go to Azure Portal → Your Azure OpenAI resource
2. Click "Model deployments" or "Deployments"
3. Click "Create new deployment"
4. Select model: `gpt-4o-realtime-preview` or `gpt-4o-mini-realtime-preview`
5. Give it a deployment name (e.g., `gpt-4o-realtime-preview`)
6. Use this exact name in your `.env.local`

## Verification Steps

### Step 1: Verify Resource Type

Run this command to check what type of resource it is:

```powershell
# Check cdc-traci-aif-002
az cognitiveservices account show --name cdc-traci-aif-002 --resource-group <your-resource-group> --query "kind"

# Check ai-cwoodland7702ai873683272520
az cognitiveservices account show --name ai-cwoodland7702ai873683272520 --resource-group <your-resource-group> --query "kind"
```

Expected results:
- Azure OpenAI: `"OpenAI"`
- Azure Speech: `"SpeechServices"`

### Step 2: List Deployments (if Azure OpenAI)

```powershell
# List all deployments in your Azure OpenAI resource
az cognitiveservices account deployment list --name ai-cwoodland7702ai873683272520 --resource-group <your-resource-group> --query "[].{name:name, model:properties.model.name}"
```

### Step 3: Test Endpoint Manually

```powershell
# Test if deployment exists
$endpoint = "https://ai-cwoodland7702ai873683272520.cognitiveservices.azure.com"
$apiKey = "F0jHoSspZZ8uSPYf2mD91iaPUrxik1jbSMeEbXt0Yj004iPWj737JQQJ99BIACHYHv6XJ3w3AAAAACOGDXWB"
$deployment = "gpt-4o-realtime-preview"
$apiVersion = "2024-10-01-preview"

$uri = "$endpoint/openai/realtime?api-version=$apiVersion&deployment=$deployment"

$headers = @{
    "api-key" = $apiKey
    "Content-Type" = "application/json"
}

# This should return a 400 (bad request) not 404 if deployment exists
Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body "{}" -ErrorAction SilentlyContinue
```

If you get **404**, the deployment doesn't exist.
If you get **400** or another error, the deployment exists but the request is invalid (expected).

## Common Deployment Names

Check if any of these exist in your Azure OpenAI resource:

- `gpt-4o-realtime-preview` (full model)
- `gpt-4o-mini-realtime-preview` (smaller/cheaper model)
- `gpt-realtime` (custom name)
- `realtime` (custom name)
- `gpt-4o-realtime` (without preview)

## Quick Fix (Most Likely)

Based on your configuration, try this first:

```bash
# Change endpoint to your Azure OpenAI resource (not Speech Service)
VITE_AZURE_OPENAI_REALTIME_ENDPOINT=https://ai-cwoodland7702ai873683272520.cognitiveservices.azure.com
VITE_AZURE_OPENAI_REALTIME_KEY=F0jHoSspZZ8uSPYf2mD91iaPUrxik1jbSMeEbXt0Yj004iPWj737JQQJ99BIACHYHv6XJ3w3AAAAACOGDXWB
VITE_AZURE_OPENAI_REALTIME_DEPLOYMENT=gpt-4o-realtime-preview
VITE_AZURE_OPENAI_API_VERSION=2024-10-01-preview
```

Then restart your dev server:
```powershell
npm run dev
```

## Alternative: Use Azure Speech Service Realtime (Different API)

If you want to use the Azure Speech Service realtime endpoint instead (commented line in your config), you would need a DIFFERENT implementation. The current WebRTC implementation is for **Azure OpenAI Realtime**, not **Azure Speech Service**.

Path differences:
- Azure OpenAI: `/openai/realtime` (what we're using)
- Azure Speech: `/voice-live/realtime` (different API)

## Summary

🔍 **Check these in order:**

1. Verify `cdc-traci-aif-002` is Azure OpenAI (not just Speech Service)
2. List deployments in your Azure OpenAI resource
3. Use the correct deployment name (case-sensitive!)
4. Consider using `ai-cwoodland7702ai873683272520` instead if it has realtime deployments
5. Create a new realtime deployment if needed

📝 **Update `.env.local` with correct values**

🔄 **Restart dev server after changing `.env.local`**
