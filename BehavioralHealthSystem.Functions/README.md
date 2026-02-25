# Behavioral Health System - Azure Functions Backend

A comprehensive Azure Functions backend providing REST API endpoints, real-time communication, and AI agent orchestration for the Behavioral Health System.

## 🚀 Overview

This Azure Functions project serves as the backend API for the behavioral health platform, providing secure endpoints for session management, audio analysis, AI agent interactions, and real-time communication via SignalR.

### Key Features

- ✅ **Azure Functions Isolated Process** - .NET 8 isolated worker process
- ✅ **Dependency Injection** - Comprehensive DI container with service registration
- ✅ **FluentValidation** - Input validation with detailed error messages
- ✅ **Polly Retry Policies** - Resilient API calls with exponential backoff
- ✅ **SignalR Integration** - Real-time bidirectional communication
- ✅ **Application Insights** - Comprehensive telemetry and monitoring
- ✅ **Health Checks** - Automated health monitoring and diagnostics

## 📁 Project Structure

```text
BehavioralHealthSystem.Functions/
├── 📁 Functions/                    # Azure Function endpoints
│   ├── AgentCommunicationHub.cs     # SignalR hub for real-time communication
│   ├── FileGroupFunctions.cs        # File group CRUD operations
│   ├── GrammarCorrectionFunction.cs # Grammar correction services
│   ├── HealthCheckFunction.cs       # Health monitoring endpoint
│   ├── RiskAssessmentFunctions.cs   # Risk assessment and prediction APIs
│   ├── SessionStorageFunctions.cs   # Session data management
│   ├── SimpleAgentOrchestrator.cs   # Agent orchestration and handoff
│   ├── TestFunctions.cs            # Testing and utility endpoints
│   └── TranscriptionFunction.cs    # Audio transcription services
├── 📁 Services/                     # Business logic services
│   └── FunctionErrorHandlingService.cs # Centralized error handling
├── 📄 GlobalUsings.cs               # Global using directives
├── 📄 Program.cs                    # Function host configuration
├── 📄 host.json                     # Azure Functions runtime configuration
└── 📄 local.settings.json.template  # Local development settings template
```

## 🛠️ Technology Stack

### Core Technologies

- **⚡ Azure Functions v4** - Serverless compute platform
- **🔢 .NET 8** - Latest .NET with isolated worker process
- **📊 Application Insights** - Telemetry and performance monitoring
- **🔄 SignalR** - Real-time bidirectional communication
- **💾 Azure Blob Storage** - File storage and session persistence

### Libraries & Frameworks

- **FluentValidation** - Input validation with fluent syntax
- **Polly** - Resilience and transient-fault-handling library
- **System.Text.Json** - High-performance JSON serialization
- **Azure.Storage.Blobs** - Azure Blob Storage SDK
- **Microsoft.AspNetCore.SignalR** - SignalR server implementation

## 🚀 Getting Started

### Prerequisites

- **.NET 8.0 SDK** - [Download here](https://dotnet.microsoft.com/download/dotnet/8.0)
- **Azure Functions Core Tools v4** - [Installation guide](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local)
- **Azure CLI** (optional) - For deployment and resource management

### Local Development Setup

1. **Navigate to the Functions project directory:**

   ```bash
   cd BehavioralHealthSystem.Functions
   ```

2. **Create local settings file:**

   ```bash
   copy local.settings.json.template local.settings.json
   # Edit local.settings.json with your configuration
   ```

3. **Install dependencies and build:**

   ```bash
   dotnet restore
   dotnet build
   ```

4. **Start the Functions host:**

   ```bash
   func start
   ```

   The Functions will be available at `http://localhost:7071`

### Environment Configuration

Create and configure `local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "AzureWebJobsStorage__accountName": "your-storage-account-name",
    "AzureWebJobsStorage__blobServiceUri": "https://your-storage-account-name.blob.core.windows.net",
    "AzureWebJobsStorage__queueServiceUri": "https://your-storage-account-name.queue.core.windows.net",
    "AzureWebJobsStorage__tableServiceUri": "https://your-storage-account-name.table.core.windows.net",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    
    "KINTSUGI_API_KEY": "your-kintsugi-api-key",
    "KINTSUGI_BASE_URL": "https://api.kintsugihealth.com/v2",
    "KINTSUGI_TIMEOUT_SECONDS": "300",
    "KINTSUGI_MAX_RETRY_ATTEMPTS": "3",
    "KINTSUGI_RETRY_DELAY_MS": "1000",
    
    "APPLICATIONINSIGHTS_CONNECTION_STRING": "your-app-insights-connection-string",
    
    "AzureSignalRConnectionString": "your-signalr-connection-string",
    
    "AZURE_SPEECH_ENDPOINT": "https://your-region.api.cognitive.microsoft.com/",
    "AZURE_SPEECH_API_KEY": "your-speech-api-key",
    
    "OPENAI_API_KEY": "your-openai-api-key",
    "OPENAI_ENDPOINT": "https://api.openai.com/v1"
  },
  "Host": {
    "CORS": "*",
    "CORSCredentials": false
  }
}
```

## 📡 API Endpoints

### Health & Monitoring

#### GET `/api/health`

Health check endpoint with detailed status information.

**Response:**

```json
{
  "status": "Healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "totalDuration": 45.2,
  "entries": {
    "kintsugi-api": {
      "status": "Healthy",
      "description": "Kintsugi API service is configured",
      "duration": 12.1
    }
  }
}
```

### Session Management

#### POST `/api/sessions/initiate`

Create a new behavioral health assessment session.

**Request:**

```json
{
  "userId": "user-123",
  "metadata": {
    "age": 28,
    "gender": "female",
    "race": "white",
    "ethnicity": "Hispanic, Latino, or Spanish Origin",
    "weight": 140,
    "zipcode": "90210",
    "language": true
  },
  "audioFileUrl": "https://storage.blob.core.windows.net/audio/file.wav",
  "audioFileName": "recording.wav"
}
```

**Response:**

```json
{
  "success": true,
  "sessionId": "95afd12a-37bd-4002-82b8-00bf79e473b4",
  "status": "processing",
  "message": "Session initiated successfully"
}
```

#### GET `/api/sessions`

Get all sessions for the current user.

#### GET `/api/sessions/{sessionId}`

Get specific session details.

#### DELETE `/api/sessions/{sessionId}`

Delete a session and associated data.

### Risk Assessment & Predictions

#### POST `/api/predictions/submit`

Submit audio data for behavioral health analysis.

**Request (URL-based):**

```json
{
  "sessionId": "session-id",
  "audioFileUrl": "https://storage.blob.core.windows.net/audio/file.wav",
  "audioFileName": "recording.wav"
}
```

**Request (Base64 data):**

```json
{
  "userId": "user-123",
  "metadata": { /* user metadata */ },
  "audioData": "base64-encoded-audio-data"
}
```

#### GET `/api/predictions/{userId}`

Get all predictions for a user.

#### GET `/api/predictions/sessions/{sessionId}`

Get prediction results for a specific session.

### File Group Management

#### POST `/api/filegroups`

Create a new file group.

#### GET `/api/filegroups`

Get all file groups for the current user.

#### DELETE `/api/filegroups/{groupName}`

Delete a file group and associated files.

### AI Agent Communication

#### POST `/api/sendusermessage`

Send a message to the AI agent system.

**Request:**

```json
{
  "sessionId": "session-id",
  "message": "I want to start a PHQ-2 assessment",
  "audioData": "optional-base64-audio",
  "metadata": {
    "speechConfidence": 0.95,
    "voiceActivityLevel": 0.8
  }
}
```

#### SignalR Hub `/api`

Real-time communication endpoints:

- `POST /api/negotiate` - SignalR connection negotiation
- `POST /api/sendagentmessage` - Send message from agent to client
- `POST /api/notifyagenthandoff` - Notify client of agent handoff
- `POST /api/notifyagenttyping` - Send typing indicators
- `POST /api/joinsession` - Join a communication session

### Transcription Services

#### POST `/api/transcription/start`

Start audio transcription using Azure Speech Services.

#### GET `/api/transcription/{transcriptionId}`

Get transcription status and results.

### Grammar Correction

#### POST `/api/grammar/correct`

Correct grammar in text using OpenAI.

**Request:**

```json
{
  "text": "the quick brown fox jump over the lazy dog",
  "sessionId": "optional-session-id"
}
```

**Response:**

```json
{
  "originalText": "the quick brown fox jump over the lazy dog",
  "correctedText": "The quick brown fox jumps over the lazy dog.",
  "hasChanges": true,
  "confidence": 0.95
}
```

### Testing & Utilities

#### POST `/api/TestKintsugiConnection`

Test connectivity to the Kintsugi Health API.

#### GET `/api/test/echo`

Echo endpoint for testing API connectivity.

## 🔧 Configuration

### Dependency Injection Setup

The Functions app uses comprehensive dependency injection configured in `Program.cs`:

```csharp
var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices((context, services) =>
    {
        var configuration = context.Configuration;
        
        // Configure typed options
        services.Configure<KintsugiApiOptions>(
            configuration.GetSection("Values"));
        
        // Register HTTP clients with Polly policies
        services.AddHttpClient<IKintsugiApiService, KintsugiApiService>()
            .AddPolicyHandler(RetryPolicies.GetRetryPolicy())
            .AddPolicyHandler(RetryPolicies.GetTimeoutPolicy());
        
        // Register validators
        services.AddValidatorsFromAssemblyContaining<InitiateRequestValidator>();
        
        // Register business services
        services.AddTransient<IFileGroupStorageService, FileGroupStorageService>();
        services.AddTransient<ISessionStorageService, SessionStorageService>();
        
        // Add health checks
        services.AddHealthChecks()
            .AddCheck<KintsugiApiHealthCheck>("kintsugi-api");
        
        // Configure SignalR
        services.AddSignalR();
        
        // Add Application Insights
        services.AddApplicationInsightsTelemetryWorkerService();
    })
    .Build();
```

### Retry Policies Configuration

Polly retry policies provide resilience for external API calls:

```csharp
public static class RetryPolicies
{
    public static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
    {
        return Policy
            .HandleResult<HttpResponseMessage>(r => !r.IsSuccessStatusCode)
            .Or<HttpRequestException>()
            .WaitAndRetryAsync(
                retryCount: 3,
                sleepDurationProvider: retryAttempt => 
                    TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                onRetry: (outcome, timespan, retryCount, context) =>
                {
                    // Log retry attempts
                });
    }
    
    public static IAsyncPolicy<HttpResponseMessage> GetTimeoutPolicy()
    {
        return Policy.TimeoutAsync<HttpResponseMessage>(TimeSpan.FromSeconds(300));
    }
}
```

### Validation Configuration

FluentValidation provides comprehensive input validation:

```csharp
public class InitiateRequestValidator : AbstractValidator<InitiateRequest>
{
    public InitiateRequestValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User ID is required");
        
        RuleFor(x => x.Metadata.Age)
            .InclusiveBetween(1, 149)
            .When(x => x.Metadata.Age.HasValue)
            .WithMessage("Age must be between 1 and 149 years");
        
        RuleFor(x => x.Metadata.Gender)
            .Must(BeValidGender)
            .When(x => !string.IsNullOrEmpty(x.Metadata.Gender))
            .WithMessage("Invalid gender value");
    }
}
```

## 🔄 Real-Time Communication

### SignalR Hub Implementation

The `AgentCommunicationHub` provides real-time communication:

```csharp
public class AgentCommunicationHub : Hub
{
    [FunctionName("negotiate")]
    public static Task<SignalRConnectionInfo> GetSignalRInfo(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req,
        [SignalRConnectionInfo(HubName = "AgentHub")] SignalRConnectionInfo connectionInfo)
    {
        return Task.FromResult(connectionInfo);
    }
    
    [FunctionName("SendAgentMessage")]
    public static async Task SendAgentMessage(
        [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req,
        [SignalR(HubName = "AgentHub")] IAsyncCollector<SignalRMessage> signalRMessages)
    {
        var message = await req.ReadFromJsonAsync<AgentMessageRequest>();
        
        await signalRMessages.AddAsync(new SignalRMessage
        {
            UserId = message.UserId,
            Target = "ReceiveAgentMessage",
            Arguments = new object[] { message }
        });
    }
}
```

### Agent Orchestration

The `SimpleAgentOrchestrator` coordinates AI agent interactions:

```csharp
[Function("SendUserMessage")]
public async Task<HttpResponseData> SendUserMessage(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req)
{
    var userInput = await req.ReadFromJsonAsync<UserInputRequest>();
    
    // Process message through agent system
    var agentResponse = await ProcessUserInput(userInput);
    
    // Send response via SignalR
    await SendAgentMessage(userInput.SessionId, agentResponse);
    
    return await CreateResponse(req, HttpStatusCode.OK, new { success = true });
}
```

## 🧪 Testing

### Running Tests

```bash
# Run all tests from the solution root
dotnet test

# Run tests with coverage
dotnet test --collect:"XPlat Code Coverage"

# Run tests in watch mode
dotnet watch test
```

### Test Coverage

The Functions project has comprehensive unit tests covering:

- ✅ **Function Constructors** - Dependency injection validation
- ✅ **Model Validation** - FluentValidation rule testing
- ✅ **Service Integration** - Business logic testing
- ✅ **Error Handling** - Exception scenarios and recovery
- ✅ **API Contracts** - Request/response validation

### Manual Testing

Use the provided `test-requests.http` file with REST Client extension:

```http
### Health Check
GET http://localhost:7071/api/health

### Test Kintsugi Connection
POST http://localhost:7071/api/TestKintsugiConnection

### Create Session
POST http://localhost:7071/api/sessions/initiate
Content-Type: application/json

{
  "userId": "test-user-123",
  "metadata": {
    "age": 28,
    "gender": "female",
    "race": "white",
    "ethnicity": "Hispanic, Latino, or Spanish Origin",
    "weight": 140,
    "zipcode": "90210",
    "language": true
  },
  "audioFileUrl": "https://example.com/test-audio.wav",
  "audioFileName": "test-audio.wav"
}
```

## 🚀 Deployment

### Local Development

```bash
# Build and start locally
dotnet build
func start

# Start with custom host configuration
func start --port 7072 --cors "*"
```

### Azure Deployment

#### Using Azure Functions Core Tools

```bash
# Deploy to Azure
func azure functionapp publish your-function-app-name

# Deploy with specific settings
func azure functionapp publish your-function-app-name --publish-local-settings
```

#### Using Azure CLI

```bash
# Create resource group
az group create --name myResourceGroup --location "East US"

# Create Function App
az functionapp create \
  --resource-group myResourceGroup \
  --consumption-plan-location eastus \
  --runtime dotnet-isolated \
  --runtime-version 8 \
  --functions-version 4 \
  --name myFunctionApp \
  --storage-account mystorageaccount

# Deploy code
func azure functionapp publish myFunctionApp
```

### Configuration Management

#### Application Settings

Configure these settings in Azure Function App:

```json
{
  "AzureWebJobsStorage": "your-storage-connection-string",
  "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
  "KINTSUGI_API_KEY": "your-kintsugi-api-key",
  "KINTSUGI_BASE_URL": "https://api.kintsugihealth.com/v2",
  "APPLICATIONINSIGHTS_CONNECTION_STRING": "your-app-insights-connection-string",
  "AzureSignalRConnectionString": "your-signalr-connection-string"
}
```

#### Managed Identity

For production deployments, use Managed Identity for secure access:

```csharp
services.AddAzureClients(builder =>
{
    builder.AddBlobServiceClient(new Uri("https://mystorageaccount.blob.core.windows.net/"))
           .WithCredential(new DefaultAzureCredential());
});
```

## 📊 Monitoring & Observability

### Application Insights Integration

Comprehensive telemetry is automatically collected:

- **HTTP Requests** - All function invocations
- **Dependencies** - External API calls (Kintsugi, OpenAI, Azure services)
- **Exceptions** - Unhandled exceptions with stack traces
- **Custom Events** - Business logic milestones
- **Performance Counters** - System metrics

### Custom Telemetry

Add custom telemetry in your functions:

```csharp
[Function("RiskAssessment")]
public async Task<HttpResponseData> AnalyzeRisk(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req,
    ILogger logger)
{
    using var activity = ActivitySource.StartActivity("RiskAssessment");
    
    logger.LogInformation("Starting risk assessment for user: {UserId}", userId);
    
    try
    {
        var result = await _riskAssessmentService.AnalyzeAsync(request);
        
        // Log custom metrics
        logger.LogMetric("RiskScore", result.Score);
        
        return await CreateResponse(req, HttpStatusCode.OK, result);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Risk assessment failed for user: {UserId}", userId);
        throw;
    }
}
```

### Monitoring Queries

Use these KQL queries in Application Insights:

**Function Performance:**

```kusto
requests
| where cloud_RoleName contains "BehavioralHealthSystem"
| summarize avg(duration), count() by name
| order by avg_duration desc
```

**Error Analysis:**

```kusto
exceptions
| where cloud_RoleName contains "BehavioralHealthSystem"
| summarize count() by type, outerMessage
| order by count_ desc
```

**Dependency Tracking:**

```kusto
dependencies
| where target contains "kintsugihealth.com"
| summarize 
    avg(duration),
    countif(success == true),
    countif(success == false)
    by name
```

## 🔒 Security & Best Practices

### Authentication & Authorization

The Functions support multiple authentication modes:

- **Azure AD Integration** - For production environments
- **Function Keys** - For internal service-to-service calls
- **Anonymous Access** - For public endpoints (with rate limiting)

### Input Validation

All endpoints use FluentValidation for comprehensive input validation:

```csharp
public class UserMetadataValidator : AbstractValidator<UserMetadata>
{
    public UserMetadataValidator()
    {
        RuleFor(x => x.Age)
            .InclusiveBetween(1, 149)
            .When(x => x.Age.HasValue);
            
        RuleFor(x => x.Gender)
            .Must(BeValidGender)
            .When(x => !string.IsNullOrEmpty(x.Gender));
    }
    
    private bool BeValidGender(string gender)
    {
        var validGenders = new[]
        {
            "male", "female", "non-binary",
            "transgender female", "transgender male",
            "other", "prefer not to specify"
        };
        
        return validGenders.Contains(gender.ToLowerInvariant());
    }
}
```

### Error Handling

Centralized error handling ensures consistent responses:

```csharp
public class FunctionErrorHandlingService
{
    public async Task<HttpResponseData> HandleErrorAsync(
        HttpRequestData request,
        Exception exception,
        ILogger logger)
    {
        logger.LogError(exception, "Function execution failed");
        
        var errorResponse = new ApiErrorResponse
        {
            Success = false,
            Message = GetUserFriendlyMessage(exception),
            Error = exception.Message,
            StatusCode = GetStatusCode(exception)
        };
        
        return await CreateErrorResponse(request, errorResponse);
    }
}
```

### Configuration Security

- ✅ **No hardcoded secrets** - All sensitive data in configuration
- ✅ **Key Vault integration** - For production secret management
- ✅ **Managed Identity** - Secure Azure resource access
- ✅ **CORS configuration** - Proper cross-origin request handling

## 🔍 Troubleshooting

### Common Issues

1. **Function startup failures:**
   - Check Application Insights connection string
   - Verify all required configuration values
   - Review dependency injection registrations

2. **External API timeouts:**
   - Check network connectivity
   - Verify API endpoints and credentials
   - Review Polly retry policies

3. **SignalR connection issues:**
   - Verify SignalR service connection string
   - Check CORS configuration
   - Review client connection code

### Debug Configuration

Enable detailed logging for troubleshooting:

```json
{
  "logging": {
    "logLevel": {
      "default": "Information",
      "Microsoft": "Warning",
      "Microsoft.Hosting.Lifetime": "Information"
    }
  }
}
```

### Performance Monitoring

Monitor Function performance:

- **Cold start times** - Function initialization duration
- **Execution times** - Individual function execution duration
- **Memory usage** - Memory consumption patterns
- **Concurrency** - Concurrent execution levels

## 📚 Additional Resources

### Documentation

- [Azure Functions Documentation](https://docs.microsoft.com/en-us/azure/azure-functions/)
- [.NET 8 Documentation](https://docs.microsoft.com/en-us/dotnet/core/whats-new/dotnet-8)
- [Application Insights Documentation](https://docs.microsoft.com/en-us/azure/azure-monitor/app/)
- [SignalR Service Documentation](https://docs.microsoft.com/en-us/azure/azure-signalr/)

### Development Tools

- [Azure Functions Core Tools](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local)
- [VS Code Azure Functions Extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions)
- [Azure Storage Explorer](https://azure.microsoft.com/en-us/features/storage-explorer/)

### Best Practices

- [Azure Functions Best Practices](https://docs.microsoft.com/en-us/azure/azure-functions/functions-best-practices)
- [.NET Performance Best Practices](https://docs.microsoft.com/en-us/dotnet/core/deploying/best-practices)
- [Application Insights Performance](https://docs.microsoft.com/en-us/azure/azure-monitor/app/performance-counters)

## 🤝 Contributing

### Development Workflow

1. Create a feature branch from `main`
2. Make changes following established patterns
3. Add comprehensive unit tests
4. Ensure all tests pass
5. Update documentation as needed
6. Submit a pull request with detailed description

### Code Standards

- Follow C# coding conventions and StyleCop rules
- Use async/await patterns consistently
- Implement proper error handling and logging
- Add XML documentation for public APIs
- Write comprehensive unit tests for new functionality

### Pull Request Guidelines

- Include unit tests for new functionality
- Update API documentation for endpoint changes
- Ensure Application Insights telemetry is properly configured
- Test with different configuration scenarios
- Validate error handling and edge cases
