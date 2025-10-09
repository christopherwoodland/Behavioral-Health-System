namespace BehavioralHealthSystem.Configuration;

/// <summary>
/// Provides Polly-based retry and timeout policies for resilient HTTP communications.
/// Implements exponential backoff and handles transient errors (5XX, 408, network failures).
/// </summary>
public static class RetryPolicies
{
    /// <summary>
    /// Default number of retry attempts before failing.
    /// </summary>
    private const int DefaultRetryCount = 3;

    /// <summary>
    /// Base for exponential backoff calculation (2^retryAttempt).
    /// </summary>
    private const int ExponentialBackoffBase = 2;

    /// <summary>
    /// Minimum HTTP status code considered a server error (500+).
    /// </summary>
    private const int ServerErrorStatusCode = 500;

    /// <summary>
    /// Maximum time in minutes before a request times out.
    /// </summary>
    private const int TimeoutMinutes = 2;

    /// <summary>
    /// Creates a retry policy with exponential backoff for handling transient HTTP errors.
    /// Retries on: HttpRequestException, 5XX status codes, 408 (Request Timeout), and other server errors (500+).
    /// Uses exponential backoff: 2^1=2s, 2^2=4s, 2^3=8s for retry attempts.
    /// </summary>
    /// <param name="logger">Optional logger for recording retry attempts and reasons.</param>
    /// <returns>An async policy that retries failed HTTP requests with exponential backoff.</returns>
    /// <remarks>
    /// Example usage:
    /// <code>
    /// var policy = RetryPolicies.GetRetryPolicy(logger);
    /// var response = await policy.ExecuteAsync(() => httpClient.GetAsync(url));
    /// </code>
    /// </remarks>
    public static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy(ILogger? logger = null)
    {
        return HttpPolicyExtensions
            .HandleTransientHttpError() // Handles HttpRequestException and 5XX, 408 status codes
            .OrResult(msg => !msg.IsSuccessStatusCode && (int)msg.StatusCode >= ServerErrorStatusCode)
            .WaitAndRetryAsync(
                retryCount: DefaultRetryCount,
                sleepDurationProvider: retryAttempt => TimeSpan.FromSeconds(Math.Pow(ExponentialBackoffBase, retryAttempt)),
                onRetry: (outcome, timespan, retryCount, context) =>
                {
                    var operationKey = context.OperationKey ?? "Unknown";
                    var duration = timespan.TotalMilliseconds;

                    // Log retry attempts with context for diagnostics
                    logger?.LogWarning("HTTP retry attempt {RetryCount} for operation {OperationKey} after {Duration}ms delay. Reason: {Reason}",
                        retryCount, operationKey, duration, outcome.Exception?.Message ?? outcome.Result?.StatusCode.ToString());
                });
    }

    /// <summary>
    /// Creates a timeout policy that cancels HTTP requests exceeding the configured duration.
    /// Uses pessimistic timeout strategy which operates independently of the underlying operation's timeout.
    /// </summary>
    /// <returns>An async policy that enforces a 2-minute timeout on HTTP requests.</returns>
    /// <remarks>
    /// Pessimistic timeout means the policy will actively cancel the operation after the timeout period,
    /// rather than waiting for the operation to recognize its own timeout.
    /// </remarks>
    public static IAsyncPolicy<HttpResponseMessage> GetTimeoutPolicy()
    {
        return Policy.TimeoutAsync<HttpResponseMessage>(TimeSpan.FromMinutes(TimeoutMinutes), TimeoutStrategy.Pessimistic);
    }
}
