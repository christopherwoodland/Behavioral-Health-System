using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using Azure.Storage.Blobs;
using BehavioralHealthSystem.Agents.DependencyInjection;
using BehavioralHealthSystem.Configuration;
using BehavioralHealthSystem.Functions.Services;
using BehavioralHealthSystem.Helpers.Models;
using BehavioralHealthSystem.Helpers.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

// Helper to get secrets from Key Vault
SecretClient? GetKeyVaultClient(IConfiguration config)
{
    // Try KEY_VAULT_URI first (from Bicep), then KEY_VAULT_URL for backwards compatibility
    var keyVaultUrl = config["KEY_VAULT_URI"] ?? config["KEY_VAULT_URL"];
    if (string.IsNullOrWhiteSpace(keyVaultUrl))
    {
        return null;
    }
    try
    {
        return new SecretClient(new Uri(keyVaultUrl), new DefaultAzureCredential());
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Warning: Could not create Key Vault client: {ex.Message}");
        return null;
    }
}

string? GetSecretFromKeyVault(SecretClient? client, string secretName, string? fallbackValue = null)
{
    if (client == null) return fallbackValue;
    try
    {
        var secret = client.GetSecret(secretName);
        return secret.Value?.Value ?? fallbackValue;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Warning: Could not retrieve {secretName} from Key Vault: {ex.Message}");
        return fallbackValue;
    }
}

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults(worker =>
    {
        // Add CORS middleware
        worker.UseMiddleware<BehavioralHealthSystem.Functions.Services.CorsMiddleware>();
    })
    .ConfigureServices((context, services) =>
    {
        var config = context.Configuration;
        var keyVaultClient = GetKeyVaultClient(config);

        // Configuration
        services.Configure<KintsugiApiOptions>(options =>
        {
            // Try environment variable first, then Key Vault
            var apiKey = config["KINTSUGI_API_KEY"];
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                // Try with both naming conventions (underscores and dashes)
                apiKey = GetSecretFromKeyVault(keyVaultClient, "KintsugiApiKey");
                if (string.IsNullOrWhiteSpace(apiKey))
                {
                    apiKey = GetSecretFromKeyVault(keyVaultClient, "KINTSUGI-API-KEY");
                }
            }

            var baseUrl = config["KINTSUGI_BASE_URL"];
            bool? autoProvideConsent = null;
            var rawConsent = config["KINTSUGI_AUTO_PROVIDE_CONSENT"];
            if (!string.IsNullOrWhiteSpace(rawConsent) && bool.TryParse(rawConsent, out var parsed))
            {
                autoProvideConsent = parsed;
            }
            options.KintsugiApiKey = apiKey ?? string.Empty;
            options.KintsugiBaseUrl = baseUrl ?? "https://api.kintsugihealth.com/v2";
            options.TimeoutSeconds = config.GetValue<int>("KINTSUGI_TIMEOUT_SECONDS", 300);
            options.MaxRetryAttempts = config.GetValue<int>("KINTSUGI_MAX_RETRY_ATTEMPTS", 3);
            options.RetryDelayMilliseconds = config.GetValue<int>("KINTSUGI_RETRY_DELAY_MS", 1000);
            if (autoProvideConsent.HasValue)
            {
                options.AutoProvideConsent = autoProvideConsent.Value;
            }
        });

        services.Configure<LocalDamModelOptions>(options =>
        {
            options.BaseUrl = config["LOCAL_DAM_BASE_URL"] ?? "http://localhost:8000";
            options.InitiatePath = config["LOCAL_DAM_INITIATE_PATH"] ?? "initiate";
            options.PredictionPath = config["LOCAL_DAM_PREDICTION_PATH"] ?? "predict";
            options.ApiKey = config["LOCAL_DAM_API_KEY"];
            options.ModelId = config["LOCAL_DAM_MODEL_ID"] ?? "KintsugiHealth/dam";
            options.TimeoutSeconds = config.GetValue<int>("LOCAL_DAM_TIMEOUT_SECONDS", 300);
        });

        // Azure OpenAI Configuration
        services.Configure<AzureOpenAIOptions>(options =>
        {
            var config = context.Configuration;
            options.Endpoint = config["AZURE_OPENAI_ENDPOINT"] ?? string.Empty;
            options.ApiKey = config["AZURE_OPENAI_API_KEY"] ?? string.Empty;
            options.DeploymentName = config["AZURE_OPENAI_DEPLOYMENT"] ?? "gpt-4o";
            options.ApiVersion = config["AZURE_OPENAI_API_VERSION"] ?? "2024-02-01";
            options.MaxTokens = config.GetValue<int>("AZURE_OPENAI_MAX_TOKENS", 1500);
            options.Temperature = config.GetValue<double>("AZURE_OPENAI_TEMPERATURE", 0.3);
            options.Enabled = config.GetValue<bool>("AZURE_OPENAI_ENABLED", false);
        });

        // Extended Assessment (GPT-5/O3) Configuration
        services.Configure<ExtendedAssessmentOpenAIOptions>(options =>
        {
            var config = context.Configuration;
            options.Endpoint = config["EXTENDED_ASSESSMENT_OPENAI_ENDPOINT"] ?? string.Empty;
            options.ApiKey = config["EXTENDED_ASSESSMENT_OPENAI_API_KEY"] ?? string.Empty;
            options.DeploymentName = config["EXTENDED_ASSESSMENT_OPENAI_DEPLOYMENT"] ?? string.Empty;
            options.ApiVersion = config["EXTENDED_ASSESSMENT_OPENAI_API_VERSION"] ?? "2024-08-01-preview";
            options.MaxTokens = config.GetValue<int>("EXTENDED_ASSESSMENT_OPENAI_MAX_TOKENS", 4000);
            options.Temperature = config.GetValue<double>("EXTENDED_ASSESSMENT_OPENAI_TEMPERATURE", 0.2);
            options.TimeoutSeconds = config.GetValue<int>("EXTENDED_ASSESSMENT_OPENAI_TIMEOUT_SECONDS", 120);
            options.Enabled = config.GetValue<bool>("EXTENDED_ASSESSMENT_OPENAI_ENABLED", false);
            options.UseFallbackToStandardConfig = config.GetValue<bool>("EXTENDED_ASSESSMENT_USE_FALLBACK", true);
        });

        // HTTP Client with policies - Simplified configuration
        services.AddHttpClient<IKintsugiApiService, KintsugiApiService>()
            .ConfigureHttpClient((serviceProvider, client) =>
            {
                try
                {
                    var options = serviceProvider.GetService<IOptions<KintsugiApiOptions>>()?.Value;
                    if (options != null && !string.IsNullOrEmpty(options.KintsugiBaseUrl))
                    {
                        var baseUrl = options.KintsugiBaseUrl.TrimEnd('/') + "/";
                        client.BaseAddress = new Uri(baseUrl);
                    }
                    client.DefaultRequestHeaders.Accept.Clear();
                    client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                    if (options != null && !string.IsNullOrEmpty(options.KintsugiApiKey))
                    {
                        client.DefaultRequestHeaders.Add("X-API-Key", options.KintsugiApiKey);
                    }
                    client.Timeout = TimeSpan.FromMinutes(5);
                }
                catch (Exception)
                {
                    client.Timeout = TimeSpan.FromMinutes(5);
                }
            })
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler())
            .AddPolicyHandler((serviceProvider, request) => RetryPolicies.GetRetryPolicy(serviceProvider.GetService<ILogger<KintsugiApiService>>()))
            .AddPolicyHandler(RetryPolicies.GetTimeoutPolicy());

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

        // Authentication & Authorization Services
        services.AddSingleton<IEntraIdValidationService, EntraIdValidationService>();
        services.AddSingleton<IApiKeyValidationService, ApiKeyValidationService>();

        // Application Services
        services.AddScoped<IKintsugiApiService, KintsugiApiService>();
        services.AddScoped<IRiskAssessmentService, RiskAssessmentService>();
        services.AddScoped<IDSM5DataService, DSM5DataService>();
        services.AddScoped<IAzureContentUnderstandingService, AzureContentUnderstandingService>();
        services.AddMemoryCache();
        services.AddScoped<IExtendedAssessmentJobService, ExtendedAssessmentJobService>();
        services.AddScoped<IGrammarCorrectionService, GrammarCorrectionService>();
        services.AddScoped<GenericErrorHandlingService>();
        services.AddScoped<ExceptionHandlingService>();
        services.AddScoped<BehavioralHealthSystem.Functions.Services.FunctionErrorHandlingService>();
        services.AddScoped<FeatureFlagsService>();
        LoggingConfiguration.ConfigureStructuredLogging(services, context.HostingEnvironment.IsDevelopment());
        services.AddSingleton<BlobServiceClient>(serviceProvider =>
        {
            var config = serviceProvider.GetService<IConfiguration>();
            if (config == null)
            {
                throw new InvalidOperationException("Configuration not available");
            }

            // First check for explicit connection string (Docker/Azurite)
            var connectionString = config["AZURE_STORAGE_CONNECTION_STRING"] ?? config.GetConnectionString("AzureStorage");
            if (!string.IsNullOrEmpty(connectionString))
            {
                return new BlobServiceClient(connectionString);
            }

            // Check for storage account name (preferred for managed identity in Azure)
            var storageAccountName = config["DSM5_STORAGE_ACCOUNT_NAME"] ?? config["AZURE_STORAGE_ACCOUNT_NAME"];
            if (!string.IsNullOrEmpty(storageAccountName))
            {
                var blobServiceUri = $"https://{storageAccountName}.blob.core.windows.net";
                return new BlobServiceClient(new Uri(blobServiceUri), new DefaultAzureCredential());
            }

            throw new InvalidOperationException(
                "Azure Blob Storage is required. Configure AZURE_STORAGE_CONNECTION_STRING or DSM5_STORAGE_ACCOUNT_NAME/AZURE_STORAGE_ACCOUNT_NAME.");
        });
        services.AddScoped<ISessionStorageService, SessionStorageService>();
        services.AddScoped<IFileGroupStorageService, FileGroupStorageService>();
        services.AddScoped<IKintsugiApiHealthCheck, KintsugiApiHealthCheck>();
        services.AddScoped<IBiometricDataService, BiometricDataService>();
        services.AddValidatorsFromAssemblyContaining<UserMetadataValidator>();
        services.AddHealthChecks().AddCheck<KintsugiApiHealthCheck>("kintsugi-api");
        services.AddSignalR();

        // Semantic Kernel audio processing pipeline (Fetch → Convert → Predict)
        services.AddAgentServices();
    })
    .Build();

host.Run();
