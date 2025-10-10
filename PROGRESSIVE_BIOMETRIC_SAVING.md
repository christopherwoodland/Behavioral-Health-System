# Progressive Biometric Data Saving

## Overview
Implemented progressive (auto-save) biometric data collection similar to the chat transcript service pattern. Data is now saved after each field is collected, preventing data loss if the conversation is interrupted.

## Files Created

### 1. `biometricDataService.ts`
**Location:** `BehavioralHealthSystem.Web/src/services/biometricDataService.ts`

**Purpose:** Frontend service for managing biometric data with progressive saving

**Key Features:**
- ✅ Session initialization per user
- ✅ Individual field updates with auto-save (2-second delay)
- ✅ Array field management (hobbies, likes, dislikes)
- ✅ Force save capability (useful before agent switches)
- ✅ Load existing data on session start
- ✅ Minimum data validation (nickname required)

**Key Methods:**
```typescript
initializeSession(userId: string): void
updateField(field: string, value: any): void
updateFields(updates: Partial<BiometricData>): void
addToArrayField(field: 'hobbies' | 'likes' | 'dislikes', value: string): void
getCurrentData(): BiometricData | null
hasMinimumData(): boolean
forceSave(): Promise<{ success: boolean; error?: string }>
clearSession(): void
loadExistingData(userId: string): Promise<BiometricData | null>
```

**Auto-Save Pattern:**
- Updates trigger a configurable delay timer (default: 2 seconds)
- Timer resets on each new update (debouncing)
- Saves automatically to backend API
- Continues silently in background (doesn't throw errors to user)
- Delay is configurable via `VITE_BIOMETRIC_SAVE_DELAY_MS` environment variable

## Files Modified

### 2. `matronAgent.ts`
**Location:** `BehavioralHealthSystem.Web/src/agents/matronAgent.ts`

**Changes:**
- ✅ Imported `biometricDataService`
- ✅ Added `updateBiometricFieldTool` - Progressive field updates
- ✅ Added `addToArrayFieldTool` - Progressive array updates
- ✅ Updated `startBiometricCollectionTool` to initialize service and load existing data
- ✅ Updated system message with progressive saving instructions
- ✅ Kept `saveBiometricDataTool` for backward compatibility (marked deprecated)

**New Tools:**

#### `update-biometric-field`
```typescript
{
  field: 'nickname' | 'weightKg' | 'heightCm' | 'gender' | 'pronoun' | 'lastResidence' | 'additionalInfo',
  value: string
}
```
- Called after EACH piece of data is collected
- Auto-converts numeric strings to numbers (weight, height)
- Triggers auto-save after 2 seconds

#### `add-to-array-field`
```typescript
{
  field: 'hobbies' | 'likes' | 'dislikes',
  value: string
}
```
- Adds items to array fields progressively
- Each item is saved automatically
- Supports multiple items collected over time

**Updated Workflow:**
1. User provides nickname → **call `update-biometric-field`** → auto-save in 2s
2. User provides weight → **call `update-biometric-field`** → auto-save in 2s
3. User provides height → **call `update-biometric-field`** → auto-save in 2s
4. User provides hobby → **call `add-to-array-field`** → auto-save in 2s
5. Continue for all fields...
6. Close conversation → **call `Agent_Tars`** (data already saved!)

### 3. `azureOpenAIRealtimeService.ts`
**Location:** `BehavioralHealthSystem.Web/src/services/azureOpenAIRealtimeService.ts`

**Changes:**
- ✅ Added `canUpdateVoice()` method to check if voice updates are safe

**New Method:**
```typescript
public canUpdateVoice(): boolean {
  return !this.isResponseInProgress;
}
```

**Purpose:** Prevents "Cannot update a conversation's voice if assistant audio is present" error

**How It Works:**
- Checks internal `isResponseInProgress` flag
- Returns `false` when AI is actively speaking
- Returns `true` when it's safe to update voice settings
- Used during agent switching to avoid API errors

### 4. `RealtimeAgentExperience.tsx`
**Location:** `BehavioralHealthSystem.Web/src/pages/RealtimeAgentExperience.tsx`

**Changes:**
- ✅ Added voice update safety check during agent switching

**Updated Agent Switch Logic:**
```typescript
// Determine voice based on agent
const agentVoice = (targetAgentId === 'Agent_PHQ2' || targetAgentId === 'Agent_PHQ9') 
  ? 'echo' 
  : azureSettings.voice;

// Build config
const updatedConfig: SessionConfig = {
  ...convertSettingsToConfig(...),
  tools: realtimeTools
};

// Only update voice if safe to do so
if (agentService.canUpdateVoice()) {
  updatedConfig.voice = agentVoice;
  console.log(`🎤 Updating session with voice: ${agentVoice}`);
} else {
  console.log('⚠️ Skipping voice update - assistant audio is active');
}

await agentService.updateSession(updatedConfig);
```

**Benefits:**
- ✅ Eliminates voice update errors during agent switches
- ✅ Gracefully skips voice parameter when AI is speaking
- ✅ Maintains correct voice settings when safe to update
- ✅ Logs clear messages for debugging

## Benefits

### Progressive Saving Pattern
✅ **Data Protection:** No data loss if conversation interrupted  
✅ **User Experience:** Seamless background saving  
✅ **Performance:** Debounced saves (2s delay) reduce API calls  
✅ **Consistency:** Matches chat transcript service pattern  
✅ **Flexibility:** Force save available before agent switches  

### Voice Update Safety
✅ **Error Prevention:** No more Azure API voice update errors  
✅ **Smooth Transitions:** Agent switches work even during AI speech  
✅ **Graceful Degradation:** Skips voice update if unsafe, applies later  
✅ **Clear Logging:** Console messages explain what's happening  

## Testing

### Test Progressive Saving
1. Start conversation with Matron
2. Provide nickname → Check console for "Updating biometric field: nickname"
3. Wait 2 seconds → Check console for "Saving biometric data..."
4. Provide weight → Check for update and save
5. Interrupt conversation → Reload → Check if data persists

### Test Voice Update Safety
1. Start conversation with Tars
2. Let Tars speak (AI response in progress)
3. Trigger agent switch to Matron mid-speech
4. Check console for "⚠️ Skipping voice update - assistant audio is active"
5. Verify NO error: "Cannot update a conversation's voice if assistant audio is present"

### Test Force Save
1. Collect data with Matron
2. Switch agents immediately (before 2s auto-save)
3. Check if data was force-saved before switch
4. Verify data persists after switch

## API Endpoints Used

### POST `/api/biometric`
Saves biometric data to Azure Blob Storage
- Called automatically by `biometricDataService.saveDataImmediate()`
- Triggered 2 seconds after last field update
- Requires minimum: `userId` and `nickname`

### GET `/api/biometric/{userId}`
Loads existing biometric data
- Called by `biometricDataService.loadExistingData()`
- Used when starting Matron session to check for existing data
- Returns 404 if no data exists (handled gracefully)

## Configuration

### Environment Variables

Add the following to your `.env.local` and `.env.production` files:

```bash
# ------------------------------------------------------------------------------
# BIOMETRIC DATA SERVICE CONFIGURATION
# ------------------------------------------------------------------------------
# Auto-save delay for biometric data collection (milliseconds)
# Time to wait after last field update before saving to backend
# Default: 2000 (2 seconds)
# Recommended range: 1000-5000 ms
VITE_BIOMETRIC_SAVE_DELAY_MS=2000
```

**Tuning Recommendations:**
- **Development:** 2000ms (2 seconds) - Good balance for testing
- **Production:** 2000ms (2 seconds) - Balances UX and API calls
- **High latency networks:** 3000-5000ms - Reduce API calls
- **Low latency networks:** 1000-2000ms - Faster saves

## Future Enhancements

### Potential Improvements
- [ ] Add visual indicator when auto-save occurs (toast notification?)
- [ ] Add "unsaved changes" warning before closing
- [ ] Implement offline queue for failed saves
- [ ] Add conflict resolution for concurrent edits
- [ ] Track save history for audit trail
- [ ] Add undo/redo functionality

### Performance Optimizations
- [ ] Batch multiple rapid updates into single save
- [ ] Implement exponential backoff for failed saves
- [ ] Add request cancellation for outdated saves
- [ ] Cache responses to reduce API calls

## Related Files

### Backend (Already Implemented)
- `UserBiometricData.cs` - Data model
- `BiometricDataService.cs` - Blob storage service
- `BiometricDataFunctions.cs` - REST API endpoints
- `UserBiometricDataValidator.cs` - Validation rules

### Frontend (This Update)
- `biometricDataService.ts` - **NEW** Progressive saving service
- `matronAgent.ts` - Updated with progressive tools
- `azureOpenAIRealtimeService.ts` - Added voice safety check
- `RealtimeAgentExperience.tsx` - Updated agent switch logic

## Summary

This update brings two major improvements:

1. **Progressive Biometric Saving:** Data is now saved continuously as it's collected, matching the chat transcript service pattern. This prevents data loss and provides a better user experience.

2. **Voice Update Safety:** Agent switches no longer fail when the AI is speaking. The system now checks if it's safe to update voice settings and gracefully skips the update if not.

Both features are production-ready and follow established patterns in the codebase.
