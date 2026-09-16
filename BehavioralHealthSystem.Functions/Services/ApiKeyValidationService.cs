using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace BehavioralHealthSystem.Functions.Services;

public class TokenValidationResult
{
    public bool IsValid { get; set; }
    public ClaimsPrincipal? Principal { get; set; }
    public string? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
    public string? ErrorMessage { get; set; }
    public IEnumerable<string> Roles { get; set; } = Array.Empty<string>();
    public HttpStatusCode FailureStatusCode { get; set; } = HttpStatusCode.Unauthorized;
}

/// <summary>
/// Service for consuming App Service EasyAuth identity or API keys.
/// EasyAuth performs token validation before requests reach this process.
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
    /// Validates trusted EasyAuth identity or the configured non-EasyAuth API key.
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
    private readonly string? _configuredApiKey;
    private readonly bool _isDevelopmentMode;
    private readonly bool _isAirGapMode;
    private readonly bool _isAirGapBypassActive;
    private readonly bool _isEasyAuthEnabled;

    private const string ApiKeyHeaderName = "X-API-Key";
    private const string ApiKeyQueryParam = "code";
    private const string EasyAuthPrincipalHeaderName = "X-MS-CLIENT-PRINCIPAL";
    private const string EasyAuthIdentityProviderHeaderName = "X-MS-CLIENT-PRINCIPAL-IDP";
    private const string RequiredDelegatedScope = "access_as_user";

    public ApiKeyValidationService(ILogger<ApiKeyValidationService> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        // Check if we're in development mode
        var environment = Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT")
                       ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                       ?? "Production";

        _isDevelopmentMode = environment.Equals("Development", StringComparison.OrdinalIgnoreCase);
        _isAirGapMode =
            string.Equals(Environment.GetEnvironmentVariable("AIR_GAP_MODE"), "true", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Environment.GetEnvironmentVariable("ENABLE_AIR_GAP"), "true", StringComparison.OrdinalIgnoreCase);
        _isAirGapBypassActive =
            _isAirGapMode
            && (
                _isDevelopmentMode
                || string.Equals(Environment.GetEnvironmentVariable("AIR_GAP_AUTH_BYPASS_APPROVED"), "true", StringComparison.OrdinalIgnoreCase)
            );
        _isEasyAuthEnabled = string.Equals(
            Environment.GetEnvironmentVariable("WEBSITE_AAD_ENABLE_MISE"),
            "true",
            StringComparison.OrdinalIgnoreCase);

        // Get the configured API key (fallback for non-browser clients)
        _configuredApiKey = Environment.GetEnvironmentVariable("FUNCTIONS_API_KEY");

        if (_isDevelopmentMode)
        {
            _logger.LogInformation("API validation running in DEVELOPMENT mode");
        }

        if (_isAirGapBypassActive)
        {
            _logger.LogInformation("API validation running in AIR_GAP_MODE (auth bypass enabled by configuration)");
        }
        else if (_isAirGapMode)
        {
            _logger.LogInformation("AIR_GAP_MODE enabled without bypass approval - API validation remains required.");
        }

        if (_isEasyAuthEnabled)
        {
            _logger.LogInformation("App Service EasyAuth authentication is enabled");
        }
    }

    public bool IsDevelopmentMode => _isDevelopmentMode;

    /// <summary>
    /// Sync validation for existing call sites.
    /// </summary>
    public bool ValidateApiKey(HttpRequestData request)
    {
        if (_isAirGapBypassActive)
        {
            _logger.LogDebug("AIR_GAP_MODE - skipping API key validation");
            return true;
        }

        // Skip validation in development mode if auth is not configured
        if (_isDevelopmentMode && !_isEasyAuthEnabled)
        {
            _logger.LogDebug("Development mode - skipping API key validation");
            return true;
        }

        if (_isEasyAuthEnabled)
        {
            return TryGetEasyAuthPrincipal(request, out _);
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
    /// Full validation result for authorization-aware call sites.
    /// </summary>
    public Task<TokenValidationResult> ValidateRequestAsync(HttpRequestData request)
    {
        if (_isAirGapBypassActive)
        {
            _logger.LogDebug("AIR_GAP_MODE - allowing request without credentials");
            return Task.FromResult(new TokenValidationResult
            {
                IsValid = true,
                UserId = "air-gap-user",
                UserEmail = "airgap@localhost",
                UserName = "Air Gap User"
            });
        }

        if (_isEasyAuthEnabled)
        {
            TryGetEasyAuthPrincipal(request, out var easyAuthResult);
            return Task.FromResult(easyAuthResult);
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
                    return Task.FromResult(new TokenValidationResult
                    {
                        IsValid = true,
                        UserId = "api-key-user",
                        UserName = "API Key User"
                    });
                }
            }

            var query = System.Web.HttpUtility.ParseQueryString(request.Url.Query);
            var queryKey = query[ApiKeyQueryParam];
            if (!string.IsNullOrEmpty(queryKey) && queryKey == _configuredApiKey)
            {
                _logger.LogDebug("API key validated from query parameter");
                return Task.FromResult(new TokenValidationResult
                {
                    IsValid = true,
                    UserId = "api-key-user",
                    UserName = "API Key User"
                });
            }
        }

        // Development mode bypass
        if (_isDevelopmentMode)
        {
            _logger.LogDebug("Development mode - allowing request without credentials");
            return Task.FromResult(new TokenValidationResult
            {
                IsValid = true,
                UserId = "development-user",
                UserEmail = "dev@localhost",
                UserName = "Development User"
            });
        }

        _logger.LogWarning("Request validation failed - no valid credentials provided");
        return Task.FromResult(new TokenValidationResult
        {
            IsValid = false,
            ErrorMessage = "Authentication required. Provide a valid API key."
        });
    }

    private bool TryGetEasyAuthPrincipal(HttpRequestData request, out TokenValidationResult result)
    {
        result = new TokenValidationResult
        {
            IsValid = false,
            ErrorMessage = "An authenticated EasyAuth principal is required."
        };

        if (!request.Headers.TryGetValues(EasyAuthPrincipalHeaderName, out var values))
        {
            _logger.LogWarning("EasyAuth is enabled but no client principal header was provided.");
            return false;
        }

        var encodedPrincipal = values.FirstOrDefault();
        if (string.IsNullOrWhiteSpace(encodedPrincipal))
        {
            return false;
        }

        try
        {
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(encodedPrincipal));
            var easyAuthPrincipal = JsonSerializer.Deserialize<EasyAuthPrincipal>(json);
            var identityProvider = request.Headers.TryGetValues(EasyAuthIdentityProviderHeaderName, out var providerValues)
                ? providerValues.FirstOrDefault()
                : null;
            var isEntraIdentity = string.Equals(identityProvider, "aad", StringComparison.OrdinalIgnoreCase)
                || string.Equals(easyAuthPrincipal?.AuthenticationType, "aad", StringComparison.OrdinalIgnoreCase);
            if (easyAuthPrincipal is null || !isEntraIdentity)
            {
                result.ErrorMessage = "The EasyAuth principal is not an Entra ID identity.";
                return false;
            }

            var claims = easyAuthPrincipal.Claims
                .Where(claim => !string.IsNullOrWhiteSpace(claim.Type))
                .Select(claim => new Claim(claim.Type, claim.Value ?? string.Empty))
                .ToList();
            var scopes = claims
                .Where(claim => claim.Type is "scp" or "http://schemas.microsoft.com/identity/claims/scope")
                .SelectMany(claim => claim.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries));
            if (!scopes.Contains(RequiredDelegatedScope, StringComparer.Ordinal))
            {
                result.ErrorMessage = $"The {RequiredDelegatedScope} delegated scope is required.";
                result.FailureStatusCode = HttpStatusCode.Forbidden;
                return false;
            }

            var identity = new ClaimsIdentity(claims, "aad");
            var principal = new ClaimsPrincipal(identity);
            var userId = FindClaimValue(
                principal,
                "oid",
                "http://schemas.microsoft.com/identity/claims/objectidentifier",
                ClaimTypes.NameIdentifier,
                "sub");
            if (string.IsNullOrWhiteSpace(userId))
            {
                result.ErrorMessage = "The EasyAuth principal has no stable user identifier.";
                return false;
            }

            var roles = claims
                .Where(claim => claim.Type is "roles" or ClaimTypes.Role)
                .Select(claim => claim.Value)
                .Distinct(StringComparer.Ordinal)
                .ToArray();

            result = new TokenValidationResult
            {
                IsValid = true,
                Principal = principal,
                UserId = userId,
                UserEmail = FindClaimValue(principal, "preferred_username", "email", ClaimTypes.Email),
                UserName = FindClaimValue(principal, "name", ClaimTypes.Name),
                Roles = roles
            };
            return true;
        }
        catch (FormatException ex)
        {
            _logger.LogWarning(ex, "EasyAuth client principal header was not valid base64.");
            result.ErrorMessage = "The EasyAuth principal header is malformed.";
            return false;
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "EasyAuth client principal header was not valid JSON.");
            result.ErrorMessage = "The EasyAuth principal header is malformed.";
            return false;
        }
    }

    private static string? FindClaimValue(ClaimsPrincipal principal, params string[] claimTypes)
    {
        foreach (var claimType in claimTypes)
        {
            var value = principal.FindFirst(claimType)?.Value;
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return null;
    }

    private sealed class EasyAuthPrincipal
    {
        [JsonPropertyName("auth_typ")]
        public string? AuthenticationType { get; init; }

        [JsonPropertyName("claims")]
        public IReadOnlyList<EasyAuthClaim> Claims { get; init; } = Array.Empty<EasyAuthClaim>();
    }

    private sealed class EasyAuthClaim
    {
        [JsonPropertyName("typ")]
        public string Type { get; init; } = string.Empty;

        [JsonPropertyName("val")]
        public string? Value { get; init; }
    }
}

