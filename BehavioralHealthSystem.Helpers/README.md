# Behavioral Health System - Helper Library

Shared services, utilities, and models used across all projects in the solution.

## 🎯 Purpose

Common library providing:
- Service interfaces and implementations
- Shared data models and DTOs
- Validation logic with FluentValidation
- Azure integrations and configurations
- Utility functions and helpers
- Deployment utilities

## 🏗️ Project Structure

```
BehavioralHealthSystem.Helpers/
├── Services/             # Shared service implementations
├── Models/              # Data models and DTOs
├── Validators/          # FluentValidation validators
├── Configuration/       # Configuration models
├── Deploy/             # Deployment utilities
└── GlobalUsings.cs     # Shared namespaces
```

## 🔧 Key Services

### Kintsugi API Service
Interface for mental health risk assessment API.

```csharp
public interface IKintsugiApiService
{
    Task<InitiateResponse> InitiateSessionAsync(InitiateRequest request);
    Task<PredictionResponse> PredictAsync(PredictionRequest request);
}
```

### DSM-5 Data Service
Manages diagnostic criteria data.

```csharp
public interface IDSM5DataService
{
    Task<DSM5ConditionData> GetConditionAsync(string conditionId);
    Task<IEnumerable<DSM5ConditionData>> GetAllConditionsAsync();
    Task<bool> UploadConditionDataAsync(DSM5ConditionData data);
}
```

### Biometric Data Service
Handles user health metrics.

```csharp
public interface IBiometricDataService
{
    Task SaveBiometricDataAsync(BiometricData data);
    Task<BiometricData> GetBiometricDataAsync(string userId);
}
```

### Azure Content Understanding Service
PDF and document processing.

```csharp
public interface IAzureContentUnderstandingService
{
    Task<string> AnalyzeDocumentAsync(Stream documentStream);
    Task<ExtractionResult> ExtractDSM5DataAsync(Stream pdfStream);
}
```

### Structured Logging Service
Consistent logging across services.

```csharp
public interface IStructuredLoggingService
{
    void LogInformation(string message, params object[] args);
    void LogError(Exception ex, string message, params object[] args);
}
```

### Exception Handling Service
Centralized error handling.

```csharp
public interface IExceptionHandlingService
{
    Task<T> ExecuteWithRetryAsync<T>(Func<Task<T>> operation);
    AppError HandleException(Exception ex);
}
```

## 📦 Models

### Request/Response Models
- `InitiateRequest` / `InitiateResponse` - Session initiation
- `PredictionRequest` / `PredictionResponse` - Risk prediction
- `UserMetadata` - User demographic data
- `BiometricData` - Health metrics
- `ChatTranscript` - Conversation data

### Configuration Models
- `KintsugiApiOptions` - Kintsugi API settings
- `AzureOpenAIOptions` - Azure OpenAI settings
- `AzureStorageOptions` - Storage settings
- `RetryPolicyOptions` - Resilience settings

### Error Models
- `AppError` - Application error representation
- `ValidationError` - Validation failure details
- `ApiErrorResponse` - API error responses

## ✅ Validators

All validators use FluentValidation:

- `InitiateRequestValidator` - Session initiation validation
- `UserMetadataValidator` - User data validation
- `PredictionRequestValidator` - Prediction request validation
- `BiometricDataValidator` - Health metrics validation

Example:
```csharp
public class InitiateRequestValidator : AbstractValidator<InitiateRequest>
{
    public InitiateRequestValidator()
    {
        RuleFor(x => x.UserMetadata).NotNull();
        RuleFor(x => x.UserMetadata.Gender).Must(BeValidGender);
        RuleFor(x => x.UserMetadata.Age).InclusiveBetween(0, 120);
    }
}
```

## 🔐 Configuration

### Retry Policies (Polly)
- Exponential backoff for transient failures
- Circuit breaker for cascading failures
- Timeout policies for long-running operations

### Azure Integrations
- Blob Storage client factory
- OpenAI client configuration
- Content Understanding service setup

## 🛠️ Utilities

### Extension Methods
- String extensions for validation
- DateTime extensions for formatting
- Collection extensions for LINQ operations

### Helpers
- JSON serialization helpers
- HTTP client helpers
- Validation helpers
- Retry helpers

## 📊 Deployment Utilities

Located in `Deploy/` directory:
- Bicep file helpers
- Resource deployment scripts
- Configuration management
- Environment validation

## 🧪 Testing Support

Provides test utilities and mocks:
- Mock service implementations
- Test data builders
- Validation test helpers
- Configuration test helpers

## 📦 Dependencies

- **Azure.Storage.Blobs** - Blob storage
- **Azure.AI.OpenAI** - OpenAI integration
- **FluentValidation** - Validation framework
- **Polly** - Resilience and retry
- **Microsoft.Extensions.Options** - Configuration
- **Microsoft.Extensions.Logging** - Logging

## 🔄 Usage in Other Projects

All projects reference this library:

```xml
<ItemGroup>
  <ProjectReference Include="..\BehavioralHealthSystem.Helpers\BehavioralHealthSystem.Helpers.csproj" />
</ItemGroup>
```

Access services via dependency injection:
```csharp
public class MyFunction
{
    private readonly IKintsugiApiService _kintsugiService;
    
    public MyFunction(IKintsugiApiService kintsugiService)
    {
        _kintsugiService = kintsugiService;
    }
}
```

## 📚 Additional Resources

- [Main README](../README.md) - Complete system documentation
- [Service Architecture](../README.md#-architecture) - System design
- [API Reference](../README.md#-api-reference) - Endpoint documentation
