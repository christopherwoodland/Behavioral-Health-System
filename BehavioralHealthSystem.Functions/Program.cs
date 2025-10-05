var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices((context, services) =>
    {
        // Configuration
        services.Configure<KintsugiApiOptions>(options =>
        {
            var config = context.Configuration;
            var apiKey = config["KINTSUGI_API_KEY"];
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

        // Services
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
        LoggingConfiguration.ConfigureStructuredLogging(services, context.HostingEnvironment.IsDevelopment());
        services.AddSingleton<BlobServiceClient>(serviceProvider =>
        {
            var config = serviceProvider.GetService<IConfiguration>();
            if (config == null)
            {
                return new BlobServiceClient("UseDevelopmentStorage=true");
            }
            var connectionString = config.GetConnectionString("AzureWebJobsStorage") ?? config["AzureWebJobsStorage"] ?? "UseDevelopmentStorage=true";
            return new BlobServiceClient(connectionString);
        });
        services.AddScoped<ISessionStorageService, SessionStorageService>();
        services.AddScoped<IFileGroupStorageService, FileGroupStorageService>();
        services.AddScoped<IKintsugiApiHealthCheck, KintsugiApiHealthCheck>();
        services.AddValidatorsFromAssemblyContaining<UserMetadataValidator>();
        services.AddHealthChecks().AddCheck<KintsugiApiHealthCheck>("kintsugi-api");
        services.AddSignalR();
    })
    .Build();

host.Run();
