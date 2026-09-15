using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Functions.Worker.Middleware;

namespace BehavioralHealthSystem.Functions.Services;

/// <summary>
/// CORS middleware for Azure Functions .NET isolated worker
/// </summary>
public class CorsMiddleware : IFunctionsWorkerMiddleware
{
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
                CorsPolicy.AddHeaders(preflightResponse, origin);

                // Set the response for preflight
                context.GetInvocationResult().Value = preflightResponse;
                return;
            }

            // Continue with the request
            try
            {
                await next(context);
            }
            catch (Exception)
            {
                // On error, try to add CORS headers so browser can read error response
                var errorResponse = context.GetInvocationResult().Value as HttpResponseData;
                if (errorResponse != null && !string.IsNullOrEmpty(origin))
                {
                    CorsPolicy.AddHeaders(errorResponse, origin);
                }
                throw;
            }

            // Add CORS headers to the response
            var response = context.GetInvocationResult().Value as HttpResponseData;
            if (response != null && !string.IsNullOrEmpty(origin))
            {
                CorsPolicy.AddHeaders(response, origin);
            }
        }
        else
        {
            await next(context);
        }
    }

}
