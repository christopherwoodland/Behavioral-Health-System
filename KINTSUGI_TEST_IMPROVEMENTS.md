# Quick Test: Kintsugi Recording Improvements

## What Changed
✅ Recording now waits for Jekyll to finish speaking before starting the clock  
✅ Jekyll stays silent during the 30-second recording (turn detection disabled)

## How to Test

### 1. Start the App
```powershell
cd scripts
./local-run.ps1
```

### 2. Test the New Behavior

#### Expected Flow:
1. **Jekyll requests recording**
   - Jekyll says: "Tell me about your day..."
   
2. **Wait indicator appears**
   - UI shows: **"Waiting for agent to finish... ⏸️"** (blue text)
   - This means Jekyll is still speaking
   
3. **Recording starts**
   - Jekyll finishes speaking
   - Wait indicator disappears
   - Recording starts: **"Voice Sample: 0s / 30s"** (red dot)
   
4. **User speaks uninterrupted**
   - Speak for 30 seconds
   - Jekyll does NOT respond (silent)
   - Counter increments: 1s, 2s, 3s... 30s
   
5. **Counter turns green at 30s**
   - Text changes to green when minimum reached
   
6. **Auto-stop and save**
   - Recording stops at ~32 seconds
   - Shows: **"Saving sample... ⏳"**
   - Upload completes
   
7. **Jekyll can respond again**
   - After recording completes, Jekyll returns to normal

### 3. What to Watch For

#### ✅ Success Indicators
- Blue "Waiting for agent..." appears if Jekyll still speaking
- Recording counter doesn't start until Jekyll finishes
- Jekyll remains SILENT during your 30-second speech
- Counter turns green at 30s
- Jekyll can respond normally after recording

#### ❌ Problems to Report
- Recording starts while Jekyll is still talking
- Jekyll interrupts you during the 30-second recording
- Counter doesn't start after Jekyll finishes
- Jekyll can't respond after recording completes

### 4. Console Logs to Check

Open browser DevTools (F12) → Console tab

**Look for these logs:**
```
🎙️ KINTSUGI RECORDING REQUEST
⏳ Waiting for Jekyll to finish speaking before starting recording...
✅ Jekyll finished speaking, starting recording now...
🔇 Disabling turn detection for Kintsugi recording...
✅ Kintsugi recording started
✅ Minimum duration (30s) reached
🛑 Auto-stopping Kintsugi recording...
🔊 Re-enabling turn detection...
✅ Kintsugi recording saved: [Azure URL]
```

### 5. Quick Verification

**Before this fix:**
- ❌ Clock starts immediately (even while Jekyll talking)
- ❌ Jekyll interrupts you during recording

**After this fix:**
- ✅ Clock waits for Jekyll to finish
- ✅ Jekyll stays silent during recording
- ✅ Clean 30-second sample captured

---

## Troubleshooting

### "Waiting..." never disappears
- Check console for timeout message (starts after 10s)
- Should start recording anyway after timeout

### Jekyll still responds during recording
- Check console for "🔇 Disabling turn detection" message
- If missing, report the issue

### Recording never starts
- Check for microphone permission denial
- Check console for error messages

---

## Summary

The key improvements are:
1. **Wait indicator**: Shows when Jekyll is still speaking
2. **Delayed start**: Recording clock waits for Jekyll to finish
3. **Silent Jekyll**: Turn detection disabled during recording
4. **Clean samples**: No interruptions in the 30-second recording

Test it out and verify Jekyll stays silent while you speak! 🎙️
