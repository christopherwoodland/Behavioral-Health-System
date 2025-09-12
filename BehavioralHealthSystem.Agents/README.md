# BehavioralHealthSystem.Agents

This project contains AI agents built with Microsoft Semantic Kernel for behavioral health assessments and workflows.

## Overview

The agents use the Group Chat multi-agent architecture to collaborate and provide comprehensive behavioral health services. The initial implementation focuses on the PHQ-9 (Patient Health Questionnaire-9) depression assessment.

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

The Coordinator Agent manages workflows and routes requests between specialized agents.

**Features:**
- Route user requests to appropriate specialized agents
- Coordinate multi-step workflows
- Aggregate results from multiple agents
- Provide unified responses to users

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