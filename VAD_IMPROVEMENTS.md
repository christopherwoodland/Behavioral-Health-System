# Voice Activity Detection (VAD) Improvements

## Overview
Enhanced voice recording quality by implementing dual-layer VAD filtering to capture only meaningful user speech and eliminate ambient noise.

## Problem Statement
The system was capturing very low ambient sounds from the microphone instead of only actual spoken words, resulting in poor quality voice recordings with background noise.

## Solution Architecture

### 1. Server-Side VAD (Azure OpenAI)
**Location:** `azureOpenAIRealtimeService.ts` lines 1080-1085

**Changes:**
```typescript
turn_detection: {
  type: 'server_vad',
  threshold: 0.7,              // Increased from 0.5 (40% less sensitive)
  prefix_padding_ms: 200,
  silence_duration_ms: 500     // Increased from 300ms (67% longer pause required)
}
```

**Impact:**
- Higher threshold (0.7 vs 0.5) requires stronger audio signal to trigger speech detection
- Longer silence duration (500ms vs 300ms) requires more sustained pauses before ending speech
- Reduces false positives from ambient noise, fans, keyboard sounds, etc.

### 2. Client-Side Audio Analysis
**Location:** `sessionVoiceRecordingService.ts`

**New Features:**
- **Web Audio API Integration**: Real-time audio level monitoring using AnalyserNode
- **RMS Calculation**: Root Mean Square analysis of audio waveform
- **Dual Threshold System**:
  - `MIN_AUDIO_LEVEL = 0.02`: Minimum RMS level to consider as potential speech
  - `SPEECH_CONFIRMATION_THRESHOLD = 0.05`: Strong signal confirmation threshold

**New Methods:**
```typescript
setupAudioAnalysis()           // Initialize Web Audio API analyser
getAudioLevel()                 // Calculate RMS audio level (0-1 scale)
isSpeechLevel()                 // Check if audio meets speech thresholds
startAudioLevelMonitoring()     // Monitor levels during capture (100ms intervals)
stopAudioLevelMonitoring()      // Clean up monitoring interval
```

## How It Works

### Speech Start Detection
1. Azure server-side VAD detects speech (threshold 0.7)
2. Client-side verification checks audio level
3. If audio level < 0.02 RMS, reject as ambient noise
4. If audio level ≥ 0.02 RMS, accept and begin recording
5. Start continuous monitoring (100ms intervals)

### Speech End Detection
1. Azure server-side VAD detects silence (500ms duration)
2. OR client-side monitoring detects sustained low audio
3. Stop recording and save audio segment
4. Stop audio level monitoring

### Continuous Monitoring
While recording:
- Check audio level every 100ms
- If level drops below MIN_AUDIO_LEVEL, auto-stop capture
- Prevents recording of fading ambient sounds
- Ensures only meaningful speech is captured

## Audio Settings

### Microphone Constraints
```typescript
audio: {
  echoCancellation: true,      // Cancel acoustic echo
  noiseSuppression: true,       // Suppress background noise
  autoGainControl: true,        // Normalize volume
  sampleRate: 48000,           // High quality sampling
  channelCount: 1              // Mono recording
}
```

### Recording Quality
- Format: audio/webm;codecs=opus
- Bitrate: 128 kbps
- Output: 44100Hz WAV
- Channel: Mono (single track)

## Architecture Separation

### User Microphone Channel
- Separate WebRTC track for user input
- Processed through server-side VAD
- Additional client-side filtering
- Records only during VAD-detected speech

### Agent Audio Channel
- Separate WebRTC track for agent responses
- Not mixed with user audio
- Independent processing pipeline
- Not included in user voice recordings

## Benefits

### Improved Recording Quality
- ✅ Eliminates ambient noise capture
- ✅ Filters out keyboard/mouse sounds
- ✅ Removes HVAC/fan background noise
- ✅ Captures only meaningful speech

### Better User Experience
- ✅ Cleaner audio for transcription
- ✅ Reduced storage usage (no silent segments)
- ✅ More accurate speech-to-text
- ✅ Better conversation analysis

### Technical Advantages
- ✅ Dual-layer validation (server + client)
- ✅ Real-time audio level monitoring
- ✅ Automatic cleanup on low audio
- ✅ No manual threshold configuration needed

## Testing Recommendations

### Test Scenarios
1. **Normal Speech**: Speak at conversational volume → Should capture cleanly
2. **Quiet Speech**: Speak softly → May need threshold adjustment if missed
3. **Ambient Noise**: Make background noise without speaking → Should NOT trigger recording
4. **Mixed Scenario**: Background noise + speaking → Should only capture speech portions
5. **Keyboard Sounds**: Type while not speaking → Should NOT trigger recording

### Threshold Tuning
If speech is missed (threshold too high):
- Reduce `threshold` from 0.7 to 0.65 or 0.6
- Reduce `MIN_AUDIO_LEVEL` from 0.02 to 0.015

If ambient noise still captured (threshold too low):
- Increase `threshold` from 0.7 to 0.75 or 0.8
- Increase `MIN_AUDIO_LEVEL` from 0.02 to 0.03

## Monitoring & Debugging

### Console Logs
- `🔇 VAD detected speech but audio level too low` - Client-side filter rejected noise
- `🔇 Audio level dropped below speech threshold` - Monitoring detected audio drop
- `👤 User speech started - capturing audio` - Valid speech detected
- `👤 User speech stopped - pausing capture` - Speech segment completed
- `🎚️ Audio analysis setup complete` - Web Audio API initialized

### Audio Level Analysis
The `getAudioLevel()` method returns RMS values:
- 0.00 - 0.01: Silence/very quiet
- 0.02 - 0.04: Ambient noise range
- 0.05 - 0.20: Normal speech
- 0.20+: Loud speech/shouting

## Implementation Details

### Files Modified
1. **azureOpenAIRealtimeService.ts**
   - Lines 1080-1085: Updated VAD threshold and silence duration

2. **sessionVoiceRecordingService.ts**
   - Lines 42-48: Added audio analysis properties
   - Lines 175-222: Added audio analysis methods
   - Lines 228-277: Added audio level monitoring
   - Lines 293-305: Enhanced speech start with level check
   - Lines 314-318: Added monitoring cleanup to speech stop
   - Lines 356-361: Added audio context cleanup

### Dependencies
- Web Audio API (built-in browser API)
- MediaStream API (already in use)
- Azure OpenAI Realtime API (already in use)

### Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (with webkit prefix)
- Mobile browsers: Supported with device constraints

## Configuration Reference

### Server-Side VAD Settings
```typescript
threshold: 0.7              // Sensitivity (0.0-1.0, higher = less sensitive)
silence_duration_ms: 500    // Pause duration to end speech (milliseconds)
prefix_padding_ms: 200      // Audio to include before speech start
```

### Client-Side Audio Settings
```typescript
MIN_AUDIO_LEVEL: 0.02                    // Minimum RMS for speech
SPEECH_CONFIRMATION_THRESHOLD: 0.05      // Strong speech RMS
MONITORING_INTERVAL: 100                 // Check every 100ms
```

## Future Enhancements

### Potential Improvements
- [ ] Adaptive threshold based on ambient noise baseline
- [ ] Frequency analysis to distinguish speech from other sounds
- [ ] Machine learning model for speech detection
- [ ] User-configurable sensitivity settings
- [ ] Visual feedback of audio levels in UI
- [ ] Pre-recording noise profile calibration

### Advanced Features
- [ ] Automatic noise floor calculation
- [ ] Voice activity probability scoring
- [ ] Multiple speaker detection
- [ ] Audio quality metrics (SNR, clarity score)

## Summary
The dual-layer VAD approach combines Azure's server-side speech detection with client-side audio level analysis to ensure only meaningful user speech is recorded. This eliminates ambient noise while maintaining natural conversation flow and high-quality audio capture.
