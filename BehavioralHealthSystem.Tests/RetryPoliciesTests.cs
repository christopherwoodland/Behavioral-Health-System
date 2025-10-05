namespace BehavioralHealthSystem.Tests;

[TestClass]
public class RetryPoliciesTests
{
    private Mock<ILogger> _mockLogger = null!;

    [TestInitialize]
    public void TestInitialize()
    {
        _mockLogger = new Mock<ILogger>();
    }

    [TestMethod]
    public void GetRetryPolicy_WithoutLogger_ReturnsValidPolicy()
    {
        // Act
        var policy = RetryPolicies.GetRetryPolicy();

        // Assert
        Assert.IsNotNull(policy);
        Assert.IsInstanceOfType(policy, typeof(IAsyncPolicy<HttpResponseMessage>));
    }

    [TestMethod]
    public void GetRetryPolicy_WithLogger_ReturnsValidPolicy()
    {
        // Act
        var policy = RetryPolicies.GetRetryPolicy(_mockLogger.Object);

        // Assert
        Assert.IsNotNull(policy);
        Assert.IsInstanceOfType(policy, typeof(IAsyncPolicy<HttpResponseMessage>));
    }

    [TestMethod]
    public async Task GetRetryPolicy_OnTransientFailure_RetriesWithExponentialBackoff()
    {
        // Arrange
        var policy = RetryPolicies.GetRetryPolicy(_mockLogger.Object);
        var callCount = 0;
        var expectedCalls = 4; // 1 initial + 3 retries

        // Act & Assert
        await Assert.ThrowsExceptionAsync<HttpRequestException>(async () =>
        {
            await policy.ExecuteAsync(async () =>
            {
                callCount++;
                await Task.Delay(1); // Simulate async work
                throw new HttpRequestException("Simulated network error");
            });
        });

        Assert.AreEqual(expectedCalls, callCount);
    }

    [TestMethod]
    public async Task GetRetryPolicy_OnServerError_RetriesAppropriately()
    {
        // Arrange
        var policy = RetryPolicies.GetRetryPolicy(_mockLogger.Object);
        var callCount = 0;
        var expectedCalls = 4; // 1 initial + 3 retries

        // Act & Assert
        await Assert.ThrowsExceptionAsync<InvalidOperationException>(async () =>
        {
            await policy.ExecuteAsync(async () =>
            {
                callCount++;
                await Task.Delay(1);
                
                var response = new HttpResponseMessage(HttpStatusCode.InternalServerError);
                if (callCount < expectedCalls)
                    return response;
                
                throw new InvalidOperationException("Final failure");
            });
        });

        Assert.AreEqual(expectedCalls, callCount);
    }

    [TestMethod]
    public async Task GetRetryPolicy_OnSuccessfulResponse_DoesNotRetry()
    {
        // Arrange
        var policy = RetryPolicies.GetRetryPolicy(_mockLogger.Object);
        var callCount = 0;

        // Act
        var result = await policy.ExecuteAsync(async () =>
        {
            callCount++;
            await Task.Delay(1);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        // Assert
        Assert.AreEqual(1, callCount);
        Assert.IsNotNull(result);
        Assert.AreEqual(HttpStatusCode.OK, result.StatusCode);
    }

    [TestMethod]
    public async Task GetRetryPolicy_OnClientError_DoesNotRetry()
    {
        // Arrange
        var policy = RetryPolicies.GetRetryPolicy(_mockLogger.Object);
        var callCount = 0;

        // Act
        var result = await policy.ExecuteAsync(async () =>
        {
            callCount++;
            await Task.Delay(1);
            return new HttpResponseMessage(HttpStatusCode.BadRequest);
        });

        // Assert
        Assert.AreEqual(1, callCount);
        Assert.IsNotNull(result);
        Assert.AreEqual(HttpStatusCode.BadRequest, result.StatusCode);
    }

    [TestMethod]
    public async Task GetRetryPolicy_LogsRetryAttempts()
    {
        // Arrange
        var policy = RetryPolicies.GetRetryPolicy(_mockLogger.Object);

        // Act
        await Assert.ThrowsExceptionAsync<HttpRequestException>(async () =>
        {
            await policy.ExecuteAsync(async () =>
            {
                await Task.Delay(1);
                throw new HttpRequestException("Test error");
            });
        });

        // Assert - Verify logging was called for retry attempts
        _mockLogger.Verify(
            x => x.Log(
                LogLevel.Warning,
                It.IsAny<EventId>(),
                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("HTTP retry attempt")),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Exactly(3)); // 3 retry attempts
    }

    [TestMethod]
    public void GetTimeoutPolicy_ReturnsValidPolicy()
    {
        // Act
        var policy = RetryPolicies.GetTimeoutPolicy();

        // Assert
        Assert.IsNotNull(policy);
        Assert.IsInstanceOfType(policy, typeof(IAsyncPolicy<HttpResponseMessage>));
    }

    [TestMethod]
    public async Task GetTimeoutPolicy_TimesOutAfterConfiguredDuration()
    {
        // Arrange
        var policy = RetryPolicies.GetTimeoutPolicy();

        // Act & Assert
        await Assert.ThrowsExceptionAsync<Polly.Timeout.TimeoutRejectedException>(async () =>
        {
            await policy.ExecuteAsync(async () =>
            {
                // Simulate a long-running operation (longer than 2 minutes)
                await Task.Delay(TimeSpan.FromMinutes(3));
                return new HttpResponseMessage(HttpStatusCode.OK);
            });
        });
    }

    [TestMethod]
    public async Task GetTimeoutPolicy_CompletesWithinTimeout()
    {
        // Arrange
        var policy = RetryPolicies.GetTimeoutPolicy();

        // Act
        var result = await policy.ExecuteAsync(async () =>
        {
            await Task.Delay(100); // Short delay within timeout
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        // Assert
        Assert.IsNotNull(result);
        Assert.AreEqual(HttpStatusCode.OK, result.StatusCode);
    }

    [TestMethod]
    public async Task CombinedPolicies_RetryAndTimeout_WorkTogether()
    {
        // Arrange
        var retryPolicy = RetryPolicies.GetRetryPolicy(_mockLogger.Object);
        var timeoutPolicy = RetryPolicies.GetTimeoutPolicy();
        var combinedPolicy = Policy.WrapAsync(retryPolicy, timeoutPolicy);

        var callCount = 0;

        // Act
        var result = await combinedPolicy.ExecuteAsync(async () =>
        {
            callCount++;
            await Task.Delay(10); // Short delay
            
            if (callCount < 2)
                throw new HttpRequestException("Transient error");
                
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        // Assert
        Assert.AreEqual(2, callCount);
        Assert.IsNotNull(result);
        Assert.AreEqual(HttpStatusCode.OK, result.StatusCode);
    }
}