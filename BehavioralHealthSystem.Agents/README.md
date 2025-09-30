# Behavioral Health System - AI Agents

A sophisticated AI agent system providing specialized behavioral health assessments through multi-agent coordination, intelligent handoffs, and real-time communication capabilities.

## 🚀 Overview

This project implements a comprehensive multi-agent system designed specifically for behavioral health assessments, featuring specialized agents for different assessment types, intelligent coordination, and seamless handoff capabilities.

### Key Features

- ✅ **Multi-Agent Architecture** - Specialized agents for different behavioral health assessments
- ✅ **Intelligent Handoffs** - Seamless transitions between agents based on context
- ✅ **Real-Time Communication** - Integration with SignalR for live interactions
- ✅ **Crisis Detection** - Automatic routing to appropriate crisis intervention agents
- ✅ **Session Management** - Persistent conversation context and state management
- ✅ **Extensible Design** - Easy addition of new specialized agents

## 📁 Project Structure

```text
BehavioralHealthSystem.Agents/
├── 📁 Agents/                       # Individual agent implementations
│   ├── ComedianAgent.cs            # Humor-based interaction agent
│   ├── CoordinatorAgent.cs         # Main coordination and routing agent
│   ├── Phq2Agent.cs               # PHQ-2 rapid depression screening
│   └── Phq9Agent.cs               # PHQ-9 comprehensive depression assessment
├── 📁 Chat/                        # Group chat orchestration
│   └── BehavioralHealthGroupChat.cs # Multi-agent chat coordination
├── 📁 Handoff/                     # Agent handoff system
│   ├── AgentHandoffCoordinator.cs  # Handoff orchestration logic
│   └── HandoffSession.cs          # Session handoff management
├── 📁 Interfaces/                  # Agent and handoff interfaces
│   ├── IChatAgent.cs              # Base chat agent interface
│   ├── IHandoffAgent.cs           # Handoff-capable agent interface
│   └── IHandoffAuditLogger.cs     # Handoff audit logging interface
├── 📁 Models/                      # Agent-specific data models
│   ├── AgentResponse.cs           # Agent response structure
│   ├── HandoffRequest.cs          # Handoff request data
│   └── SessionContext.cs         # Session context information
├── 📁 Services/                    # Agent support services
│   ├── AgentCommunicationService.cs # Agent-to-agent communication
│   └── SessionContextService.cs   # Session context management
├── 📄 GlobalSuppressions.cs       # Code analysis suppressions
├── 📄 GlobalUsings.cs             # Global using directives
└── 📄 README.md                   # This documentation
```

## 🛠️ Technology Stack

### Core Technologies

- **🔢 .NET 8** - Latest .NET version with performance improvements
- **🤖 Microsoft Semantic Kernel** - AI orchestration and agent framework
- **📡 Azure OpenAI** - Advanced language model integration
- **💉 Microsoft.Extensions.DependencyInjection** - Dependency injection framework

### AI & ML Integration

- **🧠 Semantic Kernel Agents** - Agent framework and orchestration
- **📝 Natural Language Processing** - Advanced text understanding and generation
- **🎯 Context Management** - Persistent conversation context across agents
- **🔄 Workflow Orchestration** - Complex multi-step assessment workflows

## Agents

### PHQ-9 Agent (`Phq9Agent`)

The PHQ-9 Agent administers and manages the Patient Health Questionnaire-9, a validated screening tool for depression.

**Features:**
- Administer the complete 9-question PHQ-9 assessment
- Validate responses (0-3 scale for each question)
- Calculate total scores and determine severity levels
- Store and retrieve assessment results
- Provide clinical recommendations based on scores
- Detect suicidal ideation (Question 9)

**Available Functions:**
- `StartAssessment(userId)` - Begin a new PHQ-9 assessment
- `RecordResponse(userId, questionNumber, score)` - Record response to a question
- `CompleteAssessment(userId)` - Complete and score the assessment
- `GetResults(userId, assessmentId?)` - Retrieve assessment results
- `GetAssessmentStatus(userId)` - Check current assessment progress

### Coordinator Agent (`CoordinatorAgent`)

The Coordinator Agent manages workflows and routes requests between specialized agents with enhanced real-time capabilities.

**Enhanced Features:**
- Route user requests to appropriate specialized agents
- Coordinate multi-step workflows with real-time updates
- Aggregate results from multiple agents
- Provide unified responses to users
- **Crisis Detection** - Intelligent identification of emergency situations
- **Agent Handoff Management** - Seamless transitions with context preservation
- **Real-time Notifications** - Live updates to clients during agent changes

### Communication Features

The agent system includes sophisticated real-time communication capabilities:

**SignalR Integration:**
- **Live Messaging** - Real-time bidirectional communication
- **Typing Indicators** - Visual feedback during agent processing
- **Handoff Notifications** - Seamless agent transition announcements
- **Session Tracking** - Persistent session management across interactions

**Agent Handoff System:**
- **Intelligent Routing** - Automatic agent selection based on user needs
- **Context Preservation** - Seamless information transfer between agents
- **Crisis Escalation** - Immediate routing to crisis intervention specialists
- **Performance Monitoring** - Real-time tracking of agent response times

## Agent Communication Hub

The system includes a comprehensive communication infrastructure:

```csharp
// SignalR Hub for real-time agent communication
public class AgentCommunicationHub : Hub
{
    // Real-time messaging endpoints
    public async Task SendUserMessage(string sessionId, string message);
    public async Task NotifyAgentHandoff(string sessionId, AgentHandoffInfo handoff);
    public async Task SendTypingIndicator(string sessionId, string agentName);
}
```

**Available Endpoints:**
- `GET /api/negotiate` - SignalR connection negotiation
- `POST /api/sendagentmessage` - Agent-to-client messaging
- `POST /api/notifyagenthandoff` - Agent handoff notifications
- `POST /api/notifyagenttyping` - Typing indicator updates
- `POST /api/joinsession` - Session management
- `POST /api/sendusermessage` - User message processing

## PHQ-9 Questionnaire

The PHQ-9 consists of 9 questions about depression symptoms over the last 2 weeks:

1. Little interest or pleasure in doing things
2. Feeling down, depressed, or hopeless
3. Trouble falling or staying asleep, or sleeping too much
4. Feeling tired or having little energy
5. Poor appetite or overeating
6. Feeling bad about yourself — or that you are a failure or have let yourself or your family down
7. Trouble concentrating on things, such as reading the newspaper or watching television
8. Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual
9. Thoughts that you would be better off dead or of hurting yourself in some way

**Scoring:**
- Each question is rated 0-3:
  - 0 = Not at all
  - 1 = Several days
  - 2 = More than half the days
  - 3 = Nearly every day

**Severity Levels:**
- 0-4: Minimal depression
- 5-9: Mild depression
- 10-14: Moderate depression
- 15-19: Moderately severe depression
- 20-27: Severe depression

## Usage

### Basic Setup

```csharp
// Add to your service collection
services.AddBehavioralHealthAgents(configuration);

// Initialize the service
var agentService = serviceProvider.GetRequiredService<BehavioralHealthAgentService>();
await agentService.InitializeAsync();
```

### Using the PHQ-9 Agent

```csharp
// Start an assessment
var result = await agentService.ProcessPhq9RequestAsync("user123", "start");

// Record responses
for (int i = 1; i <= 9; i++)
{
    var score = GetUserResponse(); // 0-3
    result = await agentService.RecordPhq9ResponseAsync("user123", i, score);
}

// Get results
var results = await agentService.ProcessPhq9RequestAsync("user123", "results");
```

### Using the Group Chat

```csharp
// Process natural language requests
var response = await agentService.ProcessUserMessageAsync("user123", "I'd like to take a depression assessment");

// The coordinator will route to the appropriate agent
var response2 = await agentService.ProcessUserMessageAsync("user123", "Start PHQ-9 assessment");
```

## Configuration

The agents require OpenAI or Azure OpenAI configuration:

```json
{
  "OpenAI": {
    "Endpoint": "https://your-azure-openai.openai.azure.com/",
    "ApiKey": "your-api-key",
    "DeploymentName": "gpt-4"
  }
}
```

## Data Models

### `Phq9Assessment`
- Contains user responses, scores, and severity calculation
- Tracks completion status and timestamps
- Includes suicidal ideation warnings

### `Phq9Response`
- Individual question responses with timestamps
- Validated score values (0-3)

### `Phq9Question`
- Standardized question text and descriptions
- Clinical significance explanations

## Security Considerations

- All PHQ-9 data is stored in-memory by default
- Consider implementing persistent storage for production use
- Question 9 responses (suicidal ideation) trigger special warnings
- Ensure appropriate clinical oversight and crisis protocols

## Future Enhancements

- Additional assessment tools (GAD-7, Beck Depression Inventory)
- Persistent data storage
- Integration with clinical workflows
- Multi-language support
- Trend analysis and longitudinal tracking

## Dependencies

- Microsoft.SemanticKernel
- Microsoft.SemanticKernel.Agents.Core
- Microsoft.SemanticKernel.Agents.OpenAI
- Azure.AI.OpenAI
- Microsoft.Extensions.Logging
- Microsoft.Extensions.DependencyInjection