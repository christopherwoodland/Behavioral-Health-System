namespace BehavioralHealthSystem.Functions.Services;

public sealed class LocalDamWarmupHostedService : IHostedService
{
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IOptions<LocalDamModelOptions> _localDamOptions;
    private readonly ILogger<LocalDamWarmupHostedService> _logger;

    public LocalDamWarmupHostedService(
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        IOptions<LocalDamModelOptions> localDamOptions,
        ILogger<LocalDamWarmupHostedService> logger)
    {
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        _httpClientFactory = httpClientFactory ?? throw new ArgumentNullException(nameof(httpClientFactory));
        _localDamOptions = localDamOptions ?? throw new ArgumentNullException(nameof(localDamOptions));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!UseLocalDamModel())
        {
            _logger.LogInformation("[{ServiceName}] Skipping local DAM warmup because USE_LOCAL_DAM_MODEL is disabled", nameof(LocalDamWarmupHostedService));
            return;
        }

        var warmupEnabled = _configuration.GetValue("LOCAL_DAM_WARMUP_ON_STARTUP", true);
        if (!warmupEnabled)
        {
            _logger.LogInformation("[{ServiceName}] Skipping local DAM warmup because LOCAL_DAM_WARMUP_ON_STARTUP is disabled", nameof(LocalDamWarmupHostedService));
            return;
        }

        var options = _localDamOptions.Value;
        var healthPath = (_configuration["LOCAL_DAM_HEALTH_PATH"] ?? "health").TrimStart('/');
        var warmupTimeoutSeconds = Math.Max(30, _configuration.GetValue("LOCAL_DAM_WARMUP_TIMEOUT_SECONDS", 600));
        var warmupPollSeconds = Math.Clamp(_configuration.GetValue("LOCAL_DAM_WARMUP_POLL_SECONDS", 5), 1, 30);

        var healthUri = new Uri(new Uri(options.BaseUrl.TrimEnd('/') + "/"), healthPath);
        var deadline = DateTime.UtcNow.AddSeconds(warmupTimeoutSeconds);

        _logger.LogInformation(
            "[{ServiceName}] Waiting for local DAM readiness at {HealthUri}. TimeoutSeconds={TimeoutSeconds}, PollSeconds={PollSeconds}",
            nameof(LocalDamWarmupHostedService),
            healthUri,
            warmupTimeoutSeconds,
            warmupPollSeconds);

        var client = _httpClientFactory.CreateClient(nameof(LocalDamWarmupHostedService));
        client.Timeout = TimeSpan.FromSeconds(Math.Max(5, Math.Min(30, warmupPollSeconds * 2)));

        Exception? lastError = null;

        while (DateTime.UtcNow < deadline)
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                using var response = await client.GetAsync(healthUri, cancellationToken);
                var content = await response.Content.ReadAsStringAsync(cancellationToken);

                if (response.IsSuccessStatusCode && IsPipelineLoaded(content))
                {
                    _logger.LogInformation(
                        "[{ServiceName}] Local DAM is ready and pipeline is loaded. Health={HealthContent}",
                        nameof(LocalDamWarmupHostedService),
                        content);
                    return;
                }

                _logger.LogInformation(
                    "[{ServiceName}] Local DAM not ready yet. StatusCode={StatusCode}, Health={HealthContent}",
                    nameof(LocalDamWarmupHostedService),
                    (int)response.StatusCode,
                    content);
            }
            catch (Exception ex)
            {
                lastError = ex;
                _logger.LogWarning(
                    ex,
                    "[{ServiceName}] Local DAM warmup probe failed at {HealthUri}",
                    nameof(LocalDamWarmupHostedService),
                    healthUri);
            }

            await Task.Delay(TimeSpan.FromSeconds(warmupPollSeconds), cancellationToken);
        }

        throw new InvalidOperationException(
            $"Local DAM warmup timed out after {warmupTimeoutSeconds} seconds while waiting for pipeline=loaded at {healthUri}."
            + (lastError is null ? string.Empty : $" Last error: {lastError.Message}"));
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private bool UseLocalDamModel()
    {
        var value = _configuration["USE_LOCAL_DAM_MODEL"] ?? _configuration["Values:USE_LOCAL_DAM_MODEL"];
        return bool.TryParse(value, out var parsed) && parsed;
    }

    private static bool IsPipelineLoaded(string healthContent)
    {
        if (string.IsNullOrWhiteSpace(healthContent))
        {
            return false;
        }

        try
        {
            using var json = JsonDocument.Parse(healthContent);
            var root = json.RootElement;

            if (!root.TryGetProperty("status", out var statusElement) ||
                !string.Equals(statusElement.GetString(), "ok", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (!root.TryGetProperty("pipeline", out var pipelineElement))
            {
                return true;
            }

            return string.Equals(pipelineElement.GetString(), "loaded", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }
}
