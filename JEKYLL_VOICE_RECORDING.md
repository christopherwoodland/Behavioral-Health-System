# Jekyll Agent Voice Recording Feature

## Overview
The Jekyll agent now automatically records user speech during conversations. Recordings are saved to Azure Blob Storage in the `audio-uploads` container with the same naming pattern as the UploadAnalyze page.

## Key Features
- **Automatic Recording**: Starts when Jekyll agent becomes active
- **Minimum Duration**: Requires 45 seconds of uninterrupted speech
- **High Quality**: 128kbps bitrate, 48000Hz sample rate, converted to 44100Hz WAV
- **Audio Processing**: Echo cancellation, noise suppression, auto gain control
- **Azure Storage**: Uploads to `audio-uploads` container with naming: `${userId}_${sessionId}_${timestamp}.wav`
- **UI Indicators**: Shows recording status, duration, and saving state
- **Auto-Stop**: Automatically stops and saves after 45 seconds

## Implementation Details

### New Service: `jekyllVoiceRecordingService.ts`
Location: `BehavioralHealthSystem.Web/src/services/jekyllVoiceRecordingService.ts`

**Key Methods:**
- `startRecording(sessionId, userId, onProgress)` - Starts recording with progress callbacks
- `stopRecording(uploadToBlob)` - Stops recording, converts to WAV, uploads to Azure
- `cancelRecording()` - Aborts recording without saving
- `getCurrentDuration()` - Gets current recording duration in seconds
- `hasMinimumDuration()` - Checks if 30+ seconds recorded

**Audio Settings:**
- MIME type: `audio/webm;codecs=opus` (with fallbacks)
- Bitrate: 128kbps (`audioBitsPerSecond`)
- Sample rate: 48000Hz (microphone) → 44100Hz (WAV output)
- Channels: Mono (`channelCount: 1`)
- Features: Echo cancellation, noise suppression, auto gain control

**Progress Tracking:**
- Updates every 1 second via callback
- Tracks duration and minimum duration threshold (45s)
- Provides `RecordingProgress` object with:
  - `isRecording`: Recording active
  - `duration`: Seconds recorded
  - `hasMinimumDuration`: True when >= 45 seconds
  - `isSaving`: True when converting/uploading
  - `error`: Error message if failed

### Integration: `RealtimeAgentExperience.tsx`
Location: `BehavioralHealthSystem.Web/src/pages/RealtimeAgentExperience.tsx`

**Changes:**
1. Import `jekyllVoiceRecordingService` and `RecordingProgress` type
2. Add state: `const [jekyllRecording, setJekyllRecording] = useState<RecordingProgress | null>(null)`
3. Start recording when Jekyll agent becomes active (in `performAgentSwitch` function)
4. Auto-stop recording after 30 seconds with upload
5. Stop recording when switching away from Jekyll (saves to Azure)
6. Cleanup recording on session end
7. UI indicator shows recording status in agent header

**Recording Lifecycle:**
1. **Jekyll Activated**: `startRecording()` called with sessionId and userId
2. **Progress Updates**: Every 1 second, UI updated with duration
3. **Minimum Duration Reached**: After 45 seconds, auto-stops and uploads
4. **Agent Switch**: If user switches agents, recording saves to Azure
5. **Session End**: Recording cleaned up in `cleanup()` function

## UI Indicators

### Recording Status (Agent Header)
- **Red Dot + "Recording: Xs / 30s"**: Active recording, shows progress
  - Text color changes to green when 30s reached
- **Yellow Spinner + "Saving..."**: Converting to WAV and uploading to Azure
- **Red Triangle + Error Message**: Recording/upload failed

## File Storage

### Azure Blob Storage
- **Container**: `audio-uploads`
- **Path**: `users/${userId}/audio/${fileName}`
- **Naming**: `${userId}_${sessionId}_${timestamp}.wav`
- **Format**: 44100Hz WAV (mono channel)

### Example Filename
```
user123_session456_1704067200000.wav
```

## Error Handling

### Microphone Permission Denied
- Error: "Microphone permission denied"
- User must grant permission in browser settings

### No Microphone Available
- Error: "No microphone found"
- User must connect a microphone

### Conversion/Upload Failed
- Error: "Failed to convert/upload audio"
- Recording is cancelled, user notified

## Testing Checklist

- [ ] Recording starts when Jekyll agent becomes active
- [ ] UI shows red dot and duration counter
- [ ] Duration updates every second
- [ ] Text turns green at 45 seconds
- [ ] Recording auto-stops at 45 seconds
- [ ] "Saving..." indicator shows during upload
- [ ] File appears in Azure Blob Storage `audio-uploads` container
- [ ] File is named correctly: `${userId}_${sessionId}_${timestamp}.wav`
- [ ] File is 44100Hz WAV format
- [ ] Audio quality is clear (no distortion, echo, noise)
- [ ] Recording stops when switching away from Jekyll
- [ ] Recording cleaned up on session end
- [ ] Error messages shown for permission/device issues

## Environment Variables

Configure Jekyll recording behavior via environment variables:

- `VITE_JEKYLL_RECORDING_MIN_DURATION` - Minimum recording duration in seconds (default: 45)
- `VITE_API_BASE_URL` - Azure Functions API endpoint
- `VITE_ENABLE_JEKYLL_AGENT` - Must be `'true'` to enable Jekyll agent

Example:
```bash
# .env.local or .env.production
VITE_JEKYLL_RECORDING_MIN_DURATION=45
VITE_ENABLE_JEKYLL_AGENT=true
```

## Dependencies

Uses existing services:
- `convertAudioToWav()` from `@/utils` - Converts any audio format to 44100Hz WAV
- `uploadToAzureBlob()` from `@/services/azure` - Uploads to Azure Blob Storage
- `getUserId()` from `@/utils` - Gets authenticated user ID

## Browser Compatibility

Requires:
- MediaRecorder API support
- getUserMedia API support
- Web Audio API support

Tested with:
- Chrome/Edge (Chromium)
- Firefox
- Safari (limited testing)

## Known Limitations

1. **Auto-stop at 45 seconds**: Recording stops automatically after minimum duration reached
   - **Future Enhancement**: Add option to continue recording beyond 45 seconds
   
2. **Single recording per Jekyll session**: Each Jekyll activation creates one recording
   - **Future Enhancement**: Support multiple recordings per session

3. **No pause/resume**: Recording cannot be paused and resumed
   - **Future Enhancement**: Add pause/resume functionality

4. **No manual stop before 45 seconds**: User cannot manually stop recording early
   - **Future Enhancement**: Add manual stop button that warns about minimum duration

## Troubleshooting

### Recording not starting
1. Check browser console for errors
2. Verify microphone permission granted
3. Ensure microphone is connected and working
4. Check Jekyll agent is enabled: `VITE_ENABLE_JEKYLL_AGENT=true`

### Audio quality issues
1. Check microphone quality/settings
2. Verify 44100Hz WAV conversion in DevTools Network tab
3. Download file from Azure and test playback locally

### Upload failures
1. Check Azure Blob Storage SAS token in `.env` file
2. Verify storage account exists and is accessible
3. Check network connectivity to Azure
4. Review browser console for detailed error messages

## Future Enhancements

1. **Manual Controls**: Add pause/resume/stop buttons
2. **Duration Control**: Allow recordings longer than 30 seconds
3. **Playback Preview**: Preview recording before upload
4. **Waveform Visualization**: Show audio waveform during recording
5. **Compression Options**: Add quality/size tradeoff settings
6. **Offline Support**: Save recordings locally if offline, upload later
7. **Multiple Recordings**: Support multiple recordings per Jekyll session
8. **Transcription**: Auto-transcribe recordings using Speech-to-Text API

## Related Files

- `jekyllVoiceRecordingService.ts` - Core recording service
- `RealtimeAgentExperience.tsx` - Integration and UI
- `jekyllAgent.ts` - Jekyll agent configuration
- `azure.ts` - Azure Blob Storage upload service
- `UploadAnalyze.tsx` - Reference for upload patterns
- `utils/index.ts` - Audio conversion utilities
