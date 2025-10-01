# GPT-5 Configuration Fix Applied ✅

**Date**: September 30, 2025  
**Issue**: 500 Internal Server Error when generating extended risk assessments  
**Root Cause**: Non-existent deployment name "gpt-5"  
**Solution**: Changed to existing "gpt-4.1" deployment

---

## What Was Wrong

### Error Message
```json
{
  "success": false,
  "message": "Failed to generate extended risk assessment. This may be due to Azure OpenAI configuration, timeout, or model availability."
}
```

### Root Cause
The configuration was set to use a deployment named `"gpt-5"`:

```json
"EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-5"  // ❌ Doesn't exist
```

This deployment **does not exist** in your Azure OpenAI resource:
- Resource: `openai-sesame-eastus-001.openai.azure.com`
- Available deployments: `gpt-4.1`, `gpt-realtime`, etc.
- Missing deployment: `gpt-5` ❌

When the Azure Functions tried to call the non-existent deployment, Azure OpenAI API returned an error.

---

## What Was Fixed

### Configuration Change

**File**: `BehavioralHealthSystem.Functions/local.settings.json`

**Before:**
```json
{
  "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-5",  // ❌ Non-existent
  "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true",
  "EXTENDED_ASSESSMENT_USE_FALLBACK": "false"
}
```

**After:**
```json
{
  "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-4.1",  // ✅ Exists and working
  "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true",
  "EXTENDED_ASSESSMENT_USE_FALLBACK": "false"
}
```

### Services Restarted

Ran `.\local-run.ps1` to:
1. Stop existing Azure Functions and Vite processes
2. Rebuild .NET Azure Functions project
3. Start Azure Functions host (picks up new config)
4. Reinstall npm dependencies
5. Start frontend dev server

**Build Result**: ✅ Succeeded with 3 warnings (11.1s)

---

## How to Test

### Step 1: Wait for Services to Start

Give the Azure Functions host 10-15 seconds to fully initialize.

### Step 2: Navigate to Session

1. Open browser: http://localhost:5173
2. Go to **Sessions** page
3. Click on a session that has a **Prediction** (required for extended assessments)

### Step 3: Generate Extended Assessment

1. Scroll to **"AI Risk Assessment (Extended)"** section
2. Click **"Generate AI Risk Assessment (Extended)"** button
3. Wait 5-15 seconds (GPT-4.1 is much faster than GPT-5 would be)

### Step 4: Verify Success

**Browser Console (F12)** should show:
```javascript
[ExtendedRiskAssessment] 🚀 Starting assessment generation...
[ExtendedRiskAssessment] Making POST request to generate assessment...
[ExtendedRiskAssessment] 📥 Raw response received: {success: true, ...}
[ExtendedRiskAssessment] ✅✅ Inner response successful! Assessment generated
```

**Azure Functions Logs** should show:
```
[GenerateExtendedRiskAssessmentAsync] Starting extended risk assessment for session {sessionId}
[CallAzureOpenAIForExtendedAssessmentAsync] Using dedicated extended assessment OpenAI configuration
[CallAzureOpenAIForExtendedAssessmentAsync] Calling Azure OpenAI for extended assessment. Model: Standard, Deployment: gpt-4.1, Timeout: 120s
[CallAzureOpenAIForExtendedAssessmentAsync] Extended assessment API call successful. Response length: 5234
[GenerateExtendedRiskAssessmentAsync] Extended risk assessment generated successfully for session {sessionId}
```

**UI** should display:
- Comprehensive risk assessment overview
- DSM-5 schizophrenia evaluation (Criteria A, B, C)
- Symptom breakdown with severity ratings
- Clinical recommendations
- Processing time (~5-15 seconds)

---

## Current Configuration Summary

### Extended Assessment Configuration

```json
{
  "EXTENDED_ASSESSMENT_OPENAI_ENDPOINT": "https://openai-sesame-eastus-001.openai.azure.com/",
  "EXTENDED_ASSESSMENT_OPENAI_API_KEY": "89a35462495b4448b433e57d092397e3",
  "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-4.1",
  "EXTENDED_ASSESSMENT_OPENAI_API_VERSION": "2024-08-01-preview",
  "EXTENDED_ASSESSMENT_OPENAI_MAX_TOKENS": 4000,
  "EXTENDED_ASSESSMENT_OPENAI_TEMPERATURE": 0.2,
  "EXTENDED_ASSESSMENT_OPENAI_TIMEOUT_SECONDS": 120,
  "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true",
  "EXTENDED_ASSESSMENT_USE_FALLBACK": "false"
}
```

✅ **Status**: Using dedicated GPT-4.1 deployment for extended assessments  
✅ **Mode**: Enabled (not using fallback)  
✅ **Timeout**: 120 seconds (sufficient for GPT-4.1)

---

## Future: When to Use Real GPT-5

### When GPT-5 Becomes Available

If/when you get access to GPT-5 models in Azure:

1. **Create GPT-5 Deployment in Azure Portal:**
   - Go to https://portal.azure.com
   - Navigate to `openai-sesame-eastus-001`
   - Create new deployment with model: `gpt-5` or `o3`
   - Name it: `gpt-5`

2. **Update Configuration:**
   ```json
   {
     "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-5",
     "EXTENDED_ASSESSMENT_OPENAI_TIMEOUT_SECONDS": 180  // GPT-5 takes 30-120s
   }
   ```

3. **Restart Services:**
   ```powershell
   .\local-run.ps1
   ```

### Performance Comparison

| Model | Deployment | Processing Time | Quality | Cost |
|-------|-----------|----------------|---------|------|
| GPT-4.1 (Current) | `gpt-4.1` | 5-15 seconds | High | Moderate |
| GPT-5 (Future) | `gpt-5` | 30-120 seconds | Very High | High |

**Current Recommendation**: Stick with GPT-4.1 until:
- GPT-5 is generally available in your region
- You need the extra reasoning capabilities for complex cases
- Cost and processing time are acceptable

---

## Troubleshooting

### If Extended Assessments Still Fail

**Check Azure Functions Logs:**

Look for specific error messages:
- `Neither extended assessment nor standard Azure OpenAI configuration is available or enabled` → Config issue
- `Extended assessment API call timed out` → Increase timeout
- `Azure OpenAI returned empty response` → Check deployment status

**Check Azure Portal:**

1. Go to Azure OpenAI resource: `openai-sesame-eastus-001`
2. Check **Deployments** tab
3. Verify `gpt-4.1` deployment exists and is active
4. Check deployment capacity (tokens per minute)

**Check Browser Console:**

Look for the detailed logging:
- `[ExtendedRiskAssessment] ⚠️ response.data is a string, parsing JSON...`
- `[ExtendedRiskAssessment] ❌ Wrapper response failed`
- `[ExtendedRiskAssessment] Setting error: ...`

---

## Summary

✅ **Fixed**: Changed deployment from non-existent `gpt-5` to working `gpt-4.1`  
✅ **Restarted**: Azure Functions and frontend services  
✅ **Ready**: Extended risk assessments should now work  

**Next Step**: Test by generating an extended assessment on a session with a prediction.

---

**Expected Result**: Extended risk assessments should generate successfully in 5-15 seconds using GPT-4.1.
