# Kintsugi Recording Improvements

## Changes Made (October 27, 2025)

### Issues Fixed

1. **Recording clock starts too quickly** ✅
   - Previously: Recording started immediately when Jekyll called the tool
   - Now: Recording waits for Jekyll to finish speaking before starting the clock

2. **Jekyll responds during recording** ✅
   - Previously: Turn detection (VAD) remained active, causing Jekyll to respond to user speech
   - Now: Turn detection is disabled during recording, then re-enabled after completion

---

## Implementation Details

### 1. Wait for Agent to Finish Speaking

**File**: `RealtimeAgentExperience.tsx`

**Changes**:
- Added check for `speechDetection.isAISpeaking` before starting recording
- If Jekyll is speaking, polls every 100ms until speech ends
- Shows "Waiting for agent to finish..." indicator in UI
- Safety timeout after 10 seconds (starts anyway if agent still speaking)

**Code Flow**:
```
Tool called → Check if Jekyll speaking
     ↓
If speaking → Show "Waiting..." indicator
     ↓
Poll every 100ms → Wait for isAISpeaking = false
     ↓
Jekyll finished → Start recording immediately
```

### 2. Disable Turn Detection During Recording

**File**: `RealtimeAgentExperience.tsx`

**Changes**:
- Call `agentService.disableTurnDetection()` when recording starts
- Call `agentService.enableTurnDetection()` when recording completes or errors
- Prevents Jekyll from responding to user speech during the 30-second sample

**Code Flow**:
```
Start recording → Disable turn detection
     ↓
User speaks for 30s → Jekyll remains silent
     ↓
Recording complete → Re-enable turn detection
     ↓
Jekyll can respond again
```

### 3. Added Waiting State

**File**: `kintsugiVoiceRecordingService.ts`

**Type Change**:
```typescript
export interface KintsugiRecordingProgress {
  isRecording: boolean;
  duration: number;
  hasMinimumDuration: boolean;
  isSaving: boolean;
  isWaitingForAgent?: boolean; // NEW
  error?: string;
}
```

### 4. Updated UI Indicators

**File**: `RealtimeAgentExperience.tsx`

**New Indicator**:
```tsx
{kintsugiRecording?.isWaitingForAgent && (
  <div className="flex items-center space-x-1 text-blue-600">
    <div className="animate-pulse">⏸️</div>
    <span>Waiting for agent to finish...</span>
  </div>
)}
```

---

## User Experience Flow

### Before (Issues)
```
Jekyll: "Please tell me about your day..."
[Recording clock starts immediately at 0s]
User: "Well, I woke up and—"
Jekyll: [Interrupts] "I hear you're having a day..."
❌ Recording ruined by Jekyll interrupting
```

### After (Fixed)
```
Jekyll: "Please tell me about your day..."
[UI shows: "Waiting for agent to finish..." ⏸️]
[Jekyll finishes speaking]
[Recording clock starts at 0s]
User: "Well, I woke up and had breakfast..."
[Jekyll stays silent - turn detection disabled]
User: [Speaks for 30 seconds uninterrupted]
[Clock reaches 30s, turns green]
[Recording auto-stops, uploads to Azure]
[Turn detection re-enabled]
Jekyll: "Thank you! Your voice sample has been saved."
✅ Clean 30-second recording achieved
```

---

## Technical Details

### Turn Detection Control

The Azure OpenAI Realtime API provides session update commands:

**Disable**:
```typescript
agentService.disableTurnDetection();
// Sends: { type: 'session.update', session: { turn_detection: null } }
```

**Enable**:
```typescript
agentService.enableTurnDetection();
// Sends: { type: 'session.update', session: { 
//   turn_detection: { 
//     type: 'server_vad', 
//     threshold: 0.7, 
//     prefix_padding_ms: 200, 
//     silence_duration_ms: 500 
//   }
// }}
```

### Speech Detection State

Uses existing `speechDetection` state from `azureOpenAIRealtimeService`:

```typescript
interface SpeechDetectionState {
  isUserSpeaking: boolean;
  isAISpeaking: boolean; // ← Used for waiting logic
}
```

Updated by WebRTC events:
- `response.audio.delta` → `isAISpeaking = true`
- `conversation.item.audio_transcription.completed` → `isAISpeaking = false`

### Error Handling

Turn detection is re-enabled in all exit paths:
- ✅ Successful recording completion
- ✅ Recording error/failure
- ✅ User cancellation
- ✅ Timeout scenarios

---

## Testing Checklist

### Basic Flow
- [ ] Jekyll requests Kintsugi sample
- [ ] UI shows "Waiting for agent to finish..." (blue indicator)
- [ ] Wait for Jekyll to finish speaking
- [ ] "Waiting..." indicator disappears
- [ ] Recording starts (red dot, "Voice Sample: 0s / 30s")
- [ ] User speaks for 30 seconds
- [ ] Jekyll does NOT respond during recording
- [ ] Counter reaches 30s (turns green)
- [ ] Auto-stops after ~32s
- [ ] "Saving sample..." appears
- [ ] Upload completes successfully
- [ ] Jekyll can respond again after recording

### Edge Cases
- [ ] What if Jekyll is still speaking after 10s? → Recording starts anyway
- [ ] What if recording fails? → Turn detection re-enabled
- [ ] What if user stops speaking early? → Turn detection re-enabled
- [ ] What if network upload fails? → Turn detection re-enabled

### Verification
- [ ] Console logs show: "🔇 Disabling turn detection for Kintsugi recording..."
- [ ] Console logs show: "🔊 Re-enabling turn detection..."
- [ ] Jekyll stays silent during 30-second recording
- [ ] File uploaded successfully to Azure
- [ ] Jekyll can respond normally after recording completes

---

## Files Modified

1. **`RealtimeAgentExperience.tsx`**
   - Updated `handleKintsugiRecordingRequest` with waiting logic
   - Added turn detection disable/enable calls
   - Added "Waiting for agent..." UI indicator
   - Updated useCallback dependencies

2. **`kintsugiVoiceRecordingService.ts`**
   - Added `isWaitingForAgent?: boolean` to `KintsugiRecordingProgress` interface

---

## Console Logs to Expect

### Successful Recording
```
🎙️ ========================================
🎙️ KINTSUGI RECORDING REQUEST
🎙️ ========================================
⏳ Waiting for Jekyll to finish speaking before starting recording...
✅ Jekyll finished speaking, starting recording now...
🔇 Disabling turn detection for Kintsugi recording...
✅ Kintsugi recording started
✅ Minimum duration (30s) reached
🛑 Auto-stopping Kintsugi recording...
✅ Kintsugi recording saved: https://...blob.core.windows.net/.../kintsugi_...wav
🔊 Re-enabling turn detection...
```

### If Jekyll Already Finished
```
🎙️ KINTSUGI RECORDING REQUEST
✅ Jekyll not speaking, starting recording immediately...
🔇 Disabling turn detection for Kintsugi recording...
✅ Kintsugi recording started
[... rest same as above ...]
```

---

## Benefits

1. **Clean Recordings**: No interruptions from Jekyll during sample collection
2. **Natural Timing**: Recording starts after Jekyll's prompt completes
3. **Better UX**: Clear visual feedback ("Waiting..." → Recording → Saving)
4. **Robust Error Handling**: Turn detection always restored
5. **Accessibility**: Screen reader announces state changes

---

## Summary

The Kintsugi recording feature now properly:
1. ⏳ Waits for Jekyll to finish speaking before starting the timer
2. 🔇 Silences Jekyll during the 30-second recording period
3. 🔊 Re-enables Jekyll's responses after recording completes
4. 📊 Provides clear visual feedback at each stage

These improvements ensure clean, uninterrupted voice samples suitable for Kintsugi vocal biomarker analysis.
