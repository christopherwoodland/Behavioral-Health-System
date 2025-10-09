namespace BehavioralHealthSystem.Services;

/// <summary>
/// Standard log context keys for consistent structured logging
/// </summary>
public static class LogContextKeys
{
    // Common context keys
    public const string CorrelationId = "CorrelationId";
    public const string Operation = "Operation";
    public const string ElapsedMs = "ElapsedMs";
    public const string UserId = "UserId";
    public const string SessionId = "SessionId";

    // HTTP-specific keys
    public const string HttpMethod = "HttpMethod";
    public const string HttpStatusCode = "HttpStatusCode";
    public const string RequestPath = "RequestPath";
    public const string RequestSize = "RequestSize";
    public const string ResponseSize = "ResponseSize";

    // External service keys
    public const string ExternalService = "ExternalService";
    public const string ExternalEndpoint = "ExternalEndpoint";
    public const string ExternalRequestId = "ExternalRequestId";
    public const string ExternalStatusCode = "ExternalStatusCode";

    // Business logic keys
    public const string AssessmentType = "AssessmentType";
    public const string AssessmentScore = "AssessmentScore";
    public const string RiskLevel = "RiskLevel";
    public const string AgentName = "AgentName";
    public const string ChatTurn = "ChatTurn";

    // Error context keys
    public const string ErrorCode = "ErrorCode";
    public const string ErrorCategory = "ErrorCategory";
    public const string ExceptionType = "ExceptionType";
    public const string RetryAttempt = "RetryAttempt";
    public const string IsRetryable = "IsRetryable";

    // Performance keys
    public const string MemoryUsageBytes = "MemoryUsageBytes";
    public const string CpuUsagePercent = "CpuUsagePercent";
    public const string ThreadCount = "ThreadCount";
}

/// <summary>
/// Standard log categories for consistent message classification
/// </summary>
public static class LogCategories
{
    public const string Request = "Request";
    public const string Response = "Response";
    public const string ExternalCall = "ExternalCall";
    public const string Performance = "Performance";
    public const string Security = "Security";
    public const string Business = "Business";
    public const string Error = "Error";
    public const string Validation = "Validation";
    public const string Configuration = "Configuration";
    public const string Health = "Health";
    public const string Audit = "Audit";
}

/// <summary>
/// Centralized structured logging service with consistent patterns
/// </summary>
public class StructuredLoggingService : IStructuredLoggingService
{
    private readonly ILogger<StructuredLoggingService> _logger;

    public StructuredLoggingService(ILogger<StructuredLoggingService> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Log a request with structured context
    /// </summary>
    public void LogRequest(
        string operation,
        string? correlationId = null,
        string? userId = null,
        string? sessionId = null,
        Dictionary<string, object>? additionalContext = null)
    {
        var context = CreateBaseContext(operation, correlationId, userId, sessionId);
        context[LogContextKeys.Operation] = operation;

        if (additionalContext != null)
        {
            foreach (var item in additionalContext)
                context[item.Key] = item.Value;
        }

        using var logScope = _logger.BeginScope(context);
        _logger.LogInformation("[{Category}] Starting operation: {Operation}", LogCategories.Request, operation);
    }

    /// <summary>
    /// Log a successful response with metrics
    /// </summary>
    public void LogResponse(
        string operation,
        long elapsedMs,
        string? correlationId = null,
        string? userId = null,
        string? sessionId = null,
        Dictionary<string, object>? additionalContext = null)
    {
        var context = CreateBaseContext(operation, correlationId, userId, sessionId);
        context[LogContextKeys.ElapsedMs] = elapsedMs;

        if (additionalContext != null)
        {
            foreach (var item in additionalContext)
                context[item.Key] = item.Value;
        }

        using var logScope = _logger.BeginScope(context);

        var logLevel = elapsedMs > ApplicationConstants.Performance.SlowOperationThresholdMs
            ? LogLevel.Warning
            : LogLevel.Information;

        _logger.Log(logLevel, "[{Category}] Completed operation: {Operation} in {ElapsedMs}ms",
            LogCategories.Response, operation, elapsedMs);
    }

    /// <summary>
    /// Log external service call
    /// </summary>
    public void LogExternalCall(
        string serviceName,
        string endpoint,
        string method,
        long elapsedMs,
        int statusCode,
        string? correlationId = null,
        string? externalRequestId = null,
        Dictionary<string, object>? additionalContext = null)
    {
        var context = new Dictionary<string, object>
        {
            [LogContextKeys.ExternalService] = serviceName,
            [LogContextKeys.ExternalEndpoint] = endpoint,
            [LogContextKeys.HttpMethod] = method,
            [LogContextKeys.ElapsedMs] = elapsedMs,
            [LogContextKeys.ExternalStatusCode] = statusCode
        };

        if (correlationId != null) context[LogContextKeys.CorrelationId] = correlationId;
        if (externalRequestId != null) context[LogContextKeys.ExternalRequestId] = externalRequestId;

        if (additionalContext != null)
        {
            foreach (var item in additionalContext)
                context[item.Key] = item.Value;
        }

        using var logScope = _logger.BeginScope(context);

        var logLevel = statusCode >= 400 ? LogLevel.Warning : LogLevel.Information;
        var isSuccess = statusCode < 400;

        _logger.Log(logLevel, "[{Category}] External call to {ServiceName}: {Method} {Endpoint} - {StatusCode} in {ElapsedMs}ms",
            LogCategories.ExternalCall, serviceName, method, endpoint, statusCode, elapsedMs);
    }

    /// <summary>
    /// Log business event with context
    /// </summary>
    public void LogBusinessEvent(
        string eventName,
        string? correlationId = null,
        string? userId = null,
        string? sessionId = null,
        Dictionary<string, object>? businessContext = null)
    {
        var context = CreateBaseContext(eventName, correlationId, userId, sessionId);

        if (businessContext != null)
        {
            foreach (var item in businessContext)
                context[item.Key] = item.Value;
        }

        using var logScope = _logger.BeginScope(context);
        _logger.LogInformation("[{Category}] Business event: {EventName}", LogCategories.Business, eventName);
    }

    /// <summary>
    /// Log security event
    /// </summary>
    public void LogSecurityEvent(
        string eventName,
        string? userId = null,
        string? ipAddress = null,
        string? userAgent = null,
        Dictionary<string, object>? securityContext = null)
    {
        var context = new Dictionary<string, object>
        {
            [LogContextKeys.Operation] = eventName
        };

        if (userId != null) context[LogContextKeys.UserId] = userId;
        if (ipAddress != null) context["IpAddress"] = ipAddress;
        if (userAgent != null) context["UserAgent"] = userAgent;

        if (securityContext != null)
        {
            foreach (var item in securityContext)
                context[item.Key] = item.Value;
        }

        using var logScope = _logger.BeginScope(context);
        _logger.LogWarning("[{Category}] Security event: {EventName}", LogCategories.Security, eventName);
    }

    /// <summary>
    /// Log performance metrics
    /// </summary>
    public void LogPerformanceMetrics(
        string operation,
        long elapsedMs,
        long memoryUsageBytes,
        string? correlationId = null,
        Dictionary<string, object>? performanceContext = null)
    {
        var context = new Dictionary<string, object>
        {
            [LogContextKeys.Operation] = operation,
            [LogContextKeys.ElapsedMs] = elapsedMs,
            [LogContextKeys.MemoryUsageBytes] = memoryUsageBytes
        };

        if (correlationId != null) context[LogContextKeys.CorrelationId] = correlationId;

        if (performanceContext != null)
        {
            foreach (var item in performanceContext)
                context[item.Key] = item.Value;
        }

        using var logScope = _logger.BeginScope(context);

        var logLevel = elapsedMs > ApplicationConstants.Performance.SlowOperationThresholdMs
            ? LogLevel.Warning
            : LogLevel.Information;

        _logger.Log(logLevel, "[{Category}] Performance metrics for {Operation}: {ElapsedMs}ms, {MemoryMB}MB",
            LogCategories.Performance, operation, elapsedMs, memoryUsageBytes / (1024 * 1024));
    }

    /// <summary>
    /// Log validation error with context
    /// </summary>
    public void LogValidationError(
        string operation,
        string validationMessage,
        Dictionary<string, object>? validationErrors = null,
        string? correlationId = null)
    {
        var context = new Dictionary<string, object>
        {
            [LogContextKeys.Operation] = operation,
            [LogContextKeys.ErrorCategory] = "Validation"
        };

        if (correlationId != null) context[LogContextKeys.CorrelationId] = correlationId;

        if (validationErrors != null)
        {
            foreach (var item in validationErrors)
                context[$"ValidationError.{item.Key}"] = item.Value;
        }

        using var logScope = _logger.BeginScope(context);
        _logger.LogWarning("[{Category}] Validation failed in {Operation}: {Message}",
            LogCategories.Validation, operation, validationMessage);
    }

    /// <summary>
    /// Log configuration issue
    /// </summary>
    public void LogConfigurationIssue(
        string configurationKey,
        string issue,
        LogLevel severity = LogLevel.Warning,
        Dictionary<string, object>? configContext = null)
    {
        var context = new Dictionary<string, object>
        {
            [LogContextKeys.Operation] = "ConfigurationValidation",
            ["ConfigurationKey"] = configurationKey
        };

        if (configContext != null)
        {
            foreach (var item in configContext)
                context[item.Key] = item.Value;
        }

        using var logScope = _logger.BeginScope(context);
        _logger.Log(severity, "[{Category}] Configuration issue with {ConfigKey}: {Issue}",
            LogCategories.Configuration, configurationKey, issue);
    }

    /// <summary>
    /// Log health check result
    /// </summary>
    public void LogHealthCheck(
        string healthCheckName,
        bool isHealthy,
        long responseTimeMs,
        string? details = null,
        Dictionary<string, object>? healthContext = null)
    {
        var context = new Dictionary<string, object>
        {
            [LogContextKeys.Operation] = "HealthCheck",
            ["HealthCheckName"] = healthCheckName,
            [LogContextKeys.ElapsedMs] = responseTimeMs,
            ["IsHealthy"] = isHealthy
        };

        if (healthContext != null)
        {
            foreach (var item in healthContext)
                context[item.Key] = item.Value;
        }

        using var logScope = _logger.BeginScope(context);

        var logLevel = isHealthy ? LogLevel.Information : LogLevel.Error;
        var status = isHealthy ? "Healthy" : "Unhealthy";

        _logger.Log(logLevel, "[{Category}] Health check {HealthCheckName}: {Status} in {ElapsedMs}ms",
            LogCategories.Health, healthCheckName, status, responseTimeMs);

        if (!string.IsNullOrEmpty(details))
        {
            _logger.Log(logLevel, "[{Category}] Health check details: {Details}", LogCategories.Health, details);
        }
    }

    /// <summary>
    /// Create base context for logging
    /// </summary>
    private Dictionary<string, object> CreateBaseContext(
        string operation,
        string? correlationId = null,
        string? userId = null,
        string? sessionId = null)
    {
        var context = new Dictionary<string, object>
        {
            [LogContextKeys.Operation] = operation,
            ["Timestamp"] = DateTimeOffset.UtcNow
        };

        if (correlationId != null) context[LogContextKeys.CorrelationId] = correlationId;
        if (userId != null) context[LogContextKeys.UserId] = userId;
        if (sessionId != null) context[LogContextKeys.SessionId] = sessionId;

        return context;
    }
}

/// <summary>
/// Extensions for ILogger to provide consistent structured logging patterns
/// </summary>
public static class LoggerExtensions
{
    /// <summary>
    /// Log with timing information
    /// </summary>
    public static void LogTimed(
        this ILogger logger,
        LogLevel level,
        string operation,
        TimeSpan elapsed,
        string message,
        params object[] args)
    {
        var context = new Dictionary<string, object>
        {
            [LogContextKeys.Operation] = operation,
            [LogContextKeys.ElapsedMs] = elapsed.TotalMilliseconds
        };

        using var logScope = logger.BeginScope(context);
        logger.Log(level, message, args);
    }

    /// <summary>
    /// Log operation start
    /// </summary>
    public static IDisposable BeginOperation(
        this ILogger logger,
        string operation,
        string? correlationId = null,
        Dictionary<string, object>? context = null)
    {
        var logContext = new Dictionary<string, object>
        {
            [LogContextKeys.Operation] = operation
        };

        if (correlationId != null) logContext[LogContextKeys.CorrelationId] = correlationId;

        if (context != null)
        {
            foreach (var item in context)
                logContext[item.Key] = item.Value;
        }

        logger.LogInformation("[{Category}] Starting {Operation}", LogCategories.Request, operation);

        return new OperationLogger(logger, operation, logContext);
    }
}

/// <summary>
/// Disposable operation logger for automatic timing
/// </summary>
public class OperationLogger : IDisposable
{
    private readonly ILogger _logger;
    private readonly string _operation;
    private readonly Dictionary<string, object> _context;
    private readonly System.Diagnostics.Stopwatch _stopwatch;
    private readonly IDisposable? _logScope;

    public OperationLogger(ILogger logger, string operation, Dictionary<string, object> context)
    {
        _logger = logger;
        _operation = operation;
        _context = context;
        _stopwatch = System.Diagnostics.Stopwatch.StartNew();
        _logScope = logger.BeginScope(context);
    }

    public void Dispose()
    {
        _stopwatch.Stop();
        _context[LogContextKeys.ElapsedMs] = _stopwatch.ElapsedMilliseconds;

        var logLevel = _stopwatch.ElapsedMilliseconds > ApplicationConstants.Performance.SlowOperationThresholdMs
            ? LogLevel.Warning
            : LogLevel.Information;

        _logger.Log(logLevel, "[{Category}] Completed {Operation} in {ElapsedMs}ms",
            LogCategories.Response, _operation, _stopwatch.ElapsedMilliseconds);

        _logScope?.Dispose();
    }
}
