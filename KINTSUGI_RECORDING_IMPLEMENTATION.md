# Kintsugi Voice Recording for Jekyll Agent

## Overview
This implementation provides Jekyll agent with the ability to capture at least 30 seconds of continuous user speech specifically for downstream Kintsugi voice biomarker analysis.

## Architecture

### Components Created

1. **`kintsugiVoiceRecordingService.ts`** - Dedicated recording service
   - Location: `BehavioralHealthSystem.Web/src/services/`
   - Purpose: High-quality audio capture with 30-second minimum requirement
   - Features:
     - Enforces 30-second minimum duration
     - High-quality audio (128kbps, 48kHz → 44.1kHz WAV)
     - Real-time progress tracking
     - Automatic Azure Blob Storage upload
     - Kintsugi-ready file naming: `kintsugi_{userId}_{sessionId}_{timestamp}.wav`

2. **`request-kintsugi-voice-sample` Tool** - Jekyll agent tool
   - Location: Added to `jekyllAgent.ts`
   - Purpose: Allows Jekyll to request voice samples for Kintsugi analysis
   - Triggers: Recording controlled by UI in response to tool call

## Implementation Methods

### Method 1: Agent-Requested Recording (Recommended)

**How it works:**
1. Jekyll completes conversational PHQ assessment
2. Jekyll decides if additional vocal biomarker analysis would be helpful
3. Jekyll calls `request-kintsugi-voice-sample` tool with an engaging prompt
4. UI detects tool call and starts `kintsugiVoiceRecordingService`
5. User speaks for 30+ seconds in response to prompt
6. Recording auto-saves to Azure with Kintsugi metadata

**Advantages:**
- Agent controls when to request recording
- Natural conversation flow
- User is given clear context/prompt
- Optional - only requested when beneficial

**Implementation Steps:**

#### Step 1: Add UI Handler in RealtimeAgentExperience.tsx

```typescript
import { kintsugiVoiceRecordingService, KintsugiRecordingProgress } from '@/services/kintsugiVoiceRecordingService';

// Add state
const [kintsugiRecording, setKintsugiRecording] = useState<KintsugiRecordingProgress | null>(null);

// Add handler for Kintsugi tool response
const handleKintsugiRecordingRequest = async (toolResult: any) => {
  if (toolResult.action === 'start-kintsugi-recording') {
    console.log('🎙️ Starting Kintsugi recording with prompt:', toolResult.prompt);
    
    const sessionId = toolResult.sessionId;
    const assessmentId = toolResult.assessmentId;
    
    try {
      // Start recording with progress callback
      await kintsugiVoiceRecordingService.startRecording(
        sessionId,
        assessmentId,
        (progress) => {
          setKintsugiRecording(progress);
          
          // Auto-stop after 30 seconds minimum is reached
          if (progress.hasMinimumDuration && progress.isRecording) {
            console.log('✅ Minimum duration reached, stopping recording');
            setTimeout(async () => {
              const result = await kintsugiVoiceRecordingService.stopRecording(
                sessionId,
                authenticatedUserId || getUserId(),
                assessmentId
              );
              if (result) {
                console.log('✅ Kintsugi recording saved:', result.audioUrl);
                // Optionally notify agent that recording is complete
              }
            }, 1000); // Allow a bit more speech
          }
        }
      );
    } catch (error) {
      console.error('❌ Failed to start Kintsugi recording:', error);
      setKintsugiRecording({
        isRecording: false,
        duration: 0,
        hasMinimumDuration: false,
        isSaving: false,
        error: error instanceof Error ? error.message : 'Failed to start recording'
      });
    }
  }
};

// Update function call handler to detect Kintsugi requests
// In your existing onFunctionCallCallback or tool handler:
if (functionName === 'request-kintsugi-voice-sample') {
  const result = await agentOrchestrationService.handleToolCall(functionName, args);
  if (result.result.action === 'start-kintsugi-recording') {
    await handleKintsugiRecordingRequest(result.result);
  }
  return result.result;
}
```

#### Step 2: Add UI Indicator

```typescript
{/* Kintsugi Recording Indicator */}
{kintsugiRecording?.isRecording && (
  <div className="flex items-center gap-2 text-sm">
    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
    <span className={kintsugiRecording.hasMinimumDuration ? 'text-green-600' : 'text-red-600'}>
      Recording for Kintsugi: {kintsugiRecording.duration}s / 30s
    </span>
  </div>
)}

{kintsugiRecording?.isSaving && (
  <div className="flex items-center gap-2 text-sm text-yellow-600">
    <div className="animate-spin">⏳</div>
    <span>Saving Kintsugi sample...</span>
  </div>
)}

{kintsugiRecording?.error && (
  <div className="flex items-center gap-2 text-sm text-red-600">
    <span>⚠️ {kintsugiRecording.error}</span>
  </div>
)}
```

### Method 2: Automatic Recording During Jekyll Session

**How it works:**
1. Recording starts automatically when Jekyll agent becomes active
2. Continuously records all user speech during Jekyll conversation
3. After 30 seconds of accumulated speech, save to Azure
4. Uses existing session-wide recording infrastructure with Kintsugi metadata

**Advantages:**
- Fully automatic - no user/agent action required
- Captures natural conversational speech
- No explicit prompt needed

**Implementation:**

Modify `RealtimeAgentExperience.tsx` to start Kintsugi recording on Jekyll activation:

```typescript
// In performAgentSwitch function when switching TO Jekyll:
if (targetAgent.id === 'Agent_Jekyll') {
  const currentSession = chatTranscriptService.getCurrentTranscript()?.sessionId;
  const currentAssessment = jekyllContext?.assessmentId; // If accessible
  
  try {
    await kintsugiVoiceRecordingService.startRecording(
      currentSession!,
      currentAssessment,
      (progress) => {
        setKintsugiRecording(progress);
        
        // Auto-save after 30 seconds
        if (progress.hasMinimumDuration && progress.isRecording) {
          kintsugiVoiceRecordingService.stopRecording(
            currentSession!,
            authenticatedUserId || getUserId(),
            currentAssessment,
            true // upload to blob
          );
        }
      }
    );
  } catch (error) {
    console.error('Failed to start Kintsugi recording:', error);
  }
}

// When switching AWAY from Jekyll, stop and save:
if (currentAgent?.id === 'Agent_Jekyll' && kintsugiVoiceRecordingService.isRecording()) {
  await kintsugiVoiceRecordingService.stopRecording(
    sessionId,
    userId,
    assessmentId
  );
}
```

## Recording Configuration

### Audio Settings
```typescript
{
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,     // Capture at 48kHz
  channelCount: 1        // Mono for voice
}
```

### Output Format
- **File Format**: WAV (converted from WebM/Opus)
- **Sample Rate**: 44100Hz (Kintsugi standard)
- **Channels**: Mono
- **Bit Rate**: 128kbps (high quality)
- **Naming**: `kintsugi_{userId}_{sessionId}_{timestamp}.wav`

### Storage Location
- **Container**: `audio-uploads`
- **Path**: `users/{userId}/audio/kintsugi_{userId}_{sessionId}_{timestamp}.wav`

## Usage Example (Jekyll Agent)

```typescript
// Jekyll decides to request voice sample after assessment
const result = await requestKintsugiVoiceSample({
  prompt: "Tell me about what a typical day looks like for you. Please speak naturally for about 30 seconds.",
  userId: "user123"
});

// Result triggers UI recording:
// {
//   success: true,
//   action: 'start-kintsugi-recording',
//   prompt: "Tell me about...",
//   sessionId: "session-xyz",
//   assessmentId: "assessment-abc",
//   message: "Recording will start when you begin speaking..."
// }
```

## Error Handling

### Common Errors

1. **Microphone Permission Denied**
   ```
   Error: "Microphone permission denied"
   Solution: User must grant permission in browser
   ```

2. **Recording Too Short**
   ```
   Warning: "Recording too short (15s). Need at least 30 seconds."
   Solution: Ensure user speaks for full 30 seconds
   ```

3. **No Active Session**
   ```
   Error: "No active session found"
   Solution: Only request recording during active Jekyll session
   ```

## Testing Checklist

- [ ] Recording starts when tool is called
- [ ] UI shows duration counter (0s → 30s)
- [ ] Text turns green when 30s reached
- [ ] Recording auto-saves after 30s
- [ ] File appears in Azure Blob Storage
- [ ] Filename format: `kintsugi_{userId}_{sessionId}_{timestamp}.wav`
- [ ] File is 44.1kHz WAV mono
- [ ] Audio quality is clear
- [ ] Works with both Chrome and Firefox
- [ ] Error handling for no microphone
- [ ] Error handling for permission denied
- [ ] Progress indicator updates every second

## Environment Variables

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:7071/api  # Or production URL
VITE_ENABLE_JEKYLL_AGENT=true
```

## API Integration

### Kintsugi API Submission (Future Enhancement)

After recording is saved to Azure, you can submit to Kintsugi API:

```typescript
// Example: Submit to Kintsugi for analysis
const kintsugiResult = await fetch('https://api.kintsugi.health/v1/analyze', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${KINTSUGI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    audioUrl: result.audioUrl,
    userId: userId,
    assessmentId: assessmentId,
    metadata: {
      sessionId: sessionId,
      duration: result.duration,
      timestamp: result.timestamp
    }
  })
});

const analysis = await kintsugiResult.json();
// analysis contains: depression risk, anxiety indicators, vocal biomarkers, etc.
```

## Advantages Over Session-Wide Recording

| Feature | Kintsugi Recording | Session-Wide Recording |
|---------|-------------------|----------------------|
| **Purpose** | Specific 30s+ sample for biomarker analysis | Capture all conversation |
| **Duration Control** | Enforces 30s minimum | Captures entire session |
| **File Naming** | `kintsugi_*` prefix for easy identification | `userId_sessionId_*` |
| **Trigger** | Agent-requested or automatic | Automatic on session start |
| **Use Case** | Kintsugi API submission | Conversation transcription |
| **Metadata** | Kintsugi-specific tags | General session data |

## Recommended Approach

**Use Method 1 (Agent-Requested)** for most scenarios:
- Gives Jekyll control over when to request sample
- Natural conversation flow
- User gets clear context via prompt
- Optional - only when beneficial
- Better user experience

**Use Method 2 (Automatic)** only if:
- You want to capture speech passively
- User experience doesn't matter as much
- You're doing research/analysis on all Jekyll sessions

## Future Enhancements

1. **Real-time Kintsugi Analysis**
   - Submit audio to Kintsugi API immediately after recording
   - Display biomarker results to Jekyll for enhanced assessment

2. **Multiple Samples**
   - Allow Jekyll to request multiple 30s samples
   - Compare vocal patterns across different prompts

3. **Waveform Visualization**
   - Show audio waveform during recording
   - Help user see they're speaking loud enough

4. **Quality Validation**
   - Check audio levels in real-time
   - Warn if too quiet or distorted

5. **Offline Support**
   - Save recording locally if offline
   - Upload to Azure when connection restored

## Related Files

- `kintsugiVoiceRecordingService.ts` - Core recording service
- `jekyllAgent.ts` - Jekyll agent with Kintsugi tool
- `RealtimeAgentExperience.tsx` - UI integration point
- `azure.ts` - Azure Blob Storage upload
- `sessionVoiceRecordingService.ts` - Session-wide recording (comparison)

## Troubleshooting

### Recording Not Starting
1. Check browser console for errors
2. Verify microphone permission granted
3. Ensure Jekyll agent tool is registered
4. Check UI handler is wired correctly

### Audio Quality Issues
1. Test microphone with system tools
2. Check browser audio settings
3. Verify sample rate conversion (48kHz → 44.1kHz)
4. Download file from Azure and test locally

### Upload Failures
1. Check Azure SAS token in `.env`
2. Verify storage account accessible
3. Check network connectivity
4. Review Azure Blob Storage logs

## Summary

This implementation provides Jekyll with a sophisticated method to capture high-quality voice samples specifically for Kintsugi vocal biomarker analysis. The agent can intelligently request samples when beneficial, and the system ensures proper recording duration, quality, and storage for downstream Kintsugi API integration.
