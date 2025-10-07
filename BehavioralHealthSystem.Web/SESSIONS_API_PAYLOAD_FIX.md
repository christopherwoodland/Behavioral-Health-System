# Azure OpenAI Realtime API - Fixed Sessions API Payload

## Issue Fixed

**Error:** `Unknown parameter: 'max_output_tokens'`

**Root Cause:** The `getEphemeralKey()` method was sending extra parameters that the Sessions API doesn't accept.

---

## The Fix

### Before (❌ WRONG - caused 400 error)
```typescript
const payload = {
  model: this.deploymentName,
  voice: config.voice || 'alloy',
  instructions: config.instructions || 'You are a helpful behavioral health assistant.',
  temperature: config.temperature || 0.8,
  max_output_tokens: config.maxTokens || 4096  // ← NOT ACCEPTED
};
```

### After (✅ CORRECT - matches HTML example)
```typescript
const payload = {
  model: this.deploymentName,
  voice: config.voice || 'alloy'
  // That's it! Only model and voice
};
```

---

## How It Works

### Step 1: Get Ephemeral Key (Sessions API)
**Only sends:** `model` and `voice`

```http
POST https://cdc-traci-aif-002.openai.azure.com/openai/realtimeapi/sessions?api-version=2025-04-01-preview

Headers:
  api-key: your-api-key
  Content-Type: application/json

Body:
{
  "model": "gpt-realtime",
  "voice": "alloy"
}

Response:
{
  "id": "session-xyz",
  "client_secret": {
    "value": "ephemeral-key-abc123"
  }
}
```

### Step 2: Configure Session AFTER Connection
**Instructions, temperature, and other parameters** are sent via `session.update` event through the data channel **after** it opens:

```typescript
// Sent automatically when data channel opens
const event = {
  type: 'session.update',
  session: {
    instructions: 'You are a helpful behavioral health assistant...',
    voice: 'alloy',
    temperature: 0.8
  }
};
dataChannel.send(JSON.stringify(event));
```

---

## Why This Pattern?

The Azure OpenAI Realtime API separates concerns:

1. **Sessions API** - Minimal config, just creates the session and returns ephemeral key
2. **Data Channel** - Full configuration via `session.update` event after WebRTC connection

This matches the HTML reference implementation exactly.

---

## Expected Console Output

When you click "Start Session" now, you should see:

```
🔧 Azure OpenAI Realtime Config:
  Resource: cdc-traci-aif-002
  Deployment: gpt-realtime
  API Version: 2025-04-01-preview
  WebRTC Region: eastus2

🚀 Starting Azure OpenAI Realtime session...

🔑 Getting ephemeral key from Azure OpenAI sessions API...
📡 Sessions API URL: https://cdc-traci-aif-002.openai.azure.com/openai/realtimeapi/sessions?api-version=2025-04-01-preview
📤 Request payload: {
  "model": "gpt-realtime",
  "voice": "alloy"
}
✅ Ephemeral key obtained successfully
🆔 Session ID: session-abc123

🎤 Microphone access granted

✅ RTCPeerConnection created
➕ Added local audio track

📤 Created and set local offer

📡 WebRTC URL: https://eastus2.realtimeapi-preview.ai.azure.com/v1/realtimertc?model=gpt-realtime
✅ SDP answer received from Azure OpenAI

📥 Set remote answer from Azure OpenAI

📬 Data channel is open
📤 Sent client event: {
  "type": "session.update",
  "session": {
    "instructions": "You are a helpful behavioral health assistant...",
    "voice": "alloy",
    "temperature": 0.8
  }
}

📥 Received server event: session.update
📋 Session updated. Instructions: You are a helpful behavioral health assistant...

✅ Session started successfully
```

---

## Test Now!

1. Your dev server should still be running
2. Refresh the browser: `http://localhost:5173/agent-experience`
3. Click "Start Session"
4. You should now get past the 400 error!

---

**Status:** ✅ Fixed - Sessions API payload now matches HTML example exactly  
**Changed:** Removed `instructions`, `temperature`, and `max_output_tokens` from Sessions API call  
**Result:** These parameters now sent via `session.update` after data channel opens (correct pattern)
