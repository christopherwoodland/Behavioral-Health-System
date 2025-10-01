# GPT-5/O3 Configuration Issue

## Problem

GPT-5 is **NOT** being called for extended assessments despite being configured. Using fallback to standard GPT-4.1 instead.

---

## Current Configuration

### local.settings.json

```json
{
  "EXTENDED_ASSESSMENT_OPENAI_ENDPOINT": "https://openai-sesame-eastus-001.openai.azure.com/",
  "EXTENDED_ASSESSMENT_OPENAI_API_KEY": "REDACTED_AZURE_OPENAI_API_KEY",
  "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-5",
  "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "false",     // ❌ DISABLED!
  "EXTENDED_ASSESSMENT_USE_FALLBACK": "true"         // ✅ Using fallback
}
```

---

## Why GPT-5 Isn't Called

### 1. Extended Assessment is Disabled

```json
"EXTENDED_ASSESSMENT_OPENAI_ENABLED": "false"  // ❌
```

When this is `false`, the `RiskAssessmentService` won't use the extended configuration.

### 2. Fallback is Enabled

```json
"EXTENDED_ASSESSMENT_USE_FALLBACK": "true"  // Uses standard GPT-4.1
```

This tells the service to fall back to the standard Azure OpenAI configuration instead of using GPT-5.

---

## Solution

### Enable GPT-5 for Extended Assessments

Update your `local.settings.json`:

```json
{
  "EXTENDED_ASSESSMENT_OPENAI_ENDPOINT": "https://openai-sesame-eastus-001.openai.azure.com/",
  "EXTENDED_ASSESSMENT_OPENAI_API_KEY": "REDACTED_AZURE_OPENAI_API_KEY",
  "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-5",
  "EXTENDED_ASSESSMENT_OPENAI_API_VERSION": "2024-08-01-preview",
  "EXTENDED_ASSESSMENT_OPENAI_MAX_TOKENS": "4000",
  "EXTENDED_ASSESSMENT_OPENAI_TEMPERATURE": "0.2",
  "EXTENDED_ASSESSMENT_OPENAI_TIMEOUT_SECONDS": "120",
  "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true",      // ✅ ENABLE THIS!
  "EXTENDED_ASSESSMENT_USE_FALLBACK": "false"        // ✅ DISABLE FALLBACK!
}
```

### Restart Azure Functions

After updating the configuration:

```powershell
# Stop the functions app (Ctrl+C in the terminal)
# Then restart:
./local-run.ps1
```

---

## Verification

### Check Logs

After enabling and restarting, you should see in the Azure Functions logs:

```
[INFO] Using extended assessment configuration:
  - Endpoint: https://openai-sesame-eastus-001.openai.azure.com/
  - Deployment: gpt-5
  - Enabled: True
  - Fallback: False
```

### Check Response

The assessment should show:

```json
{
  "modelVersion": "gpt-5-turbo-2024-08-01-preview",  // Should say gpt-5
  "processingTimeMs": 45000  // Will be longer (30-120 seconds)
}
```

---

## Configuration Logic

### RiskAssessmentService.cs

```csharp
// Check if extended configuration is enabled
if (_extendedOptions.Value.Enabled && 
    !string.IsNullOrWhiteSpace(_extendedOptions.Value.Endpoint))
{
    // Use GPT-5 configuration
    endpoint = _extendedOptions.Value.Endpoint;
    apiKey = _extendedOptions.Value.ApiKey;
    deploymentName = _extendedOptions.Value.DeploymentName;
    // ...
}
else if (_extendedOptions.Value.UseFallbackToStandardConfig)
{
    // Fall back to standard GPT-4.1 configuration
    endpoint = _standardOptions.Value.Endpoint;
    // ...
}
else
{
    // Neither enabled - return null
    return null;
}
```

### Decision Tree

```
Is EXTENDED_ASSESSMENT_OPENAI_ENABLED = true?
├─ YES → Use GPT-5 configuration
│         └─ Endpoint: EXTENDED_ASSESSMENT_OPENAI_ENDPOINT
│         └─ Model: EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT (gpt-5)
│
└─ NO → Is EXTENDED_ASSESSMENT_USE_FALLBACK = true?
        ├─ YES → Use standard GPT-4.1 configuration
        │        └─ Endpoint: AZURE_OPENAI_ENDPOINT
        │        └─ Model: AZURE_OPENAI_DEPLOYMENT (gpt-4.1)
        │
        └─ NO → Return null (no assessment)
```

---

## Current Behavior

**Currently:**
```
ENABLED = false → Skip GPT-5
FALLBACK = true → Use GPT-4.1 instead
```

**Result:**
- ✅ Assessment generates successfully
- ❌ Using GPT-4.1, not GPT-5
- ⏱️ Processing time: ~8 seconds (normal)
- 📝 Model version: "gpt-4.1-2024-12-01-preview"

---

## After Fix

**After enabling:**
```
ENABLED = true → Use GPT-5
FALLBACK = false → Don't fall back
```

**Expected Result:**
- ✅ Assessment generates successfully
- ✅ Using GPT-5
- ⏱️ Processing time: ~30-120 seconds (longer)
- 📝 Model version: "gpt-5-turbo-2024-08-01-preview"

---

## Why Keep Fallback Option?

The fallback feature is useful for:

1. **Development** - Use cheaper GPT-4.1 when testing UI
2. **Degraded Mode** - Fall back if GPT-5 endpoint is down
3. **Cost Control** - Use GPT-4.1 when GPT-5 quota is exceeded
4. **Testing** - Compare GPT-4.1 vs GPT-5 results

---

## Configuration Scenarios

### Scenario 1: Use GPT-5 Only
```json
"EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true",
"EXTENDED_ASSESSMENT_USE_FALLBACK": "false"
```
→ Uses GPT-5, fails if unavailable

### Scenario 2: Use GPT-4.1 Only (Current)
```json
"EXTENDED_ASSESSMENT_OPENAI_ENABLED": "false",
"EXTENDED_ASSESSMENT_USE_FALLBACK": "true"
```
→ Always uses standard GPT-4.1

### Scenario 3: GPT-5 with Fallback
```json
"EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true",
"EXTENDED_ASSESSMENT_USE_FALLBACK": "true"
```
→ Tries GPT-5, falls back to GPT-4.1 if error

### Scenario 4: Disabled
```json
"EXTENDED_ASSESSMENT_OPENAI_ENABLED": "false",
"EXTENDED_ASSESSMENT_USE_FALLBACK": "false"
```
→ No extended assessments generated

---

## Testing GPT-5

### Step 1: Update Configuration

```powershell
# Edit local.settings.json
code BehavioralHealthSystem.Functions/local.settings.json
```

Change:
```json
"EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true",
"EXTENDED_ASSESSMENT_USE_FALLBACK": "false"
```

### Step 2: Restart Functions

```powershell
# In the terminal running functions, press Ctrl+C
# Then restart:
./local-run.ps1
```

### Step 3: Generate Assessment

1. Open browser to session detail
2. Click "Generate Extended Risk Assessment"
3. **Wait 30-120 seconds** (GPT-5 is slower)
4. Check the result

### Step 4: Verify Model

Look at the assessment display:
```json
{
  "modelVersion": "gpt-5-turbo-2024-08-01-preview",  // Should say gpt-5
  "processingTimeMs": 45000  // Much longer than 8000ms
}
```

---

## Summary

| Setting | Current | Recommended |
|---------|---------|-------------|
| `EXTENDED_ASSESSMENT_OPENAI_ENABLED` | `false` ❌ | `true` ✅ |
| `EXTENDED_ASSESSMENT_USE_FALLBACK` | `true` | `false` |
| **Result** | Uses GPT-4.1 | Uses GPT-5 |
| **Processing Time** | ~8 seconds | ~30-120 seconds |
| **Model** | gpt-4.1-2024-12-01-preview | gpt-5-turbo-2024-08-01-preview |

---

## Quick Fix

**To enable GPT-5 NOW:**

1. Open `BehavioralHealthSystem.Functions/local.settings.json`
2. Change line 32: `"EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true",`
3. Change line 33: `"EXTENDED_ASSESSMENT_USE_FALLBACK": "false"`
4. Save file
5. Restart `./local-run.ps1`
6. Generate a new assessment
7. Wait patiently (30-120 seconds)
8. Enjoy GPT-5 powered schizophrenia assessment! 🎉
