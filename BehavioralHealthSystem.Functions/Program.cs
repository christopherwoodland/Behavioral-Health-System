using Microsoft.Extensions.Hosting;
using BehavioralHealthSystem.Validators;
using BehavioralHealthSystem.Configuration;
using BehavioralHealthSystem.Agents.Services;
// using BehavioralHealthSystem.Agents.Coordinators;
// using BehavioralHealthSystem.Agents.Specialized;
using BehavioralHealthSystem.Agents.Models;
using Microsoft.SemanticKernel;
using Microsoft.Azure.SignalR.Management;
using System.Net.Http.Headers;
using Azure.Storage.Blobs;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureAppConfiguration((context, config) =>
    {
        config.AddEnvironmentVariables();
        if (context.HostingEnvironment.IsDevelopment())
        {
            config.AddJsonFile("local.settings.json", optional: true, reloadOnChange: true);
        }
    })
    .ConfigureServices((context, services) =>
    {
        // Application Insights with enhanced configuration (optional for local development)
        var appInsightsConnectionString = context.Configuration.GetValue<string>("APPLICATIONINSIGHTS_CONNECTION_STRING");
        if (!string.IsNullOrEmpty(appInsightsConnectionString) && 
            !appInsightsConnectionString.Contains("your-application-insights-connection-string"))
        {
            services.AddApplicationInsightsTelemetryWorkerService(options =>
            {
                options.ConnectionString = appInsightsConnectionString;
                options.EnableDependencyTrackingTelemetryModule = true;
                options.EnableEventCounterCollectionModule = true;
                options.EnablePerformanceCounterCollectionModule = true;
            });
            
            services.ConfigureFunctionsApplicationInsights();
        }
        else
        {
            // Log that Application Insights is disabled for local development
            var logger = LoggerFactory.Create(builder => builder.AddConsole()).CreateLogger("Startup");
            logger.LogInformation("Application Insights is disabled (no valid connection string found)");
        }
        
        // Configure logging levels
        services.Configure<LoggerFilterOptions>(options =>
        {
            options.Rules.Add(new LoggerFilterRule(null, null, LogLevel.Information, null));
            options.Rules.Add(new LoggerFilterRule("Microsoft", null, LogLevel.Warning, null));
            options.Rules.Add(new LoggerFilterRule("System", null, LogLevel.Warning, null));
            options.Rules.Add(new LoggerFilterRule("BehavioralHealthSystem", null, LogLevel.Debug, null));
        });

        // Configuration
        services.Configure<KintsugiApiOptions>(options =>
        {
            var config = context.Configuration;
            
            // Debug logging to understand configuration loading
            var logger = LoggerFactory.Create(builder => builder.AddConsole()).CreateLogger("ConfigurationDebug");
            
            var apiKey = config["KINTSUGI_API_KEY"];
            var baseUrl = config["KINTSUGI_BASE_URL"];
            // Optional toggle to automatically include consent fields on initiate
            bool? autoProvideConsent = null;
            var rawConsent = config["KINTSUGI_AUTO_PROVIDE_CONSENT"]; // expecting "true"/"false" if set
            if (!string.IsNullOrWhiteSpace(rawConsent) && bool.TryParse(rawConsent, out var parsed))
            {
                autoProvideConsent = parsed;
            }
            
            logger.LogInformation("Raw config values - KINTSUGI_API_KEY: {ApiKey}, KINTSUGI_BASE_URL: {BaseUrl}", 
                string.IsNullOrEmpty(apiKey) ? "NULL/EMPTY" : "HAS_VALUE", 
                string.IsNullOrEmpty(baseUrl) ? "NULL/EMPTY" : baseUrl);
            
            options.KintsugiApiKey = apiKey ?? string.Empty;
            options.KintsugiBaseUrl = baseUrl ?? "https://api.kintsugihealth.com/v2";
            options.TimeoutSeconds = config.GetValue<int>("KINTSUGI_TIMEOUT_SECONDS", 300);
            options.MaxRetryAttempts = config.GetValue<int>("KINTSUGI_MAX_RETRY_ATTEMPTS", 3);
            options.RetryDelayMilliseconds = config.GetValue<int>("KINTSUGI_RETRY_DELAY_MS", 1000);
            if (autoProvideConsent.HasValue)
            {
                options.AutoProvideConsent = autoProvideConsent.Value;
            }
            
            logger.LogInformation("Final options - ApiKey: {ApiKeyStatus}, BaseUrl: {BaseUrl}, AutoProvideConsent: {AutoProvideConsent}", 
                string.IsNullOrEmpty(options.KintsugiApiKey) ? "NOT SET" : "SET", 
                options.KintsugiBaseUrl,
                options.AutoProvideConsent);
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

        // GPT-Realtime Configuration for Semantic Kernel
        services.Configure<BehavioralHealthSystem.Agents.Models.RealtimeConfig>(options =>
        {
            var config = context.Configuration;
            options.Endpoint = config["GPT_REALTIME_ENDPOINT"] ?? "https://cdc-traci-aif-002.cognitiveservices.azure.com/openai/realtime";
            options.ApiKey = config["GPT_REALTIME_API_KEY"] ?? config["AZURE_OPENAI_API_KEY"] ?? string.Empty;
            options.DeploymentId = config["GPT_REALTIME_DEPLOYMENT"] ?? "gpt-realtime";
            options.ApiVersion = config["GPT_REALTIME_API_VERSION"] ?? "2024-10-01-preview";
        });

        // Audio Processing Configuration
        services.Configure<BehavioralHealthSystem.Agents.Models.AudioConfig>(options =>
        {
            var config = context.Configuration;
            options.SampleRate = config.GetValue<int>("AUDIO_SAMPLE_RATE", 24000);
            options.BitsPerSample = config.GetValue<int>("AUDIO_BITS_PER_SAMPLE", 16);
            options.Channels = config.GetValue<int>("AUDIO_CHANNELS", 1);
            options.EnableVAD = config.GetValue<bool>("AUDIO_ENABLE_VAD", true);
            options.SilenceThreshold = config.GetValue<double>("AUDIO_SILENCE_THRESHOLD", 0.01);
            options.SilenceDurationMs = config.GetValue<int>("AUDIO_SILENCE_DURATION_MS", 1000);
        });

        // Semantic Kernel Setup
        services.AddKernel()
            .AddAzureOpenAIChatCompletion(
                deploymentName: context.Configuration["AZURE_OPENAI_DEPLOYMENT"] ?? "gpt-4o",
                endpoint: context.Configuration["AZURE_OPENAI_ENDPOINT"] ?? string.Empty,
                apiKey: context.Configuration["AZURE_OPENAI_API_KEY"] ?? string.Empty,
                modelId: "gpt-4o");

        // SignalR Management Service - Configured for Serverless mode
        services.AddSingleton(provider =>
        {
            var config = provider.GetRequiredService<IConfiguration>();
            var connectionString = config.GetConnectionString("AzureSignalRConnectionString") ?? 
                                 config["AzureSignalRConnectionString"] ?? 
                                 "Endpoint=https://your-signalr.service.signalr.net;AccessKey=your-access-key;Version=1.0;";
            
            return new ServiceManagerBuilder()
                .WithOptions(option => 
                {
                    option.ConnectionString = connectionString;
                    option.ServiceTransportType = ServiceTransportType.Transient;
                })
                .BuildServiceManager();
        });

        services.AddSingleton<IServiceHubContext>(provider =>
        {
            var serviceManager = provider.GetRequiredService<ServiceManager>();
            return serviceManager.CreateHubContextAsync("AgentHub", default).Result;
        });

        // Semantic Kernel Agent Services (temporarily disabled)
        services.AddScoped<SemanticKernelRealtimeService>();
        // services.AddScoped<SemanticKernelAgentCoordinator>();
        // services.AddScoped<SemanticKernelPhq2Agent>();
        // services.AddScoped<SemanticKernelComedianAgent>();
        services.AddScoped<SimpleAudioService>();

        // HTTP Client with policies - Force immediate configuration
        services.AddHttpClient<IKintsugiApiService, KintsugiApiService>()
            .ConfigureHttpClient((serviceProvider, client) =>
            {
                var configLogger = LoggerFactory.Create(builder => builder.AddConsole()).CreateLogger("HttpClientConfig");
                configLogger.LogInformation("=== HttpClient configuration delegate is being called ===");
                
                try
                {
                    var options = serviceProvider.GetRequiredService<IOptions<KintsugiApiOptions>>().Value;
                    
                    configLogger.LogInformation("Retrieved options successfully - BaseUrl: {BaseUrl}, ApiKey: {ApiKeyStatus}", 
                        options.KintsugiBaseUrl, 
                        string.IsNullOrEmpty(options.KintsugiApiKey) ? "NOT SET" : "SET");
                    
                    if (string.IsNullOrEmpty(options.KintsugiApiKey))
                    {
                        configLogger.LogError("KINTSUGI_API_KEY is not configured");
                        throw new InvalidOperationException("KINTSUGI_API_KEY is not configured");
                    }

                    if (string.IsNullOrEmpty(options.KintsugiBaseUrl))
                    {
                        configLogger.LogError("KINTSUGI_BASE_URL is not configured");
                        throw new InvalidOperationException("KINTSUGI_BASE_URL is not configured");
                    }

                    // Ensure BaseUrl ends with a slash for relative URL resolution
                    var baseUrl = options.KintsugiBaseUrl.TrimEnd('/') + "/";
                    configLogger.LogInformation("Setting BaseAddress to: {BaseUrl}", baseUrl);
                    
                    client.BaseAddress = new Uri(baseUrl);
                    client.DefaultRequestHeaders.Accept.Clear();
                    client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                    client.DefaultRequestHeaders.Add("X-API-Key", options.KintsugiApiKey);
                    client.Timeout = TimeSpan.FromMinutes(5);
                    
                    configLogger.LogInformation("=== HttpClient configuration completed successfully with BaseAddress: {BaseAddress} ===", client.BaseAddress);
                }
                catch (Exception ex)
                {
                    configLogger.LogError(ex, "=== Error in HttpClient configuration delegate ===");
                    throw;
                }
            })
        .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler())
        .AddPolicyHandler((serviceProvider, request) => RetryPolicies.GetRetryPolicy(serviceProvider.GetService<ILogger<KintsugiApiService>>()))
        .AddPolicyHandler(RetryPolicies.GetTimeoutPolicy());

        // Services
        services.AddScoped<IKintsugiApiService, KintsugiApiService>();
        
        // Risk Assessment Service (no longer needs HttpClient)
        services.AddScoped<IRiskAssessmentService, RiskAssessmentService>();
        
        // Grammar Correction Service
        services.AddScoped<IGrammarCorrectionService, GrammarCorrectionService>();
        
        // Blob Storage Service
        services.AddSingleton(serviceProvider =>
        {
            var config = serviceProvider.GetRequiredService<IConfiguration>();
            var connectionString = config.GetConnectionString("AzureWebJobsStorage") ?? 
                                   config["AzureWebJobsStorage"] ?? 
                                   "UseDevelopmentStorage=true";
            return new BlobServiceClient(connectionString);
        });
        services.AddScoped<ISessionStorageService, SessionStorageService>();
        
        // Health Check Service
        services.AddScoped<IKintsugiApiHealthCheck, KintsugiApiHealthCheck>();
        
        // Validators
        services.AddValidatorsFromAssemblyContaining<UserMetadataValidator>();
        
        // Health checks
        services.AddHealthChecks()
            .AddCheck<KintsugiApiHealthCheck>("kintsugi-api");
            
        // SignalR Service
        services.AddSignalR();
    })
    .Build();

host.Run();
