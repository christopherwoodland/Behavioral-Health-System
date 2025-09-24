namespace BehavioralHealthSystem.Agents.Services;

/// <summary>
/// Service for managing behavioral health agents and their configuration
/// </summary>
public class BehavioralHealthAgentService : BaseService
{
    private readonly IServiceProvider _serviceProvider;
    private BehavioralHealthGroupChat? _groupChat;
    private Kernel? _kernel;

    public BehavioralHealthAgentService(
        ILogger<BehavioralHealthAgentService> logger,
        IConfiguration configuration,
        IServiceProvider serviceProvider)
        : base(logger, configuration)
    {
        _serviceProvider = serviceProvider;
    }

    /// <summary>
    /// Initialize service with async operations - override from BaseService
    /// </summary>
    protected override async Task OnInitializeAsync(CancellationToken cancellationToken = default)
    {
        await ExecuteWithLoggingAsync(async () =>
        {
            // Build kernel with OpenAI configuration
            var kernelBuilder = Kernel.CreateBuilder();
            
            // Add OpenAI chat completion service
            var openAiEndpoint = GetConfigurationValue<string>("OpenAI:Endpoint");
            var openAiApiKey = GetConfigurationValue<string>("OpenAI:ApiKey");
            var deploymentName = GetConfigurationValue<string>("OpenAI:DeploymentName", "gpt-4");

            if (!string.IsNullOrEmpty(openAiEndpoint) && !string.IsNullOrEmpty(openAiApiKey))
            {
                kernelBuilder.AddAzureOpenAIChatCompletion(
                    deploymentName: deploymentName!,
                    endpoint: openAiEndpoint,
                    apiKey: openAiApiKey);
            }
            else
            {
                // Fallback to regular OpenAI
                var apiKey = GetConfigurationValue<string>("OpenAI:ApiKey");
                if (!string.IsNullOrEmpty(apiKey))
                {
                    kernelBuilder.AddOpenAIChatCompletion(
                        modelId: "gpt-4",
                        apiKey: apiKey);
                }
                else
                {
                    throw new InvalidOperationException("OpenAI configuration not found");
                }
            }

            // Add logging
            kernelBuilder.Services.AddSingleton(_serviceProvider.GetRequiredService<ILoggerFactory>());

            _kernel = kernelBuilder.Build();

            // Initialize group chat
            _groupChat = new BehavioralHealthGroupChat(
                _kernel, 
                _serviceProvider.GetRequiredService<ILogger<BehavioralHealthGroupChat>>(),
                _serviceProvider.GetRequiredService<ILoggerFactory>());
            
            await _groupChat.InitializeAsync();

            IsInitialized = true;

            LogServiceConfiguration("Behavioral Health Agents", new Dictionary<string, object?>
            {
                ["OpenAI Endpoint"] = openAiEndpoint,
                ["Deployment"] = deploymentName,
                ["Kernel Configured"] = _kernel != null,
                ["GroupChat Initialized"] = _groupChat != null
            });

        }, "Behavioral Health Agent Service Initialization");
    }

    /// <summary>
    /// Processes a user message through the agent system
    /// </summary>
    public async Task<string> ProcessUserMessageAsync(string userId, string message)
    {
        EnsureInitialized();

        return await ExecuteWithLoggingAsync(async () =>
        {
            return await _groupChat!.ProcessMessageAsync(userId, message);
        }, "Process User Message", new Dictionary<string, object> { ["UserId"] = userId });
    }

    /// <summary>
    /// Directly accesses the PHQ-2 agent for specific operations
    /// </summary>
    public async Task<string> ProcessPhq2RequestAsync(string userId, string operation, Dictionary<string, object>? parameters = null)
    {
        EnsureInitialized();

        return await ExecuteWithLoggingAsync(async () =>
        {
            parameters ??= new Dictionary<string, object>();
            parameters["userId"] = userId;

            var message = operation.ToLowerInvariant() switch
            {
                "start" => "Start PHQ-2 assessment",
                "status" => "Get assessment status",
                "results" => "Get my PHQ-2 results",
                "complete" => "Complete assessment",
                "clinical" => "Get clinical info",
                _ => $"PHQ-2 operation: {operation}"
            };

            return await _groupChat!.InvokeAgentDirectlyAsync("PHQ2Agent", userId, message);
        }, "Process PHQ-2 Request", new Dictionary<string, object> { ["UserId"] = userId, ["Operation"] = operation });
    }

    /// <summary>
    /// Directly accesses the PHQ-9 agent for specific operations
    /// </summary>
    public async Task<string> ProcessPhq9RequestAsync(string userId, string operation, Dictionary<string, object>? parameters = null)
    {
        EnsureInitialized();

        return await ExecuteWithLoggingAsync(async () =>
        {
            parameters ??= new Dictionary<string, object>();
            parameters["userId"] = userId;

            var message = operation.ToLowerInvariant() switch
            {
                "start" => "Start PHQ-9 assessment",
                "status" => "Get assessment status",
                "results" => "Get my PHQ-9 results",
                "complete" => "Complete assessment",
                _ => $"PHQ-9 operation: {operation}"
            };

            return await _groupChat!.InvokeAgentDirectlyAsync("PHQ9Agent", userId, message);
        }, "Process PHQ-9 Request", new Dictionary<string, object> { ["UserId"] = userId, ["Operation"] = operation });
    }

    /// <summary>
    /// Records a PHQ-2 response
    /// </summary>
    public async Task<string> RecordPhq2ResponseAsync(string userId, int questionNumber, int score)
    {
        EnsureInitialized();

        return await ExecuteWithLoggingAsync(async () =>
        {
            var message = $"Record response: Question {questionNumber}, Score {score}";
            return await _groupChat!.InvokeAgentDirectlyAsync("PHQ2Agent", userId, message);
        }, "Record PHQ-2 Response", new Dictionary<string, object> 
        { 
            ["UserId"] = userId, 
            ["QuestionNumber"] = questionNumber, 
            ["Score"] = score 
        });
    }

    /// <summary>
    /// Records a PHQ-9 response
    /// </summary>
    public async Task<string> RecordPhq9ResponseAsync(string userId, int questionNumber, int score)
    {
        EnsureInitialized();

        return await ExecuteWithLoggingAsync(async () =>
        {
            var message = $"Record response: Question {questionNumber}, Score {score}";
            return await _groupChat!.InvokeAgentDirectlyAsync("PHQ9Agent", userId, message);
        }, "Record PHQ-9 Response", new Dictionary<string, object> 
        { 
            ["UserId"] = userId, 
            ["QuestionNumber"] = questionNumber, 
            ["Score"] = score 
        });
    }

    /// <summary>
    /// Gets information about available agents and services
    /// </summary>
    public string GetServiceInfo()
    {
        return _groupChat?.GetAgentInfo() ?? "Agent service not initialized.";
    }

    /// <summary>
    /// Checks if the service is properly initialized - override from BaseService
    /// </summary>
    public override bool IsInitialized => base.IsInitialized && _groupChat != null && _kernel != null;
}

/// <summary>
/// Extension methods for dependency injection
/// </summary>
public static class BehavioralHealthAgentServiceExtensions
{
    /// <summary>
    /// Adds behavioral health agents to the service collection
    /// </summary>
    public static IServiceCollection AddBehavioralHealthAgents(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<BehavioralHealthAgentService>();
        services.AddSingleton<ILogger<BehavioralHealthGroupChat>>(provider => 
            provider.GetRequiredService<ILoggerFactory>().CreateLogger<BehavioralHealthGroupChat>());
        services.AddSingleton<ILogger<Phq2Agent>>(provider => 
            provider.GetRequiredService<ILoggerFactory>().CreateLogger<Phq2Agent>());
        services.AddSingleton<ILogger<Phq9Agent>>(provider => 
            provider.GetRequiredService<ILoggerFactory>().CreateLogger<Phq9Agent>());
        
        return services;
    }
}