# Utterance Tracking System

## Overview

The Azure OpenAI Realtime Service now includes comprehensive utterance tracking that identifies and tracks both user and agent speech in real-time. This system provides enhanced speaker identification, duration measurement, interruption detection, and links messages back to their originating speech events.

## Key Features

### 1. **Speaker Identification**
Every message now includes:
- `speaker: 'user' | 'agent'` - Explicit speaker identification
- `utteranceId: string` - Links message to the speech event that generated it

### 2. **Real-Time Speech Events**
Track speech from start to completion:
- `speech-start` - When speaking begins
- `speech-in-progress` - While speaking continues (agent only)
- `speech-complete` - When speaking finishes

### 3. **Duration Measurement**
Automatically measures speech duration in milliseconds:
- `startTime` - When speech began (timestamp)
- `endTime` - When speech completed (timestamp)
- `duration` - Total speech length in ms

### 4. **Interruption Detection**
Detects when speech is interrupted:
- `isInterrupted: true` - Speech was cut off before natural completion
- `wasInterrupted: true` - Message field indicating interruption

## Data Structures

### Utterance Interface

```typescript
export interface Utterance {
  id: string;                                              // Unique ID: 'user_1234567890' or 'agent_1234567890'
  speaker: 'user' | 'agent';                                // Who is speaking
  type: 'speech-start' | 'speech-in-progress' | 'speech-complete';  // Speech lifecycle stage
  content: string;                                          // Transcript text (accumulates)
  startTime: number;                                        // Start timestamp
  endTime?: number;                                         // End timestamp (when complete)
  duration?: number;                                        // Duration in ms (when complete)
  isInterrupted?: boolean;                                  // True if speech was cut off
}
```

### Enhanced RealtimeMessage Interface

```typescript
export interface RealtimeMessage {
  // ... existing fields ...
  
  // New utterance tracking fields:
  utteranceId?: string;        // Links to Utterance.id
  speaker?: 'user' | 'agent';  // Explicit speaker
  speechDuration?: number;     // Duration in ms
  wasInterrupted?: boolean;    // If speech was interrupted
}
```

## Usage

### 1. Register Utterance Callback

```typescript
const realtimeService = new AzureOpenAIRealtimeService();

// Listen to utterance events
realtimeService.onUtterance((utterance: Utterance) => {
  console.log(`${utterance.speaker} ${utterance.type}:`, utterance.content);
  
  if (utterance.type === 'speech-complete') {
    console.log(`Duration: ${utterance.duration}ms`);
    console.log(`Interrupted: ${utterance.isInterrupted}`);
  }
});
```

### 2. Retrieve Utterances

```typescript
// Get all utterances
const allUtterances = realtimeService.getUtterances();

// Get only user utterances
const userUtterances = realtimeService.getUtterancesBySpeaker('user');

// Get only agent utterances
const agentUtterances = realtimeService.getUtterancesBySpeaker('agent');
```

### 3. Clear Utterance History

```typescript
// Clear all tracked utterances
realtimeService.clearUtterances();
```

### 4. Link Messages to Utterances

```typescript
realtimeService.onMessage((message: RealtimeMessage) => {
  if (message.utteranceId) {
    // Get the full utterance details
    const utterances = realtimeService.getUtterances();
    const utterance = utterances.find(u => u.id === message.utteranceId);
    
    console.log('Message linked to utterance:', utterance);
    console.log('Speaker:', message.speaker);
    console.log('Duration:', message.speechDuration);
    console.log('Interrupted:', message.wasInterrupted);
  }
});
```

## Event Flow

### User Speech Flow

1. **User starts speaking** → `input_audio_buffer.speech_started`
   - Creates new utterance: `type: 'speech-start'`
   - Utterance ID: `user_1234567890`

2. **User stops speaking** → Processing happens

3. **Transcript completed** → `conversation.item.input_audio_transcription.completed`
   - Updates utterance: `type: 'speech-complete'`
   - Calculates duration
   - Links message to utterance via `utteranceId`

### Agent Speech Flow

1. **Agent starts responding** → `response.created`
   - Creates new utterance: `type: 'speech-start'`
   - Utterance ID: `agent_1234567890`

2. **Agent is speaking** → `response.audio_transcript.delta` (streaming)
   - Updates utterance: `type: 'speech-in-progress'`
   - Accumulates transcript content

3. **Agent finishes** → `response.audio_transcript.done`
   - Updates utterance: `type: 'speech-complete'`
   - Calculates duration
   - Links message to utterance via `utteranceId`

4. **Agent interrupted** → `response.cancelled`
   - Marks utterance: `isInterrupted: true`
   - Calculates partial duration

## Example: Real-Time Transcript with Speaker Labels

```typescript
const realtimeService = new AzureOpenAIRealtimeService();

// Track utterances in real-time
realtimeService.onUtterance((utterance) => {
  const label = utterance.speaker === 'user' ? '👤 User' : '🤖 Agent';
  
  switch (utterance.type) {
    case 'speech-start':
      console.log(`${label} started speaking...`);
      break;
      
    case 'speech-in-progress':
      console.log(`${label}: ${utterance.content}`);
      break;
      
    case 'speech-complete':
      const status = utterance.isInterrupted ? '⚠️ (interrupted)' : '✅';
      console.log(`${label} finished ${status}: ${utterance.content}`);
      console.log(`Duration: ${utterance.duration}ms`);
      break;
  }
});
```

## Example: Conversation Analytics

```typescript
// Get all completed utterances
const utterances = realtimeService.getUtterances()
  .filter(u => u.type === 'speech-complete');

// Calculate statistics
const userUtterances = utterances.filter(u => u.speaker === 'user');
const agentUtterances = utterances.filter(u => u.speaker === 'agent');

const avgUserDuration = userUtterances.reduce((sum, u) => sum + (u.duration || 0), 0) / userUtterances.length;
const avgAgentDuration = agentUtterances.reduce((sum, u) => sum + (u.duration || 0), 0) / agentUtterances.length;

const interruptions = utterances.filter(u => u.isInterrupted).length;

console.log('Conversation Analytics:');
console.log(`User turns: ${userUtterances.length}, avg ${avgUserDuration}ms`);
console.log(`Agent turns: ${agentUtterances.length}, avg ${avgAgentDuration}ms`);
console.log(`Interruptions: ${interruptions}`);
```

## Benefits

1. **Clear Speaker Attribution**: No ambiguity about who said what
2. **Real-Time Monitoring**: Track speech as it happens
3. **Duration Analysis**: Understand conversation pacing
4. **Interruption Detection**: Identify when conversations are cut off
5. **Message Traceability**: Link final messages back to original speech events
6. **Conversation Analytics**: Build metrics and insights from speech data

## Integration with Existing Code

The utterance tracking system is **fully backward compatible**. Existing code continues to work without changes:

- `onMessage()` callbacks still receive messages
- New fields are optional: `utteranceId`, `speaker`, `speechDuration`, `wasInterrupted`
- You can ignore utterance tracking if not needed

To adopt utterance tracking, simply:
1. Register `onUtterance()` callback
2. Use new fields in `RealtimeMessage`
3. Query utterances with `getUtterances()` methods

## Console Logging

The system logs utterance events for debugging:

```
🎤 Speech started: user (user_1701234567890)
✅ Speech completed: user (user_1701234567890) - 2341ms

🎤 Speech started: agent (agent_1701234570234)
✅ Speech completed: agent (agent_1701234570234) - 3456ms

⚠️ Speech interrupted: agent (agent_1701234573690)
```

## Architecture

The tracking system integrates with the existing independent handler architecture:

- **UserInputHandler**: Manages user VAD and transcripts
- **AgentResponseHandler**: Manages agent responses and mic muting
- **Main Service**: Coordinates both + tracks utterances centrally

Utterance tracking sits at the main service level because it needs to coordinate data from both handlers and link messages across the entire conversation flow.
