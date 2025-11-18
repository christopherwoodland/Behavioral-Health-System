# Behavioral Health System - Test Suite

Comprehensive test suite for Azure Functions backend with 98%+ coverage.

## 🧪 Test Structure

```
BehavioralHealthSystem.Tests/
├── *FunctionTests.cs         # Azure Function endpoint tests
├── *ServiceTests.cs          # Service layer tests
├── *ValidatorTests.cs        # Validation tests
├── *ModelTests.cs           # Data model tests
└── GlobalUsings.cs          # Shared namespaces
```

## 📊 Test Coverage

- **Total Tests:** 232
- **Passing:** 228 (98.3%)
- **Environment-dependent:** 4 (require Azure Storage)

### Coverage by Category

| Category | Tests | Coverage |
|----------|-------|----------|
| Azure Functions | 65 | ✅ Complete |
| Services | 78 | ✅ Complete |
| Validators | 45 | ✅ Complete |
| Models | 44 | ✅ Complete |

## 🏃 Running Tests

### All Tests
```powershell
dotnet test
```

### Specific Test File
```powershell
dotnet test --filter "ClassName~RiskAssessment"
```

### With Coverage
```powershell
dotnet test /p:CollectCoverage=true
```

### Verbose Output
```powershell
dotnet test --verbosity detailed
```

## 🎯 Test Categories

### Function Tests
Tests for HTTP-triggered Azure Functions:
- `HealthCheckFunctionTests.cs` - Health monitoring
- `RiskAssessmentFunctionsTests.cs` - Risk evaluation
- `ExtendedRiskAssessmentFunctionsTests.cs` - Multi-condition assessment
- `SaveChatTranscriptFunctionTests.cs` - Conversation logging
- `BiometricDataFunctionsTests.cs` - Health metrics
- `DSM5AdministrationFunctionsTests.cs` - DSM-5 management
- `SessionStorageFunctionsTests.cs` - Session management

### Service Tests
Tests for business logic services:
- `KintsugiApiServiceSerializationTests.cs` - API integration
- `StructuredLoggingServiceTests.cs` - Logging functionality
- `ExceptionHandlingServiceTests.cs` - Error handling
- `RetryPoliciesTests.cs` - Resilience patterns

### Validation Tests
Tests for FluentValidation validators:
- `InitiateRequestValidatorTests.cs` - Request validation
- `UserMetadataValidatorTests.cs` - User data validation
- `GenderEthnicityValidationTests.cs` - Demographics validation

### Model Tests
Tests for data models and DTOs:
- `InitiateRequestTests.cs` - Request models
- `PredictionResponseTests.cs` - Response models
- `UserMetadataTests.cs` - User models
- `ApiErrorResponseTests.cs` - Error models

## 🔧 Test Configuration

### MSTestSettings.cs
Global test configuration:
- Parallel execution enabled
- 14 worker threads
- Method-level parallelization

### Test Fixtures
Common test setup using:
- `[TestInitialize]` - Setup before each test
- `[TestCleanup]` - Cleanup after each test
- `[ClassInitialize]` - One-time class setup
- `[ClassCleanup]` - One-time class cleanup

## 🛠️ Testing Tools

### Frameworks
- **MSTest** - Test framework
- **Moq** - Mocking library
- **FluentAssertions** - Assertion library
- **xunit** - Alternative test framework support

### Azure Testing
- **Azure.Core.TestFramework** - Azure SDK testing
- **MockHttpClient** - HTTP mocking
- **InMemory Configuration** - Config testing

## ✅ Test Patterns

### Arrange-Act-Assert (AAA)
```csharp
[TestMethod]
public void Test_Example()
{
    // Arrange
    var service = new MyService();
    var input = "test";
    
    // Act
    var result = service.Process(input);
    
    // Assert
    Assert.AreEqual("expected", result);
}
```

### Mocking Dependencies
```csharp
var mockLogger = new Mock<ILogger<MyService>>();
var service = new MyService(mockLogger.Object);
```

### Testing Async Methods
```csharp
[TestMethod]
public async Task Test_AsyncMethod()
{
    var result = await service.ProcessAsync();
    Assert.IsNotNull(result);
}
```

## 🐛 Common Issues

### Environment-Dependent Tests
4 tests require Azure Storage connection string:
- Set `AzureWebJobsStorage` in environment variables
- Or use Azure Storage Emulator locally

### Test Isolation
- Each test should be independent
- Use `[TestCleanup]` to reset state
- Avoid shared mutable state

### Async Testing
- Always `await` async calls in tests
- Use `async Task` return type
- Don't use `async void`

## 📊 Continuous Integration

Tests run automatically on:
- Pull requests to main
- Commits to feature branches
- Scheduled nightly builds

### GitHub Actions Workflow
```yaml
- name: Run Tests
  run: dotnet test --verbosity normal
```

## 📚 Additional Resources

- [Main README](../README.md) - Complete system documentation
- [MSTest Documentation](https://docs.microsoft.com/en-us/dotnet/core/testing/unit-testing-with-mstest)
- [Moq Documentation](https://github.com/moq/moq4)
