namespace BehavioralHealthSystem.Services;

/// <summary>
/// Interface for centralized exception management providing consistent error handling,
/// logging, and exception transformation across the application
/// </summary>
public interface IExceptionHandlingService
{
    /// <summary>
    /// Execute an operation with comprehensive error handling and logging
    /// </summary>
    /// <typeparam name="T">The return type of the operation</typeparam>
    /// <param name="operation">The async operation to execute</param>
    /// <param name="operationName">Name of the operation for logging</param>
    /// <param name="context">Optional context dictionary for logging</param>
    /// <param name="suppressExceptions">Whether to suppress exceptions and return default value</param>
    /// <returns>The result of the operation or default if suppressed</returns>
    Task<T> ExecuteWithHandlingAsync<T>(
        Func<Task<T>> operation,
        string operationName,
        Dictionary<string, object>? context = null,
        bool suppressExceptions = false);

    /// <summary>
    /// Execute an operation with comprehensive error handling and logging (void return)
    /// </summary>
    /// <param name="operation">The async operation to execute</param>
    /// <param name="operationName">Name of the operation for logging</param>
    /// <param name="context">Optional context dictionary for logging</param>
    /// <param name="suppressExceptions">Whether to suppress exceptions</param>
    Task ExecuteWithHandlingAsync(
        Func<Task> operation,
        string operationName,
        Dictionary<string, object>? context = null,
        bool suppressExceptions = false);

    /// <summary>
    /// Handle and transform exceptions into standardized error responses
    /// </summary>
    /// <param name="ex">The exception to handle</param>
    /// <param name="operation">The operation that failed</param>
    /// <param name="context">Optional context dictionary</param>
    /// <param name="correlationId">Optional correlation ID for tracking</param>
    /// <returns>A standardized error response</returns>
    StandardErrorResponse HandleException(
        Exception ex,
        string operation,
        Dictionary<string, object>? context = null,
        string? correlationId = null);

    /// <summary>
    /// Log exception with context and categorization
    /// </summary>
    /// <param name="ex">The exception to log</param>
    /// <param name="operation">The operation that failed</param>
    /// <param name="context">Optional context dictionary</param>
    /// <param name="correlationId">Optional correlation ID for tracking</param>
    void LogException(
        Exception ex,
        string operation,
        Dictionary<string, object>? context = null,
        string? correlationId = null);

    /// <summary>
    /// Check if an exception is retriable
    /// </summary>
    /// <param name="ex">The exception to check</param>
    /// <returns>True if the exception is retriable</returns>
    bool IsRetriableException(Exception ex);

    /// <summary>
    /// Get retry delay based on attempt number and exception type
    /// </summary>
    /// <param name="ex">The exception that occurred</param>
    /// <param name="attemptNumber">The current retry attempt number</param>
    /// <returns>The delay to wait before retrying</returns>
    TimeSpan GetRetryDelay(Exception ex, int attemptNumber);

    /// <summary>
    /// Wrap an exception with additional context
    /// </summary>
    /// <param name="innerException">The original exception</param>
    /// <param name="message">The wrapper message</param>
    /// <param name="context">Optional context dictionary to add to exception data</param>
    /// <returns>A wrapped exception with additional context</returns>
    Exception WrapException(Exception innerException, string message, Dictionary<string, object>? context = null);
}
