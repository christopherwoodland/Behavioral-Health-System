namespace BehavioralHealthSystem.Services;

/// <summary>
/// Interface for centralized structured logging service providing consistent
/// logging patterns and structured context across the application
/// </summary>
public interface IStructuredLoggingService
{
    /// <summary>
    /// Log a request with structured context
    /// </summary>
    /// <param name="operation">The operation being performed</param>
    /// <param name="correlationId">Optional correlation ID for request tracking</param>
    /// <param name="userId">Optional user ID</param>
    /// <param name="sessionId">Optional session ID</param>
    /// <param name="additionalContext">Optional additional context data</param>
    void LogRequest(
        string operation,
        string? correlationId = null,
        string? userId = null,
        string? sessionId = null,
        Dictionary<string, object>? additionalContext = null);

    /// <summary>
    /// Log a successful response with metrics
    /// </summary>
    /// <param name="operation">The operation that completed</param>
    /// <param name="elapsedMs">The elapsed time in milliseconds</param>
    /// <param name="correlationId">Optional correlation ID for request tracking</param>
    /// <param name="userId">Optional user ID</param>
    /// <param name="sessionId">Optional session ID</param>
    /// <param name="additionalContext">Optional additional context data</param>
    void LogResponse(
        string operation,
        long elapsedMs,
        string? correlationId = null,
        string? userId = null,
        string? sessionId = null,
        Dictionary<string, object>? additionalContext = null);

    /// <summary>
    /// Log external service call with timing and status
    /// </summary>
    /// <param name="serviceName">The name of the external service</param>
    /// <param name="endpoint">The endpoint URL</param>
    /// <param name="method">The HTTP method</param>
    /// <param name="elapsedMs">The elapsed time in milliseconds</param>
    /// <param name="statusCode">The HTTP status code</param>
    /// <param name="correlationId">Optional correlation ID</param>
    /// <param name="externalRequestId">Optional external request ID</param>
    /// <param name="additionalContext">Optional additional context data</param>
    void LogExternalCall(
        string serviceName,
        string endpoint,
        string method,
        long elapsedMs,
        int statusCode,
        string? correlationId = null,
        string? externalRequestId = null,
        Dictionary<string, object>? additionalContext = null);

    /// <summary>
    /// Log business event with context
    /// </summary>
    /// <param name="eventName">The name of the business event</param>
    /// <param name="correlationId">Optional correlation ID</param>
    /// <param name="userId">Optional user ID</param>
    /// <param name="sessionId">Optional session ID</param>
    /// <param name="businessContext">Optional business-specific context data</param>
    void LogBusinessEvent(
        string eventName,
        string? correlationId = null,
        string? userId = null,
        string? sessionId = null,
        Dictionary<string, object>? businessContext = null);

    /// <summary>
    /// Log security event with user information
    /// </summary>
    /// <param name="eventName">The name of the security event</param>
    /// <param name="userId">Optional user ID</param>
    /// <param name="ipAddress">Optional IP address</param>
    /// <param name="userAgent">Optional user agent string</param>
    /// <param name="securityContext">Optional security-specific context data</param>
    void LogSecurityEvent(
        string eventName,
        string? userId = null,
        string? ipAddress = null,
        string? userAgent = null,
        Dictionary<string, object>? securityContext = null);

    /// <summary>
    /// Log performance metrics
    /// </summary>
    /// <param name="operation">The operation being measured</param>
    /// <param name="elapsedMs">The elapsed time in milliseconds</param>
    /// <param name="memoryUsageBytes">The memory usage in bytes</param>
    /// <param name="correlationId">Optional correlation ID</param>
    /// <param name="performanceContext">Optional performance-specific context data</param>
    void LogPerformanceMetrics(
        string operation,
        long elapsedMs,
        long memoryUsageBytes,
        string? correlationId = null,
        Dictionary<string, object>? performanceContext = null);

    /// <summary>
    /// Log validation error with context
    /// </summary>
    /// <param name="operation">The operation that failed validation</param>
    /// <param name="validationMessage">The validation error message</param>
    /// <param name="validationErrors">Optional validation error details</param>
    /// <param name="correlationId">Optional correlation ID</param>
    void LogValidationError(
        string operation,
        string validationMessage,
        Dictionary<string, object>? validationErrors = null,
        string? correlationId = null);

    /// <summary>
    /// Log configuration issue
    /// </summary>
    /// <param name="configurationKey">The configuration key with the issue</param>
    /// <param name="issue">Description of the issue</param>
    /// <param name="severity">The log level severity</param>
    /// <param name="configContext">Optional configuration-specific context data</param>
    void LogConfigurationIssue(
        string configurationKey,
        string issue,
        LogLevel severity = LogLevel.Warning,
        Dictionary<string, object>? configContext = null);

    /// <summary>
    /// Log health check result
    /// </summary>
    /// <param name="healthCheckName">The name of the health check</param>
    /// <param name="isHealthy">Whether the health check passed</param>
    /// <param name="responseTimeMs">The response time in milliseconds</param>
    /// <param name="details">Optional details about the health check</param>
    /// <param name="healthContext">Optional health check context data</param>
    void LogHealthCheck(
        string healthCheckName,
        bool isHealthy,
        long responseTimeMs,
        string? details = null,
        Dictionary<string, object>? healthContext = null);
}
