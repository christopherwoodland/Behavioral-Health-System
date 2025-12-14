using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace BehavioralHealthSystem.Functions.Services;

/// <summary>
/// Service for validating API keys in Azure Functions.
/// Provides a flexible approach that works for both local development and production.
/// </summary>
public interface IApiKeyValidationService
{
    /// <summary>
    /// Validates the API key from the request.
    /// In development mode (AZURE_FUNCTIONS_ENVIRONMENT=Development), validation is skipped.
    /// </summary>
    /// <param name="request">The HTTP request containing the API key header</param>
    /// <returns>True if valid or in development mode; false otherwise</returns>
    bool ValidateApiKey(HttpRequestData request);

    /// <summary>
    /// Checks if the application is running in development mode.
    /// </summary>
    bool IsDevelopmentMode { get; }
}

/// <summary>
/// Implementation of API key validation service.
/// </summary>
public class ApiKeyValidationService : IApiKeyValidationService
{
    private readonly ILogger<ApiKeyValidationService> _logger;
    private readonly string? _configuredApiKey;
    private readonly bool _isDevelopmentMode;

    private const string ApiKeyHeaderName = "X-API-Key";
    private const string ApiKeyQueryParam = "code";

    public ApiKeyValidationService(ILogger<ApiKeyValidationService> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        // Check if we're in development mode
        var environment = Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT")
                       ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                       ?? "Production";

        _isDevelopmentMode = environment.Equals("Development", StringComparison.OrdinalIgnoreCase);

        // Get the configured API key (for production)
        _configuredApiKey = Environment.GetEnvironmentVariable("FUNCTIONS_API_KEY");

        if (_isDevelopmentMode)
        {
            _logger.LogInformation("API Key validation running in DEVELOPMENT mode - validation will be skipped");
        }
        else if (string.IsNullOrEmpty(_configuredApiKey))
        {
            _logger.LogWarning("FUNCTIONS_API_KEY is not configured - API key validation will fail for protected endpoints");
        }
    }

    public bool IsDevelopmentMode => _isDevelopmentMode;

    public bool ValidateApiKey(HttpRequestData request)
    {
        // Skip validation in development mode
        if (_isDevelopmentMode)
        {
            _logger.LogDebug("Development mode - skipping API key validation");
            return true;
        }

        // No API key configured means we can't validate
        if (string.IsNullOrEmpty(_configuredApiKey))
        {
            _logger.LogWarning("No API key configured - rejecting request");
            return false;
        }

        // Try to get API key from header first
        if (request.Headers.TryGetValues(ApiKeyHeaderName, out var headerValues))
        {
            var headerKey = headerValues.FirstOrDefault();
            if (!string.IsNullOrEmpty(headerKey) && headerKey == _configuredApiKey)
            {
                _logger.LogDebug("API key validated from header");
                return true;
            }
        }

        // Fall back to query parameter (Azure Functions standard 'code' parameter)
        var query = System.Web.HttpUtility.ParseQueryString(request.Url.Query);
        var queryKey = query[ApiKeyQueryParam];
        if (!string.IsNullOrEmpty(queryKey) && queryKey == _configuredApiKey)
        {
            _logger.LogDebug("API key validated from query parameter");
            return true;
        }

        _logger.LogWarning("API key validation failed - no valid key provided");
        return false;
    }
}
