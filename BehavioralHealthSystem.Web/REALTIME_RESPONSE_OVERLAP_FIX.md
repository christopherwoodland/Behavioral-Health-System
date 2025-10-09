# Azure OpenAI Realtime API - Response Overlap Fix

## Problem
The error `Conversation already has an active response in progress` occurs when trying to create a new response while another one is still being processed by the Azure OpenAI Realtime API. The API only allows **one active response at a time**.

## Root Cause
The service was sending `response.create` events without checking if a response was already in progress. This happened in two scenarios:

1. **After function call results** - When a tool/function completed, it immediately sent `response.create`
2. **When speaking assistant messages** - The `speakAssistantMessage()` method sent `response.create` without checking state
3. **Race conditions** - Multiple events could trigger responses before the previous one completed

## Solution Implemented

### 1. Added Response State Tracking
```typescript
// Response state tracking to prevent overlapping responses
private isResponseInProgress: boolean = false;
private pendingResponseQueue: Array<() => void> = [];
```

### 2. Created Safe Response Creation Method
```typescript
/**
 * Safely create a response, queuing if one is already in progress
 */
private safeCreateResponse(options?: { modalities?: string[], instructions?: string }): void {
  // If a response is already in progress, queue this request
  if (this.isResponseInProgress) {
    console.log('⏳ Response already in progress, queuing new response request');
    this.pendingResponseQueue.push(() => this.safeCreateResponse(options));
    return;
  }

  // Send response.create event
  const responseEvent: any = {
    type: 'response.create'
  };

  if (options) {
    responseEvent.response = {};
    if (options.modalities) {
      responseEvent.response.modalities = options.modalities;
    }
    if (options.instructions) {
      responseEvent.response.instructions = options.instructions;
    }
  }

  console.log('📤 Creating AI response:', responseEvent);
  this.dataChannel.send(JSON.stringify(responseEvent));
}
```

### 3. Updated Response Event Handlers
```typescript
case 'response.created':
  this.isResponseInProgress = true; // Mark response as active
  // ... rest of handling

case 'response.done':
  this.isResponseInProgress = false; // Clear response flag
  this.processNextQueuedResponse(); // Process any queued responses
  // ... rest of handling

case 'response.cancelled':
  this.isResponseInProgress = false; // Clear response flag on cancellation
  // ... rest of handling
```

### 4. Added Queue Processing
```typescript
/**
 * Process the next queued response if any
 */
private processNextQueuedResponse(): void {
  if (this.pendingResponseQueue.length > 0) {
    console.log(`🔄 Processing next queued response (${this.pendingResponseQueue.length} in queue)`);
    const nextResponse = this.pendingResponseQueue.shift();
    if (nextResponse) {
      // Small delay to ensure previous response is fully cleared
      setTimeout(() => nextResponse(), 100);
    }
  }
}
```

### 5. Updated All Response Creation Points
- **Function results**: Changed to use `safeCreateResponse()`
- **Assistant messages**: Changed `speakAssistantMessage()` to use `safeCreateResponse()`
- **Cleanup**: Clear response state and queue on disconnect

## How It Works

1. **Response Starts**: When `response.created` event arrives, set `isResponseInProgress = true`
2. **New Request Arrives**: If `isResponseInProgress` is true, queue the request instead of sending immediately
3. **Response Completes**: When `response.done` or `response.cancelled` arrives:
   - Set `isResponseInProgress = false`
   - Process next queued response (if any) with 100ms delay
4. **Queue Processing**: Queued responses are executed in FIFO order with small delays to prevent race conditions

## Benefits

✅ **Prevents API Errors** - No more "response already in progress" errors
✅ **Maintains Order** - Responses are processed in the order they were requested
✅ **Non-Blocking** - Requests don't fail, they're just queued temporarily
✅ **Automatic Recovery** - Queue automatically processes when responses complete
✅ **Race Condition Safe** - Small delays ensure state transitions are clean

## Testing

After applying this fix:

1. **Function Calls**: Multiple rapid function calls will queue properly
2. **Assistant Messages**: Calling `speakAssistantMessage()` multiple times won't cause errors
3. **User Interruptions**: Cancelling a response clears the flag and allows new responses
4. **Edge Cases**: Queue is cleared on disconnect/cleanup

## Console Output

You'll now see helpful logs:
- `⏳ Response already in progress, queuing new response request` - When a request is queued
- `🔄 Processing next queued response (N in queue)` - When processing the queue
- `📤 Creating AI response:` - When actually sending the response.create event

## Files Modified

- `BehavioralHealthSystem.Web/src/services/azureOpenAIRealtimeService.ts`
  - Added `isResponseInProgress` and `pendingResponseQueue` properties
  - Added `safeCreateResponse()` method
  - Added `processNextQueuedResponse()` method
  - Updated `response.created`, `response.done`, `response.cancelled` handlers
  - Updated `sendFunctionResult()` to use safe method
  - Updated `speakAssistantMessage()` to use safe method
  - Updated `cleanup()` to reset response state

## Next Steps (Optional Improvements)

1. **Timeout Handling**: Add timeout to detect stuck responses and clear state
2. **Queue Limits**: Add maximum queue size to prevent memory issues
3. **Priority Queue**: Allow high-priority responses to jump the queue
4. **Metrics**: Track queue depth and response times for monitoring
