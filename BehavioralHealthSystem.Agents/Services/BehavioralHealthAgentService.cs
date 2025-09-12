namespace BehavioralHealthSystem.Agents.Services;

/// <summary>
/// Service for managing behavioral health agents and their configuration
/// </summary>
public class BehavioralHealthAgentService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<BehavioralHealthAgentService> _logger;
    private readonly IServiceProvider _serviceProvider;
    private BehavioralHealthGroupChat? _groupChat;
    private Kernel? _kernel;

    public BehavioralHealthAgentService(
        IConfiguration configuration,
        ILogger<BehavioralHealthAgentService> logger,
        IServiceProvider serviceProvider)
    {
        _configuration = configuration;
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    /// <summary>
    /// Initializes the agent service with Semantic Kernel
    /// </summary>
    public async Task InitializeAsync()
    {
        try
        {
            _logger.LogInformation("Initializing Behavioral Health Agent Service");

            // Build kernel with OpenAI configuration
            var kernelBuilder = Kernel.CreateBuilder();
            
            // Add OpenAI chat completion service
            var openAiEndpoint = _configuration["OpenAI:Endpoint"];
            var openAiApiKey = _configuration["OpenAI:ApiKey"];
            var deploymentName = _configuration["OpenAI:DeploymentName"] ?? "gpt-4";

            if (!string.IsNullOrEmpty(openAiEndpoint) && !string.IsNullOrEmpty(openAiApiKey))
            {
                kernelBuilder.AddAzureOpenAIChatCompletion(
                    deploymentName: deploymentName,
                    endpoint: openAiEndpoint,
                    apiKey: openAiApiKey);
            }
            else
            {
                // Fallback to regular OpenAI
                var apiKey = _configuration["OpenAI:ApiKey"];
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

            _logger.LogInformation("Behavioral Health Agent Service initialized successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize Behavioral Health Agent Service");
            throw;
        }
    }

    /// <summary>
    /// Processes a user message through the agent system
    /// </summary>
    public async Task<string> ProcessUserMessageAsync(string userId, string message)
    {
        if (_groupChat == null)
        {
            throw new InvalidOperationException("Agent service not initialized. Call InitializeAsync first.");
        }

        try
        {
            _logger.LogInformation("Processing user message for {UserId}", userId);
            return await _groupChat.ProcessMessageAsync(userId, message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing user message for {UserId}", userId);
            return "I apologize, but I encountered an error processing your request. Please try again later.";
        }
    }

    /// <summary>
    /// Directly accesses the PHQ-2 agent for specific operations
    /// </summary>
    public async Task<string> ProcessPhq2RequestAsync(string userId, string operation, Dictionary<string, object>? parameters = null)
    {
        if (_groupChat == null)
        {
            throw new InvalidOperationException("Agent service not initialized. Call InitializeAsync first.");
        }

        try
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

            return await _groupChat.InvokeAgentDirectlyAsync("PHQ2Agent", userId, message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PHQ-2 request for {UserId}", userId);
            return "Error processing PHQ-2 request. Please try again.";
        }
    }

    /// <summary>
    /// Directly accesses the PHQ-9 agent for specific operations
    /// </summary>
    public async Task<string> ProcessPhq9RequestAsync(string userId, string operation, Dictionary<string, object>? parameters = null)
    {
        if (_groupChat == null)
        {
            throw new InvalidOperationException("Agent service not initialized. Call InitializeAsync first.");
        }

        try
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

            return await _groupChat.InvokeAgentDirectlyAsync("PHQ9Agent", userId, message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PHQ-9 request for {UserId}", userId);
            return "Error processing PHQ-9 request. Please try again.";
        }
    }

    /// <summary>
    /// Records a PHQ-2 response
    /// </summary>
    public async Task<string> RecordPhq2ResponseAsync(string userId, int questionNumber, int score)
    {
        if (_groupChat == null)
        {
            throw new InvalidOperationException("Agent service not initialized. Call InitializeAsync first.");
        }

        try
        {
            var message = $"Record response: Question {questionNumber}, Score {score}";
            return await _groupChat.InvokeAgentDirectlyAsync("PHQ2Agent", userId, message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recording PHQ-2 response for {UserId}", userId);
            return "Error recording response. Please try again.";
        }
    }

    /// <summary>
    /// Records a PHQ-9 response
    /// </summary>
    public async Task<string> RecordPhq9ResponseAsync(string userId, int questionNumber, int score)
    {
        if (_groupChat == null)
        {
            throw new InvalidOperationException("Agent service not initialized. Call InitializeAsync first.");
        }

        try
        {
            var message = $"Record response: Question {questionNumber}, Score {score}";
            return await _groupChat.InvokeAgentDirectlyAsync("PHQ9Agent", userId, message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recording PHQ-9 response for {UserId}", userId);
            return "Error recording response. Please try again.";
        }
    }

    /// <summary>
    /// Gets information about available agents and services
    /// </summary>
    public string GetServiceInfo()
    {
        return _groupChat?.GetAgentInfo() ?? "Agent service not initialized.";
    }

    /// <summary>
    /// Checks if the service is properly initialized
    /// </summary>
    public bool IsInitialized => _groupChat != null && _kernel != null;
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