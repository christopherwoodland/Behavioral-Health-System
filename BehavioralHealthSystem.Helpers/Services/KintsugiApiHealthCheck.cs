using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BehavioralHealthSystem.Services;

public class KintsugiApiHealthCheck : IHealthCheck
{
    private readonly IKintsugiApiService _kintsugiApiService;
    private readonly ILogger<KintsugiApiHealthCheck> _logger;
    private readonly KintsugiApiOptions _options;

    public KintsugiApiHealthCheck(
        IKintsugiApiService kintsugiApiService, 
        ILogger<KintsugiApiHealthCheck> logger,
        IOptions<KintsugiApiOptions> options)
    {
        _kintsugiApiService = kintsugiApiService;
        _logger = logger;
        _options = options.Value;
    }

    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
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
