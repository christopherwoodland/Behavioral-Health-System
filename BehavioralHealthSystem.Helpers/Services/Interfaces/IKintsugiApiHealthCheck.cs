using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BehavioralHealthSystem.Services.Interfaces;

/// <summary>
/// Interface for Kintsugi API health check service
/// </summary>
public interface IKintsugiApiHealthCheck : IHealthCheck
{
    // IHealthCheck already defines CheckHealthAsync method
    // Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default);
}