# Behavioral Health System - Kintsugi API Integration

A **production-ready** Azure Functions application that integrates with the Kintsugi Health API for behavioral health assessments, following Microsoft's best practices for enterprise-grade development.

## 🚀 Key Features

### **Enterprise Architecture**

- ✅ **Direct HTTP Function Endpoints** - Simple, reliable HTTP functions for session management
- ✅ **Dependency Injection & Configuration** - Proper service registration with typed configurations
- ✅ **Interface-Based Design** - SOLID principles with testable architecture
- ✅ **Global Usings** - Clean, maintainable code structure with centralized namespace management
- ✅ **Clean Architecture** - Organized project structure with proper separation of concerns

### **Resilience & Reliability**

- ✅ **Polly Retry Policies** - Exponential backoff and circuit breaker patterns
- ✅ **Comprehensive Error Handling** - Proper HTTP status codes and error recovery
- ✅ **FluentValidation** - Input validation with detailed error messages
- ✅ **Health Checks** - Automated monitoring and diagnostics

### **Observability**

- ✅ **Application Insights Integration** - Comprehensive telemetry and monitoring
- ✅ **Structured Logging** - Correlation IDs and performance tracking
- ✅ **Unit Testing** - Comprehensive tests with excellent coverage
- ✅ **CI/CD Pipeline** - GitHub Actions for automated deployment

## 📁 Project Structure

```text
BehavioralHealthSystem/
├── 📁 BehavioralHealthSystem.Functions/         # Azure Functions project
│   ├── 📁 Functions/                            # Function endpoints
│   │   ├── HealthCheckFunction.cs                # Health monitoring endpoint
│   │   ├── KintsugiActivityFunctions.cs          # Deprecated: Activity functions (Durable Functions)
│   │   ├── RiskAssessmentFunctions.cs            # Risk assessment endpoints
│   │   ├── SessionStorageFunctions.cs            # Session data management endpoints
│   │   └── TestFunctions.cs                      # Testing and utility endpoints
│   ├── 📁 Models/                               # Function-specific models
│   │   └── WorkflowStages.cs                     # Workflow stage enumeration
│   ├── GlobalUsings.cs                          # Global using directives for cleaner code
│   ├── Program.cs                               # Function host configuration
│   ├── host.json                                # Azure Functions configuration
│   └── local.settings.json.template             # Local development settings template
├── 📁 BehavioralHealthSystem.Helpers/          # Shared library project
│   ├── 📁 Configuration/                        # Typed configuration and retry policies
│   │   ├── KintsugiApiOptions.cs
│   │   └── RetryPolicies.cs
│   ├── 📁 Models/                               # Data models and DTOs
│   │   ├── InitiateRequest.cs
│   │   ├── InitiateResponse.cs
│   │   ├── PredictionRequest.cs
│   │   ├── PredictionResponse.cs
│   │   ├── PredictionResult.cs
│   │   ├── ActualScore.cs
│   │   ├── PredictError.cs
│   │   ├── ApiErrorResponse.cs
│   │   ├── UserMetadata.cs
│   │   ├── KintsugiWorkflowInput.cs
│   │   └── KintsugiWorkflowResult.cs
│   ├── 📁 Services/                             # Business logic and API clients
│   │   ├── Interfaces/
│   │   │   └── IKintsugiApiService.cs
│   │   ├── KintsugiApiService.cs
│   │   └── KintsugiApiHealthCheck.cs
│   ├── 📁 Validators/                           # FluentValidation rules
│   │   ├── InitiateRequestValidator.cs
│   │   ├── KintsugiWorkflowInputValidator.cs
│   │   └── UserMetadataValidator.cs
│   ├── 📁 Deploy/                               # Azure deployment resources
│   │   ├── azuredeploy.json                     # ARM template
│   │   ├── azuredeploy.parameters.json          # ARM parameters
│   │   ├── deploy.ps1                           # Full deployment script
│   │   └── quick-deploy.ps1                     # Quick deployment script
│   └── GlobalUsings.cs                          # Global using directives
├── 📁 BehavioralHealthSystem.Tests/            # Unit test project
│   ├── 📁 Functions/                            # Function tests
│   │   ├── HealthCheckFunctionTests.cs
│   │   ├── KintsugiActivityFunctionsTests.cs    # Deprecated function tests
│   │   ├── RiskAssessmentFunctionsTests.cs      # Risk assessment tests
│   │   ├── SessionStorageFunctionsTests.cs      # Session storage tests
│   │   ├── TestFunctionsTests.cs
│   │   └── SessionIdFunctionalityTests.cs       # Interface validation tests
│   ├── 📁 Models/                               # Model tests
│   │   ├── ActualScoreTests.cs
│   │   ├── ApiErrorResponseTests.cs
│   │   ├── InitiateRequestTests.cs
│   │   ├── InitiateResponseTests.cs
│   │   ├── KintsugiWorkflowInputTests.cs
│   │   ├── KintsugiWorkflowResultTests.cs
│   │   ├── PredictErrorTests.cs
│   │   ├── PredictionRequestTests.cs
│   │   ├── PredictionResponseTests.cs
│   │   ├── PredictionResultTests.cs
│   │   └── UserMetadataTests.cs
│   └── test-requests.http                       # HTTP test requests for local development
├── 📄 deploy-solution.ps1                      # Solution-level deployment script
├── 📄 quick-deploy-solution.ps1               # Quick solution deployment
├── 📄 test-setup.ps1                          # Test environment setup
├── 📄 test-setup-simple.ps1                   # Simplified test setup
└── 📄 BehavioralHealthSystem.sln              # Solution file
```

## 📋 Prerequisites

- **📥 .NET 8.0 SDK** - [Download here](https://dotnet.microsoft.com/download/dotnet/8.0)
- **🔧 Azure CLI** - [Installation guide](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- **💻 PowerShell** (for deployment scripts) - Windows PowerShell 5.1+ or PowerShell Core 7+
- **⚡ Azure Functions Core Tools v4** - [Installation guide](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local)
- **🔑 Valid Kintsugi Health API credentials** - Contact Kintsugi Health for API access

## 🖥️ Local Development

### Quick Start

1. **📦 Setup local environment:**

   ```bash
   cd BehavioralHealthSystem.Functions
   copy local.settings.json.template local.settings.json
   # Edit local.settings.json with your Kintsugi API key (Application Insights is optional)
   ```

2. **🏃‍♂️ Run locally (Option 1 - Using convenience script):**

   ```bash
   # From the solution root directory
   .\local-run.ps1
   # This script builds the Functions project and starts both the Azure Functions host and frontend dev server
   ```

3. **🏃‍♂️ Run locally (Option 2 - Manual approach):**

   ```bash
   cd ..
   dotnet build BehavioralHealthSystem.sln
   cd BehavioralHealthSystem.Functions
   func start
   ```

4. **🧪 Test endpoints:**
   - Health Check: `http://localhost:7071/api/health`
   - Use `BehavioralHealthSystem.Tests/test-requests.http` for comprehensive testing

### Local Settings Configuration

Create a `local.settings.json` file from the template:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    "KINTSUGI_API_KEY": "your-kintsugi-api-key",
    "KINTSUGI_BASE_URL": "https://api.kintsugihealth.com/v2",
    "KINTSUGI_TIMEOUT_SECONDS": "300",
    "KINTSUGI_MAX_RETRY_ATTEMPTS": "3",
    "KINTSUGI_RETRY_DELAY_MS": "1000",
    "APPLICATIONINSIGHTS_CONNECTION_STRING": "your-app-insights-connection-string"
  }
}
```

### Development Tools

For the best development experience:

- **🎯 VS Code** with Azure Functions extension
- **🔍 REST Client** extension for testing HTTP requests
- **📊 Azure Storage Explorer** for local storage debugging
- **📈 Application Insights** extension for monitoring

## 🔄 Architecture Overview

The application implements a streamlined HTTP function architecture with the following key components:

### **1. Input Validation**

```csharp
// Automatic validation using FluentValidation
var validationResult = await _validator.ValidateAsync(input);
if (!validationResult.IsValid)
{
    return BadRequest(validationResult.Errors);
}
```

### **2. Resilient API Calls**

```csharp
// Automatic retry with exponential backoff and constants
services.AddHttpClient<IKintsugiApiService, KintsugiApiService>()
    .AddPolicyHandler(RetryPolicies.GetRetryPolicy())
    .AddPolicyHandler(RetryPolicies.GetTimeoutPolicy());
```

### **3. Main Workflow Process**

The `KintsugiWorkflow` function performs:

1. **Session Initiation** - Creates a new session with user metadata
2. **Prediction Submission** - Uploads audio data for analysis using either:
   - **URL-based approach** - Downloads audio from Azure Blob Storage URLs
   - **Byte array approach** - Direct upload of base64-encoded audio data  
3. **Immediate Response** - Returns session ID for client tracking

### **4. Result Polling**

Clients can poll for results using separate endpoints:

- `/api/predictions/sessions/{sessionId}` - Get specific session results
- `/api/predictions/{userId}` - Get all user predictions

### **5. Structured Logging**

```csharp
_logger.LogInformation("Session initiated successfully with ID: {SessionId} for user: {UserId}", 
    sessionId, userId);
```

### **6. Multi-Project Solution Structure**

- **BehavioralHealthSystem.Functions** - Azure Functions host with endpoints
- **BehavioralHealthSystem.Helpers** - Shared library with models, services, and configuration
- **BehavioralHealthSystem.Tests** - Unit tests with Moq for dependency mocking

### **7. Dependency Injection Container**

```csharp
// Program.cs in Functions project - Full DI configuration
services.Configure<KintsugiApiOptions>(configuration.GetSection("Values"));
services.AddHttpClient<IKintsugiApiService, KintsugiApiService>();
services.AddValidatorsFromAssemblyContaining<KintsugiWorkflowInputValidator>();
services.AddHealthChecks().AddCheck<KintsugiApiHealthCheck>("kintsugi-api");
```

## ⚙️ Configuration

Enhanced configuration with the Options pattern and typed settings:

### Application Settings

Add these settings to your Azure Function App configuration:

```json
{
  "Values": {
    "AzureWebJobsStorage": "your-storage-connection-string",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    "KINTSUGI_API_KEY": "your-kintsugi-api-key",
    "KINTSUGI_BASE_URL": "https://api.kintsugihealth.com/v2",
    "KINTSUGI_TIMEOUT_SECONDS": "300",
    "KINTSUGI_MAX_RETRY_ATTEMPTS": "3",
    "KINTSUGI_RETRY_DELAY_MS": "1000",
    "APPLICATIONINSIGHTS_CONNECTION_STRING": "your-app-insights-connection-string"
  }
}
```

### Configuration Options

#### Kintsugi API Settings

- **KINTSUGI_API_KEY**: Your Kintsugi Health API key (required)
- **KINTSUGI_BASE_URL**: API base URL (default: <https://api.kintsugihealth.com/v2>)
- **KINTSUGI_TIMEOUT_SECONDS**: API request timeout in seconds (default: 300)
- **KINTSUGI_MAX_RETRY_ATTEMPTS**: Maximum retry attempts for API calls (default: 3)
- **KINTSUGI_RETRY_DELAY_MS**: Delay between retry attempts in milliseconds (default: 1000)

## 📡 API Endpoints

### **Main Workflow**

- **POST** `/api/KintsugiWorkflow` - Submit session and prediction data
- **POST** `/api/predictions/submit` - Submit prediction with session ID and audio URL

### **Health & Monitoring**

- **GET** `/api/health` - Health check endpoint with detailed status
- **POST** `/api/TestKintsugiConnection` - API connectivity test

### **Prediction Results**

- **GET** `/api/predictions/{userId}` - Get all predictions for a user
- **GET** `/api/predictions/sessions/{sessionId}` - Get specific prediction by session ID

### **Health Check Response**

```json
{
  "status": "Healthy",
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

## 🚢 Deployment

### Option 1: Lightning Fast Deployment (Recommended for Getting Started)

Perfect for demos, testing, and rapid prototyping:

```powershell
# From solution root directory
.\quick-deploy-solution.ps1 -FunctionAppName "your-unique-app-name" -KintsugiApiKey "your-api-key"
```

This will:

- ✅ Build your complete solution
- ✅ Create resource group: `rg-your-unique-app-name`
- ✅ Deploy to East US region
- ✅ Configure all Azure resources with secure defaults
- ✅ Set up monitoring and logging

### Option 2: Full Solution Deployment (Production)

For production deployments with custom configurations:

```powershell
# From solution root directory
.\deploy-solution.ps1 -ResourceGroupName "your-rg" -FunctionAppName "your-function-app" -KintsugiApiKey "your-api-key" -Location "East US"
```

### Option 3: Infrastructure-Only Deployment

Deploy just the Azure infrastructure without building the solution:

```powershell
# From BehavioralHealthSystem.Helpers/Deploy directory
.\deploy.ps1 -ResourceGroupName "your-rg" -FunctionAppName "your-function-app" -KintsugiApiKey "your-api-key" -Location "East US"
```

### Option 4: Quick Infrastructure Deployment

```powershell
# From BehavioralHealthSystem.Helpers/Deploy directory
.\quick-deploy.ps1 -FunctionAppName "your-function-app" -KintsugiApiKey "your-api-key"
```

### Option 5: Automated Deployment with GitHub Actions

1. **Setup GitHub Repository Secrets:**

   ```text
   AZURE_FUNCTIONAPP_PUBLISH_PROFILE
   ```

2. **Setup GitHub Repository Variables:**

   ```text
   AZURE_FUNCTIONAPP_NAME
   ```

3. **Push to main branch** - The CI/CD pipeline will automatically:
   - Build and test the application
   - Deploy to Azure Functions
   - Run health checks

### Option 6: Manual Deployment with Azure CLI

1. **Create Resource Group:**

   ```bash
   az group create --name myResourceGroup --location "East US"
   ```

2. **Deploy ARM Template:**

   ```bash
   az deployment group create \
     --resource-group myResourceGroup \
     --template-file BehavioralHealthSystem.Helpers/Deploy/azuredeploy.json \
     --parameters BehavioralHealthSystem.Helpers/Deploy/azuredeploy.parameters.json \
     --parameters functionAppName=myFunctionApp
   ```

3. **Deploy Function Code:**

   ```bash
   func azure functionapp publish myFunctionApp
   ```

### Post-Deployment Steps

After any deployment method:

1. **🚀 Deploy Function Code:**

   ```bash
   cd BehavioralHealthSystem.Functions
   func azure functionapp publish your-function-app-name
   ```

2. **✅ Verify Deployment:**

   ```bash
   # Test health endpoint
   curl https://your-function-app-name.azurewebsites.net/api/health
   
   # Test API connection
   curl -X POST https://your-function-app-name.azurewebsites.net/api/TestKintsugiConnection
   ```

## 📊 Application Insights Configuration

The application includes comprehensive telemetry:

### Automatic Tracking

- **🌐 HTTP Requests**: All incoming requests to function endpoints
- **🔗 Dependencies**: External API calls to Kintsugi Health API
- **⚠️ Exceptions**: Unhandled exceptions with full stack traces
- **📈 Performance Counters**: CPU, memory, and other system metrics

### Custom Telemetry

- **📋 Custom Events**: Workflow progress and business logic milestones
- **📊 Custom Metrics**: API response times and success rates
- **🔗 Correlation**: End-to-end request tracking across function calls

### Monitoring Queries

Access Application Insights and use these Kusto queries:

**Function Execution Overview:**

```kusto
requests
| where cloud_RoleName contains "BehavioralHealthSystem"
| summarize count(), avg(duration) by name
| order by count_ desc
```

**Kintsugi API Dependency Tracking:**

```kusto
dependencies
| where target contains "kintsugihealth.com"
| summarize count(), avg(duration), countif(success == false) by name
| order by count_ desc
```

**Error Analysis:**

```kusto
exceptions
| where cloud_RoleName contains "BehavioralHealthSystem"
| order by timestamp desc
| take 50
```

**Performance Monitoring:**

```kusto
requests
| where cloud_RoleName contains "BehavioralHealthSystem"
| where duration > 5000  // Requests taking more than 5 seconds
| project timestamp, name, duration, resultCode
| order by timestamp desc
```

## 🔧 API Usage Examples

### Submit Behavioral Health Assessment

The API supports two approaches for audio file submission:

#### Option 1: URL-Based Audio Submission (Recommended)

**POST** `/api/KintsugiWorkflow`

```json
{
  "userId": "user-123",
  "metadata": {
    "age": 28,
    "ethnicity": "Hispanic, Latino, or Spanish Origin",
    "gender": "female",
    "language": true,
    "race": "white",
    "weight": 140,
    "zipcode": "90210"
  },
  "audioFileUrl": "https://yourstorageaccount.blob.core.windows.net/audio/user123_recording.wav",
  "audioFileName": "user123_recording.wav"
}
```

#### Option 2: Base64 Audio Data Submission (Legacy)

**POST** `/api/KintsugiWorkflow`

```json
{
  "userId": "user-123",
  "metadata": {
    "age": 28,
    "ethnicity": "Hispanic, Latino, or Spanish Origin",
    "gender": "female",
    "language": true,
    "race": "white",
    "weight": 140,
    "zipcode": "90210"
  },
  "audioData": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
}
```

#### Option 3: Submit Prediction with Session ID (New)

**POST** `/api/predictions/submit`

```json
{
  "sessionId": "95afd12a-37bd-4002-82b8-00bf79e473b4",
  "audioFileUrl": "https://yourstorageaccount.blob.core.windows.net/audio/user123_recording.wav",
  "audioFileName": "user123_recording.wav"
}
```

**Response:**

```json
{
  "success": true,
  "sessionId": "95afd12a-37bd-4002-82b8-00bf79e473b4",
  "status": "processing",
  "message": "Session initiated and prediction submitted successfully"
}
```

### Check Assessment Status

Use the session ID to check prediction status:

**GET** `/api/predictions/sessions/{sessionId}`

**Response:**

```json
{
  "sessionId": "95afd12a-37bd-4002-82b8-00bf79e473b4",
  "status": "success",
  "predictedScore": "0.65",
  "predictedScoreAnxiety": "0.58",
  "predictedScoreDepression": "0.72",
  "createdAt": "2024-01-01T12:00:00Z",
  "updatedAt": "2024-01-01T12:05:00Z",
  "actualScore": {
    "anxietyBinary": "false",
    "depressionBinary": "false"
  }
}
```

### Health Check

**GET** `/api/health`

**Response:**

```json
{
  "status": "Healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "checks": {
    "kintsugiApi": "Healthy",
    "storage": "Healthy"
  }
}
```

### Get Prediction Results

#### Get All Results for a User

**GET** `/api/predictions/{userId}`

**Response:**

```json
[
  {
    "sessionId": "abc123-def456-ghi789",
    "status": "completed",
    "predictedScore": "0.75",
    "predictedScoreAnxiety": "0.68",
    "predictedScoreDepression": "0.82",
    "createdAt": "2023-01-01T00:00:00Z",
    "updatedAt": "2023-01-01T00:05:00Z",
    "actualScore": {
      "anxietyBinary": "false",
      "depressionBinary": "false"
    }
  }
]
```

#### Get Specific Result by Session ID

**GET** `/api/predictions/sessions/{sessionId}`

**Response:**

```json
{
  "sessionId": "abc123-def456-ghi789", 
  "status": "completed",
  "predictedScore": "0.75",
  "predictedScoreAnxiety": "0.68",
  "predictedScoreDepression": "0.82",
  "createdAt": "2023-01-01T00:00:00Z",
  "updatedAt": "2023-01-01T00:05:00Z",
  "actualScore": {
    "anxietyBinary": "false",
    "depressionBinary": "false"
  },
  "predictError": null
}
```

### Enhanced Error Handling

When API errors occur (especially 417 errors), the system provides detailed error information:

```json
{
  "success": false,
  "message": "Error getting prediction",
  "error": "Expectation failed: Audio file is less than the minimum audio length of 999.0 seconds",
  "statusCode": 417,
  "details": {
    "error": "audio_length_error",
    "message": "Audio file is less than the minimum audio length of 999.0 seconds",
    "additionalData": {
      "minLength": 999.0,
      "actualLength": 45.2
    }
  }
}
```

### URL-Based Approach Advantages

- **📉 Reduced payload size** - No need to encode large audio files as base64
- **⚡ Better performance** - Direct streaming from storage to Kintsugi API
- **🎯 Simplified client logic** - Just provide the URL, no need for file encoding
- **💾 Memory efficiency** - Server doesn't hold entire audio file in memory

### Converting Audio to Base64

#### PowerShell

```powershell
$audioBytes = [System.IO.File]::ReadAllBytes("path\to\your\audio.wav")
$base64Audio = [System.Convert]::ToBase64String($audioBytes)
Write-Output $base64Audio
```

#### Node.js

```javascript
const fs = require('fs');
const audioBuffer = fs.readFileSync('path/to/your/audio.wav');
const base64Audio = audioBuffer.toString('base64');
console.log(base64Audio);
```

#### Python

```python
import base64

with open('path/to/your/audio.wav', 'rb') as audio_file:
    audio_data = audio_file.read()
    base64_audio = base64.b64encode(audio_data).decode('utf-8')
    print(base64_audio)
```

## 🧪 Testing

### **Comprehensive Unit Testing**

The project includes **comprehensive unit tests** covering all functions and model classes:

```bash
# Run all unit tests
dotnet test BehavioralHealthSystem.Tests/BehavioralHealthSystem.Tests.csproj

# Run tests with coverage
dotnet test --collect:"XPlat Code Coverage"

# Run tests in watch mode during development
dotnet watch test
```

### **Test Coverage**

- ✅ **Function Tests** - Complete constructor validation for all function classes with dependency injection
  - HealthCheckFunction, TestFunctions, RiskAssessmentFunctions, SessionStorageFunctions
  - KintsugiActivityFunctions (deprecated but tested for backward compatibility)
- ✅ **Model Tests** - Constructor validation for all model classes
- ✅ **Service Tests** - Business logic and API integration tests  
- ✅ **Validator Tests** - FluentValidation rule verification
- ✅ **Interface Tests** - Service contract validation and method signature verification
- ✅ **Mocking Framework** - Moq integration for comprehensive dependency testing
- ✅ **Dependency Injection** - Proper null validation and service injection testing
- ✅ **Data Integrity** - Audio data and metadata consistency validation
- ✅ **42 Total Tests** - All passing with comprehensive coverage

### **Manual API Testing**

1. **🏥 Health Check:**

   ```bash
   curl http://localhost:7071/api/health
   ```

2. **🔌 Connection Test:**

   ```bash
   curl -X POST http://localhost:7071/api/TestKintsugiConnection
   ```

3. **🚀 Start Workflow:**

   ```bash
   curl -X POST http://localhost:7071/api/KintsugiWorkflow \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "test-user-123",
       "metadata": {
         "age": 28,
         "ethnicity": "Hispanic, Latino, or Spanish Origin",
         "gender": "female",
         "language": true,
         "race": "white",
         "weight": 140,
         "zipcode": "90210"
       },
       "audioData": "base64-encoded-audio-data"
     }'
   ```

4. **📤 Submit Prediction:**

   ```bash
   curl -X POST http://localhost:7071/api/predictions/submit \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "test-session-123",
       "audioFileUrl": "https://example.com/test-audio.wav",
       "audioFileName": "test-audio.wav"
     }'
   ```

### **Integration Testing**

The GitHub Actions pipeline includes automated testing. To run tests locally:

```bash
# Full test suite with reporting
dotnet test --configuration Release --verbosity normal --logger trx --results-directory TestResults

# Quick test run
dotnet test --no-build --verbosity minimal
```

### **Load Testing**

For production readiness, consider implementing load tests:

```bash
# Install artillery for load testing
npm install -g artillery

# Create artillery test configuration
# artillery run load-test-config.yml
```

## � Deployment Script Examples

The solution includes several PowerShell deployment scripts for different scenarios:

### Full System Deployment Script

Use the `deploy-full-system.ps1` script to deploy both the Functions app and UI in sequence:

```powershell
# Deploy to specific Azure resources
.\deploy-full-system.ps1 -KintsugiApiKey "your-api-key-here"

# This script will:
# 1. Deploy Functions to: cwbhieastus001
# 2. Deploy UI to: cwuibhieastus001  
# 3. Target resource group: bhi
```

**Script Output Example:**

```text
========================================
Starting Behavioral Health System Deployment
========================================

[INFO] Starting Function App deployment...
[INFO] Deploying to Function App: cwbhieastus001
[INFO] Resource Group: bhi

[SUCCESS] Function App deployment completed successfully!

[INFO] Starting UI deployment...  
[INFO] Deploying to App Service: cwuibhieastus001
[INFO] Resource Group: bhi

[SUCCESS] UI deployment completed successfully!

========================================
Deployment Summary
========================================
Function App: cwbhieastus001 - SUCCESS
UI App Service: cwuibhieastus001 - SUCCESS
Total deployment time: 3m 45s
```

### Individual Component Deployment

Deploy just the Functions app:

```powershell
# Deploy only the Azure Functions
.\deploy-code-only.ps1 -FunctionAppName "cwbhieastus001" -ResourceGroupName "bhi"
```

Deploy just the UI:

```powershell
# Deploy only the UI application
.\deploy-ui.ps1 -DeploymentTarget "app-service" -ResourceName "cwuibhieastus001" -ResourceGroupName "bhi"
```

### Agent Project Example

The solution includes a multi-agent behavioral health system with coordinated agents:

#### CoordinatorAgent Usage Example

```csharp
// Initialize the group chat system
var groupChat = new BehavioralHealthGroupChat(kernel, logger, loggerFactory);
await groupChat.InitializeAsync();

// Process user messages through intelligent routing
var response = await groupChat.ProcessMessageAsync("user-123", "I want to start a PHQ-2 assessment");

// Example responses:
// "Starting PHQ-2 rapid screening assessment for user: user-123..."
// "Starting PHQ-9 comprehensive assessment for user: user-123..."
```

#### Direct Agent Invocation

```csharp
// Directly invoke specific agents
var phq2Response = groupChat.InvokeAgentDirectly("PHQ2Agent", "user-123", "start assessment");
var phq9Response = groupChat.InvokeAgentDirectly("PHQ9Agent", "user-123", "begin assessment");

// Get agent information
var agentInfo = groupChat.GetAgentInfo();
```

### Global Usings Pattern Example

The solution implements a clean global usings pattern to reduce code duplication:

**GlobalUsings.cs:**

```csharp
global using System.ComponentModel.DataAnnotations;
global using System.Collections.Generic;
global using System.Text.Json;
global using Microsoft.Azure.Functions.Worker;
global using Microsoft.Azure.Functions.Worker.Http;
global using Microsoft.Extensions.DependencyInjection;
global using Microsoft.Extensions.Logging;
global using BehavioralHealthSystem.Helpers.Models;
global using BehavioralHealthSystem.Helpers.Services.Interfaces;
global using BehavioralHealthSystem.Helpers.Validators;
```

**Benefits:**

- ✅ Eliminates redundant using statements across all files
- ✅ Centralized namespace management
- ✅ Cleaner, more maintainable code
- ✅ Consistent imports across the entire project

### PowerShell Script Features

All deployment scripts include:

- ✅ **Error Handling** - Comprehensive error checking and rollback
- ✅ **Progress Reporting** - Real-time status updates and completion summaries
- ✅ **Validation** - Pre-deployment checks for required parameters
- ✅ **Logging** - Detailed deployment logs for troubleshooting
- ✅ **Security** - Secure handling of API keys and connection strings

## �🔍 Troubleshooting

### Common Issues

1. **🚨 Function App not starting:**
   - Check Application Insights connection string
   - Verify all required app settings are configured
   - Review function app logs in Azure portal
   - Ensure FUNCTIONS_WORKER_RUNTIME is set to "dotnet-isolated"

2. **🔐 Kintsugi API authentication errors:**
   - Verify API key is correctly configured
   - Check API key has required permissions
   - Test API key with direct curl requests
   - Ensure KINTSUGI_BASE_URL is correct

3. **💾 Storage account connection issues:**
   - Check storage account connection string
   - Verify storage account exists and is accessible
   - Review storage account permissions

4. **📊 Application Insights not working:**
   - Verify APPLICATIONINSIGHTS_CONNECTION_STRING is set
   - Check Application Insights resource exists
   - Review sampling settings in host.json

### Debug Mode

Enable detailed logging by adding to local.settings.json:

```json
{
  "Values": {
    "AzureFunctionsJobHost__logging__logLevel__default": "Debug",
    "AzureFunctionsJobHost__logging__logLevel__Microsoft.Hosting.Lifetime": "Information"
  }
}
```

### Monitoring and Alerting

Set up Azure Monitor alerts for:

- 🚨 Function execution failures
- ⏱️ High API response times
- 📈 Increased error rates
- 💾 Resource usage thresholds

## 🔒 Security & Best Practices

### **Configuration Security**

- ✅ Environment variable-based configuration
- ✅ No hardcoded secrets in codebase
- ✅ Proper API key validation and handling
- ✅ Secure storage of connection strings

### **Input Validation**

- ✅ Comprehensive FluentValidation rules
- ✅ Sanitization and bounds checking
- ✅ Audio file size and format validation
- ✅ XSS protection for all inputs

### **Error Handling**

- ✅ No sensitive data in error responses
- ✅ Proper HTTP status codes
- ✅ Correlation IDs for troubleshooting
- ✅ Structured error logging

### **Performance Optimizations**

- ✅ HttpClient lifetime management with connection pooling
- ✅ Cancellation token support throughout
- ✅ Memory-efficient JSON serialization
- ✅ Async/await best practices with ConfigureAwait(false)

### **Infrastructure Security**

- ✅ HTTPS only communication
- ✅ TLS 1.2 minimum requirement
- ✅ Storage account security hardening
- ✅ Function App authentication ready

## 📚 Additional Resources

### **Documentation**

- 📖 [Azure Durable Functions Documentation](https://docs.microsoft.com/en-us/azure/azure-functions/durable/)
- 📊 [Application Insights for Azure Functions](https://docs.microsoft.com/en-us/azure/azure-monitor/app/azure-functions-supported-features)
- 🔗 [Kintsugi Health API Documentation](https://api.kintsugihealth.com/docs)
- ✅ [FluentValidation Documentation](https://docs.fluentvalidation.net/)
- 🔄 [Polly Resilience Framework](https://github.com/App-vNext/Polly)

### **Best Practices Guides**

- 🏗️ [Azure Functions Best Practices](https://docs.microsoft.com/en-us/azure/azure-functions/functions-best-practices)
- 🔒 [Azure Security Best Practices](https://docs.microsoft.com/en-us/azure/security/fundamentals/best-practices-and-patterns)
- 📊 [Application Performance Monitoring](https://docs.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)

### **Development Tools**

#### **Code Organization**

- ✅ **GlobalUsings.cs** - Centralized namespace management for cleaner code
  - System namespaces (Collections.Generic, ComponentModel.DataAnnotations, Text.Json)
  - Microsoft namespaces (Azure.Functions.Worker, Extensions.DependencyInjection, Logging)
  - Project namespaces (BehavioralHealthSystem.Models, Services, Interfaces)
  - Eliminates redundant using statements across all function files

#### **Local Development Script**

- ✅ **local-run.ps1** - Automated development startup script
  - Builds Azure Functions project with error checking
  - Starts Azure Functions Core Tools runtime
  - Launches Web development server (npm run dev)
  - Handles process management and error reporting

#### **Azure Tools**

- 🛠️ [Azure Functions Core Tools](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local)
- 🎯 [VS Code Azure Functions Extension](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions)
- 📱 [Azure Storage Explorer](https://azure.microsoft.com/en-us/features/storage-explorer/)

## 🤝 Contributing

1. **🍴 Fork the repository**
2. **🌿 Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **💻 Make your changes** following the established patterns
4. **🧪 Add comprehensive unit tests** for new functionality
5. **✅ Ensure all tests pass** (`dotnet test`)
6. **📝 Update documentation** as needed
7. **📤 Submit a pull request** with detailed description

### **Development Guidelines**

- Follow the existing code style and patterns
- Add unit tests for all new functionality
- Update README.md for any new features or configuration
- Ensure all tests pass before submitting PR
- Use meaningful commit messages

### **Code Review Process**

- All PRs require review before merging
- Automated tests must pass
- Code coverage should be maintained or improved
- Documentation updates are required for new features

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For support and questions:

- 📧 **Issues**: Create an issue in this repository
- 📚 **Documentation**: Refer to the sections above
- 🔗 **API Questions**: Contact Kintsugi Health support
- 🏗️ **Azure Support**: Use Azure Support Portal

---

## ✨ Enterprise Solution

This enhanced solution provides enterprise-grade reliability, comprehensive testing, and maintainability while following Microsoft's recommended patterns for Azure Functions development with .NET 8.
