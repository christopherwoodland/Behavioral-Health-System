# Behavioral Health System - Azure Functions Backend

Azure Functions backend providing HTTP endpoints for mental health assessments, session management, and AI integration.

## 🏗️ Project Structure

```
BehavioralHealthSystem.Functions/
├── Functions/              # HTTP-triggered Azure Functions
├── Services/              # Business logic and integrations
├── Prompts/               # AI agent system prompts
├── Properties/            # Launch settings
└── Program.cs            # Dependency injection configuration
```

## 🚀 Key Features

- **Session Management** - Create, retrieve, and delete user sessions
- **PHQ Assessments** - PHQ-2 and PHQ-9 depression screening
- **Risk Assessment** - AI-powered extended risk evaluation
- **Chat Transcripts** - Real-time conversation logging
- **Biometric Data** - User health metrics collection
- **DSM-5 Integration** - Diagnostic criteria management
- **Voice Recording** - Session audio capture and storage
- **Health Checks** - System monitoring endpoints

## 🔧 Configuration

### local.settings.json

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    "AzureOpenAI__Endpoint": "https://your-openai.openai.azure.com/",
    "AzureOpenAI__ApiKey": "your-key",
    "AzureOpenAI__DeploymentName": "gpt-4o-realtime-preview",
    "KintsugiApi__BaseUrl": "https://api.kintsugihealth.com",
    "KintsugiApi__ApiKey": "your-kintsugi-key",
    "AGENT_MODE_ENABLED": "true",
    "AZURE_OPENAI_ENABLED": "true",
    "EXTENDED_ASSESSMENT_OPENAI_ENABLED": "true"
  }
}
```

## 🎯 API Endpoints

### Session Management
- `GET /api/sessions/{userId}` - List user sessions
- `POST /api/sessions` - Create new session
- `DELETE /api/sessions/{sessionId}` - Delete session

### PHQ Assessments
- `POST /api/phq-assessment` - Submit PHQ assessment
- `GET /api/phq-assessment/{userId}` - Retrieve assessments

### Risk Assessment
- `POST /api/extended-risk-assessment` - AI-powered risk evaluation
- `GET /api/risk-assessment/status/{jobId}` - Check assessment status

### Data Management
- `POST /api/chat-transcript` - Save conversation transcript
- `POST /api/biometric-data` - Save user biometric data
- `POST /api/voice-recording` - Upload session recording

### DSM-5 Administration
- `GET /api/dsm5-admin/data-status` - Check DSM-5 data status
- `GET /api/dsm5-admin/conditions` - List diagnostic conditions
- `POST /api/dsm5-admin/upload-data` - Import DSM-5 data

### Monitoring
- `GET /api/health` - Health check endpoint
- `GET /api/feature-flags` - List enabled features

## 🏃 Running Locally

```powershell
# Start Azure Functions
cd BehavioralHealthSystem.Functions
func start

# Or use the script
.\scripts\local-run.ps1
```

## 🧪 Testing

Tests are in `BehavioralHealthSystem.Tests` project.

```powershell
cd BehavioralHealthSystem.Tests
dotnet test
```

## 📦 Dependencies

- **Microsoft.Azure.Functions.Worker** - Isolated worker process
- **Azure.AI.OpenAI** - Azure OpenAI integration
- **Azure.Storage.Blobs** - Blob storage for data persistence
- **FluentValidation** - Request validation
- **Polly** - Retry policies and resilience

## 🔐 Security

- Environment-based configuration
- Azure Managed Identity support
- API key validation
- CORS configuration
- Request validation with FluentValidation

## 📊 Monitoring

- Application Insights integration
- Structured logging
- Health check endpoints
- Error tracking and diagnostics

## 📚 Additional Resources

- [Main README](../README.md) - Complete system documentation
- [API Documentation](../README.md#-api-reference) - Detailed endpoint specs
- [Deployment Guide](../README.md#-deployment-guide) - Azure deployment steps
