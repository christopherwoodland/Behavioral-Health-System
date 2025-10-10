using BehavioralHealthSystem.Services;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for StructuredLoggingService to ensure proper structured logging
/// with consistent patterns and context
/// </summary>
[TestClass]
public class StructuredLoggingServiceTests
{
    private Mock<ILogger<StructuredLoggingService>> _mockLogger = null!;
    private StructuredLoggingService _service = null!;

    [TestInitialize]
    public void Setup()
    {
        _mockLogger = new Mock<ILogger<StructuredLoggingService>>();
        _service = new StructuredLoggingService(_mockLogger.Object);
    }

    #region Constructor Tests

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_WithNullLogger_ThrowsArgumentNullException()
    {
        // Act
        _ = new StructuredLoggingService(null!);
    }

    #endregion

    #region LogRequest Tests

    [TestMethod]
    public void LogRequest_WithBasicParameters_LogsInformation()
    {
        // Arrange
        var operation = "TestOperation";

        // Act
        _service.LogRequest(operation);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Starting operation")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogRequest_WithCorrelationId_IncludesCorrelationInScope()
    {
        // Arrange
        var operation = "TestOperation";
        var correlationId = "corr-123";

        // Act
        _service.LogRequest(operation, correlationId: correlationId);

        // Assert
        _mockLogger.Verify(
            x => x.BeginScope(It.Is<Dictionary<string, object>>(
                d => d.ContainsKey(LogContextKeys.CorrelationId) &&
                     d[LogContextKeys.CorrelationId].ToString() == correlationId)),
            Times.Once);
    }

    [TestMethod]
    public void LogRequest_WithAdditionalContext_IncludesContextData()
    {
        // Arrange
        var operation = "TestOperation";
        var context = new Dictionary<string, object>
        {
            ["CustomKey"] = "CustomValue"
        };

        // Act
        _service.LogRequest(operation, additionalContext: context);

        // Assert
        _mockLogger.Verify(
            x => x.BeginScope(It.Is<Dictionary<string, object>>(
                d => d.ContainsKey("CustomKey") &&
                     d["CustomKey"].ToString() == "CustomValue")),
            Times.Once);
    }

    #endregion

    #region LogResponse Tests

    [TestMethod]
    public void LogResponse_WithFastOperation_LogsInformation()
    {
        // Arrange
        var operation = "TestOperation";
        var elapsedMs = 100L;

        // Act
        _service.LogResponse(operation, elapsedMs);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Completed operation")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogResponse_WithSlowOperation_LogsWarning()
    {
        // Arrange
        var operation = "TestOperation";
        var elapsedMs = 6000L; // > 5000ms threshold

        // Act
        _service.LogResponse(operation, elapsedMs);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Completed operation")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogResponse_WithElapsedTime_IncludesTimingInContext()
    {
        // Arrange
        var operation = "TestOperation";
        var elapsedMs = 250L;

        // Act
        _service.LogResponse(operation, elapsedMs);

        // Assert
        _mockLogger.Verify(
            x => x.BeginScope(It.Is<Dictionary<string, object>>(
                d => d.ContainsKey(LogContextKeys.ElapsedMs) &&
                     (long)d[LogContextKeys.ElapsedMs] == elapsedMs)),
            Times.Once);
    }

    #endregion

    #region LogExternalCall Tests

    [TestMethod]
    public void LogExternalCall_WithSuccessfulCall_LogsInformation()
    {
        // Arrange
        var serviceName = "KintsugiAPI";
        var endpoint = "/api/v1/assess";
        var method = "POST";
        var elapsedMs = 150L;
        var statusCode = 200;

        // Act
        _service.LogExternalCall(serviceName, endpoint, method, elapsedMs, statusCode);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("External call")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogExternalCall_WithErrorStatusCode_LogsWarning()
    {
        // Arrange
        var serviceName = "KintsugiAPI";
        var endpoint = "/api/v1/assess";
        var method = "POST";
        var elapsedMs = 150L;
        var statusCode = 500;

        // Act
        _service.LogExternalCall(serviceName, endpoint, method, elapsedMs, statusCode);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("External call")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogExternalCall_WithAllParameters_IncludesAllContextData()
    {
        // Arrange
        var serviceName = "KintsugiAPI";
        var endpoint = "/api/v1/assess";
        var method = "POST";
        var elapsedMs = 150L;
        var statusCode = 200;
        var correlationId = "corr-123";
        var externalRequestId = "ext-456";

        // Act
        _service.LogExternalCall(
            serviceName,
            endpoint,
            method,
            elapsedMs,
            statusCode,
            correlationId,
            externalRequestId);

        // Assert
        _mockLogger.Verify(
            x => x.BeginScope(It.Is<Dictionary<string, object>>(d =>
                d.ContainsKey(LogContextKeys.ExternalService) &&
                d.ContainsKey(LogContextKeys.ExternalEndpoint) &&
                d.ContainsKey(LogContextKeys.HttpMethod) &&
                d.ContainsKey(LogContextKeys.CorrelationId) &&
                d.ContainsKey(LogContextKeys.ExternalRequestId))),
            Times.Once);
    }

    #endregion

    #region LogBusinessEvent Tests

    [TestMethod]
    public void LogBusinessEvent_WithBasicParameters_LogsInformation()
    {
        // Arrange
        var eventName = "AssessmentCompleted";

        // Act
        _service.LogBusinessEvent(eventName);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Business event")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogBusinessEvent_WithBusinessContext_IncludesContextData()
    {
        // Arrange
        var eventName = "AssessmentCompleted";
        var businessContext = new Dictionary<string, object>
        {
            ["AssessmentType"] = "PHQ-9",
            ["Score"] = 15
        };

        // Act
        _service.LogBusinessEvent(eventName, businessContext: businessContext);

        // Assert
        _mockLogger.Verify(
            x => x.BeginScope(It.Is<Dictionary<string, object>>(d =>
                d.ContainsKey("AssessmentType") &&
                d.ContainsKey("Score"))),
            Times.Once);
    }

    #endregion

    #region LogSecurityEvent Tests

    [TestMethod]
    public void LogSecurityEvent_WithBasicParameters_LogsWarning()
    {
        // Arrange
        var eventName = "UnauthorizedAccess";

        // Act
        _service.LogSecurityEvent(eventName);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Security event")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogSecurityEvent_WithUserInfo_IncludesUserData()
    {
        // Arrange
        var eventName = "UnauthorizedAccess";
        var userId = "user-123";
        var ipAddress = "192.168.1.1";
        var userAgent = "Mozilla/5.0";

        // Act
        _service.LogSecurityEvent(eventName, userId, ipAddress, userAgent);

        // Assert
        _mockLogger.Verify(
            x => x.BeginScope(It.Is<Dictionary<string, object>>(d =>
                d.ContainsKey("IpAddress") &&
                d.ContainsKey("UserAgent"))),
            Times.Once);
    }

    #endregion

    #region LogPerformanceMetrics Tests

    [TestMethod]
    public void LogPerformanceMetrics_WithGoodPerformance_LogsInformation()
    {
        // Arrange
        var operation = "DataProcessing";
        var elapsedMs = 100L;
        var memoryUsageBytes = 1024L * 1024L; // 1 MB

        // Act
        _service.LogPerformanceMetrics(operation, elapsedMs, memoryUsageBytes);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Performance metrics")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogPerformanceMetrics_WithSlowPerformance_LogsWarning()
    {
        // Arrange
        var operation = "DataProcessing";
        var elapsedMs = 6000L; // > 5000ms
        var memoryUsageBytes = 1024L * 1024L;

        // Act
        _service.LogPerformanceMetrics(operation, elapsedMs, memoryUsageBytes);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Performance metrics")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    #endregion

    #region LogValidationError Tests

    [TestMethod]
    public void LogValidationError_WithMessage_LogsWarning()
    {
        // Arrange
        var operation = "CreateUser";
        var validationMessage = "Email is required";

        // Act
        _service.LogValidationError(operation, validationMessage);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Validation failed")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogValidationError_WithErrors_IncludesErrorDetails()
    {
        // Arrange
        var operation = "CreateUser";
        var validationMessage = "Validation failed";
        var validationErrors = new Dictionary<string, object>
        {
            ["Email"] = "Required",
            ["Age"] = "Must be 18+"
        };

        // Act
        _service.LogValidationError(operation, validationMessage, validationErrors);

        // Assert
        _mockLogger.Verify(
            x => x.BeginScope(It.Is<Dictionary<string, object>>(d =>
                d.ContainsKey("ValidationError.Email") &&
                d.ContainsKey("ValidationError.Age"))),
            Times.Once);
    }

    #endregion

    #region LogConfigurationIssue Tests

    [TestMethod]
    public void LogConfigurationIssue_WithDefaultSeverity_LogsWarning()
    {
        // Arrange
        var configurationKey = "ApiKey";
        var issue = "Missing configuration value";

        // Act
        _service.LogConfigurationIssue(configurationKey, issue);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Configuration issue")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogConfigurationIssue_WithCustomSeverity_LogsAtSpecifiedLevel()
    {
        // Arrange
        var configurationKey = "ApiKey";
        var issue = "Missing configuration value";
        var severity = LogLevel.Error;

        // Act
        _service.LogConfigurationIssue(configurationKey, issue, severity);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Configuration issue")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    #endregion

    #region LogHealthCheck Tests

    [TestMethod]
    public void LogHealthCheck_WithHealthyCheck_LogsInformation()
    {
        // Arrange
        var healthCheckName = "Database";
        var isHealthy = true;
        var responseTimeMs = 50L;

        // Act
        _service.LogHealthCheck(healthCheckName, isHealthy, responseTimeMs);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Healthy")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogHealthCheck_WithUnhealthyCheck_LogsError()
    {
        // Arrange
        var healthCheckName = "Database";
        var isHealthy = false;
        var responseTimeMs = 5000L;

        // Act
        _service.LogHealthCheck(healthCheckName, isHealthy, responseTimeMs);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Unhealthy")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogHealthCheck_WithDetails_LogsDetails()
    {
        // Arrange
        var healthCheckName = "Database";
        var isHealthy = false;
        var responseTimeMs = 5000L;
        var details = "Connection timeout after 5 seconds";

        // Act
        _service.LogHealthCheck(healthCheckName, isHealthy, responseTimeMs, details);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Health check details")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    #endregion
}
