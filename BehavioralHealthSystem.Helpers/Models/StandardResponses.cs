namespace BehavioralHealthSystem.Models;

/// <summary>
/// Standard error response model for API endpoints
/// </summary>
public class StandardErrorResponse
{
    /// <summary>
    /// Indicates whether the operation was successful
    /// </summary>
    public bool Success { get; set; } = false;

    /// <summary>
    /// Human-readable error message
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Optional detailed error information (for debugging)
    /// </summary>
    public string? Details { get; set; }

    /// <summary>
    /// Error code for programmatic handling
    /// </summary>
    public string? Code { get; set; }

    /// <summary>
    /// Timestamp when the error occurred
    /// </summary>
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Correlation ID for request tracking
    /// </summary>
    public string? CorrelationId { get; set; }

    /// <summary>
    /// Additional context data
    /// </summary>
    public Dictionary<string, object>? Context { get; set; }

    /// <summary>
    /// Create a basic error response
    /// </summary>
    public static StandardErrorResponse Create(string message, string? code = null, string? details = null)
    {
        return new StandardErrorResponse
        {
            Message = message,
            Code = code,
            Details = details
        };
    }

    /// <summary>
    /// Create an error response with context
    /// </summary>
    public static StandardErrorResponse Create(string message, string? code, Dictionary<string, object>? context, string? details = null)
    {
        return new StandardErrorResponse
        {
            Message = message,
            Code = code,
            Details = details,
            Context = context
        };
    }
}

/// <summary>
/// Standard success response model for API endpoints
/// </summary>
public class StandardSuccessResponse<T>
{
    /// <summary>
    /// Indicates the operation was successful
    /// </summary>
    public bool Success { get; set; } = true;

    /// <summary>
    /// Success message
    /// </summary>
    public string Message { get; set; } = "Operation completed successfully";

    /// <summary>
    /// The result data
    /// </summary>
    public T? Data { get; set; }

    /// <summary>
    /// Timestamp when the operation completed
    /// </summary>
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>
    /// Correlation ID for request tracking
    /// </summary>
    public string? CorrelationId { get; set; }

    /// <summary>
    /// Additional metadata
    /// </summary>
    public Dictionary<string, object>? Metadata { get; set; }

    /// <summary>
    /// Create a success response with data
    /// </summary>
    public static StandardSuccessResponse<T> Create(T data, string? message = null)
    {
        return new StandardSuccessResponse<T>
        {
            Data = data,
            Message = message ?? "Operation completed successfully"
        };
    }

    /// <summary>
    /// Create a success response with data and metadata
    /// </summary>
    public static StandardSuccessResponse<T> Create(T data, string message, Dictionary<string, object> metadata)
    {
        return new StandardSuccessResponse<T>
        {
            Data = data,
            Message = message,
            Metadata = metadata
        };
    }
}

/// <summary>
/// Basic success response without data
/// </summary>
public class StandardSuccessResponse : StandardSuccessResponse<object>
{
    /// <summary>
    /// Create a basic success response
    /// </summary>
    public static new StandardSuccessResponse Create(string message = "Operation completed successfully")
    {
        return new StandardSuccessResponse
        {
            Message = message
        };
    }
}