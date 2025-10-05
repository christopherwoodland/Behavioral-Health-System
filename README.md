# Behavioral Health System - Complete Mental Health Platform

A **production-ready** full-stack behavioral health assessment platform featuring Azure Functions backend, React frontend, and AI-powered agent handoff system. Integrates with Kintsugi Health API for advanced mental health analysis, following Microsoft's best practices for enterprise-grade development.

## 🚀 Key Features

### **🏗️ Enterprise Architecture**

- ✅ **Full-Stack Solution** - React frontend with Azure Functions backend
- ✅ **Real-Time Communication** - SignalR integration for bidirectional communication
- ✅ **AI Agent Handoff System** - Multi-agent coordination for behavioral health assessments
- ✅ **Direct HTTP Function Endpoints** - Simple, reliable HTTP functions for session management
- ✅ **Dependency Injection & Configuration** - Proper service registration with typed configurations
- ✅ **Interface-Based Design** - SOLID principles with testable architecture
- ✅ **Global Usings** - Clean, maintainable code structure with centralized namespace management
- ✅ **Clean Architecture** - Organized project structure with proper separation of concerns

### **🛡️ Resilience & Reliability**

- ✅ **Polly Retry Policies** - Exponential backoff and circuit breaker patterns
- ✅ **Comprehensive Error Handling** - Proper HTTP status codes and error recovery
- ✅ **FluentValidation** - Input validation with detailed error messages
- ✅ **Health Checks** - Automated monitoring and diagnostics
- ✅ **Session Management** - Persistent session data with proper deletion functionality

### **🎙️ Advanced Speech Processing**

- ✅ **Web Speech API Integration** - Browser-native speech recognition
- ✅ **Voice Activity Detection** - Smart speech detection and processing
- ✅ **Interruption Handling** - Responsive speech interaction controls
- ✅ **Multiple Speech Engines** - Support for various speech recognition services
- ✅ **Audio File Processing** - Multiple audio format support and processing
- ✅ **Smart Audio Conversion** - Intelligent skip logic for pre-processed files
- ✅ **FFmpeg Integration** - Client-side audio conversion with WebAssembly
- ✅ **Format Optimization** - Automatic conversion to optimal audio formats

### **🧠 AI-Powered Extended Risk Assessment**

- ✅ **Multi-Condition DSM-5 Evaluation** - Dynamic assessment of any DSM-5 psychiatric conditions
- ✅ **GPT-5/O3 Integration** - Advanced AI analysis with comprehensive diagnostic criteria
- ✅ **Disorder-Specific Evaluation** - Tailored assessment for each selected condition
- ✅ **Cross-Condition Analysis** - Differential diagnosis across multiple disorders
- ✅ **Evidence-Based Criteria** - Official DSM-5 diagnostic criteria evaluation
- ✅ **Confidence Scoring** - AI confidence metrics for each assessment
- ✅ **Async Job Processing** - Non-blocking assessment with progress tracking
- ✅ **Backwards Compatible** - Maintains support for legacy schizophrenia-only assessments

### **📊 Observability**

- ✅ **Application Insights Integration** - Comprehensive telemetry and monitoring
- ✅ **Structured Logging** - Correlation IDs and performance tracking
- ✅ **Unit Testing** - Comprehensive tests with excellent coverage
- ✅ **CI/CD Pipeline** - GitHub Actions for automated deployment
- ✅ **Real-Time Monitoring** - Live session tracking and analytics

## 📁 Project Structure

```text
BehavioralHealthSystem/
├── 📁 BehavioralHealthSystem.Functions/         # Azure Functions backend
│   ├── 📁 Functions/                            # Function endpoints
│   │   ├── HealthCheckFunction.cs                # Health monitoring endpoint
│   │   ├── RiskAssessmentFunctions.cs            # Risk assessment endpoints
│   │   ├── SessionStorageFunctions.cs            # Session data management endpoints
│   │   └── TestFunctions.cs                      # Testing and utility endpoints
│   ├── 📁 Models/                               # Function-specific models
│   ├── GlobalUsings.cs                          # Global using directives for cleaner code
│   ├── Program.cs                               # Function host configuration
│   ├── host.json                                # Azure Functions configuration
│   └── local.settings.json.template             # Local development settings template
├── 📁 BehavioralHealthSystem.Web/              # React frontend application
│   ├── 📁 src/                                  # React source code
│   │   ├── 📁 components/                       # Reusable React components
│   │   │   ├── AudioRecorder.tsx                # Audio recording functionality
│   │   │   ├── SessionCard.tsx                  # Session display components
│   │   │   └── ui/                              # UI component library
│   │   ├── 📁 pages/                            # Application pages
│   │   │   ├── AgentExperience.tsx              # AI agent interaction interface
│   │   │   ├── Dashboard.tsx                    # Main dashboard
│   │   │   ├── Sessions.tsx                     # Session management
│   │   │   └── SessionDetail.tsx                # Detailed session view
│   │   ├── 📁 services/                         # API and service integrations
│   │   │   ├── apiService.ts                    # Backend API client
│   │   │   └── speechService.ts                 # Speech recognition service
│   │   ├── 📁 hooks/                            # Custom React hooks
│   │   ├── 📁 contexts/                         # React context providers
│   │   ├── 📁 types/                            # TypeScript type definitions
│   │   └── 📁 utils/                            # Utility functions
│   ├── package.json                             # Node.js dependencies
│   ├── vite.config.ts                          # Vite build configuration
│   ├── tailwind.config.js                      # Tailwind CSS configuration
│   └── tsconfig.json                           # TypeScript configuration
├── 📁 BehavioralHealthSystem.Agents/           # AI Agent system
│   ├── 📁 Agents/                               # Individual agent implementations
│   │   ├── CoordinatorAgent.cs                  # Main coordination agent
│   │   ├── Phq2Agent.cs                         # PHQ-2 depression screening agent
│   │   └── ComedianAgent.cs                     # Humor interaction agent
│   ├── 📁 Chat/                                 # Group chat orchestration
│   │   └── BehavioralHealthGroupChat.cs         # Multi-agent chat coordination
│   ├── 📁 Handoff/                              # Agent handoff system
│   │   ├── Interfaces/                          # Handoff interfaces
│   │   ├── HandoffSession.cs                    # Session handoff management
│   │   └── HandoffCoordinator.cs                # Handoff orchestration
│   ├── 📁 Models/                               # Agent-specific models
│   └── 📁 Services/                             # Agent services
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
│   │   └── UserMetadata.cs
│   ├── 📁 Services/                             # Business logic and API clients
│   │   ├── Interfaces/
│   │   │   └── IKintsugiApiService.cs
│   │   ├── KintsugiApiService.cs
│   │   └── KintsugiApiHealthCheck.cs
│   ├── 📁 Validators/                           # FluentValidation rules
│   │   └── InitiateRequestValidator.cs
│   │   └── UserMetadataValidator.cs
│   ├── 📁 Deploy/                               # Azure deployment resources
│   │   ├── azuredeploy.json                     # ARM template
│   │   └── azuredeploy.parameters.json          # ARM parameters
│   └── GlobalUsings.cs                          # Global using directives
├── 📁 BehavioralHealthSystem.Tests/            # Unit test project
│   ├── 📁 Functions/                            # Function tests
│   │   ├── HealthCheckFunctionTests.cs
│   │   ├── RiskAssessmentFunctionsTests.cs      # Risk assessment tests
│   │   ├── SessionStorageFunctionsTests.cs      # Session storage tests
│   │   ├── TestFunctionsTests.cs
│   │   └── SessionIdFunctionalityTests.cs       # Interface validation tests
│   ├── 📁 Models/                               # Model tests
│   │   ├── ActualScoreTests.cs
│   │   ├── ApiErrorResponseTests.cs
│   │   ├── InitiateRequestTests.cs
│   │   ├── InitiateResponseTests.cs
│   │   ├── PredictErrorTests.cs
│   │   ├── PredictionRequestTests.cs
│   │   ├── PredictionResponseTests.cs
│   │   ├── PredictionResultTests.cs
│   │   └── UserMetadataTests.cs
│   └── test-requests.http                       # HTTP test requests for local development
├── � scripts/                                  # PowerShell automation scripts
│   ├── deploy-solution.ps1                      # Complete solution deployment script
│   ├── deploy-code-only.ps1                     # Code-only deployment script
│   ├── deploy-ui.ps1                            # UI deployment script
│   ├── local-run.ps1                            # Local development startup script
│   ├── extract-dsm5-data.ps1                    # DSM-5 data extraction tool
│   ├── load-dsm5-data.ps1                       # DSM-5 data loading script
│   ├── DSM5_TEST_SCRIPT.ps1                     # DSM-5 API testing
│   └── test-dsm5-extraction.ps1                 # DSM-5 extraction testing
└── 📄 BehavioralHealthSystem.sln                # Solution file
```
└── 📄 BehavioralHealthSystem.sln              # Solution file
```

## 📋 Prerequisites

### **🛠️ Development Environment**

- **📥 .NET 8.0 SDK** - [Download here](https://dotnet.microsoft.com/download/dotnet/8.0)
- **🟢 Node.js 18+** - [Download here](https://nodejs.org/) (Required for React frontend)
- **� npm/yarn** - Package manager for frontend dependencies
- **�🔧 Azure CLI** - [Installation guide](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- **💻 PowerShell** (for deployment scripts) - Windows PowerShell 5.1+ or PowerShell Core 7+
- **⚡ Azure Functions Core Tools v4** - [Installation guide](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local)

### **🔑 API Credentials**

- **🔑 Valid Kintsugi Health API credentials** - Contact Kintsugi Health for API access
- **📊 Application Insights connection string** - For telemetry and monitoring (optional for local development)

### **🌐 Browser Requirements**

- **🎙️ Modern browser with Web Speech API support** - Chrome, Edge, Safari, Firefox
- **🔊 Microphone access** - Required for speech input functionality
- **📱 Responsive design support** - Works on desktop, tablet, and mobile devices

## 🖥️ Local Development

### **🚀 Quick Start**

1. **📦 Setup local environment:**

   ```bash
   cd BehavioralHealthSystem.Functions
   copy local.settings.json.template local.settings.json
   # Edit local.settings.json with your Kintsugi API key (Application Insights is optional)
   ```

1. **📦 Setup local environment:**

   ```bash
   cd BehavioralHealthSystem.Functions
   copy local.settings.json.template local.settings.json
   # Edit local.settings.json with your Kintsugi API key (Application Insights is optional)
   ```

2. **🏃‍♂️ Run full-stack locally (Recommended - using convenience script):**

   ```bash
   # From the solution root directory - starts both backend and frontend
   .\scripts\local-run.ps1
   # This script builds the Functions project and starts both:
   # - Azure Functions host (localhost:7071)
   # - React development server (localhost:3001)
   ```

3. **🏃‍♂️ Run backend only (Manual approach):**

   ```bash
   cd ..
   dotnet build BehavioralHealthSystem.sln
   cd BehavioralHealthSystem.Functions
   func start
   ```

4. **🌐 Run frontend only:**

   ```bash
   cd BehavioralHealthSystem.Web
   npm install
   npm run dev
   ```

5. **🧪 Test endpoints:**
   - Backend Health Check: `http://localhost:7071/api/health`
   - Frontend Application: `http://localhost:3001`
   - Use `BehavioralHealthSystem.Tests/test-requests.http` for API testing

### **🎯 Development Workflow**

The `scripts\local-run.ps1` script provides the optimal development experience:

- ✅ **Automatic building** - Builds the Functions project with error checking
- ✅ **Parallel startup** - Starts both backend and frontend simultaneously
- ✅ **Process management** - Handles cleanup and error reporting
- ✅ **Hot reloading** - Both backend and frontend support live reload during development

### **🔧 Development Tools Setup**

For the best development experience, install:

- **🎯 VS Code** with Azure Functions extension
- **🔍 REST Client** extension for testing HTTP requests
- **📊 Azure Storage Explorer** for local storage debugging
- **📈 Application Insights** extension for monitoring
- **⚛️ React DevTools** browser extension
- **🎨 Tailwind CSS IntelliSense** VS Code extension

## 🏗️ Application Architecture

The application implements a modern full-stack architecture with the following key components:

### **🎭 AI Agent Experience**

```typescript
// Multi-agent behavioral health system with coordinated handoffs
const agents = {
  coordinator: "Main orchestration and crisis detection",
  phq2: "PHQ-2 rapid depression screening",
  phq9: "PHQ-9 comprehensive depression assessment", 
  comedian: "Humor-based interaction and mood lifting"
};
```

Features:

- **🤖 Intelligent Agent Handoffs** - Seamless transitions between specialized agents
- **🎙️ Advanced Speech Processing** - Web Speech API with voice activity detection
- **🎭 Animated Bot Visualization** - Engaging visual feedback during interactions
- **♿ Accessibility Features** - Full keyboard navigation and screen reader support

### **📡 Real-Time Communication**

```csharp
// SignalR integration for bidirectional communication
services.AddSignalR();
services.AddSingleton<IHubContext<ChatHub>>();
```

Features:

- **⚡ Live Session Updates** - Real-time session status and progress tracking
- **🔄 Bidirectional Communication** - Frontend ↔ Backend real-time messaging
- **📊 Live Analytics** - Real-time dashboard updates and monitoring
- **🎯 Connection Management** - Robust connection handling and reconnection logic

### **🎨 Enhanced UI/UX Features**

- **🧠 Interactive Brain Animation** - Hover-activated throb animation with realistic scaling pattern
- **📱 Modal Dialogs** - Improved information display replacing problematic tooltips
- **🔄 Streamlined Re-run Workflow** - Navigation-based re-run with pre-filled session data
- **📊 Enhanced Session Views** - Detailed session pages with comprehensive information
- **⚡ Responsive Design** - Optimized for desktop, tablet, and mobile experiences
- **🎯 Accessible Components** - WCAG 2.2 Level AA compliant interface elements
- **🌙 Theme Support** - Dark/light mode with automatic detection
- **🎨 Consistent Styling** - Unified design language across all components

### **📋 Session Management**

- **💾 Persistent Sessions** - Session data stored with proper deletion functionality
- **🔄 Session Lifecycle** - Complete session tracking from creation to completion
- **📊 Session Analytics** - Detailed session metrics and performance data
- **🗑️ Proper Cleanup** - Backend deletion ensures data consistency
- **🔁 Smart Re-run Functionality** - Re-analyze sessions with optimized audio processing
- **📝 Session History** - Access previous sessions with enhanced detail views
- **⚡ Audio Conversion Optimization** - Skip redundant audio processing for re-runs

## ⚙️ Local Settings Configuration

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

#### **User Metadata Validation Rules**

The system includes comprehensive validation for user metadata fields:

**📋 Age Validation:**
- Optional field (can be empty)
- When provided: Must be between 1 and 149 years

**👤 Gender Validation:**
- Optional field (can be empty)
- Valid options: `male`, `female`, `non-binary`, `transgender female`, `transgender male`, `other`, `prefer not to specify`

**🏃 Race Validation:**
- Optional field (can be empty)  
- Valid options: `white`, `black or african-american`, `asian`, `american indian or alaskan native`, `native hawaiian or pacific islander`, `two or more races`, `other`, `prefer not to specify`

**🌎 Ethnicity Validation:**
- Optional field (can be empty)
- Valid options: `Hispanic, Latino, or Spanish Origin`, `Not Hispanic, Latino, or Spanish Origin`
- Note: No "prefer not to specify" option for ethnicity

**📍 Zipcode Validation:**
- Optional field (can be empty)
- When provided: Must be alphanumeric, 1-10 characters

**⚖️ Weight Validation:**
- Optional field (can be 0)
- When provided: Must be between 10 and 1000 pounds

**🗣️ Language Validation:**
- Boolean field indicating English as primary language
- `true` = English is primary language, `false` = English is not primary language

### **2. Resilient API Calls**

```csharp
// Automatic retry with exponential backoff and constants
services.AddHttpClient<IKintsugiApiService, KintsugiApiService>()
    .AddPolicyHandler(RetryPolicies.GetRetryPolicy())
    .AddPolicyHandler(RetryPolicies.GetTimeoutPolicy());
```

### **3. Main Workflow Process**

The system provides separate endpoints for different workflow steps:

1. **Session Initiation** - Creates a new session with user metadata (`/api/sessions/initiate`)
2. **Prediction Submission** - Uploads audio data for analysis (`/api/predictions/submit`) using either:
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
services.AddValidatorsFromAssemblyContaining<InitiateRequestValidator>();
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

### **🎭 Agent Experience**

- **POST** `/api/agent/chat` - Interactive chat with AI agents
- **GET** `/api/agent/info` - Get available agents and their capabilities
- **POST** `/api/agent/handoff` - Trigger agent handoff during conversation

### **🔄 Main Workflow**

- **POST** `/api/sessions/initiate` - Create new session with user metadata and audio data
- **POST** `/api/predictions/submit` - Submit prediction with session ID and audio URL

### **📊 Session Management**

- **GET** `/api/sessions` - Get all sessions for current user
- **GET** `/api/sessions/{sessionId}` - Get specific session details
- **DELETE** `/api/sessions/{sessionId}` - Delete session (persists to backend)
- **POST** `/api/sessions/bulk-delete` - Delete multiple sessions

### **🏥 Health & Monitoring**

- **GET** `/api/health` - Health check endpoint with detailed status
- **POST** `/api/TestKintsugiConnection` - API connectivity test

### **📈 Prediction Results**

- **GET** `/api/predictions/{userId}` - Get all predictions for a user
- **GET** `/api/predictions/sessions/{sessionId}` - Get specific prediction by session ID

### **📡 SignalR Hub**

- **SignalR Hub** `/chatHub` - Real-time bidirectional communication
  - `JoinGroup(userId)` - Join user-specific communication group
  - `SendMessage(userId, message)` - Send real-time message to user
  - `SessionUpdate(sessionId, status)` - Broadcast session status updates

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

### **🚀 Quick Deploy (Recommended for Getting Started)**

Perfect for demos, testing, and rapid prototyping with minimal configuration:

```powershell
# From solution root directory - Auto-generates resource group name
.\scripts\deploy-solution.ps1 -FunctionAppName "your-unique-app-name" -KintsugiApiKey "your-api-key" -QuickDeploy
```

This creates:

- ✅ Resource group: `rg-your-unique-app-name` (auto-generated)
- ✅ Deploys to East US region (optimal for most scenarios)
- ✅ Configures all Azure resources with secure defaults
- ✅ Sets up monitoring and logging

### **🏭 Production Deploy (Custom Configuration)**

For production deployments with custom resource group and region:

```powershell
# From solution root directory - Full control over resources
.\scripts\deploy-solution.ps1 -ResourceGroupName "your-rg" -FunctionAppName "your-function-app" -KintsugiApiKey "your-api-key" -Location "East US"
```

### **⚡ Code-Only Deploy (Rapid Updates)**

For updating code on existing Azure infrastructure:

```powershell
# Deploy only code changes to existing Function App
.\scripts\deploy-code-only.ps1 -FunctionAppName "your-function-app" -ResourceGroupName "your-rg"
```

### **🌐 UI-Only Deploy**

Deploy just the React web application:

```powershell
# Deploy to Azure App Service
.\scripts\deploy-ui.ps1 -DeploymentTarget "app-service" -ResourceName "your-web-app" -ResourceGroupName "your-rg"

# Deploy to Azure Storage static website
.\scripts\deploy-ui.ps1 -DeploymentTarget "storage" -ResourceName "your-storage-account" -ResourceGroupName "your-rg"

# Deploy to Azure Static Web Apps
.\scripts\deploy-ui.ps1 -DeploymentTarget "static-web-app" -ResourceName "your-static-web-app" -ResourceGroupName "your-rg"
```

### **📋 Deployment Script Overview**

| Script | Purpose | Use Case |
|--------|---------|----------|
| `scripts\deploy-solution.ps1` | **Complete solution deployment** | New projects, full infrastructure setup |
| `scripts\deploy-code-only.ps1` | **Code updates only** | Rapid development iterations |
| `scripts\deploy-ui.ps1` | **UI deployment only** | Frontend updates, multi-target deployment |

### **🎯 Which Script Should I Use?**

- **🆕 First-time deployment?** → Use `scripts\deploy-solution.ps1` with `-QuickDeploy`
- **🔄 Code changes only?** → Use `scripts\deploy-code-only.ps1`
- **🎨 UI updates only?** → Use `scripts\deploy-ui.ps1`
- **🏭 Production setup?** → Use `scripts\deploy-solution.ps1` with custom parameters

### **🤖 Automated Deployment with GitHub Actions**

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

### **🔧 Manual Deployment with Azure CLI**

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

**POST** `/api/sessions/initiate`

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

**POST** `/api/predictions/submit`

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

## 🎨 Frontend Features

### **📱 Modern React Application**

The React frontend provides a comprehensive user interface built with modern web technologies:

#### **🎭 Agent Experience Page**

- **🤖 Interactive AI Chat** - Real-time conversation with specialized behavioral health agents
- **🎙️ Advanced Speech Input** - Web Speech API integration with voice activity detection
- **✋ Interruption Handling** - Users can interrupt agent speech naturally
- **🎚️ Speech Controls** - Adjustable speech rate, pitch, and voice selection
- **🎭 Animated Bot Avatar** - Visual feedback and engagement during conversations

#### **📊 Session Dashboard**

- **📋 Session Overview** - Comprehensive view of all behavioral health assessment sessions
- **🔍 Session Details** - Detailed view of individual session results
- **🗑️ Session Deletion** - Proper session cleanup with backend persistence
- **📈 Progress Tracking** - Visual indicators of session completion status

#### **🎯 User Experience**

- **🌓 Dark/Light Mode** - Adaptive theming for user preference
- **📱 Responsive Design** - Mobile-first design that works on all devices
- **♿ Accessibility** - WCAG compliant with keyboard navigation and screen readers
- **⚡ Performance** - Optimized loading with lazy loading and code splitting

#### **🎨 Design System**

- **🎨 Tailwind CSS** - Utility-first CSS framework for consistent styling
- **🧩 Component Library** - Reusable UI components with shadcn/ui
- **🎭 Animations** - Smooth transitions and micro-interactions
- **📐 Typography** - Clear, readable typography hierarchy

### **🔧 Technical Stack**

- **⚛️ React 18** - Latest React with concurrent features
- **📘 TypeScript** - Full type safety throughout the application
- **⚡ Vite** - Fast build tool with hot module replacement
- **🎨 Tailwind CSS** - Utility-first CSS framework
- **🧩 shadcn/ui** - High-quality component library
- **📡 Axios** - HTTP client for API communication
- **🔄 React Query** - Data fetching and caching (if implemented)
- **📊 Chart.js** - Data visualization for session analytics

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
   curl -X POST http://localhost:7071/api/sessions/initiate \
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

Use the `scripts\deploy-solution.ps1` script to deploy both the Functions app and infrastructure:

```powershell
# Quick Deploy (recommended for first-time setup)
.\scripts\deploy-solution.ps1 -FunctionAppName "your-unique-app-name" -KintsugiApiKey "your-api-key" -QuickDeploy

# Or with custom resource group and location
.\scripts\deploy-solution.ps1 -ResourceGroupName "your-rg" -FunctionAppName "your-function-app" -KintsugiApiKey "your-api-key" -Location "East US"

# This script will:
# 1. Create or update Azure resources (Functions, Storage, App Service Plan, etc.)
# 2. Deploy Functions code
# 3. Configure environment variables and app settings
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

**Note:** The above example references legacy scripts that have been consolidated. Use the deployment scripts documented in the main deployment section above.

### Individual Component Deployment

Deploy just the Functions app:

```powershell
# Deploy only the Azure Functions
.\scripts\deploy-code-only.ps1 -FunctionAppName "cwbhieastus001" -ResourceGroupName "bhi"
```

Deploy just the UI:

```powershell
# Deploy only the UI application
.\scripts\deploy-ui.ps1 -DeploymentTarget "app-service" -ResourceName "cwuibhieastus001" -ResourceGroupName "bhi"
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

## �️ Audio Transcription Feature

This feature adds automatic transcription capabilities to the Behavioral Health System using Azure Speech Services Fast Transcription API.

### **🎯 Transcription Features**

- ✅ **Automatic Transcription** - Convert uploaded audio files to text using Azure Speech Services
- ✅ **Fast Transcription API** - Uses the latest Azure Speech Services Fast Transcription API for improved accuracy and speed
- ✅ **Session Integration** - Transcriptions are saved to session data for future reference
- ✅ **User Interface** - Easy-to-use transcription component in the Session Details page
- ✅ **Copy & Download** - Users can copy transcription text to clipboard or download as text file
- ✅ **Fixed Response Format** - Corrected OpenAI transcription format from 'verbose_json' to 'json'

### **🔧 Transcription Configuration**

#### Environment Variables

The following environment variables must be configured:

```bash
# Azure Speech Service Configuration
VITE_AZURE_SPEECH_ENDPOINT=https://your-region.api.cognitive.microsoft.com/
VITE_AZURE_SPEECH_API_KEY=your-speech-api-key
```

#### Azure Speech Service Setup

1. Create an Azure Speech Service resource
2. Get the endpoint URL and API key
3. Ensure the service has access to the audio files (proper CORS/SAS tokens)

### **🎯 Transcription Usage**

1. **Navigate to Session Details** - Go to any session with an uploaded audio file
2. **Generate Transcription** - Click the "Generate Transcription" button in the Audio Transcription section
3. **Wait for Completion** - The transcription process may take a few minutes depending on audio length
4. **View Results** - Once complete, the transcription text will be displayed with confidence score
5. **Copy or Download** - Use the Copy or Download buttons to save the transcription

### **📡 API Integration**

The transcription uses Azure Speech Services Fast Transcription API v3.1:

- **Create Job** - `POST /speechtotext/v3.1/transcriptions`
- **Check Status** - `GET /speechtotext/v3.1/transcriptions/{id}`
- **Get Results** - `GET /speechtotext/v3.1/transcriptions/{id}/files`
- **Cleanup** - `DELETE /speechtotext/v3.1/transcriptions/{id}`

### **⚠️ Error Handling**

- Network connectivity issues
- Azure Speech Service API errors  
- Audio file format compatibility
- Timeout handling for long transcriptions
- Graceful fallback for missing audio files

## �🆕 Recent Updates & Features

### **✅ Recent Updates & Fixes (September 2025)**

#### **OpenAI Transcription Fix**
- **Issue**: OpenAI API was rejecting transcription requests due to incorrect `response_format` parameter
- **Root Cause**: Frontend was sending `'verbose_json'` format which is not supported by gpt-4o-transcribe model
- **Solution**: Updated `transcriptionService.ts` to use `'json'` format instead
- **Files Updated**: `BehavioralHealthSystem.Web/src/services/transcriptionService.ts`

#### **Metadata Validation Consistency**
- **Issue**: Inconsistent validation rules between frontend and backend for gender, race, and ethnicity fields
- **Key Changes**:
  - **Gender**: "prefer not to specify" ✅ (consistent across all systems)
  - **Race**: "prefer not to specify" ✅ (was "prefer not to say" in some places)
  - **Ethnicity**: Removed "prefer not to specify" option ✅ (only two valid options now)
- **Files Updated**: 
  - `BehavioralHealthSystem.Helpers/Validators/UserMetadataValidator.cs`
  - `BehavioralHealthSystem.Web/src/pages/UploadAnalyze.tsx` 
  - `BehavioralHealthSystem.Tests/GenderEthnicityValidationTests.cs`
- **Testing**: All validation tests passing (6/6) with updated rules

### **🎭 AI Agent Experience (Latest)**

- ✅ **Multi-Agent System** - Coordinated AI agents for behavioral health assessments
- ✅ **Intelligent Handoffs** - Seamless transitions between specialized agents
- ✅ **Advanced Speech Processing** - Web Speech API with voice activity detection
- ✅ **Interactive Chat Interface** - Real-time conversation with animated bot visualization

### **📡 Real-Time Features**

- ✅ **SignalR Integration** - Bidirectional real-time communication
- ✅ **Live Session Updates** - Real-time session status and progress tracking
- ✅ **Connection Management** - Robust connection handling and reconnection logic

### **🎨 Enhanced Frontend**

- ✅ **React 18 Migration** - Latest React with concurrent features and TypeScript
- ✅ **Modern UI Components** - shadcn/ui component library with Tailwind CSS
- ✅ **Responsive Design** - Mobile-first design that works on all devices
- ✅ **Accessibility Improvements** - WCAG compliant with keyboard navigation

### **🛠️ Developer Experience**

- ✅ **Consolidated Deployment Scripts** - Streamlined deployment with single `deploy-solution.ps1`
- ✅ **Local Development Script** - `local-run.ps1` for one-command full-stack startup
- ✅ **Enhanced Documentation** - Comprehensive README with all latest features
- ✅ **Session Management** - Proper session deletion with backend persistence

### **🔧 Backend Improvements**

- ✅ **Session Storage Functions** - Enhanced session management and deletion
- ✅ **Health Check Enhancements** - Comprehensive health monitoring
- ✅ **Error Handling** - Improved error responses and logging
- ✅ **API Endpoints** - New endpoints for agent chat and session management

## 📊 DSM-5 Multi-Condition Extended Risk Assessment System

### **Overview**

The system provides dynamic, AI-powered psychiatric assessments that can evaluate **any combination of DSM-5 conditions** selected by the clinician. Using GPT-5/O3, the system generates comprehensive evaluations with disorder-specific diagnostic criteria, evidence mapping, and confidence scoring.

### **🎯 Dynamic Multi-Condition Assessment**

**Key Capabilities:**
- **Flexible Condition Selection** - Choose 1-5 DSM-5 conditions for simultaneous evaluation
- **Disorder-Specific Criteria** - Each condition evaluated against its unique DSM-5 diagnostic criteria
- **Cross-Condition Analysis** - Differential diagnosis and symptom overlap identification
- **Evidence-Based Evaluation** - AI maps patient data to specific diagnostic criteria
- **Confidence Metrics** - Transparent confidence scoring for each criterion and overall assessment

**Supported Assessment Types:**
1. **Single-Condition Assessment** - In-depth evaluation of one specific disorder
2. **Multi-Condition Assessment** - Simultaneous evaluation of 2-5 conditions
3. **Schizophrenia-Focused** - Legacy support for schizophrenia-only assessments
4. **Cross-Diagnostic Analysis** - Comparative evaluation across condition boundaries

### **🎯 Key Features**

- ✅ **Azure Content Understanding Integration** - Purpose-built API for complex document extraction
- ✅ **Complete DSM-5 Coverage** - All 13 standard sections per condition
- ✅ **Multi-Condition Assessment** - Evaluate multiple psychiatric conditions simultaneously
- ✅ **Schema-Driven Extraction** - Structured extraction with validation
- ✅ **Quality Scoring** - Automatic assessment quality tracking
- ✅ **Blob Storage Management** - Organized condition data storage

### **📋 DSM-5 Data Structure**

Each condition includes 13 standard sections:

1. **Diagnostic Criteria** - Official DSM-5 criteria (A, B, C, etc.)
2. **Diagnostic Features** - Detailed symptom descriptions
3. **Associated Features** - Related symptoms and presentations
4. **Prevalence** - Epidemiological data
5. **Development and Course** - Age of onset, progression
6. **Risk and Prognostic Factors** - Temperamental, environmental, genetic
7. **Culture-Related Issues** - Cultural variations in presentation
8. **Gender-Related Issues** - Gender-specific considerations
9. **Suicide Risk** - Risk assessment factors
10. **Functional Consequences** - Impact on daily functioning
11. **Differential Diagnosis** - Similar conditions to rule out
12. **Comorbidity** - Common co-occurring conditions
13. **Specifiers** - Severity levels, subtypes, course specifiers

### **🔧 Configuration**

```json
{
  "Values": {
    "AZURE_CONTENT_UNDERSTANDING_ENDPOINT": "https://your-resource.cognitiveservices.azure.com/",
    "AZURE_CONTENT_UNDERSTANDING_KEY": "your-api-key",
    "DSM5_EXTRACTION_METHOD": "CONTENT_UNDERSTANDING",
    "DSM5_STORAGE_ACCOUNT_NAME": "your-storage-account",
    "DSM5_CONTAINER_NAME": "dsm5-data"
  }
}
```

### **📡 DSM-5 API Endpoints**

#### Get System Status
**GET** `/api/dsm5-admin/data-status`

Returns DSM-5 system initialization status and statistics.

```json
{
  "success": true,
  "dataStatus": {
    "isInitialized": true,
    "totalConditions": 346,
    "availableConditions": 346,
    "categories": ["Neurodevelopmental Disorders", "Schizophrenia Spectrum", ...],
    "lastUpdated": "2025-10-02T22:53:45Z",
    "dataVersion": "1.0",
    "storageInfo": {
      "containerExists": true,
      "totalBlobSize": 267357,
      "blobCount": 346
    }
  }
}
```

#### Get Available Conditions
**GET** `/api/dsm5-admin/conditions`

Retrieves list of all DSM-5 conditions for condition selection.

```json
{
  "success": true,
  "totalConditions": 346,
  "categories": ["Depressive Disorders", "Anxiety Disorders", ...],
  "conditions": [
    {
      "conditionId": "major-depressive-disorder",
      "name": "Major Depressive Disorder",
      "code": "296.2x (F32.x)",
      "category": "Depressive Disorders"
    }
  ]
}
```

#### Get Condition Details
**GET** `/api/dsm5-admin/conditions/{conditionId}`

Returns full diagnostic criteria for a specific condition.

#### Validate Extraction
**POST** `/api/dsm5-admin/validate-extraction`

Test PDF extraction with sample pages before processing full document.

**Request:**
```json
{
  "pdfData": "base64-encoded-pdf",
  "startPage": 50,
  "endPage": 60,
  "autoUpload": false
}
```

**Response:**
```json
{
  "success": true,
  "conditionsFound": 114,
  "processingTimeSeconds": 186.0,
  "extractedData": {
    "conditions": [...]
  }
}
```

### **🔍 How It Works**

1. **PDF Upload** - DSM-5 PDF uploaded to temporary blob storage with SAS URL
2. **Content Understanding API** - API analyzes document with markdown extraction
3. **Markdown Parsing** - Regex-based extraction of condition headers and sections
4. **Data Validation** - Quality scoring and completeness checking
5. **Blob Storage** - Individual condition files stored for quick access
6. **UI Integration** - Conditions available via dropdown selector

### **⚙️ DSM-5 Administration**

#### Initial Data Loading

```powershell
# From solution root directory
cd BehavioralHealthSystem.Console
dotnet run -c Release -- import-dsm5 -p "DSM5.pdf" -s 1 -e 810 -v
```

**Processing Time Estimates:**
- Single disorder (5 pages): 3-5 seconds
- Chapter (50 pages): 30-45 seconds  
- Full DSM-5 (810 pages): 3-5 minutes

**Quality Score Guidelines:**
- **0.90-1.00**: Excellent - All major sections present
- **0.75-0.89**: Good - Most sections present
- **0.60-0.74**: Acceptable - Core sections present
- **<0.60**: Poor - May need manual review

#### Data Storage Structure

```
dsm5-temp-uploads/           # Temporary PDF uploads with SAS URLs
dsm5-data/
├── conditions/
│   └── {condition-id}.json  # Individual condition files
```

### **🎯 Extended Risk Assessment with DSM-5**

The system provides comprehensive psychiatric evaluation including:

- **Multi-Condition Analysis** - Evaluate up to 5 DSM-5 conditions simultaneously
- **Cross-Condition Symptom Tracking** - Identify overlapping symptoms
- **DSM-5 Criteria Mapping** - Match symptoms to diagnostic criteria
- **Schizophrenia Spectrum Assessment** - Detailed evaluation with confidence scoring
- **Treatment Recommendations** - Condition-specific treatment suggestions

#### Assessment Workflow

```csharp
// 1. Select DSM-5 conditions (up to 5)
var selectedConditions = new List<string> 
{ 
    "major-depressive-disorder", 
    "generalized-anxiety-disorder",
    "schizophrenia"
};

// 2. Generate extended assessment
var assessment = await riskAssessmentService.GenerateExtendedRiskAssessmentAsync(
    sessionData, 
    selectedConditions
);

// 3. Access results
var schizophreniaLikelihood = assessment.SchizophreniaAssessment?.OverallLikelihood;
var functionalImpairment = assessment.SchizophreniaAssessment?.FunctionalImpairment;
var recommendations = assessment.SchizophreniaAssessment?.RecommendedActions;
```

#### Schizophrenia Assessment Criteria

**Criterion A Symptoms** (≥2 required, at least 1 from first 3):
1. Delusions - False fixed beliefs
2. Hallucinations - Perceptions without stimulus  
3. Disorganized Speech - Incoherent, derailed
4. Disorganized Behavior - Inappropriate, unpredictable
5. Negative Symptoms - Flat affect, avolition

**Criterion B**: Functional impairment in work, relationships, or self-care

**Likelihood Levels**:
- **None** - No evidence
- **Minimal** - Slight indications → Monitor
- **Low** - Some symptoms → Consider follow-up
- **Moderate** - Multiple symptoms → Further evaluation recommended
- **High** - Strong evidence → Clinical assessment needed
- **Very High** - Meets criteria → Urgent psychiatric referral

### **📊 Extraction Quality & Validation**

**Quality Metrics:**
- Completeness score (0.0-1.0)
- Present sections count (0-13)
- Missing sections list
- Parsing confidence indicators

**Validation Checks:**
- Required fields present (name, code, category)
- Diagnostic criteria structure valid
- Section content non-empty
- JSON serialization successful

### **⚙️ Multi-Condition Assessment Architecture**

#### Assessment Generation Workflow

```typescript
// Frontend: User selects DSM-5 conditions
const selectedConditions = [
  'major-depressive-disorder',
  'generalized-anxiety-disorder',
  'post-traumatic-stress-disorder'
];

// 1. Initiate async assessment job
const response = await apiPost('/api/sessions/{sessionId}/extended-risk-assessment', {
  selectedConditions
});

// 2. Backend generates dynamic prompt with all selected conditions
// 3. GPT-5/O3 evaluates patient against each condition's DSM-5 criteria
// 4. Returns multi-condition assessment with:
//    - Individual condition evaluations
//    - Cross-condition differential diagnosis
//    - Highest risk condition identification
//    - Combined treatment recommendations
```

#### Backend Model Structure

```csharp
public class ExtendedRiskAssessment : RiskAssessment
{
    // Legacy single-condition support
    public SchizophreniaAssessment? SchizophreniaAssessment { get; set; }
    
    // New multi-condition support
    public List<ConditionAssessmentResult>? ConditionAssessments { get; set; }
}

public class ConditionAssessmentResult
{
    public string ConditionId { get; set; }
    public string ConditionName { get; set; }
    public string OverallLikelihood { get; set; }
    public List<CriterionEvaluationResult> CriteriaEvaluations { get; set; }
    public List<string> RecommendedActions { get; set; }
    // ... additional properties
}
```

#### Frontend Display Logic

```typescript
// Type detection: single vs multi-condition
if ('conditionAssessments' in assessment && assessment.conditionAssessments) {
  // Multi-condition display: Show tabs for each evaluated disorder
  return <MultiConditionDisplay conditions={assessment.conditionAssessments} />;
} else if ('schizophreniaAssessment' in assessment) {
  // Legacy display: Single schizophrenia evaluation
  return <SchizophreniaDisplay assessment={assessment.schizophreniaAssessment} />;
}
```

### **🔧 Troubleshooting DSM-5 System**

#### Common Issues

**"Cannot access a disposed object" error:**
- Ensure `CORSCredentials: false` in `local.settings.json`
- This was causing premature IServiceProvider disposal

**No conditions available:**
- Run DSM-5 import script to initialize data
- Check blob storage connection string
- Verify Azure Content Understanding credentials

**Extraction taking too long:**
- Normal processing: ~3-5 minutes for full DSM-5
- Monitor Function timeout settings (default: 10 minutes)
- Check Application Insights for performance data

**Low quality scores:**
- Verify PDF quality (text vs scanned images)
- Check page ranges align with disorder boundaries
- Some disorders naturally lack certain sections

**"The request must contain a 'url' property" error:**
- System now automatically uploads PDF to blob storage
- Generates temporary SAS URL for Content Understanding API
- Ensures AzureWebJobsStorage is configured

#### Debug Mode

Enable detailed logging:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "BehavioralHealthSystem": "Debug",
      "Azure.AI.ContentUnderstanding": "Debug"
    }
  }
}
```

### **💡 Best Practices**

1. **Test with Sample Pages First** - Use `validate-extraction` endpoint with 5-10 pages
2. **Monitor Quality Scores** - Review extraction quality before full processing
3. **Use Appropriate Model** - GPT-4 or GPT-5 recommended for extended assessments
4. **Consider Processing Time** - Budget 3-5 minutes for full DSM-5 extraction
5. **Validate Storage** - Ensure blob containers exist before extraction
6. **Check Costs** - Azure Content Understanding charges per page analyzed

## 🐛 Debugging Guide

### **Frontend Debugging**

#### Extended Risk Assessment Issues

**Enable Debug Logging:**

Open browser console (F12) and filter for `ExtendedRiskAssessment`.

**Key Log Points:**
```typescript
[ExtendedRiskAssessment] 🚀 Starting assessment generation
[ExtendedRiskAssessment] 📥 Raw response received: {full JSON}
[ExtendedRiskAssessment] Response structure check:
  - response.success: true/false
  - response.data exists: true/false
  - response.data.success: true/false
  - response.data.extendedRiskAssessment exists: true/false
```

**Common Issues:**

1. **"Failed to generate assessment" with HTTP 200:**
   - Check response structure in console logs
   - Verify nested `success` fields are both true
   - Ensure `extendedRiskAssessment` object exists

2. **Timeout errors:**
   - Extended assessments take 30s-2min
   - Standard timeout is 30s, may need increase
   - Check network tab for actual response time

3. **Type mismatches:**
   - Verify API response matches TypeScript interfaces
   - Check for null/undefined in nested objects
   - Review serialization settings in backend

#### SignalR Connection Issues

**Check Connection Status:**
```typescript
// In browser console
window.signalRConnection?.state
// Should return: "Connected", "Connecting", "Disconnected", "Reconnecting"
```

**Connection Troubleshooting:**
- Verify Functions host is running on correct port
- Check CORS settings allow SignalR connections
- Review browser console for connection errors
- Test with `chrome://inspect/#devices` for detailed logs

### **Backend Debugging**

#### Azure Functions Local Debugging

**Start with Verbose Logging:**
```powershell
cd BehavioralHealthSystem.Functions
func start --port 7071 --verbose
```

**Common Issues:**

1. **IServiceProvider disposed errors:**
   - Set `CORSCredentials: false` in `local.settings.json`
   - Check DI registration order in `Program.cs`
   - Avoid capturing IServiceProvider in long-lived delegates

2. **Blob storage connection failures:**
   - Verify `AzureWebJobsStorage` connection string
   - Use Azure Storage Emulator for local development
   - Check firewall/network connectivity to Azure

3. **Content Understanding API errors:**
   - Verify API endpoint and key are correct
   - Check API version: `2025-05-01-preview`
   - Ensure PDF is uploaded to blob storage first
   - Review SAS token expiration (default: 2 hours)

#### Health Check Endpoint

**Test System Health:**
```powershell
Invoke-RestMethod -Uri "http://localhost:7071/api/health" -Method GET
```

**Expected Response:**
```json
{
  "status": "Healthy",
  "totalDuration": 45.2,
  "entries": {
    "kintsugi-api": {
      "status": "Healthy",
      "description": "Kintsugi API service is configured"
    },
    "storage": {
      "status": "Healthy",
      "description": "Azure Storage is accessible"
    }
  }
}
```

### **Test Scripts**

#### DSM-5 System Test
```powershell
# Test DSM-5 data status
Invoke-RestMethod -Uri "http://localhost:7071/api/dsm5-admin/data-status" -Method GET

# Test extraction with sample pages
$testRequest = @{
    pdfData = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes("DSM5.pdf"))
    startPage = 50
    endPage = 60
    autoUpload = $false
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:7071/api/dsm5-admin/validate-extraction" `
    -Method POST -Body $testRequest -ContentType "application/json"
```

#### Session Management Test
```powershell
# Get all sessions
Invoke-RestMethod -Uri "http://localhost:7071/api/sessions" -Method GET

# Delete specific session
Invoke-RestMethod -Uri "http://localhost:7071/api/sessions/{sessionId}" -Method DELETE
```

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
