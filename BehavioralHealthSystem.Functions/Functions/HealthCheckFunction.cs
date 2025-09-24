using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BehavioralHealthSystem.Functions;

public class HealthCheckFunction
{
    private readonly ILogger<HealthCheckFunction> _logger;
    private readonly HealthCheckService _healthCheckService;
    private readonly JsonSerializerOptions _jsonOptions;

    public HealthCheckFunction(
        ILogger<HealthCheckFunction> logger,
        HealthCheckService healthCheckService)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _healthCheckService = healthCheckService ?? throw new ArgumentNullException(nameof(healthCheckService));
        
        _jsonOptions = JsonSerializerOptionsFactory.Default;
    }

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
