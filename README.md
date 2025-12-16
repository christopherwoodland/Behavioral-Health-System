# Behavioral Health System - Complete Mental Health Platform

A **production-ready** full-stack behavioral health assessment platform featuring Azure Functions backend, React frontend, and Azure OpenAI Realtime API for natural voice conversations. Integrates with Kintsugi Health API for advanced mental health analysis, following Microsoft's best practices for enterprise-grade development.

---

## 🌍 Three-Environment Setup

This application supports three distinct environments for different use cases:

| Environment | Purpose | Setup Guide |
|------------|---------|-------------|
| **🏠 Local** | Offline development with local models | [Quick Start](#local-offline-mode) |
| **🧪 Development** | Azure dev/test with Managed Identity | [Development Setup](#development-environment) |
| **🚀 Production** | Production deployment on Azure | [Production Deployment](#production-deployment) |

**👉 See [ENVIRONMENTS.md](ENVIRONMENTS.md) for detailed environment configuration guide**

### Quick Start by Environment

```powershell
# Local offline mode (no Azure needed)
.\scripts\run-environment.ps1 -Environment local

# Development with Azure dev resources
.\scripts\run-environment.ps1 -Environment development

# Production deployment
.\scripts\build-and-push-containers.ps1 -Environment production
```

---

## 📝 Documentation Notice

This README consolidates all markdown documentation for the Behavioral Health System. Previously separate documentation files have been merged into this single comprehensive guide covering:

- **Architecture & Features** - Full platform capabilities and design patterns
- **Local Development** - Setup and development workflow
- **Deployment** - Complete deployment guide with VNet integration
- **Infrastructure** - Services deployed and configuration
- **API Documentation** - Endpoints and usage examples
- **DSM-5 System** - Extended risk assessment with psychiatric conditions
- **Testing & Quality** - Testing strategies and best practices
- **Troubleshooting** - Common issues and solutions

For complete sections on any topic, please review the relevant section below.

## 🚀 Key Features

### **🏗️ Enterprise Architecture**

- ✅ **Full-Stack Solution** - React frontend with Azure Functions backend
- ✅ **Real-Time Communication** - Azure OpenAI Realtime API with WebRTC for voice interaction
- ✅ **AI-Powered Voice Agents** - GPT-4o Realtime API for natural voice conversations
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

---

## 📋 Prerequisites

### **🛠️ Development Environment**

- **📥 .NET 8.0 SDK** - [Download here](https://dotnet.microsoft.com/download/dotnet/8.0)
- **🟢 Node.js 18+** - [Download here](https://nodejs.org/) (Required for React frontend)
- **npm/yarn** - Package manager for frontend dependencies
- **🔧 Azure CLI** - [Installation guide](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- **💻 PowerShell** (for deployment scripts) - Windows PowerShell 5.1+ or PowerShell Core 7+
- **⚡ Azure Functions Core Tools v4** - [Installation guide](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local)

### **🔑 API Credentials**

- **Valid Kintsugi Health API credentials** - Contact Kintsugi Health for API access
- **Application Insights connection string** - For telemetry and monitoring (optional for local development)

### **🌐 Browser Requirements**

- **Modern browser with Web Speech API support** - Chrome, Edge, Safari, Firefox
- **Microphone access** - Required for speech input functionality
- **Responsive design support** - Works on desktop, tablet, and mobile devices

---

## 🖥️ Local Development

### **🚀 Quick Start**

1. **Setup local environment:**

   ```bash
   cd BehavioralHealthSystem.Functions
   copy local.settings.json.template local.settings.json
   # Edit local.settings.json with your Kintsugi API key (Application Insights is optional)
   ```

2. **Run full-stack locally (Recommended - using convenience script):**

   ```bash
   # From the solution root directory - starts both backend and frontend
   .\scripts\local-run.ps1
   # This script builds the Functions project and starts both:
   # - Azure Functions host (localhost:7071)
   # - React development server (localhost:3001)
   ```

3. **Run backend only (Manual approach):**

   ```bash
   cd ..
   dotnet build BehavioralHealthSystem.sln
   cd BehavioralHealthSystem.Functions
   func start
   ```

4. **Run frontend only:**

   ```bash
   cd BehavioralHealthSystem.Web
   npm install
   npm run dev
   ```

5. **Test endpoints:**
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

- **VS Code** with Azure Functions extension
- **REST Client** extension for testing HTTP requests
- **Azure Storage Explorer** for local storage debugging
- **Application Insights** extension for monitoring
- **React DevTools** browser extension
- **Tailwind CSS IntelliSense** VS Code extension

---

## 🏗️ Application Architecture

The application implements a modern full-stack architecture with the following key components:

### **🎭 AI Voice Agent Experience**

```typescript
// Azure OpenAI Realtime API for natural voice conversations
const realtimeConfig = {
  model: "gpt-4o-realtime-preview",
  voice: "alloy",
  turnDetection: "server_vad", // Server-side voice activity detection
  modalities: ["text", "audio"]
};
```

Features:

- **Real-Time Voice Interaction** - Natural conversations with GPT-4o using Azure OpenAI Realtime API
- **WebRTC Audio Streaming** - Low-latency bidirectional audio with WebRTC data channels
- **Server-Side VAD** - Azure-powered voice activity detection for natural turn-taking
- **Multi-Agent Personalities** - Matron (biometric intake), Tars (coordinator), PHQ-2 Agent, PHQ-9 Agent with distinct voices
- **Accessibility Features** - Full keyboard navigation and screen reader support

### **📡 Real-Time Communication**

Features:

- **WebRTC Data Channels** - Low-latency bidirectional audio streaming
- **Azure OpenAI Realtime API** - Direct connection to GPT-4o for voice interactions
- **Live Session Monitoring** - Real-time session status and progress tracking
- **Automatic Reconnection** - Robust connection handling with exponential backoff

### **🎨 Enhanced UI/UX Features**

- **Interactive Brain Animation** - Hover-activated throb animation with realistic scaling pattern
- **Modal Dialogs** - Improved information display replacing problematic tooltips
- **Streamlined Re-run Workflow** - Navigation-based re-run with pre-filled session data
- **Enhanced Session Views** - Detailed session pages with comprehensive information
- **Responsive Design** - Optimized for desktop, tablet, and mobile experiences
- **Accessible Components** - WCAG 2.2 Level AA compliant interface elements
- **Theme Support** - Dark/light mode with automatic detection
- **Consistent Styling** - Unified design language across all components

### **📋 Session Management**

- **Persistent Sessions** - Session data stored with proper deletion functionality
- **Session Lifecycle** - Complete session tracking from creation to completion
- **Session Analytics** - Detailed session metrics and performance data
- **Proper Cleanup** - Backend deletion ensures data consistency
- **Smart Re-run Functionality** - Re-analyze sessions with optimized audio processing
- **Session History** - Access previous sessions with enhanced detail views
- **Audio Conversion Optimization** - Skip redundant audio processing for re-runs

### **➕ Matron Agent - Biometric Data Collection**

The **Matron agent** is a specialized AI personality designed to collect initial user biometric and preference data for personalized experiences.

**Key Features:**

- **Smart Intake** - Automatically triggered by Tars orchestration if no biometric data exists
- **Unit Conversion** - Accepts imperial or metric input, stores all data in metric
- **Privacy-Focused** - Only nickname is required; all other data is optional
- **Culturally Sensitive** - Respectful of all identities, backgrounds, and preferences
- **Persistent Storage** - Data stored in blob storage at `bio/users/{userId}/biometric.json`

**Data Collected:**

- **Required:** Nickname (prompted up to 2 times)
- **Optional:** Weight (kg), Height (cm), Gender, Pronouns, Last Residence
- **Personalization:** Hobbies, Likes, Dislikes, Additional Info

---

## 📁 Project Structure

```text
BehavioralHealthSystem/
├── 📁 BehavioralHealthSystem.Functions/         # Azure Functions backend
│   ├── 📁 Functions/                            # Function endpoints
│   │   ├── HealthCheckFunction.cs
│   │   ├── RiskAssessmentFunctions.cs
│   │   ├── SessionStorageFunctions.cs
│   │   └── TestFunctions.cs
│   ├── 📁 Models/
│   ├── GlobalUsings.cs
│   ├── Program.cs
│   ├── host.json
│   └── local.settings.json.template
├── 📁 BehavioralHealthSystem.Web/              # React frontend application
│   ├── 📁 src/
│   │   ├── 📁 components/
│   │   ├── 📁 pages/
│   │   ├── 📁 services/
│   │   ├── 📁 hooks/
│   │   └── 📁 utils/
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── 📁 BehavioralHealthSystem.Console/          # CLI tools for DSM-5 import
├── 📁 BehavioralHealthSystem.Helpers/          # Shared library project
├── 📁 BehavioralHealthSystem.Tests/            # Unit test project
├── 📁 infrastructure/                          # Infrastructure as Code
│   ├── 📁 bicep/
│   │   ├── main.bicep
│   │   ├── 📁 modules/
│   │   └── 📁 parameters/
│   └── 📁 scripts/
│       └── Deploy-With-VNet-Integration.ps1
├── 📁 scripts/                                  # Deployment and utility scripts
└── BehavioralHealthSystem.sln
```

---

## ⚙️ Configuration

### Local Settings

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

---

## 🚀 Deployment

### **Quick Deploy (Recommended)**

Perfect for demos, testing, and rapid prototyping with minimal configuration:

```powershell
# From solution root directory
.\scripts\deploy-solution.ps1 -FunctionAppName "your-unique-app-name" -KintsugiApiKey "your-api-key" -QuickDeploy
```

### **Production Deploy (Custom Configuration)**

For production deployments with custom resource group and region:

```powershell
# From solution root directory
.\scripts\deploy-solution.ps1 -ResourceGroupName "your-rg" -FunctionAppName "your-function-app" -KintsugiApiKey "your-api-key" -Location "East US"
```

### **Infrastructure Deployment with VNet Integration**

Deploy complete infrastructure with VNet integration and security:

```powershell
cd infrastructure\scripts

# Basic deployment with what-if preview and user approval
.\Deploy-With-VNet-Integration.ps1 -Environment dev -ParameterFile ..\bicep\parameters\dev.parameters.json

# With custom deployment client IP
.\Deploy-With-VNet-Integration.ps1 -Environment dev -ParameterFile ..\bicep\parameters\dev.parameters.json -DeploymentClientIP "1.2.3.4"
```

### **Code-Only Deploy (Rapid Updates)**

For updating code on existing Azure infrastructure:

```powershell
# From solution root directory
.\scripts\deploy-code-only.ps1 -FunctionAppName "your-function-app" -ResourceGroupName "your-rg"
```

### **UI-Only Deploy**

Deploy just the React web application:

```powershell
# Deploy to Azure App Service
.\scripts\deploy-ui.ps1 -DeploymentTarget "app-service" -ResourceName "your-web-app" -ResourceGroupName "your-rg"

# Deploy to Azure Storage static website
.\scripts\deploy-ui.ps1 -DeploymentTarget "storage" -ResourceName "your-storage-account" -ResourceGroupName "your-rg"

# Deploy to Azure Static Web Apps
.\scripts\deploy-ui.ps1 -DeploymentTarget "static-web-app" -ResourceName "your-static-web-app" -ResourceGroupName "your-rg"
```

---

## 🏭 Infrastructure Deployment

### **Deployment Script Overview**

The `Deploy-With-VNet-Integration.ps1` script orchestrates complete infrastructure deployment with:

- **Provider Registration** - Registers Microsoft.App provider for Container Apps support
- **Template Validation** - Validates Bicep syntax and parameters before deployment
- **What-If Preview** - Shows planned changes before actual deployment
- **User Approval** - Requires explicit confirmation before deploying
- **Deployment Execution** - Deploys all resources to subscription scope
- **RBAC Setup** - Automatically configures Network Contributor role for Function App VNet integration
- **Post-Deployment Summary** - Displays results and next steps

### **Deployment Flow**

```
1. Prerequisites Check
   ├─ Verify Azure CLI installed
   └─ Verify logged into Azure account
   
2. Provider Registration
   ├─ Register Microsoft.App provider
   └─ Wait for registration (up to 60 seconds)
   
3. Template Validation
   ├─ Validate Bicep template syntax
   └─ Validate parameters against schema
   
4. What-If Preview
   ├─ Show planned changes
   └─ Display resource changes to user
   
5. User Approval
   └─ Prompt for yes/no confirmation
   
6. Deployment Execution
   ├─ Deploy infrastructure at subscription scope
   ├─ Create resource groups, VNet, storage, services, etc.
   └─ Create Function App with VNet integration
   
7. Post-Deployment RBAC
   ├─ Retrieve Function App managed identity Principal ID
   ├─ Retrieve VNet resource ID
   └─ Grant Network Contributor role for VNet integration
   
8. Completion Summary
   └─ Display deployment summary and next steps
```

### **Services Deployed**

#### ✅ Deployed Services

**Backend APIs**
- Flex Consumption Function App (FC1)
  - .NET 8 isolated runtime
  - VNet integration on delegated subnet
  - Private endpoint for secure access
  - System-assigned managed identity
  - Auto-scaling up to 100 instances

**AI & ML Services**
- Azure OpenAI (GPT-4 models with private endpoint)
- Document Intelligence (form processing with private endpoint)
- Content Understanding API (private endpoint)

**Security & Storage**
- Key Vault (private endpoint, firewall restricted)
- Storage Account (private endpoint, HTTPS only)

**Networking**
- Virtual Network (10.0.0.0/16)
- App subnet (10.0.1.0/24) - delegated for Function App
- Private endpoint subnet (10.0.2.0/24) - for services
- Container Apps subnet (10.0.4.0/23) - reserved for future

**Monitoring & Logging**
- Application Insights
- Log Analytics Workspace
- Private DNS Zones

#### ❌ Not Deployed (Deploy Separately)

**Static Web App (React Frontend)**
- Status: Commented out in `main.bicep`
- Reason: Temporary disable due to JSON parsing issues
- Network: NOT VNet-integrated (fully managed SaaS)
- Authentication: MSAL
- To deploy: Uncomment module in main.bicep

**Container Apps (GitHub Runners)**
- Status: Commented out in `main.bicep`
- Reason: Deploy after core infrastructure is stable
- Purpose: Self-hosted GitHub Actions runners
- When ready: Uncomment module and redeploy

---

## 📡 API Endpoints

### **Main Workflow**

- **POST** `/api/sessions/initiate` - Create new session with user metadata
- **POST** `/api/predictions/submit` - Submit prediction with session ID and audio URL

### **Session Management**

- **GET** `/api/sessions` - Get all sessions for current user
- **GET** `/api/sessions/{sessionId}` - Get specific session details
- **DELETE** `/api/sessions/{sessionId}` - Delete session
- **POST** `/api/sessions/bulk-delete` - Delete multiple sessions

### **Health & Monitoring**

- **GET** `/api/health` - Health check endpoint with detailed status
- **POST** `/api/TestKintsugiConnection` - API connectivity test

### **Prediction Results**

- **GET** `/api/predictions/{userId}` - Get all predictions for a user
- **GET** `/api/predictions/sessions/{sessionId}` - Get specific prediction by session ID

---

## 📊 DSM-5 Extended Risk Assessment System

The system provides dynamic, AI-powered psychiatric assessments that can evaluate **any combination of DSM-5 conditions** selected by the clinician.

### **Key Capabilities**

- **Flexible Condition Selection** - Choose 1-5 DSM-5 conditions for simultaneous evaluation
- **Disorder-Specific Criteria** - Each condition evaluated against unique DSM-5 diagnostic criteria
- **Cross-Condition Analysis** - Differential diagnosis and symptom overlap identification
- **Evidence-Based Evaluation** - AI maps patient data to specific diagnostic criteria
- **Confidence Metrics** - Transparent confidence scoring for each assessment

### **Supported Assessment Types**

1. **Single-Condition Assessment** - In-depth evaluation of one specific disorder
2. **Multi-Condition Assessment** - Simultaneous evaluation of 2-5 conditions
3. **Schizophrenia-Focused** - Legacy support for schizophrenia-only assessments
4. **Cross-Diagnostic Analysis** - Comparative evaluation across condition boundaries

### **DSM-5 Data Structure**

Each condition includes 13 standard sections:

1. Diagnostic Criteria (A, B, C, etc.)
2. Diagnostic Features
3. Associated Features
4. Prevalence
5. Development and Course
6. Risk and Prognostic Factors
7. Culture-Related Issues
8. Gender-Related Issues
9. Suicide Risk
10. Functional Consequences
11. Differential Diagnosis
12. Comorbidity
13. Specifiers

### **DSM-5 Admin Endpoints**

- **GET** `/api/dsm5-admin/data-status` - System status and statistics
- **GET** `/api/dsm5-admin/conditions` - List all available conditions
- **GET** `/api/dsm5-admin/conditions/{conditionId}` - Get condition details
- **POST** `/api/dsm5-admin/validate-extraction` - Test PDF extraction

---

## 🧪 Testing

### **Unit Testing**

```bash
# Run all unit tests
dotnet test BehavioralHealthSystem.Tests/BehavioralHealthSystem.Tests.csproj

# Run tests with coverage
dotnet test --collect:"XPlat Code Coverage"

# Run tests in watch mode
dotnet watch test
```

### **Test Coverage**

The project includes **comprehensive unit tests** covering:

- ✅ Function Tests - Constructor validation for all function classes
- ✅ Model Tests - Constructor validation for all model classes
- ✅ Service Tests - Business logic and API integration tests
- ✅ Validator Tests - FluentValidation rule verification
- ✅ Interface Tests - Service contract validation
- ✅ Mocking Framework - Moq integration for dependency testing
- ✅ 42 Total Tests - All passing with comprehensive coverage

### **Manual API Testing**

1. **Health Check:**
   ```bash
   curl http://localhost:7071/api/health
   ```

2. **Kintsugi Connection Test:**
   ```bash
   curl -X POST http://localhost:7071/api/TestKintsugiConnection
   ```

3. **Start Workflow:**
   ```bash
   curl -X POST http://localhost:7071/api/sessions/initiate \
     -H "Content-Type: application/json" \
     -d '{"userId":"test-user-123","metadata":{...}}'
   ```

---

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

### **Infrastructure Security**

- ✅ HTTPS only communication
- ✅ TLS 1.2 minimum requirement
- ✅ Storage account security hardening
- ✅ Private endpoints for all services
- ✅ VNet integration for Function App

---

## 📚 Additional Resources

### **Documentation**

- [Azure Functions Documentation](https://docs.microsoft.com/en-us/azure/azure-functions/)
- [Azure App Service Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [Application Insights Documentation](https://docs.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)
- [Kintsugi Health API Documentation](https://api.kintsugihealth.com/docs)
- [FluentValidation Documentation](https://docs.fluentvalidation.net/)
- [Polly Resilience Framework](https://github.com/App-vNext/Polly)

### **Best Practices Guides**

- [Azure Functions Best Practices](https://docs.microsoft.com/en-us/azure/azure-functions/functions-best-practices)
- [Azure Security Best Practices](https://docs.microsoft.com/en-us/azure/security/fundamentals/best-practices-and-patterns)
- [Application Performance Monitoring](https://docs.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)

---

## 🐛 Troubleshooting

### **Common Issues**

1. **Function App not starting:**
   - Check Application Insights connection string
   - Verify all required app settings are configured
   - Review function app logs in Azure portal
   - Ensure FUNCTIONS_WORKER_RUNTIME is set to "dotnet-isolated"

2. **Kintsugi API authentication errors:**
   - Verify API key is correctly configured
   - Check API key has required permissions
   - Test API key with direct curl requests

3. **Storage account connection issues:**
   - Check storage account connection string
   - Verify storage account exists and is accessible
   - Review storage account permissions

4. **Application Insights not working:**
   - Verify APPLICATIONINSIGHTS_CONNECTION_STRING is set
   - Check Application Insights resource exists
   - Review sampling settings in host.json

### **Debug Mode**

Enable detailed logging by adding to local.settings.json:

```json
{
  "Values": {
    "AzureFunctionsJobHost__logging__logLevel__default": "Debug",
    "AzureFunctionsJobHost__logging__logLevel__Microsoft.Hosting.Lifetime": "Information"
  }
}
```

---

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes** following the established patterns
4. **Add comprehensive unit tests** for new functionality
5. **Ensure all tests pass** (`dotnet test`)
6. **Update documentation** as needed
7. **Submit a pull request** with detailed description

### **Development Guidelines**

- Follow the existing code style and patterns
- Add unit tests for all new functionality
- Update README for any new features or configuration
- Ensure all tests pass before submitting PR
- Use meaningful commit messages

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 📞 Support

For support and questions:

- **Issues**: Create an issue in this repository
- **Documentation**: Refer to the sections above
- **API Questions**: Contact Kintsugi Health support
- **Azure Support**: Use Azure Support Portal

---

## ✨ Enterprise Solution

This enhanced solution provides enterprise-grade reliability, comprehensive testing, and maintainability while following Microsoft's recommended patterns for Azure Functions development with .NET 8.

**Last Updated:** December 12, 2025
**Version:** 1.0
**Status:** Production Ready
