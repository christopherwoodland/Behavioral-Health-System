namespace BehavioralHealthSystem.Functions.Services;

/// <summary>
/// Azure Functions specific error handling service
/// Extends the generic error handling with HTTP-specific functionality
/// </summary>
public class FunctionErrorHandlingService
{
    private readonly GenericErrorHandlingService _genericErrorHandler;
    private readonly ILogger<FunctionErrorHandlingService> _logger;

    public FunctionErrorHandlingService(
        GenericErrorHandlingService genericErrorHandler,
        ILogger<FunctionErrorHandlingService> logger)
    {
        _genericErrorHandler = genericErrorHandler ?? throw new ArgumentNullException(nameof(genericErrorHandler));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Handle exceptions and create standardized HTTP error responses
    /// </summary>
    public async Task<HttpResponseData> HandleExceptionAsync(
        HttpRequestData req,
        Exception ex,
        string functionName,
        Dictionary<string, object>? context = null,
        string? correlationId = null)
    {
        var statusCode = GetHttpStatusCode(ex);
        
        // Use the generic error handler to create the error response
        var errorResponse = _genericErrorHandler.CreateErrorResponse(
            ex, 
            functionName, 
            context, 
            correlationId);

        // Log additional function-specific context
        _logger.LogError("[{FunctionName}] HTTP {StatusCode} error: {ErrorMessage}", 
            functionName, statusCode, ex.Message);

        // Create HTTP response
        var response = req.CreateResponse(statusCode);
        response.Headers.Add("Content-Type", ApplicationConstants.ContentTypes.ApplicationJson);
        
        await response.WriteStringAsync(_genericErrorHandler.SerializeResponse(errorResponse));
        return response;
    }

    /// <summary>
    /// Create standardized validation error HTTP response
    /// </summary>
    public async Task<HttpResponseData> CreateValidationErrorResponseAsync(
        HttpRequestData req,
        string message,
        Dictionary<string, object>? validationErrors = null,
        string? correlationId = null)
    {
        var errorResponse = _genericErrorHandler.CreateValidationErrorResponse(
            message, 
            validationErrors, 
            correlationId);

        var response = req.CreateResponse(HttpStatusCode.BadRequest);
        response.Headers.Add("Content-Type", ApplicationConstants.ContentTypes.ApplicationJson);
        
        await response.WriteStringAsync(_genericErrorHandler.SerializeResponse(errorResponse));
        return response;
    }

    /// <summary>
    /// Create standardized not found HTTP response
    /// </summary>
    public async Task<HttpResponseData> CreateNotFoundResponseAsync(
        HttpRequestData req,
        string resourceType,
        string resourceId,
        string? correlationId = null)
    {
        var errorResponse = _genericErrorHandler.CreateNotFoundResponse(
            resourceType, 
            resourceId, 
            correlationId);

        var response = req.CreateResponse(HttpStatusCode.NotFound);
        response.Headers.Add("Content-Type", ApplicationConstants.ContentTypes.ApplicationJson);
        
        await response.WriteStringAsync(_genericErrorHandler.SerializeResponse(errorResponse));
        return response;
    }

    /// <summary>
    /// Create standardized success HTTP response
    /// </summary>
    public async Task<HttpResponseData> CreateSuccessResponseAsync<T>(
        HttpRequestData req,
        T data,
        string? message = null,
        Dictionary<string, object>? metadata = null,
        string? correlationId = null,
        HttpStatusCode statusCode = HttpStatusCode.OK)
    {
        var successResponse = _genericErrorHandler.CreateSuccessResponse(
            data, 
            message, 
            metadata, 
            correlationId);

        var response = req.CreateResponse(statusCode);
        response.Headers.Add("Content-Type", ApplicationConstants.ContentTypes.ApplicationJson);
        
        await response.WriteStringAsync(_genericErrorHandler.SerializeResponse(successResponse));
        return response;
    }

    /// <summary>
    /// Create standardized success HTTP response without data
    /// </summary>
    public async Task<HttpResponseData> CreateSuccessResponseAsync(
        HttpRequestData req,
        string message = "Operation completed successfully",
        string? correlationId = null,
        HttpStatusCode statusCode = HttpStatusCode.OK)
    {
        var successResponse = _genericErrorHandler.CreateSuccessResponse(message, correlationId);

        var response = req.CreateResponse(statusCode);
        response.Headers.Add("Content-Type", ApplicationConstants.ContentTypes.ApplicationJson);
        
        await response.WriteStringAsync(_genericErrorHandler.SerializeResponse(successResponse));
        return response;
    }

    /// <summary>
    /// Execute function with automatic error handling
    /// </summary>
    public async Task<HttpResponseData> ExecuteWithErrorHandlingAsync(
        HttpRequestData req,
        string functionName,
        Func<Task<HttpResponseData>> operation,
        string? correlationId = null,
        Dictionary<string, object>? context = null)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Starting function execution", functionName);
            
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            var result = await operation();
            stopwatch.Stop();
            
            _logger.LogInformation("[{FunctionName}] Function execution completed successfully in {ElapsedMs}ms", 
                functionName, stopwatch.ElapsedMilliseconds);
            
            return result;
        }
        catch (Exception ex)
        {
            return await HandleExceptionAsync(req, ex, functionName, context, correlationId);
        }
    }

    /// <summary>
    /// Get appropriate HTTP status code based on exception type
    /// </summary>
    private static HttpStatusCode GetHttpStatusCode(Exception ex)
    {
        return ex switch
        {
            ArgumentNullException => HttpStatusCode.BadRequest, // More specific first
            ArgumentException => HttpStatusCode.BadRequest,
            InvalidOperationException => HttpStatusCode.BadRequest,
            UnauthorizedAccessException => HttpStatusCode.Unauthorized,
            FileNotFoundException => HttpStatusCode.NotFound,
            DirectoryNotFoundException => HttpStatusCode.NotFound,
            TimeoutException => HttpStatusCode.RequestTimeout,
            HttpRequestException httpEx => httpEx.Data.Contains("StatusCode") && httpEx.Data["StatusCode"] is HttpStatusCode code 
                ? code 
                : HttpStatusCode.BadGateway,
            OperationCanceledException => HttpStatusCode.RequestTimeout, // Covers TaskCanceledException as well
            JsonException => HttpStatusCode.BadRequest,
            FormatException => HttpStatusCode.BadRequest,
            _ => HttpStatusCode.InternalServerError
        };
    }
}