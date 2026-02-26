using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BehavioralHealthSystem.Services;

public class KintsugiApiHealthCheck : IKintsugiApiHealthCheck
{
    private readonly ILogger<KintsugiApiHealthCheck> _logger;
    private readonly KintsugiApiOptions _options;
    private readonly IConfiguration _configuration;

    public KintsugiApiHealthCheck(
        ILogger<KintsugiApiHealthCheck> logger,
        IOptions<KintsugiApiOptions> options,
        IConfiguration configuration)
    {
        _logger = logger;
        _options = options.Value;
        _configuration = configuration;
    }

    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var useLocalDamModel = string.Equals(
                _configuration["USE_LOCAL_DAM_MODEL"],
                "true",
                StringComparison.OrdinalIgnoreCase);

            if (useLocalDamModel)
            {
                var localDamBaseUrl = _configuration["LOCAL_DAM_BASE_URL"];
                if (string.IsNullOrWhiteSpace(localDamBaseUrl))
                {
                    return Task.FromResult(HealthCheckResult.Unhealthy(
                        "Local DAM mode is enabled but LOCAL_DAM_BASE_URL is not configured"));
                }

                return Task.FromResult(HealthCheckResult.Healthy(
                    "Local DAM mode is enabled and configured"));
            }

            // Simple health check - verify API key is configured
            if (string.IsNullOrEmpty(_options.KintsugiApiKey) || _options.KintsugiApiKey == "your-api-key-here")
            {
                return Task.FromResult(HealthCheckResult.Unhealthy("Kintsugi API key is not properly configured"));
            }

            // You could add more comprehensive health checks here
            // For example, making a lightweight API call to verify connectivity

            return Task.FromResult(HealthCheckResult.Healthy("Kintsugi API service is configured"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Health check failed for Kintsugi API", nameof(CheckHealthAsync));
            return Task.FromResult(HealthCheckResult.Unhealthy("Kintsugi API health check failed", ex));
        }
    }
}
