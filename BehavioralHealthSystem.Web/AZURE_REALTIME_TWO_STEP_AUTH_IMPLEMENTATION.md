# Azure OpenAI Realtime API - Two-Step Authentication Implementation

## Date: 2025-01-24

## Summary

Successfully implemented Microsoft's two-step authentication pattern for Azure OpenAI Realtime API based on working HTML example. The implementation replaces the old single-endpoint approach with the correct architectural pattern.

## Problem

The previous implementation was attempting to connect directly to Azure OpenAI Realtime API using a single endpoint:
```
POST https://cdc-traci-aif-002.cognitiveservices.azure.com/openai/realtime?api-version=2024-10-01-preview&deployment=gpt-realtime
```

This resulted in **404 errors** because:
1. Wrong domain (`.cognitiveservices.azure.com` instead of `.openai.azure.com`)
2. Wrong path (`/openai/realtime` instead of `/openai/realtimeapi/sessions`)
3. Wrong authentication flow (direct API key instead of ephemeral key)
4. Missing regional WebRTC endpoint

## Solution - Two-Step Authentication

Based on Microsoft's official working example, the correct flow is:

### Step 1: Get Ephemeral Session Key
```
POST https://cdc-traci-aif-002.openai.azure.com/openai/realtimeapi/sessions?api-version=2025-04-01-preview

Headers:
  api-key: {your-api-key}
  Content-Type: application/json

Body:
{
  "model": "gpt-realtime",
  "voice": "alloy",
  "instructions": "You are a helpful behavioral health assistant.",
  "temperature": 0.8,
  "max_output_tokens": 4096
}

Response:
{
  "id": "session-xyz",
  "client_secret": {
    "value": "ephemeral-key-abc123"
  }
}
```

### Step 2: Establish WebRTC Connection
```
POST https://eastus.realtimeapi-preview.ai.azure.com/v1/realtimertc?model=gpt-realtime

Headers:
  Authorization: Bearer {ephemeral-key-abc123}
  Content-Type: application/sdp

Body:
{SDP offer from RTCPeerConnection}

Response:
{SDP answer for WebRTC connection}
```

## Code Changes

### 1. Service Properties Added
```typescript
private webrtcRegion: string;
private ephemeralKey: string = '';
```

### 2. Constructor Updated
```typescript
constructor() {
  this.endpoint = import.meta.env.VITE_AZURE_OPENAI_RESOURCE_NAME || '';
  this.apiKey = import.meta.env.VITE_AZURE_OPENAI_REALTIME_KEY || '';
  this.deploymentName = import.meta.env.VITE_AZURE_OPENAI_REALTIME_DEPLOYMENT || 'gpt-4o-realtime-preview';
  this.apiVersion = import.meta.env.VITE_AZURE_OPENAI_REALTIME_API_VERSION || '2025-04-01-preview';
  this.webrtcRegion = import.meta.env.VITE_AZURE_OPENAI_WEBRTC_REGION || 'eastus';
  
  console.log('🔧 Azure OpenAI Realtime Config:');
  console.log('  Resource:', this.endpoint);
  console.log('  Deployment:', this.deploymentName);
  console.log('  API Version:', this.apiVersion);
  console.log('  WebRTC Region:', this.webrtcRegion);
}
```

### 3. New Method: getEphemeralKey()
```typescript
private async getEphemeralKey(config: RealtimeSessionConfig): Promise<void> {
  const sessionsUrl = `https://${this.endpoint}.openai.azure.com/openai/realtimeapi/sessions?api-version=${this.apiVersion}`;
  
  const payload = {
    model: this.deploymentName,
    voice: config.voice || 'alloy',
    instructions: config.instructions || 'You are a helpful behavioral health assistant.',
    temperature: config.temperature || 0.8,
    max_output_tokens: config.maxTokens || 4096
  };
  
  const response = await fetch(sessionsUrl, {
    method: 'POST',
    headers: {
      'api-key': this.apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  const data = await response.json();
  this.ephemeralKey = data.client_secret.value;
}
```

### 4. Updated: startSession()
Now calls `getEphemeralKey()` BEFORE initializing audio:
```typescript
async startSession(userId: string, config: RealtimeSessionConfig): Promise<void> {
  // Step 1: Get ephemeral key from sessions API
  console.log('🔑 Getting ephemeral key from Azure OpenAI sessions API...');
  await this.getEphemeralKey(config);
  
  // Step 2: Initialize audio and WebRTC
  await this.initializeAudioStream(config.enableAudio);
  await this.createPeerConnection(config);
  
  // Step 3: Establish WebRTC connection with ephemeral key
  await this.connectToAzureOpenAI();
}
```

### 5. Updated: exchangeSDPWithAzure()
Now uses regional WebRTC endpoint with Bearer token:
```typescript
private async exchangeSDPWithAzure(
  offer: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> {
  const webrtcUrl = `https://${this.webrtcRegion}.realtimeapi-preview.ai.azure.com/v1/realtimertc?model=${this.deploymentName}`;
  
  const response = await fetch(webrtcUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.ephemeralKey}`,
      'Content-Type': 'application/sdp'
    },
    body: offer.sdp
  });
  
  const sdpAnswer = await response.text();
  
  return {
    type: 'answer' as RTCSdpType,
    sdp: sdpAnswer
  };
}
```

## Environment Variables

All required variables are already configured in `.env.local`:

```bash
# Resource name (not full URL)
VITE_AZURE_OPENAI_RESOURCE_NAME=cdc-traci-aif-002

# API key for sessions endpoint
VITE_AZURE_OPENAI_REALTIME_KEY=7fGpwV46hnYrzploQr6mnERZoTcIUBdKkKuuwlyQMqylmGbqkVTQJQQJ99BIACHYHv6XJ3w3AAAAACOGB48K

# Deployment name
VITE_AZURE_OPENAI_REALTIME_DEPLOYMENT=gpt-realtime

# API version from working example
VITE_AZURE_OPENAI_REALTIME_API_VERSION=2025-04-01-preview

# Regional WebRTC endpoint
VITE_AZURE_OPENAI_WEBRTC_REGION=eastus
```

## Testing Checklist

### 1. Restart Dev Server
```powershell
# In BehavioralHealthSystem.Web directory
npm run dev
```

### 2. Open Agent Experience
- Navigate to: http://localhost:5173/agent-experience
- Should load `RealtimeAgentExperience.tsx` (not the old SignalR version)

### 3. Check Configuration Logs
Open browser console and verify:
```
🔧 Azure OpenAI Realtime Config:
  Resource: cdc-traci-aif-002
  Deployment: gpt-realtime
  API Version: 2025-04-01-preview
  WebRTC Region: eastus
```

### 4. Start Session
Click "Start Session" button and monitor console:

**Expected Step 1: Sessions API**
```
🚀 Starting Azure OpenAI Realtime session...
🔑 Getting ephemeral key from Azure OpenAI sessions API...
📡 Sessions API URL: https://cdc-traci-aif-002.openai.azure.com/openai/realtimeapi/sessions?api-version=2025-04-01-preview
✅ Ephemeral key obtained successfully
```

**Expected Step 2: Audio Initialization**
```
🎤 Microphone access granted
```

**Expected Step 3: WebRTC Connection**
```
📤 Created and set local offer
📡 WebRTC URL: https://eastus.realtimeapi-preview.ai.azure.com/v1/realtimertc?model=gpt-realtime
✅ SDP answer received from Azure OpenAI
📥 Set remote answer from Azure OpenAI
✅ Session started successfully: session-{userId}-{timestamp}
```

### 5. Verify Voice Interaction
- Microphone indicator should show activity
- Speak into microphone
- AI should respond with voice

## Potential Issues & Troubleshooting

### Issue 1: Deployment Name Not Found
**Symptom:** `Sessions API error: 404 - deployment not found`

**Solution:** Verify deployment exists in Azure:
1. Open Azure Portal
2. Navigate to Azure OpenAI resource: `cdc-traci-aif-002`
3. Go to "Model deployments"
4. Confirm deployment named `gpt-realtime` exists
5. If different name, update `.env.local`:
   ```bash
   VITE_AZURE_OPENAI_REALTIME_DEPLOYMENT=your-actual-deployment-name
   ```

### Issue 2: Region Mismatch
**Symptom:** `WebRTC API error: 404 - region not available`

**Solution:** Verify WebRTC region matches Azure resource region:
1. Check Azure OpenAI resource region in portal
2. Update `.env.local` if needed:
   ```bash
   # Common regions:
   VITE_AZURE_OPENAI_WEBRTC_REGION=eastus
   # or
   VITE_AZURE_OPENAI_WEBRTC_REGION=eastus2
   # or
   VITE_AZURE_OPENAI_WEBRTC_REGION=swedencentral
   ```

### Issue 3: API Key Invalid
**Symptom:** `Sessions API error: 401 - Unauthorized`

**Solution:** Regenerate API key from Azure Portal:
1. Navigate to resource `cdc-traci-aif-002`
2. Go to "Keys and Endpoint"
3. Copy Key 1 or Key 2
4. Update `.env.local`:
   ```bash
   VITE_AZURE_OPENAI_REALTIME_KEY=your-new-api-key
   ```
5. Restart dev server

### Issue 4: CORS Errors
**Symptom:** `Access-Control-Allow-Origin` errors in console

**Solution:** CORS should be handled by Azure automatically for WebRTC endpoints. If issues persist:
1. Check Azure OpenAI resource CORS settings
2. Ensure `http://localhost:5173` is allowed
3. For production, add production URL

### Issue 5: Microphone Access Denied
**Symptom:** `DOMException: Permission denied`

**Solution:**
1. Browser should prompt for microphone access - click "Allow"
2. If blocked, click lock icon in address bar
3. Reset permissions for microphone
4. Refresh page

## Key Differences from Old Implementation

| Aspect | Old (Incorrect) | New (Correct) |
|--------|----------------|---------------|
| **Domain** | `.cognitiveservices.azure.com` | `.openai.azure.com` (sessions)<br>`.realtimeapi-preview.ai.azure.com` (WebRTC) |
| **Endpoints** | Single endpoint | Two endpoints (sessions + WebRTC) |
| **Path** | `/openai/realtime` | `/openai/realtimeapi/sessions` (step 1)<br>`/v1/realtimertc` (step 2) |
| **Auth** | Direct api-key to WebRTC | api-key to sessions → ephemeral key to WebRTC |
| **API Version** | `2024-10-01-preview` | `2025-04-01-preview` |
| **Query Params** | `?deployment=name` | `?model=name` (WebRTC only) |

## Reference

Working HTML example provided by user showing correct Microsoft implementation pattern.

## Files Modified

1. ✅ `src/services/azureOpenAIRealtimeService.ts` - Complete rewrite with two-step auth
2. ✅ `src/vite-env.d.ts` - TypeScript definitions for new env variables
3. ✅ `.env.local` - Environment variables updated
4. ✅ `src/pages/index.tsx` - Fixed routing to use RealtimeAgentExperience

## Next Steps

1. **Test locally** following the testing checklist above
2. **Verify Azure deployment** name matches configuration
3. **Confirm region** matches Azure resource region
4. **Monitor console** for any errors during connection
5. **Test voice interaction** end-to-end

## Success Criteria

✅ Configuration logs show correct resource, deployment, API version, and region  
✅ Sessions API returns 200 with ephemeral key  
✅ WebRTC connection returns 200 with SDP answer  
✅ Microphone access granted  
✅ Data channel opens  
✅ Voice activity detection working  
✅ AI responds to voice/text input  

---

**Status:** Implementation complete, ready for testing  
**Blockers:** None - all code changes and configuration complete  
**Risk:** Low - pattern matches Microsoft's official working example
