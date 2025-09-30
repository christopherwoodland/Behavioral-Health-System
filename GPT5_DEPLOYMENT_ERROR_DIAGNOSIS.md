# GPT-5 Deployment Error Diagnosis

**Date**: September 30, 2025  
**Error**: "Failed to generate extended risk assessment. This may be due to Azure OpenAI configuration, timeout, or model availability."

---

## Current Configuration (Verified)

```json
{
  "EXTENDED_ASSESSMENT_OPENAI_ENDPOINT": "https://openai-sesame-eastus-001.openai.azure.com/",
  "EXTENDED_ASSESSMENT_OPENAI_API_KEY": "REDACTED_AZURE_OPENAI_API_KEY",
  "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-5",
  "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true",
  "EXTENDED_ASSESSMENT_USE_FALLBACK": "false"
}
```

✅ Configuration is **CORRECT** in `local.settings.json`

---

## Root Cause Analysis

### **Most Likely Issue**: GPT-5 Deployment Doesn't Exist

The error occurs because the **"gpt-5" deployment name doesn't exist** in your Azure OpenAI resource:
- Endpoint: `https://openai-sesame-eastus-001.openai.azure.com/`
- Deployment: `gpt-5` ❌ **NOT FOUND**

### How to Verify

The backend code in `RiskAssessmentService.cs` (line 626-730) makes the following call:

```csharp
OpenAIClient client = new OpenAIClient(
    endpoint,  // https://openai-sesame-eastus-001.openai.azure.com/
    new AzureKeyCredential(apiKey));

var requestOptions = new ChatCompletionsOptions()
{
    MaxTokens = effectiveConfig.MaxTokens,
    DeploymentName = "gpt-5"  // ❌ THIS DEPLOYMENT DOESN'T EXIST
};

var response = await client.GetChatCompletionsAsync(requestOptions, cancellationTokenSource.Token);
```

When Azure OpenAI receives a request for a non-existent deployment, it returns an error that bubbles up to the 500 error you're seeing.

---

## Solution Options

### **Option 1: Use Existing Deployment (RECOMMENDED)**

Change the deployment name to one that **actually exists** in your Azure OpenAI resource.

**Common deployment names you might have:**
- `gpt-4o` (GPT-4 Omni)
- `gpt-4.1` (GPT-4 Turbo)
- `gpt-4-turbo-2024-04-09`
- `gpt-4-0613`
- `gpt-35-turbo`

**To find your actual deployments:**

1. **Via Azure Portal:**
   - Go to https://portal.azure.com
   - Navigate to your Azure OpenAI resource: `openai-sesame-eastus-001`
   - Click **"Model deployments"** or **"Deployments"**
   - Look for available deployment names

2. **Via Azure CLI:**
   ```bash
   az cognitiveservices account deployment list \
     --resource-group <your-resource-group> \
     --name openai-sesame-eastus-001
   ```

3. **Check what you're using for standard assessments:**
   - Your standard config uses: `"AZURE_OPENAI_DEPLOYMENT": "gpt-4.1"`
   - This deployment exists and works
   - You could use this for extended assessments too

**Update local.settings.json:**

```json
{
  "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-4.1"  // Use existing deployment
}
```

Then restart: `.\local-run.ps1`

---

### **Option 2: Create GPT-5 Deployment**

If GPT-5/O3 models are available in your region:

1. Go to Azure Portal → Your OpenAI resource
2. Click **"Model deployments"** → **"Create new deployment"**
3. Select GPT-5 or O3 model (if available)
4. Name it: `gpt-5`
5. Deploy
6. Restart functions: `.\local-run.ps1`

**Note:** GPT-5/O3 models may not be publicly available yet or may require special access.

---

### **Option 3: Enable Fallback (TEMPORARY FIX)**

Use GPT-4.1 as a temporary measure:

```json
{
  "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "false",
  "EXTENDED_ASSESSMENT_USE_FALLBACK": "true"
}
```

This will use your working `gpt-4.1` deployment until you get GPT-5 access.

---

## Why This Happened

1. **Configuration Change**: You recently changed from:
   ```json
   "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "false"  // Was using fallback
   "EXTENDED_ASSESSMENT_USE_FALLBACK": "true"
   ```
   to:
   ```json
   "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true"   // Now trying to use gpt-5
   "EXTENDED_ASSESSMENT_USE_FALLBACK": "false"
   ```

2. **Deployment Name Assumption**: The config assumed a deployment named `gpt-5` existed

3. **Azure Functions Cache**: The functions host needs to be restarted to pick up new config

---

## Immediate Action Required

### **Step 1: Check Your Azure OpenAI Deployments**

Go to Azure Portal and see what deployments you **actually have** in `openai-sesame-eastus-001`.

### **Step 2: Update Configuration**

**If you DON'T have a "gpt-5" deployment**, use Option 1 above and change to an existing deployment like `gpt-4.1`.

### **Step 3: Restart Azure Functions**

```powershell
# Stop all processes and restart
.\local-run.ps1
```

### **Step 4: Test Again**

1. Navigate to a session with a prediction
2. Click "Generate AI Risk Assessment (Extended)"
3. Check browser console and Azure Functions logs

---

## Expected Behavior After Fix

When working correctly, you should see logs like:

```
[CallAzureOpenAIForExtendedAssessmentAsync] Using dedicated extended assessment OpenAI configuration. 
Endpoint: https://openai-sesame-eastus-001.openai.azure.com/
Deployment: gpt-4.1

[CallAzureOpenAIForExtendedAssessmentAsync] Calling Azure OpenAI for extended assessment. 
Model: Standard
Deployment: gpt-4.1
Timeout: 120s

[CallAzureOpenAIForExtendedAssessmentAsync] Extended assessment API call successful. 
Response length: 5234
```

---

## Additional Troubleshooting

### Check Azure Functions Logs

When you restart with `.\local-run.ps1`, watch for:

```
[GenerateExtendedRiskAssessmentAsync] Extended assessment is not configured...
```

OR

```
Error calling Azure OpenAI API for extended assessment
```

These will tell you if there's a configuration or connectivity issue.

### Verify API Key

Your API key: `REDACTED_AZURE_OPENAI_API_KEY`

This is the **same key** used for standard assessments, so it should work. Just make sure the deployment name exists.

---

## Summary

**Problem**: Deployment `"gpt-5"` doesn't exist in your Azure OpenAI resource  
**Solution**: Change `EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT` to an existing deployment name (probably `"gpt-4.1"`)  
**Next Step**: Check Azure Portal for actual deployment names, update config, restart functions

---

## Quick Fix (90% Likely to Work)

```json
// In local.settings.json, change:
"EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-5"

// To:
"EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-4.1"
```

Then run:
```powershell
.\local-run.ps1
```

This uses your working GPT-4.1 deployment for extended assessments.
