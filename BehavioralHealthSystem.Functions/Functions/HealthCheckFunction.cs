using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BehavioralHealthSystem.Functions;

/// <summary>
/// Azure Function for system health monitoring and diagnostics.
/// Provides a comprehensive health check endpoint that verifies the status of all registered health checks.
/// </summary>
public class HealthCheckFunction
{
    private readonly ILogger<HealthCheckFunction> _logger;
    private readonly HealthCheckService _healthCheckService;
    private readonly JsonSerializerOptions _jsonOptions;

    /// <summary>
    /// Initializes a new instance of the <see cref="HealthCheckFunction"/> class.
    /// </summary>
    /// <param name="logger">Logger for diagnostics and monitoring.</param>
    /// <param name="healthCheckService">Service for executing registered health checks.</param>
    /// <exception cref="ArgumentNullException">Thrown when logger or healthCheckService is null.</exception>
    public HealthCheckFunction(
        ILogger<HealthCheckFunction> logger,
        HealthCheckService healthCheckService)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _healthCheckService = healthCheckService ?? throw new ArgumentNullException(nameof(healthCheckService));

        _jsonOptions = JsonSerializerOptionsFactory.Default;
    }

    /// <summary>
    /// HTTP endpoint for system health status.
    /// Returns comprehensive health information including status of all registered health checks,
    /// their durations, and any error details.
    /// </summary>
    /// <param name="req">The HTTP request containing health check parameters.</param>
    /// <returns>
    /// HTTP 200 (OK) if all health checks pass with detailed status information.
    /// HTTP 503 (Service Unavailable) if any health check fails.
    /// HTTP 500 (Internal Server Error) if the health check process itself fails.
    /// </returns>
    /// <remarks>
    /// Example response:
    /// <code>
    /// {
    ///   "Status": "Healthy",
    ///   "TotalDuration": 123.45,
    ///   "Entries": {
    ///     "DatabaseCheck": {
    ///       "Status": "Healthy",
    ///       "Description": "Database connection successful",
    ///       "Duration": 50.2
    ///     }
    ///   }
    /// }
    /// </code>
    /// </remarks>
    [Function("HealthCheck")]
    public async Task<HttpResponseData> HealthCheck(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health")] HttpRequestData req)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Health check requested", nameof(HealthCheck));

            var healthReport = await _healthCheckService.CheckHealthAsync();

            var response = req.CreateResponse(
                healthReport.Status == HealthStatus.Healthy ? HttpStatusCode.OK : HttpStatusCode.ServiceUnavailable);

            var healthResult = new
            {
                Status = healthReport.Status.ToString(),
                TotalDuration = healthReport.TotalDuration.TotalMilliseconds,
                Entries = healthReport.Entries.ToDictionary(
                    kvp => kvp.Key,
                    kvp => new
                    {
                        Status = kvp.Value.Status.ToString(),
                        kvp.Value.Description,
                        Duration = kvp.Value.Duration.TotalMilliseconds,
                        Exception = kvp.Value.Exception?.Message,
                        Data = kvp.Value.Data
                    })
            };

            await response.WriteStringAsync(JsonSerializer.Serialize(healthResult, _jsonOptions));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error during health check", nameof(HealthCheck));

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            var errorResult = new
            {
                Status = "Unhealthy",
                Error = "Health check failed",
                Message = ex.Message
            };

            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(errorResult, _jsonOptions));
            return errorResponse;
        }
    }
}
