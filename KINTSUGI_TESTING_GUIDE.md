# Quick Start: Testing Kintsugi Voice Recording

## Start Testing in 3 Steps

### 1. Start the Development Server
```powershell
cd scripts
./local-run.ps1
```

### 2. Navigate to the Application
Open browser to: `http://localhost:5173`

### 3. Test the Feature

1. **Start Session** → Click "Start Session" button
2. **Wait for TARS** → TARS will greet you and ask how you can help
3. **Request Jekyll** → Say: "I'd like a mental health assessment" or "I need to talk to Jekyll"
4. **Complete Assessment** → Have a natural conversation with Jekyll about your mood
5. **Watch for Recording Request** → Jekyll may request a voice sample after assessment
6. **Speak for 30 seconds** → When recording starts, speak naturally about your day
7. **Watch UI Indicator** → Header shows "Voice Sample: 0s / 30s" (red → green at 30s)
8. **Auto-stop** → Recording stops automatically after ~32 seconds
9. **Verify Upload** → Check console logs for Azure Blob Storage URL

## What to Look For

### Success Indicators
- ✅ Red pulsing dot appears in header
- ✅ Counter shows: "Voice Sample: Xs / 30s"
- ✅ Text turns **green** at 30 seconds
- ✅ "Saving sample... ⏳" appears
- ✅ Success confirmation (disappears after 3s)
- ✅ Console logs show Azure Blob URL

### Console Logs
```
🎙️ ========================================
🎙️ KINTSUGI RECORDING REQUEST
🎙️ Prompt: Tell me about what a typical day looks like for you
🎙️ ========================================
✅ Kintsugi recording started
✅ Minimum duration (30s) reached
🛑 Auto-stopping Kintsugi recording...
✅ Kintsugi recording saved: https://...blob.core.windows.net/.../kintsugi_...wav
```

## Manual Testing Commands

### Force Jekyll to Request Recording
If Jekyll doesn't automatically request a recording, you can manually trigger it by:

1. **Complete a short assessment** with Jekyll
2. **Say explicitly**: "Can you do a vocal analysis?" or "I'd like to do voice biomarker testing"

## Verify File in Azure

### Using Azure Portal
1. Go to Azure Portal
2. Navigate to Storage Account
3. Open `audio-uploads` container
4. Look for: `users/{userId}/audio/kintsugi_{userId}_{sessionId}_{timestamp}.wav`

### Using Azure Storage Explorer
1. Connect to storage account
2. Browse to `audio-uploads` container
3. Download the WAV file
4. Play it to verify audio quality

## Troubleshooting

### Recording Doesn't Start
- Check browser microphone permissions
- Check console for errors
- Verify `VITE_ENABLE_JEKYLL_AGENT=true` in `.env.local`

### Recording Stops Immediately
- Check console for error messages
- Verify microphone is working (system settings)
- Try in Chrome/Edge (best compatibility)

### No UI Indicator
- Check React DevTools for `kintsugiRecording` state
- Verify handler is connected (check console logs)
- Refresh page and try again

### Upload Fails
- Check `.env.local` has `VITE_API_BASE_URL`
- Verify Azure Storage credentials
- Check network tab for failed requests

## Quick Console Check

Run this in browser console during recording:
```javascript
// Check if recording is active
console.log('Recording active:', kintsugiVoiceRecordingService.isRecording());

// Get current duration
console.log('Duration:', kintsugiVoiceRecordingService.getCurrentDuration());

// Check minimum reached
console.log('Min duration:', kintsugiVoiceRecordingService.hasMinimumDuration());
```

## Expected Timeline

```
0:00 - Jekyll requests voice sample
0:01 - Recording starts (red indicator)
0:15 - Counter shows "15s / 30s" (still red)
0:30 - Counter shows "30s / 30s" (turns green!)
0:32 - Auto-stop + "Saving sample..."
0:35 - Success message (clears at 0:38)
```

## Need Help?

Check these files:
- **Implementation Guide**: `KINTSUGI_RECORDING_IMPLEMENTATION.md`
- **Summary**: `KINTSUGI_METHOD1_IMPLEMENTATION_SUMMARY.md`
- **Code**: 
  - Service: `BehavioralHealthSystem.Web/src/services/kintsugiVoiceRecordingService.ts`
  - Agent: `BehavioralHealthSystem.Web/src/agents/jekyllAgent.ts`
  - UI: `BehavioralHealthSystem.Web/src/pages/RealtimeAgentExperience.tsx`

---

**Ready to test!** 🎙️ The implementation is complete and waiting for you to try it out.
