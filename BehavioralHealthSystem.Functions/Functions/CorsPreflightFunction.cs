using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using System.Net;

namespace BehavioralHealthSystem.Functions.Functions;

/// <summary>
/// Handles CORS preflight OPTIONS requests for all API endpoints
/// </summary>
public class CorsPreflightFunction
{
    private static readonly string[] AllowedOrigins = new[]
    {
        "http://localhost:5173",
        "http://localhost:5174",
        "https://localhost:5173",
        "https://localhost:5174",
        "https://portal.azure.com"
    };

    /// <summary>
    /// Catch-all handler for OPTIONS preflight requests
    /// </summary>
    [Function("CorsPreflightHandler")]
    public HttpResponseData HandlePreflight(
        [HttpTrigger(AuthorizationLevel.Anonymous, "options", Route = "{*path}")] HttpRequestData req)
    {
        var response = req.CreateResponse(HttpStatusCode.OK);

        var origin = req.Headers.TryGetValues("Origin", out var originValues)
            ? originValues.FirstOrDefault()
            : null;

        AddCorsHeaders(response, origin);

        return response;
    }

    private static void AddCorsHeaders(HttpResponseData response, string? origin)
    {
        var allowedOrigin = "*";
        if (!string.IsNullOrEmpty(origin))
        {
            var allowedOriginsEnv = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS");
            var originsToCheck = !string.IsNullOrEmpty(allowedOriginsEnv)
                ? allowedOriginsEnv.Split(',', StringSplitOptions.RemoveEmptyEntries)
                : AllowedOrigins;

            if (originsToCheck.Any(o => o.Equals(origin, StringComparison.OrdinalIgnoreCase)))
            {
                allowedOrigin = origin;
            }
        }

        response.Headers.Add("Access-Control-Allow-Origin", allowedOrigin);
        response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
        response.Headers.Add("Access-Control-Allow-Credentials", "true");
        response.Headers.Add("Access-Control-Max-Age", "86400");
    }
}
