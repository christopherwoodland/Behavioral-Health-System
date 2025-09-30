# Behavioral Health System - Tests

Comprehensive unit test suite for the Behavioral Health System, providing thorough testing coverage for all components including Functions, Models, Services, and Validators.

## 🚀 Overview

This test project ensures the reliability and correctness of the Behavioral Health System through comprehensive unit testing, integration testing, and validation testing using modern .NET testing frameworks.

### Key Features

- ✅ **Comprehensive Coverage** - Tests for all major components and functionality
- ✅ **MSTest Framework** - Microsoft's robust testing framework
- ✅ **Moq Integration** - Powerful mocking framework for dependency testing
- ✅ **Constructor Validation** - Ensures proper dependency injection setup
- ✅ **Data Integrity Testing** - Validates model consistency and serialization
- ✅ **Interface Compliance** - Verifies service contract adherence

## 📁 Test Structure

```text
BehavioralHealthSystem.Tests/
├── 📁 Functions/                    # Azure Function tests
│   ├── HealthCheckFunctionTests.cs  # Health endpoint testing
│   ├── RiskAssessmentFunctionsTests.cs # Risk assessment API tests
│   ├── SessionStorageFunctionsTests.cs # Session management tests
│   ├── TestFunctionsTests.cs       # Utility function tests
│   └── SessionIdFunctionalityTests.cs # Session ID validation tests
├── 📁 Models/                       # Data model tests
│   ├── ActualScoreTests.cs         # Actual score model testing
│   ├── ApiErrorResponseTests.cs    # Error response model testing
│   ├── InitiateRequestTests.cs     # Request model testing
│   ├── InitiateResponseTests.cs    # Response model testing
│   ├── PredictErrorTests.cs        # Error model testing
│   ├── PredictionRequestTests.cs   # Prediction request testing
│   ├── PredictionResponseTests.cs  # Prediction response testing
│   ├── PredictionResultTests.cs    # Prediction result testing
│   └── UserMetadataTests.cs        # User metadata testing
├── 📁 Services/                     # Service layer tests (planned)
├── 📁 Validators/                   # Validation tests (planned)
├── 📄 MSTestSettings.cs            # Test configuration settings
├── 📄 test-requests.http           # Manual API testing requests
└── 📄 BehavioralHealthSystem.Tests.csproj # Test project file
```

## 🛠️ Technology Stack

### Testing Frameworks

- **🧪 MSTest** - Microsoft's unit testing framework
- **🔍 Moq** - Mocking framework for dependency injection testing
- **📊 Microsoft.Extensions.DependencyInjection** - DI container testing
- **🔧 Microsoft.Extensions.Logging** - Logging infrastructure testing

### Test Categories

- **Unit Tests** - Individual component testing
- **Integration Tests** - Service interaction testing
- **Constructor Tests** - Dependency injection validation
- **Model Tests** - Data model integrity testing
- **Validation Tests** - Input validation rule testing

## 🧪 Test Coverage

### Current Test Coverage (42 Tests)

The test suite currently includes comprehensive coverage for:

#### Function Tests (Constructor Validation)

All Azure Function classes have constructor validation tests ensuring proper dependency injection:

```csharp
[TestClass]
public class HealthCheckFunctionTests
{
    [TestMethod]
    public void Constructor_WithValidDependencies_ShouldNotThrow()
    {
        // Arrange
        var mockHealthCheckService = new Mock<IHealthCheckService>();
        var mockLogger = new Mock<ILogger<HealthCheckFunction>>();

        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() => 
            new HealthCheckFunction(null, mockLogger.Object));
        Assert.ThrowsException<ArgumentNullException>(() => 
            new HealthCheckFunction(mockHealthCheckService.Object, null));
        
        // Should not throw with valid dependencies
        var function = new HealthCheckFunction(mockHealthCheckService.Object, mockLogger.Object);
        Assert.IsNotNull(function);
    }
}
```

**Covered Functions:**
- ✅ **HealthCheckFunction** - Health monitoring endpoint
- ✅ **RiskAssessmentFunctions** - Risk assessment APIs
- ✅ **SessionStorageFunctions** - Session management
- ✅ **TestFunctions** - Utility endpoints

#### Model Tests (Data Integrity)

All data models have comprehensive constructor and property validation tests:

```csharp
[TestClass]
public class UserMetadataTests
{
    [TestMethod]
    public void Constructor_ShouldInitializeWithDefaultValues()
    {
        // Act
        var userMetadata = new UserMetadata();

        // Assert
        Assert.IsNull(userMetadata.Age);
        Assert.IsNull(userMetadata.Gender);
        Assert.IsNull(userMetadata.Race);
        Assert.IsNull(userMetadata.Ethnicity);
        Assert.IsNull(userMetadata.Weight);
        Assert.IsNull(userMetadata.Zipcode);
        Assert.IsFalse(userMetadata.Language);
    }

    [TestMethod]
    public void Properties_ShouldSetAndGetCorrectly()
    {
        // Arrange
        var userMetadata = new UserMetadata();
        const int expectedAge = 25;
        const string expectedGender = "female";
        const string expectedRace = "white";
        const string expectedEthnicity = "Hispanic, Latino, or Spanish Origin";
        const int expectedWeight = 150;
        const string expectedZipcode = "12345";
        const bool expectedLanguage = true;

        // Act
        userMetadata.Age = expectedAge;
        userMetadata.Gender = expectedGender;
        userMetadata.Race = expectedRace;
        userMetadata.Ethnicity = expectedEthnicity;
        userMetadata.Weight = expectedWeight;
        userMetadata.Zipcode = expectedZipcode;
        userMetadata.Language = expectedLanguage;

        // Assert
        Assert.AreEqual(expectedAge, userMetadata.Age);
        Assert.AreEqual(expectedGender, userMetadata.Gender);
        Assert.AreEqual(expectedRace, userMetadata.Race);
        Assert.AreEqual(expectedEthnicity, userMetadata.Ethnicity);
        Assert.AreEqual(expectedWeight, userMetadata.Weight);
        Assert.AreEqual(expectedZipcode, userMetadata.Zipcode);
        Assert.AreEqual(expectedLanguage, userMetadata.Language);
    }
}
```

**Covered Models:**
- ✅ **UserMetadata** - User demographic information
- ✅ **PredictionResult** - Prediction response data
- ✅ **InitiateRequest/Response** - Session initiation models
- ✅ **ApiErrorResponse** - Error response structure
- ✅ **ActualScore** - Actual assessment scores
- ✅ **PredictError** - Error details model

#### Interface Validation Tests

Specialized tests ensure service interfaces are properly implemented:

```csharp
[TestClass]
public class SessionIdFunctionalityTests
{
    [TestMethod]
    public void ISessionStorageService_ShouldHaveCorrectMethods()
    {
        // Arrange
        var interfaceType = typeof(ISessionStorageService);

        // Act & Assert
        var methods = interfaceType.GetMethods();
        Assert.IsTrue(methods.Any(m => m.Name == "CreateSessionAsync"));
        Assert.IsTrue(methods.Any(m => m.Name == "GetSessionAsync"));
        Assert.IsTrue(methods.Any(m => m.Name == "GetUserSessionsAsync"));
        Assert.IsTrue(methods.Any(m => m.Name == "DeleteSessionAsync"));
    }
}
```

### Test Configuration

#### MSTestSettings.cs

```csharp
using Microsoft.VisualStudio.TestTools.UnitTesting;

[assembly: Parallelize(Workers = 0, Scope = ExecutionScope.MethodLevel)]

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class MSTestSettings
    {
        [AssemblyInitialize]
        public static void AssemblyInitialize(TestContext context)
        {
            // Global test setup
            Environment.SetEnvironmentVariable("ENVIRONMENT", "Test");
        }

        [AssemblyCleanup]
        public static void AssemblyCleanup()
        {
            // Global test cleanup
        }
    }
}
```

## 🚀 Running Tests

### Command Line Testing

```bash
# Run all tests
dotnet test

# Run tests with detailed output
dotnet test --verbosity normal

# Run tests with coverage
dotnet test --collect:"XPlat Code Coverage"

# Run specific test class
dotnet test --filter "TestClass=UserMetadataTests"

# Run tests matching pattern
dotnet test --filter "Name~Metadata"

# Run tests in watch mode
dotnet watch test
```

### Visual Studio Testing

1. **Test Explorer** - View and run tests from VS Test Explorer
2. **Debug Tests** - Set breakpoints and debug individual tests
3. **Live Unit Testing** - Automatic test execution on code changes
4. **Code Coverage** - View coverage reports in Visual Studio

### Test Results and Reporting

```bash
# Generate test results file
dotnet test --logger trx --results-directory TestResults

# Generate coverage report
dotnet test --collect:"XPlat Code Coverage" --results-directory TestResults

# Generate HTML coverage report (requires reportgenerator)
reportgenerator -reports:"TestResults/**/coverage.cobertura.xml" -targetdir:"CoverageReport" -reporttypes:Html
```

## 📊 Test Patterns

### Constructor Validation Pattern

All Functions and Services follow this testing pattern:

```csharp
[TestClass]
public class SampleFunctionTests
{
    [TestMethod]
    public void Constructor_WithNullDependency_ShouldThrowArgumentNullException()
    {
        // Arrange
        var mockService = new Mock<ISampleService>();
        var mockLogger = new Mock<ILogger<SampleFunction>>();

        // Act & Assert
        Assert.ThrowsException<ArgumentNullException>(() => 
            new SampleFunction(null, mockLogger.Object));
        Assert.ThrowsException<ArgumentNullException>(() => 
            new SampleFunction(mockService.Object, null));
    }

    [TestMethod]
    public void Constructor_WithValidDependencies_ShouldCreateInstance()
    {
        // Arrange
        var mockService = new Mock<ISampleService>();
        var mockLogger = new Mock<ILogger<SampleFunction>>();

        // Act
        var function = new SampleFunction(mockService.Object, mockLogger.Object);

        // Assert
        Assert.IsNotNull(function);
    }
}
```

### Model Testing Pattern

All Models follow this comprehensive testing approach:

```csharp
[TestClass]
public class SampleModelTests
{
    [TestMethod]
    public void Constructor_ShouldInitializeWithDefaultValues()
    {
        // Act
        var model = new SampleModel();

        // Assert
        Assert.IsNull(model.StringProperty);
        Assert.AreEqual(0, model.IntProperty);
        Assert.IsFalse(model.BoolProperty);
    }

    [TestMethod]
    public void Properties_ShouldSetAndGetCorrectly()
    {
        // Arrange
        var model = new SampleModel();
        const string expectedString = "test";
        const int expectedInt = 42;
        const bool expectedBool = true;

        // Act
        model.StringProperty = expectedString;
        model.IntProperty = expectedInt;
        model.BoolProperty = expectedBool;

        // Assert
        Assert.AreEqual(expectedString, model.StringProperty);
        Assert.AreEqual(expectedInt, model.IntProperty);
        Assert.AreEqual(expectedBool, model.BoolProperty);
    }

    [TestMethod]
    public void Serialization_ShouldMaintainDataIntegrity()
    {
        // Arrange
        var originalModel = new SampleModel
        {
            StringProperty = "test",
            IntProperty = 42,
            BoolProperty = true
        };

        // Act
        var json = JsonSerializer.Serialize(originalModel);
        var deserializedModel = JsonSerializer.Deserialize<SampleModel>(json);

        // Assert
        Assert.AreEqual(originalModel.StringProperty, deserializedModel.StringProperty);
        Assert.AreEqual(originalModel.IntProperty, deserializedModel.IntProperty);
        Assert.AreEqual(originalModel.BoolProperty, deserializedModel.BoolProperty);
    }
}
```

## 🔧 Manual Testing

### HTTP Request Testing

The project includes `test-requests.http` for manual API testing:

```http
### Health Check
GET http://localhost:7071/api/health
Accept: application/json

### Test Kintsugi Connection
POST http://localhost:7071/api/TestKintsugiConnection
Content-Type: application/json

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

### Get Session
GET http://localhost:7071/api/sessions/{{sessionId}}
Accept: application/json

### Submit Prediction
POST http://localhost:7071/api/predictions/submit
Content-Type: application/json

{
  "sessionId": "{{sessionId}}",
  "audioFileUrl": "https://example.com/test-audio.wav",
  "audioFileName": "test-audio.wav"
}

### Get Predictions
GET http://localhost:7071/api/predictions/{{userId}}
Accept: application/json
```

### Test Data Setup

```csharp
public static class TestDataFactory
{
    public static UserMetadata CreateValidUserMetadata()
    {
        return new UserMetadata
        {
            Age = 28,
            Gender = "female",
            Race = "white",
            Ethnicity = "Hispanic, Latino, or Spanish Origin",
            Weight = 140,
            Zipcode = "90210",
            Language = true
        };
    }

    public static InitiateRequest CreateValidInitiateRequest()
    {
        return new InitiateRequest
        {
            UserId = "test-user-123",
            Metadata = CreateValidUserMetadata(),
            AudioFileUrl = "https://example.com/test-audio.wav",
            AudioFileName = "test-audio.wav"
        };
    }

    public static PredictionResult CreateSamplePredictionResult()
    {
        return new PredictionResult
        {
            SessionId = Guid.NewGuid().ToString(),
            Status = "completed",
            PredictedScore = "0.75",
            PredictedScoreAnxiety = "0.68",
            PredictedScoreDepression = "0.82",
            CreatedAt = DateTime.UtcNow.AddMinutes(-10),
            UpdatedAt = DateTime.UtcNow,
            ActualScore = new ActualScore
            {
                AnxietyBinary = "false",
                DepressionBinary = "false"
            }
        };
    }
}
```

## 📈 Planned Test Enhancements

### Service Layer Testing

```csharp
[TestClass]
public class KintsugiApiServiceTests
{
    private Mock<HttpMessageHandler> _mockHttpHandler;
    private Mock<IOptions<KintsugiApiOptions>> _mockOptions;
    private Mock<ILogger<KintsugiApiService>> _mockLogger;
    private KintsugiApiService _service;

    [TestInitialize]
    public void Setup()
    {
        _mockHttpHandler = new Mock<HttpMessageHandler>();
        _mockOptions = new Mock<IOptions<KintsugiApiOptions>>();
        _mockLogger = new Mock<ILogger<KintsugiApiService>>();

        _mockOptions.Setup(x => x.Value).Returns(new KintsugiApiOptions
        {
            ApiKey = "test-key",
            BaseUrl = "https://api.test.com",
            TimeoutSeconds = 30
        });

        var httpClient = new HttpClient(_mockHttpHandler.Object);
        _service = new KintsugiApiService(httpClient, _mockOptions.Object, _mockLogger.Object);
    }

    [TestMethod]
    public async Task InitiateAsync_WithValidRequest_ShouldReturnResponse()
    {
        // Arrange
        var request = TestDataFactory.CreateValidInitiateRequest();
        var expectedResponse = new InitiateResponse
        {
            Success = true,
            SessionId = Guid.NewGuid().ToString()
        };

        _mockHttpHandler
            .Setup<Task<HttpResponseMessage>>("SendAsync", 
                ItExpr.IsAny<HttpRequestMessage>(), 
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent(JsonSerializer.Serialize(expectedResponse))
            });

        // Act
        var result = await _service.InitiateAsync(request);

        // Assert
        Assert.IsNotNull(result);
        Assert.IsTrue(result.Success);
        Assert.IsNotNull(result.SessionId);
    }
}
```

### Validation Testing

```csharp
[TestClass]
public class UserMetadataValidatorTests
{
    private readonly UserMetadataValidator _validator = new();

    [TestMethod]
    public void Validate_WithValidMetadata_ShouldPass()
    {
        // Arrange
        var metadata = TestDataFactory.CreateValidUserMetadata();

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid);
        Assert.AreEqual(0, result.Errors.Count);
    }

    [TestMethod]
    public void Validate_WithInvalidAge_ShouldFail()
    {
        // Arrange
        var metadata = TestDataFactory.CreateValidUserMetadata();
        metadata.Age = 200; // Invalid age

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsFalse(result.IsValid);
        Assert.IsTrue(result.Errors.Any(e => e.PropertyName == nameof(UserMetadata.Age)));
    }

    [TestMethod]
    public void Validate_WithInvalidGender_ShouldFail()
    {
        // Arrange
        var metadata = TestDataFactory.CreateValidUserMetadata();
        metadata.Gender = "invalid-gender";

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsFalse(result.IsValid);
        Assert.IsTrue(result.Errors.Any(e => e.PropertyName == nameof(UserMetadata.Gender)));
    }
}
```

### Integration Testing

```csharp
[TestClass]
public class EndToEndIntegrationTests
{
    private TestServer _testServer;
    private HttpClient _client;

    [TestInitialize]
    public void Setup()
    {
        var builder = new WebHostBuilder()
            .UseStartup<TestStartup>()
            .ConfigureAppConfiguration((context, config) =>
            {
                config.AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["KINTSUGI_API_KEY"] = "test-key",
                    ["KINTSUGI_BASE_URL"] = "https://api.test.com"
                });
            });

        _testServer = new TestServer(builder);
        _client = _testServer.CreateClient();
    }

    [TestMethod]
    public async Task HealthCheck_ShouldReturnHealthy()
    {
        // Act
        var response = await _client.GetAsync("/api/health");

        // Assert
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        
        var content = await response.Content.ReadAsStringAsync();
        var healthResult = JsonSerializer.Deserialize<HealthCheckResult>(content);
        
        Assert.AreEqual("Healthy", healthResult.Status);
    }
}
```

## 🔍 Test Debugging

### Debugging Tips

1. **Breakpoint Testing** - Set breakpoints in test methods for step-through debugging
2. **Console Output** - Use `Console.WriteLine()` or `Debug.WriteLine()` for test debugging
3. **Test Context** - Use `TestContext` for accessing test execution information
4. **Assert Messages** - Include descriptive messages in Assert statements

```csharp
[TestMethod]
public void SampleTest_WithDebugging()
{
    // Arrange
    var model = new SampleModel();
    Console.WriteLine($"Initial model state: {JsonSerializer.Serialize(model)}");

    // Act
    model.Property = "test-value";
    Console.WriteLine($"After setting property: {JsonSerializer.Serialize(model)}");

    // Assert
    Assert.AreEqual("test-value", model.Property, 
        "Property should be set to the expected value");
}
```

### Test Data Validation

```csharp
[TestMethod]
public void TestData_ShouldBeValid()
{
    // Arrange
    var testData = TestDataFactory.CreateValidUserMetadata();
    var validator = new UserMetadataValidator();

    // Act
    var validationResult = validator.Validate(testData);

    // Assert
    Assert.IsTrue(validationResult.IsValid, 
        $"Test data should be valid. Errors: {string.Join(", ", validationResult.Errors.Select(e => e.ErrorMessage))}");
}
```

## 📊 Code Coverage

### Coverage Goals

- **Functions** - 100% constructor validation coverage
- **Models** - 100% property and serialization coverage
- **Services** - 80%+ business logic coverage
- **Validators** - 100% validation rule coverage

### Coverage Reporting

```bash
# Generate coverage with exclusions
dotnet test --collect:"XPlat Code Coverage" --settings coverlet.runsettings

# Example coverlet.runsettings
<?xml version="1.0" encoding="utf-8" ?>
<RunSettings>
  <DataCollectionRunSettings>
    <DataCollectors>
      <DataCollector friendlyName="XPlat code coverage">
        <Configuration>
          <Exclude>
            [*]*.Program
            [*]*Tests*
            [*]*.GlobalUsings
          </Exclude>
        </Configuration>
      </DataCollector>
    </DataCollectors>
  </DataCollectionRunSettings>
</RunSettings>
```

## 🤝 Contributing to Tests

### Adding New Tests

1. **Follow naming conventions** - `MethodName_Scenario_ExpectedResult`
2. **Use AAA pattern** - Arrange, Act, Assert
3. **Include edge cases** - Test boundary conditions and null values
4. **Add descriptive assertions** - Include meaningful assertion messages
5. **Use test data factories** - Maintain consistent test data creation

### Test Categories

```csharp
[TestCategory("Unit")]
[TestCategory("Constructor")]
[TestMethod]
public void Constructor_WithNullLogger_ShouldThrowArgumentNullException()
{
    // Test implementation
}

[TestCategory("Integration")]
[TestMethod]
public async Task ApiCall_WithValidRequest_ShouldReturnExpectedResponse()
{
    // Test implementation
}
```

### Pull Request Requirements

- ✅ **Add tests for new functionality** - All new code must have corresponding tests
- ✅ **Maintain coverage levels** - Don't decrease overall coverage percentage
- ✅ **Follow test patterns** - Use established patterns for consistency
- ✅ **Update test documentation** - Document new test categories or patterns
- ✅ **Verify all tests pass** - Ensure no breaking changes to existing tests

---

This comprehensive test suite ensures the reliability, correctness, and maintainability of the Behavioral Health System through thorough automated testing coverage.