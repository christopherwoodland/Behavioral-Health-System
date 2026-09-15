using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using System.Net;
using BehavioralHealthSystem.Functions.Services;

namespace BehavioralHealthSystem.Functions.Functions;

/// <summary>
/// Handles CORS preflight OPTIONS requests for all API endpoints
/// </summary>
public class CorsPreflightFunction
{
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

        CorsPolicy.AddHeaders(response, origin);

        return response;
    }

}
