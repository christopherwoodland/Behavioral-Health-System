# Agent Experience - WebRTC Voice Capture Reference

## Overview
The Agent Experience uses **native browser Web APIs** for voice capture - NO SignalR, NO backend audio processing. Everything happens directly between your browser and Azure OpenAI via WebRTC.

## Voice Capture Technology Stack

### 1. **getUserMedia API** (Microphone Access)
```typescript
// Location: src/services/azureOpenAIRealtimeService.ts
const constraints: MediaStreamConstraints = {
  audio: {
    echoCancellation: true,      // Removes echo feedback
    noiseSuppression: true,       // Filters background noise
    autoGainControl: true,        // Normalizes volume levels
    sampleRate: 24000,           // Azure OpenAI recommended rate
  },
  video: false
};

this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
```

**What it does:**
- Native browser API (supported in Chrome, Edge, Firefox, Safari)
- Requests microphone permission from user
- Returns a `MediaStream` with audio tracks
- Applies audio processing (echo cancellation, noise reduction)

### 2. **Web Audio API** (Voice Activity Detection)
```typescript
// Location: src/services/azureOpenAIRealtimeService.ts
this.audioContext = new AudioContext({ sampleRate: 24000 });
this.analyser = this.audioContext.createAnalyser();
this.analyser.fftSize = 2048;

this.microphoneSource = this.audioContext.createMediaStreamSource(this.localStream);
this.microphoneSource.connect(this.analyser);

// Analyze audio levels every 50ms
const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
this.analyser.getByteTimeDomainData(dataArray);

// Calculate volume level (0-1)
const volumeLevel = Math.max(...dataArray) / 255;
```

**What it does:**
- Creates audio processing graph
- Connects microphone stream to analyzer
- Performs real-time frequency analysis
- Detects voice activity based on volume threshold
- Updates UI visualizer with volume levels

### 3. **RTCPeerConnection** (WebRTC Audio Streaming)
```typescript
// Location: src/services/azureOpenAIRealtimeService.ts
this.peerConnection = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
});

// Add local audio tracks to connection
this.localStream.getTracks().forEach(track => {
  this.peerConnection!.addTrack(track, this.localStream!);
});

// Receive remote audio from AI
this.peerConnection.ontrack = (event) => {
  this.remoteStream = event.streams[0];
  this.playRemoteAudio();
};
```

**What it does:**
- Establishes peer-to-peer connection between browser and Azure OpenAI
- Streams audio directly to Azure (no backend involvement)
- Receives AI voice responses in real-time
- Plays AI audio through browser's audio output

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                             │
│                                                             │
│  ┌─────────────────┐         ┌──────────────────┐         │
│  │  Microphone     │────────▶│  getUserMedia    │         │
│  │  (Hardware)     │         │  (Capture)       │         │
│  └─────────────────┘         └────────┬─────────┘         │
│                                       │                     │
│                                       ▼                     │
│                              ┌──────────────────┐          │
│                              │  MediaStream     │          │
│                              │  (Audio Track)   │          │
│                              └────────┬─────────┘          │
│                                       │                     │
│                      ┌────────────────┴──────────────┐     │
│                      │                                │     │
│                      ▼                                ▼     │
│          ┌──────────────────┐           ┌─────────────────┐│
│          │  Web Audio API   │           │ RTCPeerConnection││
│          │  (Analyser)      │           │ (WebRTC Stream) ││
│          └────────┬─────────┘           └────────┬────────┘│
│                   │                               │         │
│                   ▼                               │         │
│          ┌──────────────────┐                    │         │
│          │  Voice Activity  │                    │         │
│          │  Detection       │                    │         │
│          │  (Volume Level)  │                    │         │
│          └────────┬─────────┘                    │         │
│                   │                               │         │
│                   ▼                               │         │
│          ┌──────────────────┐                    │         │
│          │  UI Visualizer   │                    │         │
│          └──────────────────┘                    │         │
│                                                   │         │
└───────────────────────────────────────────────────┼─────────┘
                                                    │
                                                    │ WebRTC
                                                    │ (Direct)
                                                    │
                                          ┌─────────▼─────────┐
                                          │  Azure OpenAI     │
                                          │  Realtime API     │
                                          │  (gpt-realtime)   │
                                          └───────────────────┘
```

## No Backend Involvement

### ❌ What We DON'T Use:
- ❌ **SignalR** - No WebSocket connections to backend
- ❌ **C# Backend Audio Processing** - No server-side transcription
- ❌ **Azure Speech Services** - Not needed for Realtime API
- ❌ **Intermediate Servers** - Direct browser-to-Azure connection

### ✅ What We DO Use:
- ✅ **Browser Native APIs** - getUserMedia, Web Audio API, RTCPeerConnection
- ✅ **Azure OpenAI Realtime API** - Direct WebRTC endpoint
- ✅ **Client-Side Processing** - Voice activity detection in browser
- ✅ **Environment Variables** - Configuration only (endpoint, API key)

## Configuration

### Environment Variables (`.env.local`)
```bash
# Base URL only (service appends path and params)
VITE_AZURE_OPENAI_REALTIME_ENDPOINT=https://cdc-traci-aif-002.cognitiveservices.azure.com

# API key for authentication
VITE_AZURE_OPENAI_REALTIME_KEY=<your-api-key>

# Deployment name
VITE_AZURE_OPENAI_REALTIME_DEPLOYMENT=gpt-realtime

# API version
VITE_AZURE_OPENAI_API_VERSION=2024-10-01-preview
```

**Important:** 
- Endpoint should be **base URL only** (no `/openai/realtime` path)
- Service automatically constructs full URL: `{endpoint}/openai/realtime?api-version={version}&deployment={deployment}`

## Troubleshooting

### Error: "Microphone access denied"
**Cause:** User denied microphone permission or browser blocked access

**Solution:**
1. Check browser address bar for microphone icon
2. Click and allow microphone access
3. Refresh page and try again

### Error: "WebRTC is not supported"
**Cause:** Browser doesn't support WebRTC

**Solution:**
- Use modern browser: Chrome 80+, Edge 80+, Firefox 75+, Safari 14+
- Update browser to latest version

### Error: "Azure OpenAI API error: 401"
**Cause:** Invalid API key or endpoint

**Solution:**
1. Verify `VITE_AZURE_OPENAI_REALTIME_KEY` is correct
2. Ensure endpoint is base URL only (no path or query params)
3. Check deployment name matches Azure OpenAI resource

### Error: "Connection error"
**Cause:** Network issue or incorrect configuration

**Solution:**
1. Check internet connection
2. Verify endpoint URL format: `https://<resource>.cognitiveservices.azure.com`
3. Ensure API version is supported: `2024-10-01-preview`
4. Check browser console for detailed error messages

## Testing Voice Capture

### 1. Check Microphone Permission
```javascript
// Run in browser console
navigator.mediaDevices.enumerateDevices().then(devices => {
  console.log('Audio inputs:', devices.filter(d => d.kind === 'audioinput'));
});
```

### 2. Test getUserMedia
```javascript
// Run in browser console
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    console.log('✅ Microphone access granted');
    console.log('Audio tracks:', stream.getAudioTracks());
    stream.getTracks().forEach(t => t.stop()); // Cleanup
  })
  .catch(err => console.error('❌ Microphone error:', err));
```

### 3. Monitor Voice Activity
- Start session in Agent Experience
- Speak into microphone
- Watch for green microphone icon (indicates voice detected)
- Check voice activity visualizer animation
- Look for volume level changes in the circular animation

## Performance Characteristics

### Latency
- **Microphone to Browser:** ~10-20ms (hardware)
- **Browser to Azure:** ~50-100ms (network, depends on location)
- **Azure Processing:** ~200-500ms (AI response generation)
- **Total Round-Trip:** ~300-700ms (excellent for real-time)

### Bandwidth Usage
- **Audio Upstream:** ~24 kbps (24kHz mono PCM)
- **Audio Downstream:** ~24 kbps (AI voice response)
- **Data Channel:** <1 kbps (text messages and control)
- **Total:** ~50 kbps during active conversation

### CPU Usage
- **Voice Activity Detection:** <5% CPU (Web Audio API)
- **WebRTC Encoding/Decoding:** ~5-10% CPU
- **UI Rendering:** <5% CPU
- **Total:** ~15-20% CPU on modern hardware

## References

### Browser APIs
- [getUserMedia API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [RTCPeerConnection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection)

### Azure OpenAI
- [Realtime Audio Quickstart](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/realtime-audio-quickstart)
- [Realtime Audio WebRTC Guide](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/realtime-audio-webrtc)
- [API Reference](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/realtime-audio-reference)

## Summary

✅ **Voice capture uses browser native Web APIs:**
- `navigator.mediaDevices.getUserMedia()` - Microphone access
- `AudioContext` & `AnalyserNode` - Voice activity detection
- `RTCPeerConnection` - Direct WebRTC streaming to Azure

✅ **No SignalR, no backend audio processing**

✅ **Configuration fixed:** Endpoint should be base URL only

✅ **Testing:** Check browser console for detailed WebRTC logs
