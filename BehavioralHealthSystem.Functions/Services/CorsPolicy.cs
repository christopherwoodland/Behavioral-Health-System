using Microsoft.Azure.Functions.Worker.Http;

namespace BehavioralHealthSystem.Functions.Services;

public static class CorsPolicy
{
    private static readonly string[] DefaultAllowedOrigins =
    [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "https://localhost:3000",
        "https://localhost:5173",
        "https://localhost:5174",
        "https://localhost:5175",
        "https://127.0.0.1:3000",
        "https://127.0.0.1:5173",
        "https://127.0.0.1:5174",
        "https://127.0.0.1:5175",
        "https://portal.azure.com"
    ];

    public static bool IsOriginAllowed(string? origin)
    {
        if (string.IsNullOrWhiteSpace(origin))
        {
            return false;
        }

        var configuredOrigins = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS");
        var allowedOrigins = string.IsNullOrWhiteSpace(configuredOrigins)
            ? DefaultAllowedOrigins
            : configuredOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return allowedOrigins.Any(allowedOrigin =>
            allowedOrigin.Equals(origin, StringComparison.OrdinalIgnoreCase));
    }

    public static void AddHeaders(HttpResponseData response, string? origin)
    {
        if (!IsOriginAllowed(origin))
        {
            return;
        }

        response.Headers.Remove("Access-Control-Allow-Origin");
        response.Headers.Remove("Access-Control-Allow-Methods");
        response.Headers.Remove("Access-Control-Allow-Headers");
        response.Headers.Remove("Access-Control-Allow-Credentials");
        response.Headers.Remove("Access-Control-Max-Age");

        response.Headers.Add("Access-Control-Allow-Origin", origin!);
        response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
        response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key, X-User-ID, X-User-Principal");
        response.Headers.Add("Access-Control-Allow-Credentials", "true");
        response.Headers.Add("Access-Control-Max-Age", "86400");
    }
}
