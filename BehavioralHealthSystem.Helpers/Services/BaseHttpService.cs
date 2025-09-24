namespace BehavioralHealthSystem.Services;

/// <summary>
/// Base class for HTTP-based services providing common functionality for API calls
/// </summary>
public abstract class BaseHttpService : IDisposable
{
    protected readonly HttpClient HttpClient;
    protected readonly ILogger Logger;
    protected readonly JsonSerializerOptions JsonOptions;
    private bool _disposed;

    protected BaseHttpService(HttpClient httpClient, ILogger logger)
    {
        HttpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        Logger = logger ?? throw new ArgumentNullException(nameof(logger));
        JsonOptions = JsonSerializerOptionsFactory.Default;
    }

    /// <summary>
    /// Configure HTTP client with base settings
    /// </summary>
    protected virtual void ConfigureHttpClient(string baseUrl, Dictionary<string, string>? defaultHeaders = null)
    {
        if (HttpClient.BaseAddress == null && !string.IsNullOrEmpty(baseUrl))
        {
            Logger.LogInformation("[{ClassName}] Configuring HttpClient with BaseAddress: {BaseAddress}", 
                GetType().Name, baseUrl);
            
            // Ensure BaseUrl ends with a slash for relative URL resolution
            var normalizedBaseUrl = baseUrl.TrimEnd('/') + "/";
            HttpClient.BaseAddress = new Uri(normalizedBaseUrl);
            
            // Set default headers
            HttpClient.DefaultRequestHeaders.Accept.Clear();
            HttpClient.DefaultRequestHeaders.Accept.Add(
                new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue(ApplicationConstants.ContentTypes.ApplicationJson));
            
            // Set timeout
            HttpClient.Timeout = ApplicationConstants.Timeouts.HttpClientTimeout;
            
            // Add custom headers if provided
            if (defaultHeaders != null)
            {
                foreach (var header in defaultHeaders)
                {
                    HttpClient.DefaultRequestHeaders.Add(header.Key, header.Value);
                }
            }
        }
    }

    /// <summary>
    /// Execute GET request with standard error handling and logging
    /// </summary>
    protected async Task<TResponse?> ExecuteGetAsync<TResponse>(
        string endpoint,
        CancellationToken cancellationToken = default,
        string? operationName = null) where TResponse : class
    {
        operationName ??= $"GET {endpoint}";
        
        try
        {
            Logger.LogInformation("[{ClassName}] Executing {Operation}", GetType().Name, operationName);
            
            using var response = await HttpClient.GetAsync(endpoint, cancellationToken);
            
            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
                var result = JsonSerializer.Deserialize<TResponse>(responseContent, JsonOptions);
                
                Logger.LogInformation("[{ClassName}] {Operation} completed successfully", GetType().Name, operationName);
                return result;
            }
            
            await HandleErrorResponseAsync(response, operationName, cancellationToken);
            return null;
        }
        catch (OperationCanceledException)
        {
            Logger.LogWarning("[{ClassName}] {Operation} was cancelled", GetType().Name, operationName);
            throw;
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "[{ClassName}] Error executing {Operation}", GetType().Name, operationName);
            throw;
        }
    }

    /// <summary>
    /// Execute POST request with JSON payload and standard error handling
    /// </summary>
    protected async Task<TResponse?> ExecutePostAsync<TRequest, TResponse>(
        string endpoint,
        TRequest requestPayload,
        CancellationToken cancellationToken = default,
        string? operationName = null) where TResponse : class
    {
        operationName ??= $"POST {endpoint}";
        
        try
        {
            Logger.LogInformation("[{ClassName}] Executing {Operation}", GetType().Name, operationName);
            
            var json = JsonSerializer.Serialize(requestPayload, JsonOptions);
            Logger.LogDebug("[{ClassName}] {Operation} request payload: {RequestJson}", GetType().Name, operationName, json);
            
            using var content = new StringContent(json, Encoding.UTF8, ApplicationConstants.ContentTypes.ApplicationJson);
            using var response = await HttpClient.PostAsync(endpoint, content, cancellationToken);
            
            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
                var result = JsonSerializer.Deserialize<TResponse>(responseContent, JsonOptions);
                
                Logger.LogInformation("[{ClassName}] {Operation} completed successfully", GetType().Name, operationName);
                return result;
            }
            
            await HandleErrorResponseAsync(response, operationName, cancellationToken);
            return null;
        }
        catch (OperationCanceledException)
        {
            Logger.LogWarning("[{ClassName}] {Operation} was cancelled", GetType().Name, operationName);
            throw;
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "[{ClassName}] Error executing {Operation}", GetType().Name, operationName);
            throw;
        }
    }

    /// <summary>
    /// Execute POST request with multipart form data
    /// </summary>
    protected async Task<TResponse?> ExecutePostMultipartAsync<TResponse>(
        string endpoint,
        MultipartFormDataContent formContent,
        CancellationToken cancellationToken = default,
        string? operationName = null) where TResponse : class
    {
        operationName ??= $"POST {endpoint}";
        
        try
        {
            Logger.LogInformation("[{ClassName}] Executing {Operation} with multipart content", GetType().Name, operationName);
            
            using var response = await HttpClient.PostAsync(endpoint, formContent, cancellationToken);
            
            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
                var result = JsonSerializer.Deserialize<TResponse>(responseContent, JsonOptions);
                
                Logger.LogInformation("[{ClassName}] {Operation} completed successfully", GetType().Name, operationName);
                return result;
            }
            
            await HandleErrorResponseAsync(response, operationName, cancellationToken);
            return null;
        }
        catch (OperationCanceledException)
        {
            Logger.LogWarning("[{ClassName}] {Operation} was cancelled", GetType().Name, operationName);
            throw;
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "[{ClassName}] Error executing {Operation}", GetType().Name, operationName);
            throw;
        }
    }

    /// <summary>
    /// Download binary data from a URL using a separate HttpClient instance
    /// </summary>
    protected async Task<byte[]> DownloadBinaryDataAsync(
        string url,
        CancellationToken cancellationToken = default,
        string? operationName = null)
    {
        operationName ??= $"Download from {url}";
        
        try
        {
            Logger.LogInformation("[{ClassName}] {Operation}", GetType().Name, operationName);
            
            // Use a separate HttpClient for downloads to avoid interference with configured timeouts
            using var downloadClient = new HttpClient();
            downloadClient.Timeout = ApplicationConstants.Timeouts.FileDownloadTimeout;
            
            using var response = await downloadClient.GetAsync(url, cancellationToken);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorMessage = $"Failed to download from {url}. Status: {response.StatusCode}";
                Logger.LogError("[{ClassName}] {ErrorMessage}", GetType().Name, errorMessage);
                throw new HttpRequestException(errorMessage, null, response.StatusCode);
            }
            
            var data = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            Logger.LogInformation("[{ClassName}] {Operation} completed: {FileSize} bytes", GetType().Name, operationName, data.Length);
            return data;
        }
        catch (OperationCanceledException)
        {
            Logger.LogWarning("[{ClassName}] {Operation} was cancelled", GetType().Name, operationName);
            throw;
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "[{ClassName}] Error in {Operation}", GetType().Name, operationName);
            throw;
        }
    }

    /// <summary>
    /// Handle HTTP error responses with structured logging and appropriate exception throwing
    /// </summary>
    protected virtual async Task HandleErrorResponseAsync(
        HttpResponseMessage response,
        string operation,
        CancellationToken cancellationToken = default)
    {
        var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
        
        // Try to parse as structured error response
        ApiErrorResponse? errorResponse = null;
        try
        {
            errorResponse = JsonSerializer.Deserialize<ApiErrorResponse>(errorContent, JsonOptions);
        }
        catch (JsonException)
        {
            Logger.LogWarning("[{ClassName}] Could not parse error response as JSON for {Operation}: {ErrorContent}", 
                GetType().Name, operation, errorContent);
        }

        var errorMessage = response.StatusCode switch
        {
            System.Net.HttpStatusCode.Unauthorized => $"Not authorized: {errorResponse?.Message ?? errorContent}",
            System.Net.HttpStatusCode.Forbidden => $"Not authenticated: {errorResponse?.Message ?? errorContent}",
            System.Net.HttpStatusCode.NotAcceptable => $"Not acceptable: {errorResponse?.Message ?? errorContent}",
            System.Net.HttpStatusCode.NotFound => $"Resource not found: {errorResponse?.Message ?? errorContent}",
            System.Net.HttpStatusCode.Conflict => $"Request conflict: {errorResponse?.Message ?? errorContent}",
            System.Net.HttpStatusCode.UnprocessableEntity => $"Validation error: {errorResponse?.Message ?? errorContent}",
            System.Net.HttpStatusCode.InternalServerError => $"Server error: {errorResponse?.Message ?? errorContent}",
            _ => $"API error ({response.StatusCode}): {errorResponse?.Message ?? errorContent}"
        };
        
        Logger.LogError("[{ClassName}] {Operation} failed: {StatusCode} - {ErrorMessage}, Raw Response: {RawResponse}", 
            GetType().Name, operation, response.StatusCode, errorMessage, errorContent);

        var exception = new HttpRequestException(errorMessage, null, response.StatusCode);
        
        // Add additional context to exception for specific error codes
        if (response.StatusCode == (System.Net.HttpStatusCode)417 || errorResponse != null)
        {
            exception.Data["RawErrorResponse"] = errorContent;
            exception.Data["ErrorDetails"] = errorResponse;
            exception.Data["StatusCode"] = response.StatusCode;
        }
        
        throw exception;
    }

    /// <summary>
    /// Validate required configuration values
    /// </summary>
    protected void ValidateConfiguration(Dictionary<string, string?> configValues)
    {
        var missingConfigs = configValues
            .Where(kvp => string.IsNullOrEmpty(kvp.Value))
            .Select(kvp => kvp.Key)
            .ToList();

        if (missingConfigs.Any())
        {
            var message = $"Missing required configuration values: {string.Join(", ", missingConfigs)}";
            Logger.LogError("[{ClassName}] {Message}", GetType().Name, message);
            throw new InvalidOperationException(message);
        }
    }

    /// <summary>
    /// Log configuration setup
    /// </summary>
    protected void LogConfigurationSetup(string serviceName, Dictionary<string, object?> configInfo)
    {
        Logger.LogInformation("[{ClassName}] {ServiceName} configured with: {ConfigInfo}", 
            GetType().Name, serviceName, 
            string.Join(", ", configInfo.Where(kvp => kvp.Value != null).Select(kvp => $"{kvp.Key}={kvp.Value}")));
    }

    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed && disposing)
        {
            // HttpClient should not be disposed here as it's typically injected and managed by DI container
            _disposed = true;
        }
    }

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }
}