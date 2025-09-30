# Extended Assessment Configuration Guide

## Overview

The Extended Risk Assessment feature uses separate Azure OpenAI configuration to allow you to use a different endpoint, model, and settings specifically for GPT-5/O3 extended assessments. This provides flexibility to use different Azure OpenAI resources or model deployments for standard vs. extended assessments.

---

## Configuration Options

### Standard Azure OpenAI (for quick assessments)

Used for standard risk assessments (5-15 second processing).

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL | - | `https://your-openai.openai.azure.com/` |
| `AZURE_OPENAI_API_KEY` | API key for Azure OpenAI | - | `abc123...` |
| `AZURE_OPENAI_DEPLOYMENT` | Model deployment name | `gpt-4o` | `gpt-4o`, `gpt-4-turbo` |
| `AZURE_OPENAI_API_VERSION` | API version | `2024-02-01` | `2024-02-01` |
| `AZURE_OPENAI_MAX_TOKENS` | Max response tokens | `1500` | `1500` |
| `AZURE_OPENAI_TEMPERATURE` | Temperature (0.0-1.0) | `0.3` | `0.3` |
| `AZURE_OPENAI_ENABLED` | Enable standard assessments | `false` | `true` |

### Extended Assessment Azure OpenAI (for GPT-5/O3)

Used specifically for extended risk assessments with schizophrenia evaluation (30-120 second processing).

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `EXTENDED_ASSESSMENT_OPENAI_ENDPOINT` | Dedicated endpoint for extended assessments | - | `https://your-gpt5.openai.azure.com/` |
| `EXTENDED_ASSESSMENT_OPENAI_API_KEY` | Dedicated API key for extended assessments | - | `xyz789...` |
| `EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT` | GPT-5/O3 deployment name | - | `gpt-5-turbo`, `o3-mini` |
| `EXTENDED_ASSESSMENT_OPENAI_API_VERSION` | API version (GPT-5 requires preview) | `2024-08-01-preview` | `2024-08-01-preview` |
| `EXTENDED_ASSESSMENT_OPENAI_MAX_TOKENS` | Max response tokens (more for extended) | `4000` | `4000` |
| `EXTENDED_ASSESSMENT_OPENAI_TEMPERATURE` | Temperature (slightly higher for nuance) | `0.2` | `0.2` |
| `EXTENDED_ASSESSMENT_OPENAI_TIMEOUT_SECONDS` | Timeout in seconds | `120` | `120` (2 minutes) |
| `EXTENDED_ASSESSMENT_OPENAI_ENABLED` | Enable extended assessments | `false` | `true` |
| `EXTENDED_ASSESSMENT_USE_FALLBACK` | Fallback to standard config if extended not configured | `true` | `true` |

---

## Configuration Scenarios

### Scenario 1: Separate Resources for Standard and Extended

**Use Case:** You have different Azure OpenAI resources with different models for cost optimization.

```json
{
  "Values": {
    // Standard assessments - GPT-4o on regular resource
    "AZURE_OPENAI_ENDPOINT": "https://myorg-standard.openai.azure.com/",
    "AZURE_OPENAI_API_KEY": "key-for-standard-resource",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-4o",
    "AZURE_OPENAI_ENABLED": "true",
    
    // Extended assessments - GPT-5 on premium resource
    "EXTENDED_ASSESSMENT_OPENAI_ENDPOINT": "https://myorg-premium.openai.azure.com/",
    "EXTENDED_ASSESSMENT_OPENAI_API_KEY": "key-for-premium-resource",
    "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-5-turbo",
    "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true",
    "EXTENDED_ASSESSMENT_USE_FALLBACK": "false"
  }
}
```

### Scenario 2: Same Resource, Different Models

**Use Case:** You have one Azure OpenAI resource with multiple model deployments.

```json
{
  "Values": {
    // Standard assessments - GPT-4o
    "AZURE_OPENAI_ENDPOINT": "https://myorg-openai.openai.azure.com/",
    "AZURE_OPENAI_API_KEY": "shared-api-key",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-4o-deployment",
    "AZURE_OPENAI_ENABLED": "true",
    
    // Extended assessments - GPT-5 on same resource
    "EXTENDED_ASSESSMENT_OPENAI_ENDPOINT": "https://myorg-openai.openai.azure.com/",
    "EXTENDED_ASSESSMENT_OPENAI_API_KEY": "shared-api-key",
    "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-5-deployment",
    "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true",
    "EXTENDED_ASSESSMENT_USE_FALLBACK": "false"
  }
}
```

### Scenario 3: Fallback Mode (Recommended for Testing)

**Use Case:** You only have standard Azure OpenAI configured, want to test extended assessments.

```json
{
  "Values": {
    // Only standard configuration
    "AZURE_OPENAI_ENDPOINT": "https://myorg-openai.openai.azure.com/",
    "AZURE_OPENAI_API_KEY": "api-key",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-4o",
    "AZURE_OPENAI_ENABLED": "true",
    
    // Extended assessment will use standard config as fallback
    "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "false",
    "EXTENDED_ASSESSMENT_USE_FALLBACK": "true"
  }
}
```

**Result:** Extended assessments will automatically use the standard Azure OpenAI configuration with adjusted parameters (4000 tokens, 120s timeout, 0.2 temperature).

### Scenario 4: Disable Extended Assessments

**Use Case:** You don't have GPT-5 access yet.

```json
{
  "Values": {
    "AZURE_OPENAI_ENDPOINT": "https://myorg-openai.openai.azure.com/",
    "AZURE_OPENAI_API_KEY": "api-key",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-4o",
    "AZURE_OPENAI_ENABLED": "true",
    
    // Disable extended assessments completely
    "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "false",
    "EXTENDED_ASSESSMENT_USE_FALLBACK": "false"
  }
}
```

**Result:** Extended assessment endpoints will return error indicating feature is not configured.

---

## Setup Instructions

### Step 1: Update local.settings.json

Copy the template and fill in your values:

```bash
cd BehavioralHealthSystem.Functions
cp local.settings.json.template local.settings.json
# Edit local.settings.json with your actual values
```

### Step 2: Configure for Your Scenario

Choose one of the scenarios above and update your `local.settings.json` accordingly.

### Step 3: Test Configuration

Start the Azure Functions:

```bash
func start
```

Check the logs for configuration confirmation:
```
[ExtendedAssessmentOpenAI] Using dedicated extended assessment OpenAI configuration
Endpoint: https://your-gpt5.openai.azure.com/
Deployment: gpt-5-turbo
```

Or if using fallback:
```
[ExtendedAssessmentOpenAI] Extended assessment configuration not fully configured. 
Falling back to standard AzureOpenAI configuration.
```

### Step 4: Test Extended Assessment

```bash
# Check status
curl http://localhost:7071/api/sessions/{sessionId}/extended-risk-assessment/status

# Generate assessment
curl -X POST http://localhost:7071/api/sessions/{sessionId}/extended-risk-assessment
```

---

## Azure Portal Configuration

For deployment to Azure, set these as Application Settings:

### Standard OpenAI Settings
```
AZURE_OPENAI_ENDPOINT = https://myorg-standard.openai.azure.com/
AZURE_OPENAI_API_KEY = @Microsoft.KeyVault(SecretUri=...)
AZURE_OPENAI_DEPLOYMENT = gpt-4o
AZURE_OPENAI_ENABLED = true
```

### Extended Assessment Settings
```
EXTENDED_ASSESSMENT_OPENAI_ENDPOINT = https://myorg-premium.openai.azure.com/
EXTENDED_ASSESSMENT_OPENAI_API_KEY = @Microsoft.KeyVault(SecretUri=...)
EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT = gpt-5-turbo
EXTENDED_ASSESSMENT_OPENAI_ENABLED = true
EXTENDED_ASSESSMENT_USE_FALLBACK = false
```

**Security Best Practice:** Store API keys in Azure Key Vault and reference them using the syntax above.

---

## Troubleshooting

### Extended Assessment Returns "Not Configured"

**Problem:** API returns error about configuration.

**Solution:**
1. Check `EXTENDED_ASSESSMENT_OPENAI_ENABLED` is set to `true`
2. Verify endpoint and API key are set
3. Or set `EXTENDED_ASSESSMENT_USE_FALLBACK` to `true` to use standard config

### Extended Assessment Times Out

**Problem:** Assessment takes too long and times out.

**Solution:**
1. Increase `EXTENDED_ASSESSMENT_OPENAI_TIMEOUT_SECONDS` (default 120)
2. Check Azure OpenAI service health
3. Verify model deployment is active and has capacity

### Using Standard Model Instead of GPT-5

**Problem:** Logs show "Standard" instead of "GPT-5/O3".

**Solution:**
1. Verify `EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT` contains "gpt-5" or "o3" in the name
2. Check deployment name matches Azure OpenAI deployment exactly (case-sensitive)

### Fallback Not Working

**Problem:** Want to use fallback but it's not working.

**Solution:**
1. Set `EXTENDED_ASSESSMENT_USE_FALLBACK` to `true`
2. Ensure `AZURE_OPENAI_ENABLED` is `true`
3. Check standard Azure OpenAI configuration is complete

---

## Cost Optimization Tips

### Tip 1: Use Fallback for Development
During development, use `EXTENDED_ASSESSMENT_USE_FALLBACK = true` to test with existing GPT-4 models before deploying GPT-5.

### Tip 2: Separate Resources by Environment
- **Development:** Use standard GPT-4 for both (fallback mode)
- **Staging:** Use same resource, different deployments
- **Production:** Use separate resources with different pricing tiers

### Tip 3: Adjust Token Limits
- Standard assessments: 1500 tokens (sufficient for concise responses)
- Extended assessments: 4000 tokens (required for comprehensive DSM-5 evaluation)

### Tip 4: Monitor Usage
Track which assessments are being used:
- Standard: Quick screening, high volume
- Extended: Detailed evaluation, lower volume, higher cost

---

## Migration Guide

### From Single Configuration to Dual Configuration

If you're currently using only standard Azure OpenAI:

1. **Keep existing standard configuration unchanged**
2. **Add extended configuration** with same values initially:
   ```json
   "EXTENDED_ASSESSMENT_OPENAI_ENDPOINT": "<same as AZURE_OPENAI_ENDPOINT>",
   "EXTENDED_ASSESSMENT_OPENAI_API_KEY": "<same as AZURE_OPENAI_API_KEY>",
   "EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "<your-gpt5-deployment>",
   "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true"
   ```
3. **Test both assessments** work correctly
4. **Gradually migrate** to separate resources as needed

---

## Configuration Validation

The service validates configuration at startup and runtime:

### Startup Validation
- Logs configuration status for both standard and extended
- Warns if extended assessment will use fallback
- Errors if neither configuration is available

### Runtime Validation
- Checks configuration before each extended assessment
- Falls back gracefully if extended config unavailable
- Logs detailed information about which configuration is used

### Log Messages

**✅ Dedicated Extended Config:**
```
Using dedicated extended assessment OpenAI configuration
Endpoint: https://your-gpt5.openai.azure.com/
Deployment: gpt-5-turbo
```

**⚠️ Fallback Mode:**
```
Extended assessment configuration not fully configured. 
Falling back to standard AzureOpenAI configuration.
```

**❌ No Configuration:**
```
Neither extended assessment nor standard Azure OpenAI configuration 
is available or enabled.
```

---

## Advanced Configuration

### Custom Timeout Per Assessment
Adjust timeout based on model performance:
- GPT-5: 120-180 seconds
- O3: 60-120 seconds  
- GPT-4 (fallback): 90 seconds

### Temperature Tuning
- Standard assessments: 0.3 (balanced)
- Extended assessments: 0.2 (more deterministic for clinical evaluation)
- Adjust based on response quality needs

### Token Limits
- Minimum for extended: 3000 tokens
- Recommended: 4000 tokens
- Maximum useful: 6000 tokens (diminishing returns)

---

## Quick Reference

### Minimal Configuration (Fallback Mode)
```json
"AZURE_OPENAI_ENDPOINT": "https://your-resource.openai.azure.com/",
"AZURE_OPENAI_API_KEY": "your-key",
"AZURE_OPENAI_DEPLOYMENT": "gpt-4o",
"AZURE_OPENAI_ENABLED": "true",
"EXTENDED_ASSESSMENT_USE_FALLBACK": "true"
```

### Full Configuration (Production)
```json
"AZURE_OPENAI_ENDPOINT": "https://standard.openai.azure.com/",
"AZURE_OPENAI_API_KEY": "standard-key",
"AZURE_OPENAI_DEPLOYMENT": "gpt-4o",
"AZURE_OPENAI_ENABLED": "true",
"EXTENDED_ASSESSMENT_OPENAI_ENDPOINT": "https://premium.openai.azure.com/",
"EXTENDED_ASSESSMENT_OPENAI_API_KEY": "premium-key",
"EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT": "gpt-5-turbo",
"EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true",
"EXTENDED_ASSESSMENT_USE_FALLBACK": "false"
```

---

## Support

For questions or issues:
- Check logs for configuration validation messages
- Verify all required settings are present
- Test with fallback mode first
- Review Azure OpenAI deployment status in Azure Portal
