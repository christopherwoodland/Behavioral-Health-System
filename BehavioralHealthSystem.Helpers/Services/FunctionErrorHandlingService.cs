namespace BehavioralHealthSystem.Services;

/// <summary>
/// Generic error handling service that can be extended by specific implementations
/// </summary>
public class GenericErrorHandlingService
{
    private readonly ILogger<GenericErrorHandlingService> _logger;
    private readonly JsonSerializerOptions _jsonOptions;

    public GenericErrorHandlingService(ILogger<GenericErrorHandlingService> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _jsonOptions = JsonSerializerOptionsFactory.PrettyPrint;
    }

    /// <summary>
    /// Create standardized error response
    /// </summary>
    public StandardErrorResponse CreateErrorResponse(
        Exception ex,
        string operation,
        Dictionary<string, object>? context = null,
        string? correlationId = null)
    {
        var errorCode = GetErrorCode(ex);
        var userMessage = GetUserFriendlyMessage(ex);
        
        // Log the error
        LogError(ex, operation, context, correlationId);

        var errorContext = context ?? new Dictionary<string, object>();
        if (correlationId != null)
            errorContext["CorrelationId"] = correlationId;

        return StandardErrorResponse.Create(
            userMessage,
            errorCode,
            errorContext,
            ApplicationConstants.Defaults.IncludeErrorDetails ? ex.ToString() : null
        );
    }

    /// <summary>
    /// Create standardized validation error response
    /// </summary>
    public StandardErrorResponse CreateValidationErrorResponse(
        string message,
        Dictionary<string, object>? validationErrors = null,
        string? correlationId = null)
    {
        _logger.LogWarning("[Validation] Validation failed: {Message}, Errors: {Errors}", 
            message, validationErrors != null ? string.Join(", ", validationErrors.Select(kvp => $"{kvp.Key}: {kvp.Value}")) : "None");

        var errorContext = validationErrors ?? new Dictionary<string, object>();
        if (correlationId != null)
            errorContext["CorrelationId"] = correlationId;

        return StandardErrorResponse.Create(
            message,
            "VALIDATION_ERROR",
            errorContext
        );
    }

    /// <summary>
    /// Create standardized not found response
    /// </summary>
    public StandardErrorResponse CreateNotFoundResponse(
        string resourceType,
        string resourceId,
        string? correlationId = null)
    {
        var message = $"{resourceType} not found: {resourceId}";
        
        _logger.LogWarning("[NotFound] Resource not found: {ResourceType} with ID {ResourceId}", 
            resourceType, resourceId);

        var errorContext = new Dictionary<string, object>
        {
            ["ResourceType"] = resourceType,
            ["ResourceId"] = resourceId
        };

        if (correlationId != null)
            errorContext["CorrelationId"] = correlationId;

        return StandardErrorResponse.Create(
            message,
            "RESOURCE_NOT_FOUND",
            errorContext
        );
    }

    /// <summary>
    /// Create standardized success response
    /// </summary>
    public StandardSuccessResponse<T> CreateSuccessResponse<T>(
        T data,
        string? message = null,
        Dictionary<string, object>? metadata = null,
        string? correlationId = null)
    {
        var responseMetadata = metadata ?? new Dictionary<string, object>();
        if (correlationId != null)
            responseMetadata["CorrelationId"] = correlationId;

        return responseMetadata.Any()
            ? StandardSuccessResponse<T>.Create(data, message ?? "Operation completed successfully", responseMetadata)
            : StandardSuccessResponse<T>.Create(data, message);
    }

    /// <summary>
    /// Create standardized success response without data
    /// </summary>
    public StandardSuccessResponse CreateSuccessResponse(
        string message = "Operation completed successfully",
        string? correlationId = null)
    {
        var response = StandardSuccessResponse.Create(message);
        return response;
    }

    /// <summary>
    /// Get JSON string for response
    /// </summary>
    public string SerializeResponse<T>(T response)
    {
        return JsonSerializer.Serialize(response, _jsonOptions);
    }

    /// <summary>
    /// Log error with proper context
    /// </summary>
    protected void LogError(
        Exception ex,
        string operation,
        Dictionary<string, object>? context = null,
        string? correlationId = null)
    {
        var logContext = new Dictionary<string, object>
        {
            ["Operation"] = operation,
            ["ErrorCode"] = GetErrorCode(ex),
            ["ExceptionType"] = ex.GetType().Name
        };

        if (correlationId != null)
            logContext["CorrelationId"] = correlationId;

        if (context != null)
        {
            foreach (var item in context)
                logContext[$"Context.{item.Key}"] = item.Value;
        }

        using var logScope = _logger.BeginScope(logContext);
        _logger.LogError(ex, "[{Operation}] Error: {ErrorMessage}", operation, ex.Message);
    }

    /// <summary>
    /// Get error code based on exception type
    /// </summary>
    protected virtual string GetErrorCode(Exception ex)
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
            _ => "INTERNAL_ERROR"
        };
    }

    /// <summary>
    /// Get user-friendly error message
    /// </summary>
    protected virtual string GetUserFriendlyMessage(Exception ex)
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
            _ => "An unexpected error occurred. Please try again later"
        };
    }
}