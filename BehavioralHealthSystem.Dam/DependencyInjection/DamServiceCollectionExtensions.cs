using BehavioralHealthSystem.Configuration;

namespace BehavioralHealthSystem.Dam.Services;

public static class DamServiceCollectionExtensions
{
    /// <summary>
    /// Registers DAM HTTP client, options, and warmup hosted service.
    /// Reads LOCAL_DAM_* configuration keys from the supplied <paramref name="configuration"/>.
    /// </summary>
    public static IServiceCollection AddDamServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<LocalDamModelOptions>(options =>
        {
            options.BaseUrl = configuration["LOCAL_DAM_BASE_URL"] ?? "http://localhost:8000";
            options.InitiatePath = configuration["LOCAL_DAM_INITIATE_PATH"] ?? "initiate";
            options.PredictionPath = configuration["LOCAL_DAM_PREDICTION_PATH"] ?? "predict";
            options.ApiKey = configuration["LOCAL_DAM_API_KEY"];
            options.ModelId = configuration["LOCAL_DAM_MODEL_ID"] ?? "KintsugiHealth/dam";
            options.TimeoutSeconds = configuration.GetValue<int>("LOCAL_DAM_TIMEOUT_SECONDS", 300);
        });

        services.AddHttpClient<ILocalDamModelService, LocalDamModelService>()
            .ConfigureHttpClient((serviceProvider, client) =>
            {
                var options = serviceProvider.GetService<IOptions<LocalDamModelOptions>>()?.Value;
                if (options != null)
                {
                    client.BaseAddress = new Uri(options.BaseUrl.TrimEnd('/') + "/");
                    client.Timeout = TimeSpan.FromSeconds(Math.Max(30, options.TimeoutSeconds));
                    if (!string.IsNullOrWhiteSpace(options.ApiKey))
                    {
                        client.DefaultRequestHeaders.Remove("X-API-Key");
                        client.DefaultRequestHeaders.Add("X-API-Key", options.ApiKey);
                    }
                }
            })
            .AddPolicyHandler((serviceProvider, request) =>
                RetryPolicies.GetRetryPolicy(serviceProvider.GetService<ILogger<LocalDamModelService>>()));

        services.AddHostedService<LocalDamWarmupHostedService>();

        return services;
    }
}
