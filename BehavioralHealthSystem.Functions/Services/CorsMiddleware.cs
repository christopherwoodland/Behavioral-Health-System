using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Functions.Worker.Middleware;

namespace BehavioralHealthSystem.Functions.Services;

/// <summary>
/// CORS middleware for Azure Functions .NET isolated worker
/// </summary>
public class CorsMiddleware : IFunctionsWorkerMiddleware
{
    private static readonly string[] AllowedOrigins = new[]
    {
        "http://localhost:5173",
        "http://localhost:5174",
        "https://localhost:5173",
        "https://localhost:5174",
        "https://portal.azure.com"
    };

    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        // Get the request
        var requestData = await context.GetHttpRequestDataAsync();

        if (requestData != null)
        {
            var origin = requestData.Headers.TryGetValues("Origin", out var originValues)
                ? originValues.FirstOrDefault()
                : null;

            // Handle preflight OPTIONS request
            if (requestData.Method.Equals("OPTIONS", StringComparison.OrdinalIgnoreCase))
            {
                var preflightResponse = requestData.CreateResponse(System.Net.HttpStatusCode.OK);
                AddCorsHeaders(preflightResponse, origin);

                // Set the response for preflight
                context.GetInvocationResult().Value = preflightResponse;
                return;
            }

            // Continue with the request
            await next(context);

            // Add CORS headers to the response
            var response = context.GetInvocationResult().Value as HttpResponseData;
            if (response != null && !string.IsNullOrEmpty(origin))
            {
                AddCorsHeaders(response, origin);
            }
        }
        else
        {
            await next(context);
        }
    }

    private static void AddCorsHeaders(HttpResponseData response, string? origin)
    {
        // Check if origin is allowed
        var allowedOrigin = "*";
        if (!string.IsNullOrEmpty(origin))
        {
            // Check against allowed origins or environment variable
            var allowedOriginsEnv = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS");
            var originsToCheck = !string.IsNullOrEmpty(allowedOriginsEnv)
                ? allowedOriginsEnv.Split(',', StringSplitOptions.RemoveEmptyEntries)
                : AllowedOrigins;

            if (originsToCheck.Any(o => o.Equals(origin, StringComparison.OrdinalIgnoreCase)))
            {
                allowedOrigin = origin;
            }
        }

        // Remove existing headers if any
        response.Headers.Remove("Access-Control-Allow-Origin");
        response.Headers.Remove("Access-Control-Allow-Methods");
        response.Headers.Remove("Access-Control-Allow-Headers");
        response.Headers.Remove("Access-Control-Allow-Credentials");

        // Add CORS headers
        response.Headers.Add("Access-Control-Allow-Origin", allowedOrigin);
        response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
        response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key");
        response.Headers.Add("Access-Control-Allow-Credentials", "true");
    }
}
