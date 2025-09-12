# Behavioral Health System Console Test Interface

This console application provides an interactive interface to test the Behavioral Health Group Chat system with its PHQ-2 and PHQ-9 agents.

## Setup

1. **Set your OpenAI API Key** (choose one method):

   ```bash
   # Method 1: Environment variable
   set OPENAI_API_KEY=your-openai-api-key-here
   
   # Method 2: User secrets (recommended for development)
   dotnet user-secrets set "OpenAI:ApiKey" "your-openai-api-key-here"
   
   # Method 3: Edit appsettings.json (not recommended for production)
   ```

2. **Run the application**:
   ```bash
   dotnet run
   ```

## Usage

### PHQ-2 Agent Commands
- `start phq2` or `begin phq2` - Start PHQ-2 rapid screening
- `phq2 status` - Get current assessment status
- `phq2 results` - Get assessment results
- `clinical info` - Get clinical information about PHQ-2
- Answer with numbers 0-3 when prompted

### PHQ-9 Agent Commands
- `start phq9` or `begin phq9` - Start PHQ-9 comprehensive assessment
- `phq9 status` - Get current assessment status
- `phq9 results` - Get assessment results
- Answer with numbers 0-3 when prompted

### General Commands
- `agents` - Show available agents
- `help` - Show help message
- `clear` - Clear the console
- `quit` or `exit` - Exit the application

## Testing Scenarios

1. **Test PHQ-2 Screening**:
   ```
   You: start phq2
   Agent: [Starts PHQ-2 assessment]
   You: 2
   Agent: [Records response and continues]
   ```

2. **Test PHQ-9 Assessment**:
   ```
   You: begin phq9
   Agent: [Starts PHQ-9 assessment]
   You: 1
   Agent: [Records response and continues]
   ```

3. **Test Agent Routing**:
   ```
   You: I want to do a depression screening
   Agent: [Coordinator routes to appropriate agent]
   ```

## Features

- **Automatic Agent Routing**: The Coordinator Agent intelligently routes messages
- **Interactive Sessions**: Maintains state during assessments
- **Rich Formatting**: Responses are formatted for better readability
- **Error Handling**: Graceful handling of errors and invalid inputs
- **Logging**: Comprehensive logging for debugging
- **User-Friendly**: Clear instructions and help system