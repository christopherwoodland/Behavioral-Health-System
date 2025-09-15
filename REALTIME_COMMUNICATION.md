# Real-Time Agent Communication System

This document describes the real-time communication system implemented for the Behavioral Health System using SignalR and Azure Functions.

## Overview

The system enables real-time bidirectional communication between the frontend Agent Experience UI and backend agent systems, supporting:

- **Real-time messaging** between users and behavioral health agents
- **Agent handoff** with seamless transitions between specialized agents
- **Typing indicators** to show when agents are processing responses
- **Session management** with unique session IDs for each user interaction
- **Speech integration** with voice input/output capabilities
- **Crisis detection** and appropriate agent routing

## Architecture

### Backend Components

#### 1. AgentCommunicationHub.cs
SignalR hub that handles real-time communication:

**Endpoints:**
- `GET /api/negotiate` - SignalR connection negotiation
- `POST /api/sendagentmessage` - Send message from agent to client
- `POST /api/notifyagenthandoff` - Notify client of agent handoff
- `POST /api/notifyagenttyping` - Send typing indicators
- `POST /api/joinsession` - Join a communication session
- `POST /api/sendusermessage` - Process user messages

**Features:**
- Group-based session management
- Message broadcasting to session participants
- Agent handoff notifications
- Typing indicator management

#### 2. RealtimeAgentOrchestrator.cs
Processes user input and coordinates agent responses:

**Functionality:**
- Processes user messages through agent handoff system
- Crisis detection and routing
- Confidence scoring for agent responses
- Mock agent simulation (for development)
- Session status tracking

#### 3. SignalR Configuration
- Added Microsoft.Azure.Functions.Worker.Extensions.SignalRService package
- Configured SignalR service in Program.cs
- Environment variable for Azure SignalR connection string

### Frontend Components

#### 1. signalRService.ts
TypeScript service for SignalR client communication:

**Features:**
- Connection management with automatic reconnection
- Event handling for messages, handoffs, typing indicators
- Session management and status tracking
- Error handling and connection state monitoring

**Key Methods:**
- `connect()` - Establish SignalR connection
- `joinSession()` - Join a communication session
- `sendMessage()` - Send user messages to backend
- Event handlers for real-time updates

#### 2. useSignalR.ts
React hook for managing SignalR state:

**State Management:**
- Connection status tracking
- Real-time message collection
- Agent handoff notifications
- Typing indicators by agent
- Session status and participants

**Actions:**
- Connection lifecycle management
- Message sending with metadata
- Session joining and management
- Error handling and recovery

#### 3. Enhanced Agent Experience UI
Updated React component with real-time capabilities:

**New Features:**
- Real-time connection status indicator
- SignalR message integration with local chat
- Agent handoff visual feedback
- Typing indicators from multiple agents
- Session ID display
- Fallback to mock behavior when offline

## Usage

### Starting the System

1. **Backend (Azure Functions):**
   ```powershell
   cd BehavioralHealthSystem.Functions
   func start
   ```

2. **Frontend (React):**
   ```powershell
   cd BehavioralHealthSystem.Web
   npm start
   ```

### Configuration

#### Local Development
- SignalR connection uses default local endpoint: `http://localhost:7071/api`
- No Azure SignalR service required for local development
- CORS enabled for cross-origin requests

#### Production
- Set `AzureSignalRConnectionString` environment variable
- Configure Azure SignalR Service resource
- Update frontend `signalRService.ts` baseUrl if needed

### Session Flow

1. **Connection:** Frontend establishes SignalR connection on load
2. **Session Join:** Generates unique session ID and joins session
3. **Messaging:** User sends messages through SignalR to backend
4. **Processing:** RealtimeAgentOrchestrator processes message through agent system
5. **Response:** Agents send responses back through SignalR hub
6. **Handoff:** System automatically handles agent transitions with notifications

## Message Types

### User Message
```typescript
interface UserMessage {
  content: string;
  timestamp: string;
  audioData?: string;
  metadata?: {
    speechConfidence?: number;
    voiceActivityLevel?: number;
    processingTime?: number;
  };
}
```

### Agent Message
```typescript
interface AgentMessage {
  agentName: string;
  content: string;
  timestamp: string;
  confidence?: number;
  suggestedActions?: string[];
}
```

### Agent Handoff
```typescript
interface AgentHandoffNotification {
  fromAgent: string;
  toAgent: string;
  reason: string;
  timestamp: string;
  userContext?: any;
}
```

## Integration Points

### Speech System
- Voice input metadata included in SignalR messages
- Speech confidence scores sent to backend
- Voice activity levels for processing optimization

### Agent Handoff System
- Real-time notifications when agents change
- Seamless transition between specialized agents
- Context preservation across handoffs

### Crisis Detection
- Immediate routing to crisis intervention agents
- Real-time alerts and escalation procedures
- Emergency contact integration

## Monitoring and Debugging

### Connection Status
- Real-time connection indicator in UI
- Connection state monitoring in console
- Automatic reconnection with session rejoin

### Message Flow
- Console logging for all SignalR events
- Message timestamps for latency tracking
- Error handling with user notifications

### Session Management
- Session ID display for debugging
- Participant tracking
- Session status monitoring

## Future Enhancements

1. **Authentication Integration**
   - User identity in SignalR connections
   - Secure session management
   - Role-based agent access

2. **Message Persistence**
   - Chat history storage
   - Session replay capabilities
   - Analytics and reporting

3. **Advanced Agent Features**
   - Multi-agent collaboration
   - Agent availability status
   - Queue management for busy periods

4. **Performance Optimization**
   - Connection pooling
   - Message batching
   - Caching for frequent responses

## Troubleshooting

### Common Issues

1. **SignalR Connection Failed**
   - Check Azure Functions is running on port 7071
   - Verify CORS configuration
   - Check network connectivity

2. **Messages Not Delivered**
   - Verify session ID is set correctly
   - Check SignalR connection state
   - Monitor console for errors

3. **Agent Handoff Not Working**
   - Ensure agent handoff coordinator is properly initialized
   - Check mock agent responses in development
   - Verify notification event handlers

### Development Mode
- Fallback to mock responses when SignalR unavailable
- Local session simulation
- Console logging for all events