# Independent User/Agent Handler Architecture

## Overview
The Azure OpenAI Realtime service has been refactored to separate user input and agent response processing into independent handler classes. This improves code organization, testability, and maintains clear responsibility boundaries while sharing the necessary WebRTC connection.

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│         AzureOpenAIRealtimeService (Main Service)           │
│  - WebRTC Connection (RTCPeerConnection)                    │
│  - Data Channel (RTCDataChannel)                            │
│  - Event Routing                                            │
│  - Session Management                                       │
└───────────────┬──────────────────────┬──────────────────────┘
                │                      │
     ┌──────────▼─────────┐ ┌─────────▼──────────┐
     │  UserInputHandler  │ │ AgentResponseHandler│
     │                    │ │                     │
     │  - VAD             │ │  - Response Tracking│
     │  - User Transcripts│ │  - Agent Transcripts│
     │  - Speech Detection│ │  - Mic Muting       │
     └────────────────────┘ └─────────────────────┘
```

### UserInputHandler
**Purpose:** Manages all user voice input, voice activity detection, and user transcription

**Responsibilities:**
- ✅ Voice Activity Detection (VAD)
  - AudioContext analysis
  - Volume monitoring (50ms intervals)
  - Speech start/stop detection
- ✅ User transcript processing
  - Handles `conversation.item.input_audio_transcription.completed`
- ✅ Speech detection state (user side)
- ✅ Independent audio analysis pipeline

**Key Methods:**
- `initializeVAD(stream: MediaStream)` - Setup VAD on user's audio
- `handleTranscriptEvent(event)` - Process user transcripts
- `isCurrentlySpeaking()` - Get current user speaking state
- `cleanup()` - Release resources

**Callbacks:**
- `onVoiceActivity(callback)` - Volume/speaking updates
- `onLiveTranscript(callback)` - User transcript updates
- `onSpeechDetection(callback)` - Speech state changes

### AgentResponseHandler
**Purpose:** Manages all agent voice responses, transcription, and microphone muting

**Responsibilities:**
- ✅ Response lifecycle tracking
  - `response.created` - Agent about to speak
  - `response.done` - Agent finished
  - `response.cancelled` - Response interrupted
- ✅ Agent transcript processing
  - `response.audio_transcript.delta` - Streaming text
  - `response.audio_transcript.done` - Final transcript
- ✅ Microphone muting strategy
  - Mute BEFORE agent speaks (`response.created`)
  - Unmute 1.5s AFTER agent finishes (`response.audio_transcript.done`)
  - Immediate unmute on cancellation
- ✅ Message history management

**Key Methods:**
- `handleResponseCreated(event)` - Agent starting to speak
- `handleAudioTranscriptDelta(event)` - Streaming agent text
- `handleAudioTranscriptDone(event)` - Agent finished speaking
- `handleResponseDone(event)` - Response generation complete
- `handleResponseCancelled(event)` - Response interrupted
- `isCurrentlySpeaking()` - Get current agent speaking state
- `cleanup()` - Release resources

**Callbacks:**
- `onLiveTranscript(callback)` - Agent transcript updates
- `onMessage(callback)` - Complete messages
- `onSpeechDetection(callback)` - Speech state changes
- `onMuteMicrophone(callback)` - Mic mute/unmute requests

## Event Flow

### User Speaking Flow
```
1. User starts speaking
   ↓
2. UserInputHandler.VAD detects volume increase
   ↓
3. onVoiceActivity(callback) fires
   ↓
4. Azure OpenAI detects speech: input_audio_buffer.speech_started
   ↓
5. User stops speaking
   ↓
6. UserInputHandler.VAD detects volume decrease
   ↓
7. Azure OpenAI transcribes: conversation.item.input_audio_transcription.completed
   ↓
8. UserInputHandler.handleTranscriptEvent() processes transcript
   ↓
9. Main service receives user transcript via callback
```

### Agent Speaking Flow
```
1. response.created event
   ↓
2. AgentResponseHandler.handleResponseCreated()
   ↓
3. 🔇 Microphone MUTED immediately (via callback to main service)
   ↓
4. response.audio_transcript.delta events (streaming)
   ↓
5. AgentResponseHandler.handleAudioTranscriptDelta()
   ↓
6. Agent speaks (microphone stays muted)
   ↓
7. response.audio_transcript.done
   ↓
8. AgentResponseHandler.handleAudioTranscriptDone()
   ↓
9. Wait 1.5 seconds
   ↓
10. 🔊 Microphone UNMUTED (via callback to main service)
    ↓
11. response.done event
    ↓
12. AgentResponseHandler.handleResponseDone()
```

## Integration Points

### Main Service Responsibilities
- ✅ Manages WebRTC connection (RTCPeerConnection)
- ✅ Manages data channel (RTCDataChannel)
- ✅ Routes events to appropriate handlers
- ✅ Provides microphone control to handlers
- ✅ Maintains backward compatibility with existing callbacks
- ✅ Session management (start/stop/pause)
- ✅ Function calling integration

### Handler Integration
```typescript
constructor() {
  // Initialize handlers
  this.userInputHandler = new UserInputHandler();
  this.agentResponseHandler = new AgentResponseHandler();
  
  // Connect agent handler's mute callback
  this.agentResponseHandler.onMuteMicrophone((mute) => {
    this.muteMicrophone(mute);
  });
  
  // Forward handler events to main service callbacks
  this.agentResponseHandler.onMessage((message) => {
    if (this.onMessageCallback) {
      this.onMessageCallback(message);
    }
  });
  
  this.userInputHandler.onVoiceActivity((activity) => {
    if (this.onVoiceActivityCallback) {
      this.onVoiceActivityCallback(activity);
    }
  });
}
```

### Event Routing
```typescript
private handleDataChannelMessage(data: string): void {
  const realtimeEvent = JSON.parse(data);
  
  // Route to appropriate handler
  switch (realtimeEvent.type) {
    // User events → UserInputHandler
    case 'conversation.item.input_audio_transcription.completed':
      this.userInputHandler.handleTranscriptEvent(realtimeEvent);
      break;
    
    // Agent events → AgentResponseHandler
    case 'response.created':
      this.agentResponseHandler.handleResponseCreated(realtimeEvent);
      break;
      
    case 'response.audio_transcript.delta':
      this.agentResponseHandler.handleAudioTranscriptDelta(realtimeEvent);
      break;
      
    case 'response.audio_transcript.done':
      this.agentResponseHandler.handleAudioTranscriptDone(realtimeEvent);
      break;
      
    case 'response.done':
      this.agentResponseHandler.handleResponseDone(realtimeEvent);
      break;
      
    case 'response.cancelled':
      this.agentResponseHandler.handleResponseCancelled(realtimeEvent);
      break;
      
    // Session/error events stay in main service
    case 'session.created':
    case 'session.update':
    case 'error':
      // Handle in main service
      break;
  }
}
```

## Benefits

### ✅ Separation of Concerns
- User input logic isolated from agent response logic
- Each handler has clear, focused responsibilities
- Easier to understand and maintain

### ✅ Independent State Management
- User handler tracks: `isUserSpeaking`, `vadStartTime`, `vadEndTime`
- Agent handler tracks: `isAISpeaking`, `responseStartTime`, `responseEndTime`
- No state conflicts between user and agent processing

### ✅ Easier Testing
- Can unit test UserInputHandler independently
- Can unit test AgentResponseHandler independently
- Mock callbacks for isolated testing

### ✅ Better Code Organization
- ~200 lines each handler vs 1500+ line monolithic service
- Clear file structure: `services/handlers/`
- Easy to locate specific functionality

### ✅ Backward Compatibility
- All existing callbacks still work
- Main service forwards handler events to legacy callbacks
- No breaking changes to external API

## Constraints

### ❌ Shared WebRTC Connection
- Single `RTCPeerConnection` for both directions
- Cannot create separate connections
- Protocol limitation, not code limitation

### ❌ Single Data Channel
- All events come through one `DataChannel.onmessage`
- Main service must route events
- Cannot create separate channels per handler

### ❌ Microphone Control
- Microphone muting affects both handlers
- Agent handler requests mute via callback
- Main service executes mute (owns MediaStream)

## File Structure

```
BehavioralHealthSystem.Web/src/services/
├── azureOpenAIRealtimeService.ts          (Main service - 1500 lines)
└── handlers/
    ├── UserInputHandler.ts                (User handler - ~180 lines)
    └── AgentResponseHandler.ts            (Agent handler - ~280 lines)
```

## Migration Notes

### What Changed
- VAD setup moved from main service to UserInputHandler
- Agent response handling moved to AgentResponseHandler
- Event routing logic added to main service
- Handlers initialized in constructor
- Cleanup updated to clean handlers

### What Stayed the Same
- Public API of main service (no breaking changes)
- WebRTC connection setup
- Session management
- Function calling
- All external callbacks still work

### Deprecated
- `startVoiceActivityMonitoring()` - Now in UserInputHandler
- Direct VAD interval management - Delegated to handler

## Testing Checklist

- [ ] VAD still detects user speech
- [ ] User transcripts appear correctly
- [ ] Agent responses play correctly
- [ ] Agent transcripts appear correctly
- [ ] Microphone mutes BEFORE agent speaks
- [ ] Microphone unmutes 1.5s AFTER agent finishes
- [ ] Response cancellation unmutes immediately
- [ ] Function calling still works
- [ ] Session pause/resume works
- [ ] PHQ assessments still trigger
- [ ] Cleanup releases all resources
- [ ] No memory leaks (check timeout cleanup)

## Future Enhancements

### Potential Improvements
1. **Separate VAD Configuration**
   - Allow different thresholds for user vs agent detection
   - Independent sensitivity settings

2. **Enhanced Agent Handler**
   - Track multiple concurrent responses
   - Support response queuing
   - Advanced muting strategies

3. **User Handler Extensions**
   - Noise profile learning
   - Speaker identification
   - Custom VAD algorithms

4. **Testing Infrastructure**
   - Mock handlers for testing
   - Handler-level unit tests
   - Integration test suite

5. **Performance Monitoring**
   - Handler-specific metrics
   - Performance profiling per handler
   - Resource usage tracking

## Conclusion

The separated handler architecture provides a clean, maintainable structure for managing user input and agent responses independently while sharing the necessary WebRTC infrastructure. This design improves code quality without sacrificing functionality or backward compatibility.
