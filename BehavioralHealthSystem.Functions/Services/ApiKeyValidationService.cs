using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace BehavioralHealthSystem.Functions.Services;

/// <summary>
/// Service for validating API requests using Entra ID (Azure AD) tokens or API keys.
/// Provides a flexible approach that works for both local development and production.
/// Priority: 1) Entra ID Bearer Token, 2) API Key, 3) Development Mode bypass
/// </summary>
public interface IApiKeyValidationService
{
    /// <summary>
    /// Validates the request using Entra ID token or API key.
    /// In development mode without auth configured, validation is skipped.
    /// </summary>
    /// <param name="request">The HTTP request containing auth header or API key</param>
    /// <returns>True if valid; false otherwise</returns>
    bool ValidateApiKey(HttpRequestData request);

    /// <summary>
    /// Async version that validates Entra ID tokens (preferred for new code)
    /// </summary>
    Task<TokenValidationResult> ValidateRequestAsync(HttpRequestData request);

    /// <summary>
    /// Checks if the application is running in development mode.
    /// </summary>
    bool IsDevelopmentMode { get; }
}

/// <summary>
/// Implementation of API validation service with Entra ID and API key support.
/// </summary>
public class ApiKeyValidationService : IApiKeyValidationService
{
    private readonly ILogger<ApiKeyValidationService> _logger;
    private readonly IEntraIdValidationService _entraIdValidation;
    private readonly string? _configuredApiKey;
    private readonly bool _isDevelopmentMode;

    private const string ApiKeyHeaderName = "X-API-Key";
    private const string ApiKeyQueryParam = "code";

    public ApiKeyValidationService(
        ILogger<ApiKeyValidationService> logger,
        IEntraIdValidationService entraIdValidation)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _entraIdValidation = entraIdValidation ?? throw new ArgumentNullException(nameof(entraIdValidation));

        // Check if we're in development mode
        var environment = Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT")
                       ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                       ?? "Production";

        _isDevelopmentMode = environment.Equals("Development", StringComparison.OrdinalIgnoreCase);

        // Get the configured API key (fallback for non-browser clients)
        _configuredApiKey = Environment.GetEnvironmentVariable("FUNCTIONS_API_KEY");

        if (_isDevelopmentMode)
        {
            _logger.LogInformation("API validation running in DEVELOPMENT mode");
        }

        if (_entraIdValidation.IsAuthenticationEnabled)
        {
            _logger.LogInformation("Entra ID authentication is enabled");
        }
    }

    public bool IsDevelopmentMode => _isDevelopmentMode;

    /// <summary>
    /// Sync validation - checks API key or development mode.
    /// For Entra ID token validation, use ValidateRequestAsync instead.
    /// </summary>
    public bool ValidateApiKey(HttpRequestData request)
    {
        // Skip validation in development mode if auth is not configured
        if (_isDevelopmentMode && !_entraIdValidation.IsAuthenticationEnabled)
        {
            _logger.LogDebug("Development mode - skipping API key validation");
            return true;
        }

        // Check for Authorization header (indicates Entra ID flow - use async method)
        if (request.Headers.TryGetValues("Authorization", out var authValues))
        {
            var authHeader = authValues.FirstOrDefault();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                // Has bearer token - caller should use ValidateRequestAsync for proper validation
                // For backward compatibility, we'll do sync validation
                var result = ValidateRequestAsync(request).GetAwaiter().GetResult();
                return result.IsValid;
            }
        }

        // Try API key validation (fallback for non-browser clients)
        if (!string.IsNullOrEmpty(_configuredApiKey))
        {
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
        }

        // Development mode bypass (last resort)
        if (_isDevelopmentMode)
        {
            _logger.LogDebug("Development mode - allowing request without credentials");
            return true;
        }

        _logger.LogWarning("Request validation failed - no valid credentials provided");
        return false;
    }

    /// <summary>
    /// Async validation with full Entra ID token support (preferred method)
    /// </summary>
    public async Task<TokenValidationResult> ValidateRequestAsync(HttpRequestData request)
    {
        // Check for Entra ID bearer token first
        if (request.Headers.TryGetValues("Authorization", out var authValues))
        {
            var authHeader = authValues.FirstOrDefault();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogDebug("Validating Entra ID bearer token");
                return await _entraIdValidation.ValidateTokenAsync(request);
            }
        }

        // Check API key as fallback
        if (!string.IsNullOrEmpty(_configuredApiKey))
        {
            if (request.Headers.TryGetValues(ApiKeyHeaderName, out var headerValues))
            {
                var headerKey = headerValues.FirstOrDefault();
                if (!string.IsNullOrEmpty(headerKey) && headerKey == _configuredApiKey)
                {
                    _logger.LogDebug("API key validated from header");
                    return new TokenValidationResult
                    {
                        IsValid = true,
                        UserId = "api-key-user",
                        UserName = "API Key User"
                    };
                }
            }

            var query = System.Web.HttpUtility.ParseQueryString(request.Url.Query);
            var queryKey = query[ApiKeyQueryParam];
            if (!string.IsNullOrEmpty(queryKey) && queryKey == _configuredApiKey)
            {
                _logger.LogDebug("API key validated from query parameter");
                return new TokenValidationResult
                {
                    IsValid = true,
                    UserId = "api-key-user",
                    UserName = "API Key User"
                };
            }
        }

        // Development mode bypass
        if (_isDevelopmentMode && !_entraIdValidation.IsAuthenticationEnabled)
        {
            _logger.LogDebug("Development mode - allowing request without credentials");
            return new TokenValidationResult
            {
                IsValid = true,
                UserId = "development-user",
                UserEmail = "dev@localhost",
                UserName = "Development User"
            };
        }

        _logger.LogWarning("Request validation failed - no valid credentials provided");
        return new TokenValidationResult
        {
            IsValid = false,
            ErrorMessage = "Authentication required. Provide a valid Bearer token or API key."
        };
    }
}

