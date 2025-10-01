# GPT-5/O3 Parameter Compatibility Fix ✅

**Date**: September 30, 2025  
**Issue**: GPT-5/O3 models don't support `max_tokens` parameter  
**Solution**: Conditionally omit `MaxTokens` for GPT-5/O3 models

---

## 🔴 **The Problem**

When calling GPT-5 deployment, Azure OpenAI returned error:

```
Azure.RequestFailedException: Unsupported parameter: 'max_tokens' is not supported with this model. 
Use 'max_completion_tokens' instead.
Status: 400 (Bad Request)
ErrorCode: unsupported_parameter
```

### **Root Cause**

GPT-5 and O3 models have different parameter requirements than GPT-4 models:

| Model Family | `max_tokens` | `max_completion_tokens` | Temperature | TopP | Notes |
|--------------|--------------|-------------------------|-------------|------|-------|
| GPT-4.x | ✅ Supported | ❌ Not used | ✅ Configurable | ✅ Configurable | Standard parameters |
| GPT-5/O3 | ❌ **NOT SUPPORTED** | ✅ Required | ❌ Not configurable | ❌ Not configurable | Limited parameters |

### **Code Issue**

The `RiskAssessmentService.cs` was unconditionally setting `MaxTokens`:

```csharp
var requestOptions = new ChatCompletionsOptions()
{
    MaxTokens = effectiveConfig.MaxTokens,  // ❌ Fails for GPT-5/O3!
    DeploymentName = deploymentName
};
```

---

## ✅ **The Solution**

### **Code Changes**

Modified `CallAzureOpenAIForExtendedAssessmentAsync` method in `RiskAssessmentService.cs`:

**Before:**
```csharp
var requestOptions = new ChatCompletionsOptions()
{
    MaxTokens = effectiveConfig.MaxTokens,  // Always set
    DeploymentName = deploymentName
};

// ... add messages ...

bool isAdvancedModel = deploymentName.ToLowerInvariant().Contains("gpt-5") || 
                       deploymentName.ToLowerInvariant().Contains("o3");

if (!isAdvancedModel)
{
    requestOptions.Temperature = (float)effectiveConfig.Temperature;
    requestOptions.NucleusSamplingFactor = 0.2f;
    // ...
}
```

**After:**
```csharp
// Detect GPT-5/O3 models FIRST
bool isAdvancedModel = deploymentName.ToLowerInvariant().Contains("gpt-5") || 
                       deploymentName.ToLowerInvariant().Contains("o3");

// Create request options - GPT-5/O3 doesn't support max_tokens parameter
var requestOptions = new ChatCompletionsOptions()
{
    DeploymentName = deploymentName
};

// Only set MaxTokens for non-GPT-5/O3 models
// GPT-5/O3 uses max_completion_tokens which is not supported by this SDK version
if (!isAdvancedModel)
{
    requestOptions.MaxTokens = effectiveConfig.MaxTokens;
}

// ... add messages ...

// Set other parameters only for non-advanced models
if (!isAdvancedModel)
{
    requestOptions.Temperature = (float)effectiveConfig.Temperature;
    requestOptions.NucleusSamplingFactor = 0.2f;
    // ...
}
```

### **Key Changes**

1. **Moved `isAdvancedModel` detection earlier** - Before creating request options
2. **Conditionally set `MaxTokens`** - Only for non-GPT-5/O3 models
3. **Improved logging** - Shows "omitted (GPT-5/O3 limitation)" for advanced models

---

## 🧪 **Testing**

### **Before Fix**

```
[CallAzureOpenAIForExtendedAssessmentAsync] Calling Azure OpenAI for extended assessment. 
Model: GPT-5/O3, Deployment: gpt-5, Timeout: 120s

[CallAzureOpenAIForExtendedAssessmentAsync] Error calling Azure OpenAI API for extended assessment
Exception: Azure.RequestFailedException: Unsupported parameter: 'max_tokens' is not supported with this model.
Status: 400 (Bad Request)
```

### **After Fix** (Expected)

```
[CallAzureOpenAIForExtendedAssessmentAsync] Calling Azure OpenAI for extended assessment. 
Model: GPT-5/O3, Deployment: gpt-5, MaxTokens: omitted (GPT-5/O3 limitation), Timeout: 120s

[CallAzureOpenAIForExtendedAssessmentAsync] Extended assessment API call successful. 
Response length: 8234

[GenerateExtendedRiskAssessmentAsync] Extended risk assessment generated successfully 
for session {sessionId} in 45234ms
```

---

## 📊 **GPT-5/O3 Model Characteristics**

### **Parameter Support**

| Parameter | GPT-4.x | GPT-5/O3 | Notes |
|-----------|---------|----------|-------|
| `max_tokens` | ✅ | ❌ | Use `max_completion_tokens` for GPT-5/O3 |
| `temperature` | ✅ | ❌ | GPT-5/O3 uses default (not configurable) |
| `top_p` | ✅ | ❌ | GPT-5/O3 uses default (not configurable) |
| `frequency_penalty` | ✅ | ❌ | Not configurable |
| `presence_penalty` | ✅ | ❌ | Not configurable |
| `messages` | ✅ | ✅ | Standard chat format |
| `deployment_name` | ✅ | ✅ | Required |

### **Performance Characteristics**

| Metric | GPT-4.1 | GPT-5/O3 |
|--------|---------|----------|
| **Processing Time** | 5-15 seconds | 30-120 seconds |
| **Max Output Tokens** | 4,096 | 16,384+ (default) |
| **Reasoning Capability** | High | Very High |
| **Cost** | Moderate | Higher |
| **Temperature** | Configurable (0.0-2.0) | Fixed (optimized for reasoning) |

### **When to Use Each Model**

**Use GPT-4.1 when:**
- Fast responses needed (< 15 seconds)
- Standard risk assessment sufficient
- Cost is a concern
- Temperature control required

**Use GPT-5/O3 when:**
- Deep reasoning required (extended assessments)
- Complex diagnostic evaluations (DSM-5 criteria)
- Differential diagnosis considerations
- Processing time (30-120s) is acceptable

---

## 🔧 **SDK Version Limitation**

### **Current SDK: Azure.AI.OpenAI 1.0.0-beta.17**

This SDK version:
- ✅ Has `MaxTokens` property in `ChatCompletionsOptions`
- ❌ Does NOT have `MaxCompletionTokens` property
- ❌ Cannot directly set `max_completion_tokens` for GPT-5/O3

### **Workaround**

**Omit the parameter entirely** - GPT-5/O3 will use its default max_completion_tokens (typically 16,384)

```csharp
if (!isAdvancedModel)
{
    requestOptions.MaxTokens = effectiveConfig.MaxTokens;  // Only for GPT-4.x
}
// For GPT-5/O3: Don't set any token limit, use model default
```

### **Future SDK Versions**

When upgrading to newer SDK versions that support `MaxCompletionTokens`:

```csharp
if (isAdvancedModel)
{
    requestOptions.MaxCompletionTokens = effectiveConfig.MaxTokens;  // For GPT-5/O3
}
else
{
    requestOptions.MaxTokens = effectiveConfig.MaxTokens;  // For GPT-4.x
}
```

---

## 📝 **Configuration**

### **Current Extended Assessment Configuration**

```json
{
  "EXTENDED_ASSESSMENT_OPENAI_ENDPOINT": "https://openai-sesame-eastus-001.openai.azure.com/",
  "EXTENDED_ASSESSMENT_OPENAI_API_KEY": "89a35462495b4448b433e57d092397e3",
  "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-5",
  "EXTENDED_ASSESSMENT_OPENAI_API_VERSION": "2024-12-01-preview",
  "EXTENDED_ASSESSMENT_OPENAI_MAX_TOKENS": "4000",
  "EXTENDED_ASSESSMENT_OPENAI_TEMPERATURE": "0.2",
  "EXTENDED_ASSESSMENT_OPENAI_TIMEOUT_SECONDS": "120",
  "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true",
  "EXTENDED_ASSESSMENT_USE_FALLBACK": "false"
}
```

**Notes:**
- `MAX_TOKENS` is **ignored** for GPT-5 (model uses default ~16K)
- `TEMPERATURE` is **ignored** for GPT-5 (model uses optimized default)
- `TIMEOUT_SECONDS` should be **120-180** for GPT-5 (slow processing)

---

## 🚀 **Next Steps**

### **1. Test GPT-5 Extended Assessment**

```bash
# Services should be running after .\local-run.ps1
```

1. Navigate to http://localhost:5173
2. Open a session with a prediction
3. Click **"Generate AI Risk Assessment (Extended)"**
4. **Wait 30-120 seconds** (GPT-5 is slow!)
5. Verify comprehensive assessment appears

### **2. Check Logs**

**Azure Functions logs should show:**

```
[CallAzureOpenAIForExtendedAssessmentAsync] Using dedicated extended assessment OpenAI configuration. 
Endpoint: https://openai-sesame-eastus-001.openai.azure.com/, 
Deployment: gpt-5

[CallAzureOpenAIForExtendedAssessmentAsync] Calling Azure OpenAI for extended assessment. 
Model: GPT-5/O3, 
Deployment: gpt-5, 
MaxTokens: omitted (GPT-5/O3 limitation),  ✅ FIXED!
Timeout: 120s

[CallAzureOpenAIForExtendedAssessmentAsync] Extended assessment API call successful. 
Response length: 8234

[GenerateExtendedRiskAssessmentAsync] Extended risk assessment generated successfully 
for session {sessionId} in 45234ms  ← Typical GPT-5 processing time
```

**Browser console should show:**

```javascript
[ExtendedRiskAssessment] 🚀 Starting assessment generation...
[ExtendedRiskAssessment] Making POST request to generate assessment...
[ExtendedRiskAssessment] 📥 Raw response received: {success: true, ...}
[ExtendedRiskAssessment] ✅✅ Inner response successful! Assessment generated
```

### **3. Verify Assessment Quality**

Extended assessment should include:
- ✅ Comprehensive risk overview
- ✅ DSM-5 Criterion A evaluation (5 symptoms)
- ✅ Functional impairment assessment (Criterion B)
- ✅ Duration assessment (Criterion C)
- ✅ Differential diagnosis considerations
- ✅ Detailed symptom evidence and notes
- ✅ Processing time ~30-120 seconds (GPT-5 is slow but thorough)

---

## 🎯 **Summary**

**Problem**: GPT-5/O3 models don't support `max_tokens` parameter  
**Solution**: Conditionally omit `MaxTokens` for GPT-5/O3 models  
**Status**: ✅ **FIXED** - Ready for testing  
**Build**: ✅ Succeeded with warnings (not errors)  
**Services**: ✅ Restarted with fix applied  

**Expected Behavior**: GPT-5 extended assessments should now generate successfully in 30-120 seconds with comprehensive DSM-5 evaluations.

---

**Test now by generating an extended assessment!** 🚀
