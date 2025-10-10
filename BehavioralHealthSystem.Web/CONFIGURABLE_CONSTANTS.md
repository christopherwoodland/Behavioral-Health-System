# Configurable Constants - Environment Variables Reference

## Overview
This document lists all configurable constants that have been moved from hard-coded values to environment variables. This allows for flexible configuration across different environments (development, staging, production) without code changes.

## Configuration Philosophy

✅ **Externalize Configuration** - No magic numbers in code  
✅ **Environment-Specific** - Different values for dev/staging/prod  
✅ **Sensible Defaults** - Fallback values if not configured  
✅ **Type Safety** - Parse and validate at runtime  
✅ **Documentation** - Clear comments explain each setting  

## All Configurable Constants

### 1. Biometric Data Service

#### `VITE_BIOMETRIC_SAVE_DELAY_MS`
**File:** `src/services/biometricDataService.ts`  
**Purpose:** Auto-save delay after last field update  
**Type:** Integer (milliseconds)  
**Default:** `2000` (2 seconds)  
**Recommended Values:**
- Development: `2000ms` - Good balance for testing
- Production: `2000ms` - Balances UX and API calls
- High latency: `3000-5000ms` - Reduce API frequency
- Low latency: `1000-2000ms` - Faster feedback

```typescript
private readonly saveDelayMs = parseInt(import.meta.env.VITE_BIOMETRIC_SAVE_DELAY_MS || '2000', 10);
```

**Impact:** Controls how frequently biometric data is saved during collection. Lower = more API calls but less data loss risk. Higher = fewer API calls but more potential data loss.

---

#### `VITE_MATRON_MAX_COLLECTION_ATTEMPTS`
**File:** `src/agents/matronAgent.ts`  
**Purpose:** Maximum retry attempts for biometric data collection  
**Type:** Integer (attempts)  
**Default:** `2`  
**Recommended Values:**
- Development: `2` - Quick feedback
- Production: `2-3` - Balance between persistence and UX
- Unreliable networks: `3-5` - More retries

```typescript
const MAX_COLLECTION_ATTEMPTS = parseInt(import.meta.env.VITE_MATRON_MAX_COLLECTION_ATTEMPTS || '2', 10);
```

**Impact:** If data collection fails this many times, Matron returns control to Tars. Higher = more persistent but slower failure feedback.

---

#### `VITE_AGENT_HANDOFF_DELAY_MS`
**File:** `src/pages/RealtimeAgentExperience.tsx`  
**Purpose:** Delay between agent handoff announcement and actual switch  
**Type:** Integer (milliseconds)  
**Default:** `1500` (1.5 seconds)  
**Recommended Values:**
- Development: `1500ms` - Natural pause
- Production: `1500-2000ms` - Allow announcement to be heard
- Fast transitions: `1000ms` - Quicker handoff
- Careful explanation: `2000-3000ms` - More time to process

```typescript
const HANDOFF_DELAY_MS = parseInt(import.meta.env.VITE_AGENT_HANDOFF_DELAY_MS || '1500', 10);
```

**Impact:** When Tars announces handoff to any other agent (Matron, PHQ-2, PHQ-9, etc.), this delay ensures the user hears the announcement before the agent switch occurs. Applies to all handoffs originating from Tars. Lower = faster transitions but may feel abrupt. Higher = smoother UX but slightly slower.

---

### 2. API Request Configuration

#### `VITE_API_TIMEOUT_MS`
**File:** `src/utils/api.ts`  
**Purpose:** HTTP request timeout  
**Type:** Integer (milliseconds)  
**Default:** `30000` (30 seconds)  
**Recommended Values:**
- Development: `30000ms` - Generous timeout
- Production: `30000ms` - Standard for web APIs
- Slow backends: `60000ms` - 1 minute
- Fast backends: `15000ms` - 15 seconds

```typescript
timeout: parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '30000', 10)
```

**Impact:** How long to wait before considering an API request failed. Too short = premature timeouts. Too long = poor UX on failures.

---

#### `VITE_API_MAX_RETRIES`
**File:** `src/utils/api.ts`  
**Purpose:** Maximum retry attempts for failed API requests  
**Type:** Integer (attempts)  
**Default:** `3`  
**Recommended Values:**
- Development: `3` - Good for debugging
- Production: `3` - Standard retry count
- Critical requests: `5` - More persistent
- Non-critical: `1-2` - Fail faster

```typescript
retries: parseInt(import.meta.env.VITE_API_MAX_RETRIES || '3', 10)
```

**Impact:** Applies to all API requests with exponential backoff. Higher = more resilient but slower total failure time.

---

#### `VITE_API_RETRY_DELAY_MS`
**File:** `src/utils/api.ts`  
**Purpose:** Initial delay between retry attempts  
**Type:** Integer (milliseconds)  
**Default:** `1000` (1 second)  
**Recommended Values:**
- Development: `1000ms` - Quick retries
- Production: `1000-2000ms` - Standard
- Rate-limited APIs: `2000-5000ms` - Avoid throttling
- Fast recovery: `500ms` - Quick retry

```typescript
retryDelay: parseInt(import.meta.env.VITE_API_RETRY_DELAY_MS || '1000', 10)
```

**Impact:** First retry waits this long, subsequent retries use exponential backoff (2x, 4x, 8x, etc.). Lower = faster recovery but more load. Higher = more polite but slower recovery.

**Retry Pattern Example:**
- Attempt 1: Immediate
- Attempt 2: Wait 1000ms
- Attempt 3: Wait 2000ms
- Attempt 4: Wait 4000ms

---

### 3. Azure OpenAI Realtime API (WebRTC)

#### `VITE_REALTIME_MAX_RECONNECTION_ATTEMPTS`
**File:** `src/services/azureOpenAIRealtimeService.ts`  
**Purpose:** Maximum WebRTC reconnection attempts  
**Type:** Integer (attempts)  
**Default:** `3`  
**Recommended Values:**
- Development: `3` - Quick failure feedback
- Production: `3-5` - Balance persistence and UX
- Critical sessions: `5-10` - Very persistent
- Demo/testing: `1-2` - Fail fast

```typescript
private maxReconnectionAttempts: number = parseInt(import.meta.env.VITE_REALTIME_MAX_RECONNECTION_ATTEMPTS || '3', 10);
```

**Impact:** If WebRTC connection drops, will retry this many times with exponential backoff. Higher = more resilient to network issues but longer hang on permanent failures.

---

#### `VITE_REALTIME_RECONNECTION_DELAY_MS`
**File:** `src/services/azureOpenAIRealtimeService.ts`  
**Purpose:** Initial reconnection delay (uses exponential backoff)  
**Type:** Integer (milliseconds)  
**Default:** `2000` (2 seconds)  
**Recommended Values:**
- Development: `1000-2000ms` - Quick reconnect
- Production: `2000ms` - Standard
- Unstable networks: `3000-5000ms` - Let issues settle
- Stable networks: `1000ms` - Fast recovery

```typescript
private reconnectionDelay: number = parseInt(import.meta.env.VITE_REALTIME_RECONNECTION_DELAY_MS || '2000', 10);
```

**Impact:** Uses exponential backoff (2s → 4s → 8s → 16s). Lower = faster recovery attempts. Higher = more time for transient issues to resolve.

**Reconnection Pattern Example (with default 2000ms):**
- Attempt 1: Wait 2000ms (2s)
- Attempt 2: Wait 4000ms (4s)
- Attempt 3: Wait 8000ms (8s)
- Total time before giving up: 14 seconds

---

#### `VITE_REALTIME_DATA_CHANNEL_TIMEOUT_MS`
**File:** `src/services/azureOpenAIRealtimeService.ts`  
**Purpose:** WebRTC data channel ready timeout  
**Type:** Integer (milliseconds)  
**Default:** `5000` (5 seconds)  
**Recommended Values:**
- Development: `5000ms` - Standard
- Production: `5000-10000ms` - Account for latency
- Fast networks: `3000ms` - Quicker failure detection
- Slow networks: `10000ms` - More patience

```typescript
private async waitForDataChannelReady(timeoutMs: number = parseInt(import.meta.env.VITE_REALTIME_DATA_CHANNEL_TIMEOUT_MS || '5000', 10)): Promise<void>
```

**Impact:** How long to wait for WebRTC data channel to open. Too short = false negatives on slow networks. Too long = slow failure feedback.

---

## Complete Environment File Reference

### `.env.example` / `.env.local` / `.env.production`

```bash
# ==============================================================================
# CONFIGURABLE CONSTANTS - TIMING AND RETRY SETTINGS
# ==============================================================================

# ------------------------------------------------------------------------------
# BIOMETRIC DATA SERVICE CONFIGURATION
# ------------------------------------------------------------------------------
# Auto-save delay for biometric data collection (milliseconds)
VITE_BIOMETRIC_SAVE_DELAY_MS=2000

# Maximum retry attempts for Matron biometric data collection
VITE_MATRON_MAX_COLLECTION_ATTEMPTS=2

# Agent handoff announcement delay (milliseconds)
VITE_AGENT_HANDOFF_DELAY_MS=1500

# ------------------------------------------------------------------------------
# API REQUEST CONFIGURATION
# ------------------------------------------------------------------------------
# HTTP request timeout in milliseconds
VITE_API_TIMEOUT_MS=30000

# Maximum number of retry attempts for failed API requests
VITE_API_MAX_RETRIES=3

# Initial delay between API retry attempts (milliseconds)
VITE_API_RETRY_DELAY_MS=1000

# ------------------------------------------------------------------------------
# AZURE OPENAI REALTIME API CONFIGURATION (Advanced)
# ------------------------------------------------------------------------------
# Maximum WebRTC reconnection attempts
VITE_REALTIME_MAX_RECONNECTION_ATTEMPTS=3

# Initial reconnection delay (milliseconds, uses exponential backoff)
VITE_REALTIME_RECONNECTION_DELAY_MS=2000

# Data channel ready timeout (milliseconds)
VITE_REALTIME_DATA_CHANNEL_TIMEOUT_MS=5000
```

---

## Environment-Specific Recommendations

### Development Environment

**Goal:** Fast feedback, easy debugging

```bash
VITE_BIOMETRIC_SAVE_DELAY_MS=2000           # Quick saves
VITE_MATRON_MAX_COLLECTION_ATTEMPTS=2       # Fast failure
VITE_AGENT_HANDOFF_DELAY_MS=1500            # Natural pause
VITE_API_TIMEOUT_MS=30000                   # Generous timeout
VITE_API_MAX_RETRIES=3                      # Standard retries
VITE_API_RETRY_DELAY_MS=1000                # Quick retry
VITE_REALTIME_MAX_RECONNECTION_ATTEMPTS=3   # Standard
VITE_REALTIME_RECONNECTION_DELAY_MS=1000    # Fast reconnect
VITE_REALTIME_DATA_CHANNEL_TIMEOUT_MS=5000  # Standard
```

### Production Environment

**Goal:** Reliability, good UX, cost efficiency

```bash
VITE_BIOMETRIC_SAVE_DELAY_MS=2000           # Balance UX/API
VITE_MATRON_MAX_COLLECTION_ATTEMPTS=2       # Don't be too pushy
VITE_AGENT_HANDOFF_DELAY_MS=1500            # Natural pause
VITE_API_TIMEOUT_MS=30000                   # Standard web timeout
VITE_API_MAX_RETRIES=3                      # Resilient
VITE_API_RETRY_DELAY_MS=1000                # Standard backoff
VITE_REALTIME_MAX_RECONNECTION_ATTEMPTS=3   # Resilient
VITE_REALTIME_RECONNECTION_DELAY_MS=2000    # Measured approach
VITE_REALTIME_DATA_CHANNEL_TIMEOUT_MS=5000  # Standard
```

### High-Latency Networks (Mobile, International)

**Goal:** More patience, fewer false timeouts

```bash
VITE_BIOMETRIC_SAVE_DELAY_MS=3000           # Reduce API calls
VITE_MATRON_MAX_COLLECTION_ATTEMPTS=3       # More attempts
VITE_AGENT_HANDOFF_DELAY_MS=2000            # More time to process
VITE_API_TIMEOUT_MS=60000                   # 1 minute timeout
VITE_API_MAX_RETRIES=5                      # More retries
VITE_API_RETRY_DELAY_MS=2000                # Longer backoff
VITE_REALTIME_MAX_RECONNECTION_ATTEMPTS=5   # Very persistent
VITE_REALTIME_RECONNECTION_DELAY_MS=3000    # Let issues settle
VITE_REALTIME_DATA_CHANNEL_TIMEOUT_MS=10000 # More patience
```

### Demo/Testing Environment

**Goal:** Fast failures, clear error messages

```bash
VITE_BIOMETRIC_SAVE_DELAY_MS=1000           # Fast saves for demo
VITE_MATRON_MAX_COLLECTION_ATTEMPTS=1       # Fail fast
VITE_AGENT_HANDOFF_DELAY_MS=1000            # Quicker handoff
VITE_API_TIMEOUT_MS=15000                   # Quick timeout
VITE_API_MAX_RETRIES=1                      # Minimal retry
VITE_API_RETRY_DELAY_MS=500                 # Quick retry
VITE_REALTIME_MAX_RECONNECTION_ATTEMPTS=2   # Fail fast
VITE_REALTIME_RECONNECTION_DELAY_MS=1000    # Quick reconnect
VITE_REALTIME_DATA_CHANNEL_TIMEOUT_MS=3000  # Quick failure
```

---

## Testing Configuration Changes

### 1. Test Biometric Save Delay
```bash
# Set to 5 seconds for testing
VITE_BIOMETRIC_SAVE_DELAY_MS=5000
```
**How to verify:**
1. Start Matron data collection
2. Provide a field value
3. Watch console: Should see "Saving biometric data..." after 5 seconds

### 2. Test Matron Retry Attempts
```bash
# Set to 1 for quick failure
VITE_MATRON_MAX_COLLECTION_ATTEMPTS=1
```
**How to verify:**
1. Disconnect backend (stop Azure Functions)
2. Try to save with Matron
3. Should return to Tars after 1 failed attempt

### 3. Test API Timeout
```bash
# Set to 5 seconds for quick timeout
VITE_API_TIMEOUT_MS=5000
```
**How to verify:**
1. Add artificial delay to backend endpoint
2. Make API request
3. Should timeout after 5 seconds

### 4. Test WebRTC Reconnection
```bash
# Set to 1 attempt for quick failure
VITE_REALTIME_MAX_RECONNECTION_ATTEMPTS=1
VITE_REALTIME_RECONNECTION_DELAY_MS=1000
```
**How to verify:**
1. Start voice session
2. Disconnect network briefly
3. Should attempt 1 reconnection after 1 second, then give up

---

## Migration Guide

### For Existing Deployments

**Step 1:** Add new environment variables to your `.env` files  
**Step 2:** Keep default values initially (no behavior change)  
**Step 3:** Test in development environment  
**Step 4:** Tune values based on monitoring data  
**Step 5:** Deploy to staging, monitor for issues  
**Step 6:** Deploy to production with confidence  

### Monitoring Recommendations

Track these metrics to optimize configuration:
- **API timeout rate** - If high, increase `VITE_API_TIMEOUT_MS`
- **API retry success rate** - If low retries succeed, reduce `VITE_API_MAX_RETRIES`
- **Biometric save frequency** - If too many saves, increase `VITE_BIOMETRIC_SAVE_DELAY_MS`
- **WebRTC reconnection success rate** - If low, increase attempts/delay
- **User-reported "slow" feedback** - Reduce timeouts and delays

---

## Benefits Summary

✅ **Flexibility** - Adjust timing without code changes  
✅ **Environment-Specific** - Different values per environment  
✅ **A/B Testing** - Easy to test different configurations  
✅ **Performance Tuning** - Optimize based on real usage  
✅ **Cost Control** - Reduce API calls by tuning delays  
✅ **UX Optimization** - Balance speed vs. reliability  
✅ **Network Adaptation** - Tune for different network conditions  
✅ **Debugging** - Faster iteration during development  

---

## Related Documentation

- `PROGRESSIVE_BIOMETRIC_SAVING.md` - Biometric save patterns
- `ENVIRONMENT_CONFIGURATION.md` - General env config guide
- `.env.example` - Full environment variable reference
