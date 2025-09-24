using System.Security;

namespace BehavioralHealthSystem.Services;

/// <summary>
/// Centralized exception management service providing consistent error handling,
/// logging, and exception transformation across the entire application
/// </summary>
public class ExceptionHandlingService
{
    private readonly ILogger<ExceptionHandlingService> _logger;

    public ExceptionHandlingService(ILogger<ExceptionHandlingService> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Execute an operation with comprehensive error handling and logging
    /// </summary>
    public async Task<T> ExecuteWithHandlingAsync<T>(
        Func<Task<T>> operation,
        string operationName,
        Dictionary<string, object>? context = null,
        bool suppressExceptions = false)
    {
        var contextInfo = context != null ? 
            string.Join(", ", context.Select(kvp => $"{kvp.Key}={kvp.Value}")) : "";
        
        using var logScope = _logger.BeginScope(new Dictionary<string, object>
        {
            ["Operation"] = operationName,
            ["Context"] = contextInfo
        });

        try
        {
            _logger.LogInformation("[{Operation}] Starting operation {Context}", operationName, contextInfo);
            
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            var result = await operation();
            stopwatch.Stop();
            
            _logger.LogInformation("[{Operation}] Operation completed successfully in {ElapsedMs}ms {Context}", 
                operationName, stopwatch.ElapsedMilliseconds, contextInfo);
            
            return result;
        }
        catch (Exception ex) when (suppressExceptions)
        {
            _logger.LogError(ex, "[{Operation}] Operation failed but exception suppressed {Context}", 
                operationName, contextInfo);
            return default(T)!;
        }
        catch (Exception ex)
        {
            LogException(ex, operationName, context);
            throw;
        }
    }

    /// <summary>
    /// Execute an operation with comprehensive error handling and logging (void return)
    /// </summary>
    public async Task ExecuteWithHandlingAsync(
        Func<Task> operation,
        string operationName,
        Dictionary<string, object>? context = null,
        bool suppressExceptions = false)
    {
        var contextInfo = context != null ? 
            string.Join(", ", context.Select(kvp => $"{kvp.Key}={kvp.Value}")) : "";
        
        using var logScope = _logger.BeginScope(new Dictionary<string, object>
        {
            ["Operation"] = operationName,
            ["Context"] = contextInfo
        });

        try
        {
            _logger.LogInformation("[{Operation}] Starting operation {Context}", operationName, contextInfo);
            
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            await operation();
            stopwatch.Stop();
            
            _logger.LogInformation("[{Operation}] Operation completed successfully in {ElapsedMs}ms {Context}", 
                operationName, stopwatch.ElapsedMilliseconds, contextInfo);
        }
        catch (Exception ex) when (suppressExceptions)
        {
            _logger.LogError(ex, "[{Operation}] Operation failed but exception suppressed {Context}", 
                operationName, contextInfo);
        }
        catch (Exception ex)
        {
            LogException(ex, operationName, context);
            throw;
        }
    }

    /// <summary>
    /// Handle and transform exceptions into standardized error responses
    /// </summary>
    public StandardErrorResponse HandleException(
        Exception ex,
        string operation,
        Dictionary<string, object>? context = null,
        string? correlationId = null)
    {
        LogException(ex, operation, context);

        var errorCode = GetErrorCode(ex);
        var userMessage = GetUserFriendlyMessage(ex);

        return StandardErrorResponse.Create(
            userMessage,
            errorCode,
            context,
            ApplicationConstants.Defaults.IncludeErrorDetails ? ex.ToString() : null
        );
    }

    /// <summary>
    /// Log exception with context and categorization
    /// </summary>
    public void LogException(
        Exception ex,
        string operation,
        Dictionary<string, object>? context = null,
        string? correlationId = null)
    {
        var severity = GetExceptionSeverity(ex);
        var category = GetExceptionCategory(ex);
        var errorCode = GetErrorCode(ex);

        var logData = new Dictionary<string, object>
        {
            ["Operation"] = operation,
            ["ErrorCode"] = errorCode,
            ["Category"] = category,
            ["Severity"] = severity,
            ["ExceptionType"] = ex.GetType().Name
        };

        if (correlationId != null)
        {
            logData["CorrelationId"] = correlationId;
        }

        if (context != null)
        {
            foreach (var item in context)
            {
                logData[$"Context.{item.Key}"] = item.Value;
            }
        }

        using var logScope = _logger.BeginScope(logData);

        switch (severity)
        {
            case ExceptionSeverity.Critical:
                _logger.LogCritical(ex, "[{Operation}] Critical error in {Category}: {ErrorMessage}", 
                    operation, category, ex.Message);
                break;
            case ExceptionSeverity.High:
                _logger.LogError(ex, "[{Operation}] High severity error in {Category}: {ErrorMessage}", 
                    operation, category, ex.Message);
                break;
            case ExceptionSeverity.Medium:
                _logger.LogWarning(ex, "[{Operation}] Medium severity error in {Category}: {ErrorMessage}", 
                    operation, category, ex.Message);
                break;
            case ExceptionSeverity.Low:
                _logger.LogInformation(ex, "[{Operation}] Low severity error in {Category}: {ErrorMessage}", 
                    operation, category, ex.Message);
                break;
            default:
                _logger.LogError(ex, "[{Operation}] Unclassified error in {Category}: {ErrorMessage}", 
                    operation, category, ex.Message);
                break;
        }
    }

    /// <summary>
    /// Check if an exception is retriable
    /// </summary>
    public bool IsRetriableException(Exception ex)
    {
        return ex switch
        {
            TimeoutException => true,
            TaskCanceledException => true,
            HttpRequestException httpEx when IsRetriableHttpStatus(httpEx) => true,
            _ => false
        };
    }

    /// <summary>
    /// Get retry delay based on attempt number and exception type
    /// </summary>
    public TimeSpan GetRetryDelay(Exception ex, int attemptNumber)
    {
        var baseDelay = TimeSpan.FromMilliseconds(ApplicationConstants.Defaults.RetryDelayMilliseconds);
        
        // Exponential backoff with jitter
        var delay = TimeSpan.FromMilliseconds(
            baseDelay.TotalMilliseconds * Math.Pow(2, attemptNumber - 1)
        );

        // Add jitter (±25%)
        var jitter = Random.Shared.NextDouble() * 0.5 - 0.25; // -0.25 to +0.25
        var jitteredDelay = TimeSpan.FromMilliseconds(delay.TotalMilliseconds * (1 + jitter));

        // Cap at maximum delay
        var maxDelay = TimeSpan.FromSeconds(30);
        return jitteredDelay > maxDelay ? maxDelay : jitteredDelay;
    }

    /// <summary>
    /// Wrap an exception with additional context
    /// </summary>
    public Exception WrapException(Exception innerException, string message, Dictionary<string, object>? context = null)
    {
        var wrapper = new InvalidOperationException(message, innerException);
        
        if (context != null)
        {
            foreach (var item in context)
            {
                wrapper.Data[item.Key] = item.Value;
            }
        }

        return wrapper;
    }

    private ExceptionSeverity GetExceptionSeverity(Exception ex)
    {
        return ex switch
        {
            OutOfMemoryException => ExceptionSeverity.Critical,
            StackOverflowException => ExceptionSeverity.Critical,
            AccessViolationException => ExceptionSeverity.Critical,
            UnauthorizedAccessException => ExceptionSeverity.High,
            SecurityException => ExceptionSeverity.High,
            ArgumentNullException => ExceptionSeverity.Medium,
            ArgumentException => ExceptionSeverity.Medium,
            InvalidOperationException => ExceptionSeverity.Medium,
            FileNotFoundException => ExceptionSeverity.Low,
            DirectoryNotFoundException => ExceptionSeverity.Low,
            TimeoutException => ExceptionSeverity.Low,
            TaskCanceledException => ExceptionSeverity.Low,
            OperationCanceledException => ExceptionSeverity.Low,
            _ => ExceptionSeverity.Medium
        };
    }

    private string GetExceptionCategory(Exception ex)
    {
        return ex switch
        {
            HttpRequestException => "HTTP",
            TimeoutException => "Timeout",
            TaskCanceledException => "Cancellation",
            OperationCanceledException => "Cancellation",
            ArgumentNullException => "Validation",
            ArgumentException => "Validation",
            InvalidOperationException => "Logic",
            UnauthorizedAccessException => "Security",
            SecurityException => "Security",
            FileNotFoundException => "IO",
            DirectoryNotFoundException => "IO",
            IOException => "IO",
            JsonException => "Serialization",
            FormatException => "Format",
            _ => "General"
        };
    }

    private string GetErrorCode(Exception ex)
    {
        return ex switch
        {
            ArgumentNullException => "MISSING_ARGUMENT",
            ArgumentException => "INVALID_ARGUMENT",
            InvalidOperationException => "INVALID_OPERATION",
            UnauthorizedAccessException => "UNAUTHORIZED",
            FileNotFoundException => "FILE_NOT_FOUND",
            DirectoryNotFoundException => "DIRECTORY_NOT_FOUND",
            TimeoutException => "TIMEOUT",
            HttpRequestException => "HTTP_ERROR",
            TaskCanceledException => "TIMEOUT",
            OperationCanceledException => "CANCELLED",
            JsonException => "JSON_ERROR",
            FormatException => "FORMAT_ERROR",
            OutOfMemoryException => "OUT_OF_MEMORY",
            StackOverflowException => "STACK_OVERFLOW",
            _ => "INTERNAL_ERROR"
        };
    }

    private string GetUserFriendlyMessage(Exception ex)
    {
        return ex switch
        {
            ArgumentNullException => "Required information is missing",
            ArgumentException => "Invalid request parameters provided",
            InvalidOperationException => "The requested operation cannot be completed at this time",
            UnauthorizedAccessException => "You are not authorized to perform this operation",
            FileNotFoundException => "The requested resource was not found",
            DirectoryNotFoundException => "The requested resource was not found",
            TimeoutException => "The operation timed out. Please try again",
            HttpRequestException => "External service error. Please try again later",
            TaskCanceledException => "The operation was cancelled or timed out",
            OperationCanceledException => "The operation was cancelled",
            JsonException => "Invalid data format provided",
            FormatException => "Data format is invalid",
            OutOfMemoryException => "System resources temporarily unavailable",
            _ => "An unexpected error occurred. Please try again later"
        };
    }

    private bool IsRetriableHttpStatus(HttpRequestException httpEx)
    {
        if (!httpEx.Data.Contains("StatusCode"))
            return false;

        if (httpEx.Data["StatusCode"] is not System.Net.HttpStatusCode statusCode)
            return false;

        return statusCode is 
            System.Net.HttpStatusCode.RequestTimeout or
            System.Net.HttpStatusCode.TooManyRequests or
            System.Net.HttpStatusCode.InternalServerError or
            System.Net.HttpStatusCode.BadGateway or
            System.Net.HttpStatusCode.ServiceUnavailable or
            System.Net.HttpStatusCode.GatewayTimeout;
    }
}

/// <summary>
/// Exception severity levels for logging and handling decisions
/// </summary>
public enum ExceptionSeverity
{
    Low,
    Medium,
    High,
    Critical
}