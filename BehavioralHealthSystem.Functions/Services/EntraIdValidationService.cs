using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using FunctionsHttpRequestData = Microsoft.Azure.Functions.Worker.Http.HttpRequestData;

namespace BehavioralHealthSystem.Functions.Services;

/// <summary>
/// Configuration options for Entra ID (Azure AD) authentication
/// </summary>
public class EntraIdOptions
{
    public string TenantId { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public bool ValidateIssuer { get; set; } = true;
    public bool ValidateAudience { get; set; } = true;
    public bool ValidateLifetime { get; set; } = true;
}

/// <summary>
/// Result of token validation
/// </summary>
public class TokenValidationResult
{
    public bool IsValid { get; set; }
    public ClaimsPrincipal? Principal { get; set; }
    public string? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
    public string? ErrorMessage { get; set; }
    public IEnumerable<string> Roles { get; set; } = Array.Empty<string>();
}

/// <summary>
/// Interface for Entra ID token validation
/// </summary>
public interface IEntraIdValidationService
{
    /// <summary>
    /// Validates an Azure AD/Entra ID JWT token from the request
    /// </summary>
    Task<TokenValidationResult> ValidateTokenAsync(FunctionsHttpRequestData request);

    /// <summary>
    /// Checks if authentication is enabled
    /// </summary>
    bool IsAuthenticationEnabled { get; }

    /// <summary>
    /// Checks if running in development mode (authentication may be bypassed)
    /// </summary>
    bool IsDevelopmentMode { get; }
}

/// <summary>
/// Service for validating Azure AD/Entra ID JWT bearer tokens
/// </summary>
public class EntraIdValidationService : IEntraIdValidationService
{
    private readonly ILogger<EntraIdValidationService> _logger;
    private readonly EntraIdOptions _options;
    private readonly bool _isDevelopmentMode;
    private readonly bool _isAuthenticationEnabled;
    private readonly ConfigurationManager<OpenIdConnectConfiguration>? _configManager;
    private readonly JwtSecurityTokenHandler _tokenHandler;

    public EntraIdValidationService(ILogger<EntraIdValidationService> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _tokenHandler = new JwtSecurityTokenHandler();

        // Check if we're in development mode
        var environment = Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT")
                       ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
                       ?? "Production";

        _isDevelopmentMode = environment.Equals("Development", StringComparison.OrdinalIgnoreCase);

        // Load Entra ID configuration from environment variables
        _options = new EntraIdOptions
        {
            TenantId = Environment.GetEnvironmentVariable("ENTRA_TENANT_ID") ?? string.Empty,
            ClientId = Environment.GetEnvironmentVariable("ENTRA_CLIENT_ID") ?? string.Empty,
            Audience = Environment.GetEnvironmentVariable("ENTRA_AUDIENCE")
                    ?? Environment.GetEnvironmentVariable("ENTRA_CLIENT_ID")
                    ?? string.Empty
        };

        // Authentication is enabled if we have the required configuration
        _isAuthenticationEnabled = !string.IsNullOrEmpty(_options.TenantId) && !string.IsNullOrEmpty(_options.ClientId);

        if (_isAuthenticationEnabled)
        {
            // Set up OpenID Connect configuration manager for token validation
            var metadataAddress = $"https://login.microsoftonline.com/{_options.TenantId}/v2.0/.well-known/openid-configuration";
            _configManager = new ConfigurationManager<OpenIdConnectConfiguration>(
                metadataAddress,
                new OpenIdConnectConfigurationRetriever(),
                new HttpDocumentRetriever());

            _logger.LogInformation("Entra ID authentication enabled for tenant: {TenantId}", _options.TenantId);
        }
        else if (_isDevelopmentMode)
        {
            _logger.LogInformation("Entra ID authentication NOT configured - running in development mode, auth will be bypassed");
        }
        else
        {
            _logger.LogWarning("Entra ID authentication NOT configured - set ENTRA_TENANT_ID and ENTRA_CLIENT_ID environment variables");
        }
    }

    public bool IsAuthenticationEnabled => _isAuthenticationEnabled;
    public bool IsDevelopmentMode => _isDevelopmentMode;

    public async Task<TokenValidationResult> ValidateTokenAsync(FunctionsHttpRequestData request)
    {
        // In development mode without auth configured, allow all requests
        if (_isDevelopmentMode && !_isAuthenticationEnabled)
        {
            _logger.LogDebug("Development mode - skipping token validation");
            return new TokenValidationResult
            {
                IsValid = true,
                UserId = "development-user",
                UserEmail = "dev@localhost",
                UserName = "Development User"
            };
        }

        // Extract bearer token from Authorization header
        var authHeader = request.Headers.TryGetValues("Authorization", out var authValues)
            ? authValues.FirstOrDefault()
            : null;

        if (string.IsNullOrEmpty(authHeader))
        {
            _logger.LogDebug("No Authorization header present");
            return new TokenValidationResult
            {
                IsValid = false,
                ErrorMessage = "Authorization header is required"
            };
        }

        if (!authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogDebug("Authorization header is not a Bearer token");
            return new TokenValidationResult
            {
                IsValid = false,
                ErrorMessage = "Authorization header must use Bearer scheme"
            };
        }

        var token = authHeader.Substring("Bearer ".Length).Trim();

        if (string.IsNullOrEmpty(token))
        {
            _logger.LogDebug("Bearer token is empty");
            return new TokenValidationResult
            {
                IsValid = false,
                ErrorMessage = "Bearer token is empty"
            };
        }

        try
        {
            // Get OpenID Connect configuration (signing keys, etc.)
            var config = await _configManager!.GetConfigurationAsync(CancellationToken.None);

            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuer = _options.ValidateIssuer,
                ValidIssuers = new[]
                {
                    $"https://login.microsoftonline.com/{_options.TenantId}/v2.0",
                    $"https://sts.windows.net/{_options.TenantId}/"
                },
                ValidateAudience = _options.ValidateAudience,
                ValidAudiences = new[]
                {
                    _options.Audience,
                    _options.ClientId,
                    $"api://{_options.ClientId}"
                },
                ValidateLifetime = _options.ValidateLifetime,
                ValidateIssuerSigningKey = true,
                IssuerSigningKeys = config.SigningKeys,
                ClockSkew = TimeSpan.FromMinutes(5)
            };

            var principal = _tokenHandler.ValidateToken(token, validationParameters, out var validatedToken);

            // Extract user information from claims
            var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
                      ?? principal.FindFirst("oid")?.Value
                      ?? principal.FindFirst("sub")?.Value;

            var userEmail = principal.FindFirst(ClaimTypes.Email)?.Value
                         ?? principal.FindFirst("email")?.Value
                         ?? principal.FindFirst("preferred_username")?.Value;

            var userName = principal.FindFirst(ClaimTypes.Name)?.Value
                        ?? principal.FindFirst("name")?.Value;

            // Extract roles from token
            var roles = principal.FindAll(ClaimTypes.Role)
                .Concat(principal.FindAll("roles"))
                .Select(c => c.Value)
                .Distinct()
                .ToList();

            _logger.LogDebug("Token validated successfully for user: {UserId} ({UserEmail})", userId, userEmail);

            return new TokenValidationResult
            {
                IsValid = true,
                Principal = principal,
                UserId = userId,
                UserEmail = userEmail,
                UserName = userName,
                Roles = roles
            };
        }
        catch (SecurityTokenExpiredException ex)
        {
            _logger.LogWarning("Token has expired: {Message}", ex.Message);
            return new TokenValidationResult
            {
                IsValid = false,
                ErrorMessage = "Token has expired"
            };
        }
        catch (SecurityTokenInvalidSignatureException ex)
        {
            _logger.LogWarning("Invalid token signature: {Message}", ex.Message);
            return new TokenValidationResult
            {
                IsValid = false,
                ErrorMessage = "Invalid token signature"
            };
        }
        catch (SecurityTokenInvalidAudienceException ex)
        {
            _logger.LogWarning("Invalid token audience: {Message}", ex.Message);
            return new TokenValidationResult
            {
                IsValid = false,
                ErrorMessage = "Invalid token audience"
            };
        }
        catch (SecurityTokenInvalidIssuerException ex)
        {
            _logger.LogWarning("Invalid token issuer: {Message}", ex.Message);
            return new TokenValidationResult
            {
                IsValid = false,
                ErrorMessage = "Invalid token issuer"
            };
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogWarning("Token validation failed: {Message}", ex.Message);
            return new TokenValidationResult
            {
                IsValid = false,
                ErrorMessage = $"Token validation failed: {ex.Message}"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during token validation");
            return new TokenValidationResult
            {
                IsValid = false,
                ErrorMessage = "An error occurred during token validation"
            };
        }
    }
}
