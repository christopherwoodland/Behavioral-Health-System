namespace BehavioralHealthSystem.Configuration;

public static class RetryPolicies
{
    private const int DefaultRetryCount = 3;
    private const int ExponentialBackoffBase = 2;
    private const int ServerErrorStatusCode = 500;
    private const int TimeoutMinutes = 2;

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
                    
                    logger?.LogWarning("HTTP retry attempt {RetryCount} for operation {OperationKey} after {Duration}ms delay. Reason: {Reason}",
                        retryCount, operationKey, duration, outcome.Exception?.Message ?? outcome.Result?.StatusCode.ToString());
                });
    }

    public static IAsyncPolicy<HttpResponseMessage> GetTimeoutPolicy()
    {
        return Policy.TimeoutAsync<HttpResponseMessage>(TimeSpan.FromMinutes(TimeoutMinutes), TimeoutStrategy.Pessimistic);
    }
}
