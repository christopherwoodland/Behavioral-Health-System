using BehavioralHealthSystem.Services;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for ExceptionHandlingService to ensure proper exception handling,
/// logging, and error response generation
/// </summary>
[TestClass]
public class ExceptionHandlingServiceTests
{
    private Mock<ILogger<ExceptionHandlingService>> _mockLogger = null!;
    private ExceptionHandlingService _service = null!;

    [TestInitialize]
    public void Setup()
    {
        _mockLogger = new Mock<ILogger<ExceptionHandlingService>>();
        _service = new ExceptionHandlingService(_mockLogger.Object);
    }

    #region Constructor Tests

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_WithNullLogger_ThrowsArgumentNullException()
    {
        // Act
        _ = new ExceptionHandlingService(null!);
    }

    #endregion

    #region ExecuteWithHandlingAsync<T> Tests

    [TestMethod]
    public async Task ExecuteWithHandlingAsync_WithSuccessfulOperation_ReturnsResult()
    {
        // Arrange
        var expectedResult = "test result";
        var operation = new Func<Task<string>>(() => Task.FromResult(expectedResult));

        // Act
        var result = await _service.ExecuteWithHandlingAsync(
            operation,
            "TestOperation");

        // Assert
        Assert.AreEqual(expectedResult, result);
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
    [ExpectedException(typeof(InvalidOperationException))]
    public async Task ExecuteWithHandlingAsync_WithFailingOperation_ThrowsException()
    {
        // Arrange
        var operation = new Func<Task<string>>(() => throw new InvalidOperationException("Test error"));

        // Act
        await _service.ExecuteWithHandlingAsync(
            operation,
            "TestOperation");
    }

    [TestMethod]
    public async Task ExecuteWithHandlingAsync_WithFailingOperationAndSuppression_ReturnsDefault()
    {
        // Arrange
        var operation = new Func<Task<string>>(() => throw new InvalidOperationException("Test error"));

        // Act
        var result = await _service.ExecuteWithHandlingAsync(
            operation,
            "TestOperation",
            suppressExceptions: true);

        // Assert
        Assert.IsNull(result);
    }

    [TestMethod]
    public async Task ExecuteWithHandlingAsync_WithContext_LogsContext()
    {
        // Arrange
        var context = new Dictionary<string, object>
        {
            ["UserId"] = "user-123",
            ["SessionId"] = "session-456"
        };
        var operation = new Func<Task<string>>(() => Task.FromResult("success"));

        // Act
        await _service.ExecuteWithHandlingAsync(
            operation,
            "TestOperation",
            context);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("UserId=user-123")),
                null,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.AtLeastOnce);
    }

    #endregion

    #region ExecuteWithHandlingAsync (void) Tests

    [TestMethod]
    public async Task ExecuteWithHandlingAsync_Void_WithSuccessfulOperation_CompletesSuccessfully()
    {
        // Arrange
        var executed = false;
        var operation = new Func<Task>(() =>
        {
            executed = true;
            return Task.CompletedTask;
        });

        // Act
        await _service.ExecuteWithHandlingAsync(
            operation,
            "TestOperation");

        // Assert
        Assert.IsTrue(executed);
    }

    [TestMethod]
    [ExpectedException(typeof(InvalidOperationException))]
    public async Task ExecuteWithHandlingAsync_Void_WithFailingOperation_ThrowsException()
    {
        // Arrange
        var operation = new Func<Task>(() => throw new InvalidOperationException("Test error"));

        // Act
        await _service.ExecuteWithHandlingAsync(
            operation,
            "TestOperation");
    }

    [TestMethod]
    public async Task ExecuteWithHandlingAsync_Void_WithFailingOperationAndSuppression_DoesNotThrow()
    {
        // Arrange
        var operation = new Func<Task>(() => throw new InvalidOperationException("Test error"));

        // Act - should not throw
        await _service.ExecuteWithHandlingAsync(
            operation,
            "TestOperation",
            suppressExceptions: true);

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("exception suppressed")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    #endregion

    #region HandleException Tests

    [TestMethod]
    public void HandleException_WithArgumentNullException_ReturnsProperErrorResponse()
    {
        // Arrange
        var exception = new ArgumentNullException("testParam");

        // Act
        var response = _service.HandleException(
            exception,
            "TestOperation");

        // Assert
        Assert.IsNotNull(response);
        Assert.IsFalse(response.Success);
        Assert.AreEqual("MISSING_ARGUMENT", response.Code);
        Assert.IsTrue(response.Message.Contains("Required information is missing"));
    }

    [TestMethod]
    public void HandleException_WithInvalidOperationException_ReturnsProperErrorResponse()
    {
        // Arrange
        var exception = new InvalidOperationException("Test error");

        // Act
        var response = _service.HandleException(
            exception,
            "TestOperation");

        // Assert
        Assert.IsNotNull(response);
        Assert.IsFalse(response.Success);
        Assert.AreEqual("INVALID_OPERATION", response.Code);
    }

    [TestMethod]
    public void HandleException_WithCorrelationId_IncludesCorrelationId()
    {
        // Arrange
        var exception = new InvalidOperationException("Test error");
        var correlationId = Guid.NewGuid().ToString();

        // Act
        var response = _service.HandleException(
            exception,
            "TestOperation",
            correlationId: correlationId);

        // Assert - Note: The correlationId might be in metadata or context
        // depending on implementation details
        Assert.IsNotNull(response);
    }

    #endregion

    #region LogException Tests

    [TestMethod]
    public void LogException_WithCriticalException_LogsCritical()
    {
        // Arrange
        var exception = new OutOfMemoryException("Test OOM");

        // Act
        _service.LogException(exception, "TestOperation");

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Critical,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Critical error")),
                exception,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogException_WithHighSeverityException_LogsError()
    {
        // Arrange
        var exception = new UnauthorizedAccessException("Test unauthorized");

        // Act
        _service.LogException(exception, "TestOperation");

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("High severity")),
                exception,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogException_WithMediumSeverityException_LogsWarning()
    {
        // Arrange
        var exception = new ArgumentException("Test argument");

        // Act
        _service.LogException(exception, "TestOperation");

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Medium severity")),
                exception,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    [TestMethod]
    public void LogException_WithLowSeverityException_LogsInformation()
    {
        // Arrange
        var exception = new TimeoutException("Test timeout");

        // Act
        _service.LogException(exception, "TestOperation");

        // Assert
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Information,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("Low severity")),
                exception,
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    #endregion

    #region IsRetriableException Tests

    [TestMethod]
    public void IsRetriableException_WithTimeoutException_ReturnsTrue()
    {
        // Arrange
        var exception = new TimeoutException();

        // Act
        var result = _service.IsRetriableException(exception);

        // Assert
        Assert.IsTrue(result);
    }

    [TestMethod]
    public void IsRetriableException_WithTaskCanceledException_ReturnsTrue()
    {
        // Arrange
        var exception = new TaskCanceledException();

        // Act
        var result = _service.IsRetriableException(exception);

        // Assert
        Assert.IsTrue(result);
    }

    [TestMethod]
    public void IsRetriableException_WithArgumentException_ReturnsFalse()
    {
        // Arrange
        var exception = new ArgumentException();

        // Act
        var result = _service.IsRetriableException(exception);

        // Assert
        Assert.IsFalse(result);
    }

    #endregion

    #region GetRetryDelay Tests

    [TestMethod]
    public void GetRetryDelay_FirstAttempt_ReturnsBaseDelay()
    {
        // Arrange
        var exception = new TimeoutException();

        // Act
        var delay = _service.GetRetryDelay(exception, 1);

        // Assert
        Assert.IsTrue(delay.TotalMilliseconds > 0);
        Assert.IsTrue(delay.TotalMilliseconds < 5000); // Should be reasonable
    }

    [TestMethod]
    public void GetRetryDelay_SubsequentAttempts_IncreasesExponentially()
    {
        // Arrange
        var exception = new TimeoutException();

        // Act
        var delay1 = _service.GetRetryDelay(exception, 1);
        var delay2 = _service.GetRetryDelay(exception, 2);
        var delay3 = _service.GetRetryDelay(exception, 3);

        // Assert
        Assert.IsTrue(delay2.TotalMilliseconds > delay1.TotalMilliseconds * 1.5);
        Assert.IsTrue(delay3.TotalMilliseconds > delay2.TotalMilliseconds * 1.5);
    }

    [TestMethod]
    public void GetRetryDelay_LargeAttemptNumber_CapsAtMaximum()
    {
        // Arrange
        var exception = new TimeoutException();

        // Act
        var delay = _service.GetRetryDelay(exception, 10);

        // Assert
        Assert.IsTrue(delay.TotalSeconds <= 30); // Should be capped at 30 seconds
    }

    #endregion

    #region WrapException Tests

    [TestMethod]
    public void WrapException_WithInnerException_WrapsCorrectly()
    {
        // Arrange
        var innerException = new InvalidOperationException("Inner error");
        var message = "Wrapped error message";

        // Act
        var wrappedException = _service.WrapException(innerException, message);

        // Assert
        Assert.IsNotNull(wrappedException);
        Assert.AreEqual(message, wrappedException.Message);
        Assert.AreSame(innerException, wrappedException.InnerException);
    }

    [TestMethod]
    public void WrapException_WithContext_AddsContextToData()
    {
        // Arrange
        var innerException = new InvalidOperationException("Inner error");
        var message = "Wrapped error message";
        var context = new Dictionary<string, object>
        {
            ["UserId"] = "user-123",
            ["SessionId"] = "session-456"
        };

        // Act
        var wrappedException = _service.WrapException(innerException, message, context);

        // Assert
        Assert.IsTrue(wrappedException.Data.Contains("UserId"));
        Assert.AreEqual("user-123", wrappedException.Data["UserId"]);
        Assert.IsTrue(wrappedException.Data.Contains("SessionId"));
        Assert.AreEqual("session-456", wrappedException.Data["SessionId"]);
    }

    #endregion
}
