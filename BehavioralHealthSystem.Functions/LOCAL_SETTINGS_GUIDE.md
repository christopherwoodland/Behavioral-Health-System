# Local Settings Configuration Guide

This guide explains all the configuration options in `local.settings.json`, `local.settings.json.template`, and `local.settings.json.example`.

## Overview

- **`local.settings.json`** - Your actual local development configuration (DO NOT commit to Git)
- **`local.settings.json.template`** - Template with placeholders (commit to Git, update with your keys)
- **`local.settings.json.example`** - Simplified example showing common settings

## Setup Instructions

1. Copy the template file:
   ```bash
   cp local.settings.json.template local.settings.json
   ```

2. Update your actual Azure credentials in `local.settings.json`

3. Never commit `local.settings.json` to source control

## Configuration Sections

### Storage Configuration

| Setting | Description | Value |
|---------|-------------|-------|
| `AzureWebJobsStorage` | Storage for Azure Functions runtime | Use `UseDevelopmentStorage=true` for local development with Azure Storage Emulator |
| `FUNCTIONS_WORKER_RUNTIME` | .NET runtime type | Always `dotnet-isolated` for this project |

**Setup**: Make sure you have [Azure Storage Emulator](https://docs.microsoft.com/en-us/azure/storage/common/storage-use-emulator) installed and running.

---

### Audio Processing Configuration

Settings for voice and audio processing in the behavioral health system.

| Setting | Description | Default | Range |
|---------|-------------|---------|-------|
| `AUDIO_BITS_PER_SAMPLE` | Audio bit depth | `16` | 16 (CD quality) |
| `AUDIO_CHANNELS` | Audio channels | `1` | 1 = Mono, 2 = Stereo |
| `AUDIO_ENABLE_VAD` | Voice Activity Detection | `true` | `true` or `false` |
| `AUDIO_SAMPLE_RATE` | Sample rate in Hz | `24000` | 24000 Hz (telephony quality) |
| `AUDIO_SILENCE_DURATION_MS` | Silence threshold duration | `1000` | Milliseconds |
| `AUDIO_SILENCE_THRESHOLD` | Silence threshold level | `0.01` | 0.0 - 1.0 |

**Use Case**: These settings control how audio is captured and processed. For voice conversation, keep VAD enabled.

---

### Application Insights (Optional)

| Setting | Description |
|---------|-------------|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Telemetry and monitoring connection string |

**Setup**: 
- Leave blank for local development
- For production, create an Application Insights resource in Azure Portal and add the connection string

---

### Azure Content Understanding

AI service for understanding document content.

| Setting | Description |
|---------|-------------|
| `AZURE_CONTENT_UNDERSTANDING_ENDPOINT` | Content Understanding service endpoint |
| `AZURE_CONTENT_UNDERSTANDING_KEY` | API authentication key |

**Setup**: Create an Azure AI Content Understanding resource in Azure Portal.

---

### Azure OpenAI - Primary GPT-4

Standard Azure OpenAI resource for general-purpose AI tasks and conversational AI.

| Setting | Description | Example |
|---------|-------------|---------|
| `AZURE_OPENAI_ENDPOINT` | Your Azure OpenAI resource endpoint | `https://your-openai-resource.openai.azure.com/` |
| `AZURE_OPENAI_API_KEY` | API authentication key | Your secret key |
| `AZURE_OPENAI_DEPLOYMENT` | Model deployment name | `gpt-4o` or `gpt-4o-realtime` |
| `AZURE_OPENAI_API_VERSION` | API version | `2024-12-01-preview` |
| `AZURE_OPENAI_MAX_TOKENS` | Max response tokens | `1500` |
| `AZURE_OPENAI_TEMPERATURE` | Creativity level | `0.3` (0=deterministic, 1=creative) |
| `AZURE_OPENAI_ENABLED` | Enable/disable GPT-4 | `true` or `false` |

**Setup**:
1. Create an Azure OpenAI resource in Azure Portal
2. Deploy a `gpt-4o` or `gpt-4o-realtime` model
3. Get your endpoint URL and API key from the Keys section
4. For realtime voice conversations, use `gpt-4o-realtime` deployment

---

### Document Intelligence

AI service for extracting data from documents and forms.

| Setting | Description |
|---------|-------------|
| `DocumentIntelligenceEndpoint` | Document Intelligence service endpoint |
| `DocumentIntelligenceKey` | API authentication key |

**Setup**: Create an Azure Document Intelligence resource in Azure Portal.

**Use Case**: Used for parsing DSM-5 documents and extracting diagnostic criteria.

---

### DSM-5 Data Configuration

Settings for DSM-5 diagnostic criteria import and storage.

| Setting | Description | Example |
|---------|-------------|---------|
| `DSM5_CONTAINER_NAME` | Blob Storage container for DSM-5 data | `dsm5-data` |
| `DSM5_DOCUMENT_INTELLIGENCE_ENDPOINT` | Document Intelligence endpoint for DSM-5 | Your endpoint |
| `DSM5_DOCUMENT_INTELLIGENCE_KEY` | API key for Document Intelligence | Your key |
| `DSM5_EXTRACTION_METHOD` | Method for extracting DSM-5 | `CONTENT_UNDERSTANDING` |
| `DSM5_STORAGE_ACCOUNT_NAME` | Azure Storage account name | `aistgvi` |

**Setup**:
1. Create an Azure Blob Storage container named `dsm5-data`
2. Use Document Intelligence to parse DSM-5 PDF documents
3. Store extracted data in the blob storage container

---

### Azure OpenAI - Extended Assessment (Advanced DSM-5 Analysis)

Advanced AI resource for comprehensive disorder assessment using GPT-5 or similar advanced models.

| Setting | Description | Example |
|---------|-------------|---------|
| `EXTENDED_ASSESSMENT_OPENAI_ENDPOINT` | Advanced model endpoint | Can be same as GPT-4 or separate |
| `EXTENDED_ASSESSMENT_OPENAI_API_KEY` | API key | Can be same as GPT-4 or separate |
| `EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT` | Advanced model deployment | `gpt-5-turbo` or similar |
| `EXTENDED_ASSESSMENT_OPENAI_API_VERSION` | Advanced API version | `2024-08-01-preview` |
| `EXTENDED_ASSESSMENT_OPENAI_MAX_TOKENS` | Max tokens for analysis | `4000` (larger for detailed analysis) |
| `EXTENDED_ASSESSMENT_OPENAI_TEMPERATURE` | Creativity level | `0.2` (lower for consistency) |
| `EXTENDED_ASSESSMENT_OPENAI_TIMEOUT_SECONDS` | Request timeout | `120` (longer for complex analysis) |
| `EXTENDED_ASSESSMENT_OPENAI_ENABLED` | Enable/disable advanced assessment | `true` or `false` |
| `EXTENDED_ASSESSMENT_USE_FALLBACK` | Fall back to GPT-4 if unavailable | `true` or `false` |

**Setup**:
1. Optional: Can use same endpoint/key as primary GPT-4
2. Or: Deploy a separate advanced model (GPT-5, o1, etc.)
3. Increase `MAX_TOKENS` and `TIMEOUT_SECONDS` for more thorough analysis
4. Set `ENABLED` to `false` for local development if not testing advanced features
5. Set `USE_FALLBACK` to `true` to gracefully degrade to GPT-4

---

### Realtime API Configuration

Settings for Azure OpenAI Realtime API (GPT-4o Realtime for real-time voice conversations).

| Setting | Description | Example |
|---------|-------------|---------|
| `GPT_REALTIME_API_KEY` | Realtime API key | Same as GPT-4 key |
| `GPT_REALTIME_API_VERSION` | Realtime API version | `2024-10-01-preview` |
| `GPT_REALTIME_DEPLOYMENT` | Realtime model deployment | `gpt-realtime` or `gpt-4o-realtime` |
| `GPT_REALTIME_ENDPOINT` | Realtime API endpoint | Your resource endpoint with `/openai/realtime` path |

**Setup**:
1. Deploy a `gpt-realtime` or `gpt-4o-realtime` model in Azure OpenAI
2. Use the resource endpoint with `/openai/realtime` path
3. Use the same API key as your main OpenAI resource

**Use Case**: Enables real-time voice conversations with WebRTC streaming for natural voice interactions.

---

### Kintsugi Health API

Third-party mental health assessment API for voice analysis.

| Setting | Description | Example |
|---------|-------------|---------|
| `KINTSUGI_API_KEY` | Your Kintsugi API key | Your secret key |
| `KINTSUGI_AUTO_PROVIDE_CONSENT` | Auto-provide consent | `false` = require user consent |
| `KINTSUGI_BASE_URL` | Kintsugi API base URL | `https://api.kintsugihealth.com/v2` |

**Setup**:
1. Contact Kintsugi Health for API credentials
2. Get your API key from their dashboard
3. Set `AUTO_PROVIDE_CONSENT` to `false` to require explicit user consent before voice analysis

---

### Workflow Configuration

Settings for async job processing and retries.

| Setting | Description | Default |
|---------|-------------|---------|
| `WORKFLOW_MAX_RETRIES` | Maximum retry attempts for failed operations | `100` |
| `WORKFLOW_RETRY_DELAY_SECONDS` | Delay between retry attempts | `30` seconds |

**Use Case**: Controls how the system retries failed async operations (e.g., API calls, uploads).

---

### Feature Flags

Settings to enable or disable application features at runtime.

| Setting | Description | Default | Values |
|---------|-------------|---------|--------|
| `AGENT_MODE_ENABLED` | Enable/disable the Agent Experience feature on dashboard | `true` | `true` or `false` |

**Use Case**: Feature flags allow you to control which features are available to users without redeploying the application.

**How It Works**:
1. When a user loads the dashboard, the frontend queries the `/api/feature-flags` endpoint
2. If `AGENT_MODE_ENABLED` is `true`, the Agent Experience button is clickable
3. If `AGENT_MODE_ENABLED` is `false`, the button is greyed out with a "DISABLED" overlay
4. Frontend caches results for 5 minutes to reduce API calls

**Examples**:
- Set to `false` during feature development or testing
- Set to `false` during maintenance windows
- Set to `false` to gradually roll out features to users

**Frontend Implementation**: The dashboard uses the `useFeatureFlag` hook to check the `AGENT_MODE_ENABLED` flag. If the flag fetch fails, it defaults to `true` (feature enabled).

---

## Host Configuration

```json
"Host": {
  "LocalHttpPort": 7071,
  "CORS": "http://localhost:5173,http://localhost:5174,https://localhost:5173,https://localhost:5174",
  "CORSCredentials": false
}
```

| Setting | Description |
|---------|-------------|
| `LocalHttpPort` | Port for local Azure Functions host (default: 7071) |
| `CORS` | Comma-separated list of allowed CORS origins |
| `CORSCredentials` | Whether to allow credentials with CORS requests |

**For Local Development**: The default CORS settings allow the Vite dev server running on ports 5173-5174.

---

## Getting Started Checklist

- [ ] Copy `local.settings.json.template` to `local.settings.json`
- [ ] Update `KINTSUGI_API_KEY` with your actual key
- [ ] Update Azure OpenAI settings with your resource details
- [ ] Start Azure Storage Emulator (if using `UseDevelopmentStorage=true`)
- [ ] Run `./scripts/local-run.ps1` to start the development server
- [ ] Test the health endpoint: `http://localhost:7071/api/health`

---

## Troubleshooting

### Storage Connection Error
**Error**: "Unable to resolve the Azure Storage connection named 'Storage'"

**Solution**: 
1. Ensure `AzureWebJobsStorage` is set to `UseDevelopmentStorage=true` for local dev
2. Start the Azure Storage Emulator
3. Or provide a real Azure Storage connection string

### API Connection Errors
**Error**: 401 Unauthorized or invalid API key errors

**Solution**:
1. Verify your API keys are correct and not expired
2. Check that the endpoint URLs are correct
3. Ensure your Azure resource exists and is in the correct region

### Realtime API Issues
**Error**: WebRTC connection failures during voice conversations

**Solution**:
1. Verify `GPT_REALTIME_ENDPOINT` includes `/openai/realtime` path
2. Check that you've deployed a realtime model (gpt-4o-realtime)
3. Ensure API key and version are correct

---

## Production Deployment

When deploying to Azure:

1. **Do NOT include `local.settings.json`** in your deployment
2. Set all values as **Azure Function App Configuration** settings
3. Use Azure Key Vault for sensitive values
4. Set appropriate CORS origins (not `*`)
5. Adjust timeouts and retries based on your workload

See `README.md` deployment section for full production setup instructions.
