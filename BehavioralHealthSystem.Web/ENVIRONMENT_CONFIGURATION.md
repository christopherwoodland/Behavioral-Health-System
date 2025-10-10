# Environment Configuration Updates

## Overview
Made biometric data service configuration customizable via environment variables, following best practices for configurable application settings.

## Changes Made

### 1. `biometricDataService.ts`
**Before:**
```typescript
private readonly saveDelayMs = 2000; // Hard-coded
```

**After:**
```typescript
private readonly saveDelayMs = parseInt(import.meta.env.VITE_BIOMETRIC_SAVE_DELAY_MS || '2000', 10);
```

### 2. Environment Files Updated

#### `.env.example`
Added new configuration section:
```bash
# ------------------------------------------------------------------------------
# BIOMETRIC DATA SERVICE CONFIGURATION
# ------------------------------------------------------------------------------
# Auto-save delay for biometric data collection (milliseconds)
# Time to wait after last field update before saving to backend
# Local development: 2000ms (2 seconds) - good for testing
# Production: 2000ms (2 seconds) - balances UX and API calls
VITE_BIOMETRIC_SAVE_DELAY_MS=2000
```

#### `.env.local`
Added:
```bash
# ------------------------------------------------------------------------------
# BIOMETRIC DATA SERVICE CONFIGURATION
# ------------------------------------------------------------------------------
# Auto-save delay for biometric data collection (milliseconds)
VITE_BIOMETRIC_SAVE_DELAY_MS=2000
```

#### `.env.production`
Added:
```bash
# ------------------------------------------------------------------------------
# BIOMETRIC DATA SERVICE CONFIGURATION
# ------------------------------------------------------------------------------
# Auto-save delay for biometric data collection (milliseconds)
VITE_BIOMETRIC_SAVE_DELAY_MS=2000
```

### 3. Documentation Updated
Updated `PROGRESSIVE_BIOMETRIC_SAVING.md` with:
- Configuration section explaining the new environment variable
- Tuning recommendations for different scenarios
- Default value and recommended ranges

## Benefits

✅ **Flexibility:** Adjust save delay without code changes  
✅ **Environment-specific:** Different values for dev/staging/prod  
✅ **Testing:** Easy to test different delay values  
✅ **Performance tuning:** Optimize for network latency  
✅ **Best practices:** Follows existing configuration patterns  

## Usage

### Default Behavior
If `VITE_BIOMETRIC_SAVE_DELAY_MS` is not set, defaults to 2000ms (2 seconds).

### Customization
Set the environment variable to any positive integer (milliseconds):

```bash
# Fast saves (1 second) - good for low latency
VITE_BIOMETRIC_SAVE_DELAY_MS=1000

# Standard saves (2 seconds) - balanced
VITE_BIOMETRIC_SAVE_DELAY_MS=2000

# Slower saves (5 seconds) - reduce API calls
VITE_BIOMETRIC_SAVE_DELAY_MS=5000
```

### Tuning Guide

**Development Environment:**
- Recommended: 2000ms (2 seconds)
- Good balance for testing and debugging
- Fast enough to verify saves work
- Slow enough to observe behavior

**Production Environment:**
- Recommended: 2000ms (2 seconds)
- Balances user experience and API costs
- Prevents excessive API calls during rapid typing
- Still responsive enough for good UX

**High Latency Networks:**
- Recommended: 3000-5000ms (3-5 seconds)
- Reduces API call frequency
- Better for users on slow connections
- Minimizes partial save attempts

**Low Latency Networks:**
- Recommended: 1000-2000ms (1-2 seconds)
- Faster feedback for users
- Network can handle more frequent saves
- Better perceived responsiveness

## Testing

To test different delay values:

1. Update `.env.local` with desired value
2. Restart the dev server (`npm run dev`)
3. Open browser console
4. Interact with Matron agent
5. Observe timing of save messages in console:
   ```
   ➕ Updating biometric field: nickname = John
   [wait configured delay]
   ➕ Saving biometric data...
   ✅ Biometric data saved successfully
   ```

## Related Configuration

Other configurable timing settings in the app:
- `VITE_POLL_INTERVAL_MS` - General polling interval (1000ms dev, 3000ms prod)
- `VITE_JOB_POLL_INTERVAL_MS` - Job status polling (10000ms)
- `VITE_CONTROL_PANEL_REFRESH_INTERVAL` - Control panel refresh (30s dev, 69s prod)

The biometric save delay follows the same pattern and philosophy.
