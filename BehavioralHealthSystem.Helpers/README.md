# Behavioral Health System - Helpers Library

A shared library containing core models, services, validators, and utilities used across the Behavioral Health System solution.

## 🚀 Overview

This shared library project contains common functionality, data models, business logic, and configuration used by the Azure Functions backend and other components of the behavioral health platform.

### Key Features

- ✅ **Shared Data Models** - Consistent DTOs and entities across projects
- ✅ **Business Services** - Core business logic and external API integrations
- ✅ **FluentValidation** - Comprehensive input validation rules
- ✅ **Retry Policies** - Resilient API call patterns with Polly
- ✅ **Typed Configuration** - Strongly-typed configuration options
- ✅ **Global Usings** - Centralized namespace management

## 📁 Project Structure

```text
BehavioralHealthSystem.Helpers/
├── 📁 Configuration/                # Typed configuration and policies
│   ├── AzureOpenAIOptions.cs       # Azure OpenAI service configuration
│   ├── KintsugiApiOptions.cs       # Kintsugi Health API configuration
│   └── RetryPolicies.cs            # Polly retry policy definitions
├── 📁 Models/                       # Data models and DTOs
│   ├── ActualScore.cs              # Actual score data model
│   ├── ApiErrorResponse.cs         # Standardized error response
│   ├── FileGroupData.cs            # File group data structures
│   ├── InitiateRequest.cs          # Session initiation request
│   ├── InitiateResponse.cs         # Session initiation response
│   ├── PredictError.cs             # Prediction error details
│   ├── PredictionRequest.cs        # Prediction submission request
│   ├── PredictionResponse.cs       # Prediction API response
│   ├── PredictionResult.cs         # Prediction result data
│   ├── SessionData.cs              # Session storage data
│   └── UserMetadata.cs             # User demographic information
├── 📁 Services/                     # Business logic services
│   ├── 📁 Interfaces/              # Service interface definitions
│   │   ├── IFileGroupStorageService.cs    # File group storage interface
│   │   ├── IKintsugiApiService.cs         # Kintsugi API service interface
│   │   └── ISessionStorageService.cs      # Session storage interface
│   ├── FileGroupStorageService.cs  # File group storage implementation
│   ├── KintsugiApiHealthCheck.cs   # Health check for Kintsugi API
│   ├── KintsugiApiService.cs       # Kintsugi Health API client
│   └── SessionStorageService.cs    # Session data storage service
├── 📁 Validators/                   # FluentValidation validators
│   ├── InitiateRequestValidator.cs # Session initiation validation
│   └── UserMetadataValidator.cs    # User metadata validation
├── 📁 Deploy/                       # Azure deployment resources
│   ├── azuredeploy.json            # ARM template for Azure resources
│   └── azuredeploy.parameters.json # ARM template parameters
├── 📄 GlobalUsings.cs              # Global using directives
└── 📄 BehavioralHealthSystem.Helpers.csproj # Project file
```

## 🛠️ Technology Stack

### Core Technologies

- **🔢 .NET 8** - Latest .NET version with performance improvements
- **📄 System.Text.Json** - High-performance JSON serialization
- **🔄 Polly** - Resilience and transient-fault-handling library
- **✅ FluentValidation** - Fluent interface for validation rules

### Azure Integration

- **☁️ Azure.Storage.Blobs** - Azure Blob Storage SDK
- **🏥 Microsoft.Extensions.Diagnostics.HealthChecks** - Health monitoring
- **🔧 Microsoft.Extensions.Options** - Configuration patterns
- **💉 Microsoft.Extensions.DependencyInjection** - Dependency injection

## 📊 Data Models

### Core Models

#### UserMetadata

Represents user demographic information for behavioral health analysis:

```csharp
public class UserMetadata
{
    public int? Age { get; set; }
    public string? Gender { get; set; }
    public string? Race { get; set; }
    public string? Ethnicity { get; set; }
    public int? Weight { get; set; }
    public string? Zipcode { get; set; }
    public bool Language { get; set; } // English as primary language
}
```

**Validation Rules:**
- **Age:** 1-149 years (optional)
- **Gender:** Valid options include "male", "female", "non-binary", "transgender female", "transgender male", "other", "prefer not to specify"
- **Race:** Valid options include "white", "black or african-american", "asian", etc.
- **Ethnicity:** "Hispanic, Latino, or Spanish Origin" or "Not Hispanic, Latino, or Spanish Origin"
- **Weight:** 10-1000 pounds (optional)
- **Zipcode:** Alphanumeric, 1-10 characters (optional)

#### PredictionResult

Contains behavioral health prediction data from Kintsugi API:

```csharp
public class PredictionResult
{
    public string SessionId { get; set; }
    public string Status { get; set; }
    public string? PredictedScore { get; set; }
    public string? PredictedScoreAnxiety { get; set; }
    public string? PredictedScoreDepression { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public ActualScore? ActualScore { get; set; }
    public PredictError? PredictError { get; set; }
}
```

#### FileGroupData

Manages file group organization:

```csharp
public class FileGroupData
{
    public string GroupName { get; set; }
    public List<string> FileNames { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string UserId { get; set; }
}
```

### Request/Response Models

#### InitiateRequest

Session initiation with multiple input options:

```csharp
public class InitiateRequest
{
    public string UserId { get; set; }
    public UserMetadata Metadata { get; set; }
    
    // Option 1: URL-based audio (recommended)
    public string? AudioFileUrl { get; set; }
    public string? AudioFileName { get; set; }
    
    // Option 2: Base64 audio data (legacy)
    public string? AudioData { get; set; }
}
```

#### ApiErrorResponse

Standardized error response format:

```csharp
public class ApiErrorResponse
{
    public bool Success { get; set; } = false;
    public string Message { get; set; }
    public string? Error { get; set; }
    public int StatusCode { get; set; }
    public object? Details { get; set; }
}
```

## 🔧 Services

### KintsugiApiService

Primary service for integrating with Kintsugi Health API:

```csharp
public interface IKintsugiApiService
{
    Task<InitiateResponse> InitiateAsync(InitiateRequest request, CancellationToken cancellationToken = default);
    Task<PredictionResponse> SubmitPredictionAsync(PredictionRequest request, CancellationToken cancellationToken = default);
    Task<PredictionResult[]> GetPredictionsAsync(string userId, CancellationToken cancellationToken = default);
    Task<PredictionResult?> GetPredictionBySessionAsync(string sessionId, CancellationToken cancellationToken = default);
}
```

**Features:**
- ✅ **Automatic retry** with exponential backoff
- ✅ **Timeout handling** with configurable timeouts
- ✅ **Error mapping** from API responses to domain models
- ✅ **Comprehensive logging** with correlation IDs

**Usage Example:**

```csharp
// Inject service via DI
public class RiskAssessmentFunction
{
    private readonly IKintsugiApiService _kintsugiService;
    
    public RiskAssessmentFunction(IKintsugiApiService kintsugiService)
    {
        _kintsugiService = kintsugiService;
    }
    
    public async Task<HttpResponseData> AnalyzeRisk(HttpRequestData req)
    {
        var request = await req.ReadFromJsonAsync<InitiateRequest>();
        var response = await _kintsugiService.InitiateAsync(request);
        return await CreateResponse(req, HttpStatusCode.OK, response);
    }
}
```

### FileGroupStorageService

Manages file group organization with Azure Blob Storage:

```csharp
public interface IFileGroupStorageService
{
    Task<FileGroupData> CreateFileGroupAsync(string userId, string groupName, CancellationToken cancellationToken = default);
    Task<bool> DoesGroupNameExistAsync(string userId, string groupName, CancellationToken cancellationToken = default);
    Task<List<FileGroupData>> GetFileGroupsAsync(string userId, CancellationToken cancellationToken = default);
    Task<bool> DeleteFileGroupAsync(string userId, string groupName, CancellationToken cancellationToken = default);
}
```

**Features:**
- ✅ **Duplicate name validation** - Prevents duplicate group names per user
- ✅ **Conditional creation** - Creates groups only if they don't exist
- ✅ **Cascade delete** - Removes associated session data when groups are deleted
- ✅ **Persistent storage** - Uses Azure Blob Storage for reliable data persistence

### SessionStorageService

Handles session data persistence and lifecycle management:

```csharp
public interface ISessionStorageService
{
    Task<SessionData> CreateSessionAsync(string userId, string sessionId, object sessionData, CancellationToken cancellationToken = default);
    Task<SessionData?> GetSessionAsync(string sessionId, CancellationToken cancellationToken = default);
    Task<List<SessionData>> GetUserSessionsAsync(string userId, CancellationToken cancellationToken = default);
    Task<bool> DeleteSessionAsync(string sessionId, CancellationToken cancellationToken = default);
}
```

**Features:**
- ✅ **Session lifecycle management** - Create, read, and delete operations
- ✅ **User session queries** - Retrieve all sessions for a specific user
- ✅ **Data persistence** - Reliable storage with Azure Blob Storage
- ✅ **Proper cleanup** - Ensures complete session data removal

## ✅ Validation

### FluentValidation Implementation

The library uses FluentValidation for comprehensive input validation:

#### UserMetadataValidator

```csharp
public class UserMetadataValidator : AbstractValidator<UserMetadata>
{
    public UserMetadataValidator()
    {
        RuleFor(x => x.Age)
            .InclusiveBetween(1, 149)
            .When(x => x.Age.HasValue)
            .WithMessage("Age must be between 1 and 149 years");

        RuleFor(x => x.Gender)
            .Must(BeValidGender)
            .When(x => !string.IsNullOrEmpty(x.Gender))
            .WithMessage("Invalid gender value. Valid options: male, female, non-binary, transgender female, transgender male, other, prefer not to specify");

        RuleFor(x => x.Race)
            .Must(BeValidRace)
            .When(x => !string.IsNullOrEmpty(x.Race))
            .WithMessage("Invalid race value");

        RuleFor(x => x.Ethnicity)
            .Must(BeValidEthnicity)
            .When(x => !string.IsNullOrEmpty(x.Ethnicity))
            .WithMessage("Invalid ethnicity value. Valid options: 'Hispanic, Latino, or Spanish Origin', 'Not Hispanic, Latino, or Spanish Origin'");

        RuleFor(x => x.Weight)
            .InclusiveBetween(10, 1000)
            .When(x => x.Weight.HasValue && x.Weight > 0)
            .WithMessage("Weight must be between 10 and 1000 pounds");

        RuleFor(x => x.Zipcode)
            .Matches("^[a-zA-Z0-9]{1,10}$")
            .When(x => !string.IsNullOrEmpty(x.Zipcode))
            .WithMessage("Zipcode must be alphanumeric and 1-10 characters");
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

#### InitiateRequestValidator

```csharp
public class InitiateRequestValidator : AbstractValidator<InitiateRequest>
{
    public InitiateRequestValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User ID is required");

        RuleFor(x => x.Metadata)
            .NotNull()
            .WithMessage("User metadata is required")
            .SetValidator(new UserMetadataValidator());

        // Ensure either audio URL or audio data is provided
        RuleFor(x => x)
            .Must(HaveAudioData)
            .WithMessage("Either AudioFileUrl or AudioData must be provided");
    }

    private bool HaveAudioData(InitiateRequest request)
    {
        return !string.IsNullOrEmpty(request.AudioFileUrl) || 
               !string.IsNullOrEmpty(request.AudioData);
    }
}
```

### Validation Usage

```csharp
// Automatic validation in Azure Functions
[Function("CreateSession")]
public async Task<HttpResponseData> CreateSession(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req,
    IValidator<InitiateRequest> validator)
{
    var request = await req.ReadFromJsonAsync<InitiateRequest>();
    
    var validationResult = await validator.ValidateAsync(request);
    if (!validationResult.IsValid)
    {
        return await CreateBadRequestResponse(req, validationResult.Errors);
    }
    
    // Process valid request...
}
```

## 🔄 Configuration

### Typed Configuration Options

#### KintsugiApiOptions

```csharp
public class KintsugiApiOptions
{
    public const string SectionName = "Kintsugi";
    
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.kintsugihealth.com/v2";
    public int TimeoutSeconds { get; set; } = 300;
    public int MaxRetryAttempts { get; set; } = 3;
    public int RetryDelayMs { get; set; } = 1000;
}
```

#### Configuration Registration

```csharp
// In Program.cs or Startup.cs
services.Configure<KintsugiApiOptions>(
    configuration.GetSection(KintsugiApiOptions.SectionName));

// Usage in services
public class KintsugiApiService
{
    private readonly KintsugiApiOptions _options;
    
    public KintsugiApiService(IOptions<KintsugiApiOptions> options)
    {
        _options = options.Value;
    }
}
```

### Retry Policies

The library includes Polly-based retry policies for resilient API calls:

```csharp
public static class RetryPolicies
{
    public static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
    {
        return Policy
            .HandleResult<HttpResponseMessage>(r => !r.IsSuccessStatusCode)
            .Or<HttpRequestException>()
            .Or<TaskCanceledException>()
            .WaitAndRetryAsync(
                retryCount: 3,
                sleepDurationProvider: retryAttempt => 
                    TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)), // Exponential backoff
                onRetry: (outcome, timespan, retryCount, context) =>
                {
                    // Log retry attempts
                    var logger = context.GetLogger();
                    logger?.LogWarning("Retry {RetryCount} after {Delay}ms", 
                        retryCount, timespan.TotalMilliseconds);
                });
    }

    public static IAsyncPolicy<HttpResponseMessage> GetTimeoutPolicy()
    {
        return Policy.TimeoutAsync<HttpResponseMessage>(TimeSpan.FromSeconds(300));
    }

    public static IAsyncPolicy<HttpResponseMessage> GetCircuitBreakerPolicy()
    {
        return Policy
            .HandleResult<HttpResponseMessage>(r => !r.IsSuccessStatusCode)
            .CircuitBreakerAsync(
                consecutiveFailureCount: 5,
                durationOfBreak: TimeSpan.FromSeconds(30));
    }
}
```

### Usage in HTTP Client Registration

```csharp
services.AddHttpClient<IKintsugiApiService, KintsugiApiService>()
    .AddPolicyHandler(RetryPolicies.GetRetryPolicy())
    .AddPolicyHandler(RetryPolicies.GetTimeoutPolicy())
    .AddPolicyHandler(RetryPolicies.GetCircuitBreakerPolicy());
```

## 🏥 Health Checks

### KintsugiApiHealthCheck

Monitors the health and connectivity of the Kintsugi Health API:

```csharp
public class KintsugiApiHealthCheck : IHealthCheck
{
    private readonly IOptions<KintsugiApiOptions> _options;
    private readonly ILogger<KintsugiApiHealthCheck> _logger;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, 
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Verify configuration
            if (string.IsNullOrEmpty(_options.Value.ApiKey))
            {
                return HealthCheckResult.Unhealthy(
                    "Kintsugi API key is not configured");
            }

            if (string.IsNullOrEmpty(_options.Value.BaseUrl))
            {
                return HealthCheckResult.Unhealthy(
                    "Kintsugi API base URL is not configured");
            }

            // Basic connectivity check could be added here
            
            return HealthCheckResult.Healthy(
                "Kintsugi API service is configured");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Health check failed");
            return HealthCheckResult.Unhealthy(
                "Kintsugi API health check failed", ex);
        }
    }
}
```

### Health Check Registration

```csharp
services.AddHealthChecks()
    .AddCheck<KintsugiApiHealthCheck>("kintsugi-api")
    .AddCheck("storage", () => 
    {
        // Storage connectivity check
        return HealthCheckResult.Healthy();
    });
```

## 🚀 Deployment Resources

### ARM Template

The library includes Azure Resource Manager templates for infrastructure deployment:

#### azuredeploy.json

Defines Azure resources including:
- ✅ **Azure Function App** with consumption plan
- ✅ **Application Insights** for monitoring
- ✅ **Storage Account** for Functions and data storage
- ✅ **App Service Plan** with appropriate SKU
- ✅ **Key Vault** for secret management (optional)

#### Key Template Sections

```json
{
  "parameters": {
    "functionAppName": {
      "type": "string",
      "metadata": {
        "description": "Name of the Function App"
      }
    },
    "kintsugiApiKey": {
      "type": "securestring",
      "metadata": {
        "description": "Kintsugi Health API key"
      }
    }
  },
  "resources": [
    {
      "type": "Microsoft.Web/sites",
      "apiVersion": "2022-03-01",
      "name": "[parameters('functionAppName')]",
      "kind": "functionapp",
      "properties": {
        "siteConfig": {
          "appSettings": [
            {
              "name": "FUNCTIONS_WORKER_RUNTIME",
              "value": "dotnet-isolated"
            },
            {
              "name": "KINTSUGI_API_KEY",
              "value": "[parameters('kintsugiApiKey')]"
            }
          ]
        }
      }
    }
  ]
}
```

### Deployment Parameters

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "functionAppName": {
      "value": "your-function-app-name"
    },
    "location": {
      "value": "East US"
    }
  }
}
```

## 🔧 Development Setup

### Package References

The library includes these key dependencies:

```xml
<PackageReference Include="Azure.Storage.Blobs" Version="12.19.1" />
<PackageReference Include="FluentValidation" Version="11.8.0" />
<PackageReference Include="Microsoft.Extensions.DependencyInjection.Abstractions" Version="8.0.0" />
<PackageReference Include="Microsoft.Extensions.Diagnostics.HealthChecks" Version="8.0.0" />
<PackageReference Include="Microsoft.Extensions.Http" Version="8.0.0" />
<PackageReference Include="Microsoft.Extensions.Options" Version="8.0.0" />
<PackageReference Include="Polly.Extensions.Http" Version="3.0.0" />
<PackageReference Include="System.Text.Json" Version="8.0.0" />
```

### Global Usings

The project uses global usings for cleaner code:

```csharp
global using System.ComponentModel.DataAnnotations;
global using System.Text.Json;
global using System.Text.Json.Serialization;
global using Azure.Storage.Blobs;
global using FluentValidation;
global using Microsoft.Extensions.DependencyInjection;
global using Microsoft.Extensions.Diagnostics.HealthChecks;
global using Microsoft.Extensions.Logging;
global using Microsoft.Extensions.Options;
global using Polly;
```

### Building the Library

```bash
# Build the library
dotnet build BehavioralHealthSystem.Helpers/

# Run tests (if any)
dotnet test BehavioralHealthSystem.Helpers/

# Pack as NuGet package
dotnet pack BehavioralHealthSystem.Helpers/ -c Release
```

## 🧪 Testing

### Unit Test Recommendations

The library should include comprehensive unit tests for:

#### Model Tests
- ✅ **Property validation** - Ensure all properties work correctly
- ✅ **Serialization** - JSON serialization/deserialization
- ✅ **Data integrity** - Validate model relationships

#### Service Tests
- ✅ **API client logic** - Mock HTTP responses and test service behavior
- ✅ **Error handling** - Test exception scenarios and retry logic
- ✅ **Configuration validation** - Test with various configuration scenarios

#### Validator Tests
- ✅ **Validation rules** - Test all validation scenarios
- ✅ **Error messages** - Verify user-friendly error messages
- ✅ **Edge cases** - Test boundary conditions and null values

### Example Test Structure

```csharp
public class UserMetadataValidatorTests
{
    private readonly UserMetadataValidator _validator = new();

    [Fact]
    public void Age_WithValidValue_ShouldPass()
    {
        // Arrange
        var metadata = new UserMetadata { Age = 25 };
        
        // Act
        var result = _validator.Validate(metadata);
        
        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(150)]
    [InlineData(-1)]
    public void Age_WithInvalidValue_ShouldFail(int invalidAge)
    {
        // Arrange
        var metadata = new UserMetadata { Age = invalidAge };
        
        // Act
        var result = _validator.Validate(metadata);
        
        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UserMetadata.Age));
    }
}
```

## 📚 Usage Examples

### Service Registration

```csharp
// In Program.cs or Startup.cs
public void ConfigureServices(IServiceCollection services, IConfiguration configuration)
{
    // Register configuration options
    services.Configure<KintsugiApiOptions>(
        configuration.GetSection("Kintsugi"));

    // Register HTTP clients with policies
    services.AddHttpClient<IKintsugiApiService, KintsugiApiService>()
        .AddPolicyHandler(RetryPolicies.GetRetryPolicy())
        .AddPolicyHandler(RetryPolicies.GetTimeoutPolicy());

    // Register other services
    services.AddTransient<IFileGroupStorageService, FileGroupStorageService>();
    services.AddTransient<ISessionStorageService, SessionStorageService>();

    // Register validators
    services.AddValidatorsFromAssemblyContaining<UserMetadataValidator>();

    // Add health checks
    services.AddHealthChecks()
        .AddCheck<KintsugiApiHealthCheck>("kintsugi-api");
}
```

### Model Usage

```csharp
// Creating and validating user metadata
var metadata = new UserMetadata
{
    Age = 28,
    Gender = "female",
    Race = "white",
    Ethnicity = "Hispanic, Latino, or Spanish Origin",
    Weight = 140,
    Zipcode = "90210",
    Language = true
};

var validator = new UserMetadataValidator();
var validationResult = await validator.ValidateAsync(metadata);

if (!validationResult.IsValid)
{
    foreach (var error in validationResult.Errors)
    {
        Console.WriteLine($"Validation Error: {error.ErrorMessage}");
    }
}
```

### Service Usage

```csharp
// Using the Kintsugi API service
public class RiskAssessmentService
{
    private readonly IKintsugiApiService _kintsugiService;
    
    public RiskAssessmentService(IKintsugiApiService kintsugiService)
    {
        _kintsugiService = kintsugiService;
    }
    
    public async Task<PredictionResult> AnalyzeRiskAsync(
        string userId, 
        UserMetadata metadata, 
        string audioFileUrl)
    {
        var request = new InitiateRequest
        {
            UserId = userId,
            Metadata = metadata,
            AudioFileUrl = audioFileUrl,
            AudioFileName = "analysis.wav"
        };
        
        var response = await _kintsugiService.InitiateAsync(request);
        
        // Poll for results or return session ID for client polling
        return await _kintsugiService.GetPredictionBySessionAsync(response.SessionId);
    }
}
```

## 🤝 Contributing

### Development Guidelines

1. **Follow naming conventions** - Use PascalCase for public members
2. **Add XML documentation** - Document all public APIs
3. **Include validation** - Add FluentValidation rules for new models
4. **Write unit tests** - Comprehensive test coverage for new functionality
5. **Update configuration** - Add new options to appropriate configuration classes

### Pull Request Requirements

- ✅ **Unit tests** for new models and services
- ✅ **XML documentation** for public APIs
- ✅ **Validation rules** for new request models
- ✅ **Configuration updates** if adding new external dependencies
- ✅ **Health check updates** for new external services

---

This shared library provides the foundation for consistent, reliable, and maintainable code across the Behavioral Health System solution.