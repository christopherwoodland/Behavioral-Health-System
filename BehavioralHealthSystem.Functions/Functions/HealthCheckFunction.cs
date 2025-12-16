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
    private readonly IConfiguration _configuration;
    private readonly JsonSerializerOptions _jsonOptions;

    /// <summary>
    /// Initializes a new instance of the <see cref="HealthCheckFunction"/> class.
    /// </summary>
    /// <param name="logger">Logger for diagnostics and monitoring.</param>
    /// <param name="healthCheckService">Service for executing registered health checks.</param>
    /// <param name="configuration">Configuration for accessing app settings.</param>
    /// <exception cref="ArgumentNullException">Thrown when logger or healthCheckService is null.</exception>
    public HealthCheckFunction(
        ILogger<HealthCheckFunction> logger,
        HealthCheckService healthCheckService,
        IConfiguration configuration)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _healthCheckService = healthCheckService ?? throw new ArgumentNullException(nameof(healthCheckService));
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));

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

            // Get resource names from configuration
            var storageAccountName = _configuration["DSM5_STORAGE_ACCOUNT_NAME"]
                ?? _configuration["AZURE_STORAGE_ACCOUNT_NAME"]
                ?? "Not configured";
            var documentIntelligenceEndpoint = _configuration["DocumentIntelligenceEndpoint"] ?? "Not configured";
            var openAiEndpoint = _configuration["AZURE_OPENAI_ENDPOINT"] ?? "Not configured";

            var healthResult = new
            {
                Status = healthReport.Status.ToString(),
                TotalDuration = healthReport.TotalDuration.TotalMilliseconds,
                Resources = new
                {
                    StorageAccount = storageAccountName,
                    DocumentIntelligence = ExtractResourceName(documentIntelligenceEndpoint),
                    OpenAI = ExtractResourceName(openAiEndpoint)
                },
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

    /// <summary>
    /// Extracts the resource name from an Azure endpoint URL.
    /// </summary>
    /// <param name="endpoint">The full endpoint URL.</param>
    /// <returns>The resource name or the original value if extraction fails.</returns>
    private static string ExtractResourceName(string endpoint)
    {
        if (string.IsNullOrEmpty(endpoint) || endpoint == "Not configured")
            return endpoint;

        try
        {
            // Try to extract resource name from URLs like https://resource-name.openai.azure.com/
            if (Uri.TryCreate(endpoint, UriKind.Absolute, out var uri))
            {
                var host = uri.Host;
                var parts = host.Split('.');
                if (parts.Length > 0)
                    return parts[0];
            }
        }
        catch
        {
            // Fallback to returning the original endpoint
        }

        return endpoint;
    }
}
