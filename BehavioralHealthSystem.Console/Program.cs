using Microsoft.Extensions.Configuration;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;

namespace BehavioralHealthSystem.Console;

/// <summary>
/// Interactive console application for testing the Behavioral Health Group Chat system
/// </summary>
public class Program
{
    public static async Task Main(string[] args)
    {
        System.Console.WriteLine("================================================================================");
        System.Console.WriteLine("     Behavioral Health System - Azure OpenAI Agent Console Test Interface   ");
        System.Console.WriteLine("================================================================================");
        System.Console.WriteLine();

        // Build configuration
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddUserSecrets<Program>(optional: true)
            .AddEnvironmentVariables()
            .Build();

        // Get Azure OpenAI configuration
        var azureEndpoint = configuration["AzureOpenAI:Endpoint"] ?? 
                           Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
        var azureApiKey = configuration["AzureOpenAI:ApiKey"] ?? 
                         Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");
        var deploymentName = configuration["AzureOpenAI:DeploymentName"] ?? 
                           Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT_NAME") ?? 
                           "gpt-4o-mini";

        if (string.IsNullOrEmpty(azureApiKey) || string.IsNullOrEmpty(azureEndpoint))
        {
            System.Console.WriteLine("❌ Azure OpenAI configuration not found!");
            System.Console.WriteLine("Please set either:");
            System.Console.WriteLine("  1. Environment variables: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY");
            System.Console.WriteLine("  2. User secrets: dotnet user-secrets set \"AzureOpenAI:Endpoint\" \"your-endpoint\"");
            System.Console.WriteLine("  3. appsettings.json: \"AzureOpenAI\": { \"Endpoint\": \"your-endpoint\", \"ApiKey\": \"your-key\" }");
            System.Console.WriteLine();
            System.Console.WriteLine("Press any key to exit...");
            System.Console.ReadKey();
            return;
        }

        // Build host with dependency injection
        using var host = Host.CreateDefaultBuilder(args)
            .ConfigureServices((context, services) =>
            {
                // Configure logging
                services.AddLogging(builder =>
                {
                    builder.SetMinimumLevel(LogLevel.Information);
                    builder.AddConsole();
                });

                // Configure Semantic Kernel
                services.AddKernel();
                services.AddAzureOpenAIChatCompletion(
                    deploymentName: deploymentName,
                    endpoint: azureEndpoint,
                    apiKey: azureApiKey);

                // Register the group chat
                services.AddScoped<BehavioralHealthGroupChat>();
            })
            .Build();

        await host.StartAsync();

        // Get services
        var logger = host.Services.GetRequiredService<ILogger<Program>>();
        var groupChat = host.Services.GetRequiredService<BehavioralHealthGroupChat>();

        try
        {
            // Test basic Semantic Kernel functionality first
            System.Console.WriteLine("🔄 Testing basic Semantic Kernel setup with Azure OpenAI...");
            System.Console.WriteLine($"   Endpoint: {azureEndpoint}");
            System.Console.WriteLine($"   Deployment: {deploymentName}");
            
            var chatService = host.Services.GetRequiredService<IChatCompletionService>();
            System.Console.WriteLine("✅ Chat completion service initialized successfully!");
            
            // Simple test message
            var testResult = await chatService.GetChatMessageContentAsync("Hello, can you respond with 'Test successful'?");
            System.Console.WriteLine($"🤖 Test Response: {testResult.Content}");
            System.Console.WriteLine();

            // Initialize the group chat
            try 
            {
                System.Console.WriteLine("🔄 Initializing Behavioral Health Group Chat...");
                await groupChat.InitializeAsync();
                System.Console.WriteLine("✅ Group chat initialized successfully!");
                System.Console.WriteLine();

                // Show available agents
                System.Console.WriteLine("📋 Available Agents:");
                System.Console.WriteLine(groupChat.GetAgentInfo());
                System.Console.WriteLine();

                // Show usage instructions
                ShowUsageInstructions();

                // Start interactive chat loop
                await StartChatLoop(groupChat, logger);
            }
            catch (Exception agentEx)
            {
                logger.LogWarning(agentEx, "Group chat initialization failed, running basic chat mode");
                System.Console.WriteLine("⚠️ Group chat not available, running basic chat mode...");
                await StartBasicChatLoop(chatService, logger);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error during application execution");
            System.Console.WriteLine($"❌ Error: {ex.Message}");
        }
        finally
        {
            await host.StopAsync();
        }
    }

    private static void ShowUsageInstructions()
    {
        System.Console.WriteLine("💬 How to interact with the agents:");
        System.Console.WriteLine();
        System.Console.WriteLine("PHQ-2 Agent Commands:");
        System.Console.WriteLine("  • 'start phq2' or 'begin phq2' - Start PHQ-2 rapid screening");
        System.Console.WriteLine("  • 'phq2 status' - Get current assessment status");
        System.Console.WriteLine("  • 'phq2 results' - Get assessment results");
        System.Console.WriteLine("  • 'clinical info' - Get clinical information about PHQ-2");
        System.Console.WriteLine("  • Answer with numbers 0-3 when prompted");
        System.Console.WriteLine();
        System.Console.WriteLine("PHQ-9 Agent Commands:");
        System.Console.WriteLine("  • 'start phq9' or 'begin phq9' - Start PHQ-9 comprehensive assessment");
        System.Console.WriteLine("  • 'phq9 status' - Get current assessment status");
        System.Console.WriteLine("  • 'phq9 results' - Get assessment results");
        System.Console.WriteLine("  • Answer with numbers 0-3 when prompted");
        System.Console.WriteLine();
        System.Console.WriteLine("ComedianAgent Commands:");
        System.Console.WriteLine("  • 'tell me a joke' - Get a mood-lifting joke");
        System.Console.WriteLine("  • 'tell me a story' - Hear a funny, wholesome story");
        System.Console.WriteLine("  • 'cheer me up' - Get encouraging humor");
        System.Console.WriteLine("  • 'make me laugh' - General humor and fun");
        System.Console.WriteLine("  • Simply chat with humor topics for playful banter");
        System.Console.WriteLine();
        System.Console.WriteLine("General Commands:");
        System.Console.WriteLine("  • 'agents' - Show available agents");
        System.Console.WriteLine("  • 'help' - Show this help message");
        System.Console.WriteLine("  • 'clear' - Clear the console");
        System.Console.WriteLine("  • 'quit' or 'exit' - Exit the application");
        System.Console.WriteLine();
        System.Console.WriteLine("🎯 The Coordinator Agent will automatically route your messages to the right agent!");
        System.Console.WriteLine("================================================================================");
        System.Console.WriteLine();
    }

    private static async Task StartBasicChatLoop(IChatCompletionService chatService, ILogger<Program> logger)
    {
        var userId = "console-user-" + DateTime.Now.ToString("yyyyMMdd-HHmmss");
        System.Console.WriteLine($"👤 Your User ID: {userId}");
        System.Console.WriteLine("💬 Basic Chat Mode - Direct Azure OpenAI interaction");
        System.Console.WriteLine("Type 'quit' or 'exit' to exit, 'help' for help");
        System.Console.WriteLine();

        while (true)
        {
            System.Console.Write("You: ");
            var userInput = System.Console.ReadLine();

            if (string.IsNullOrWhiteSpace(userInput))
            {
                continue;
            }

            if (userInput.Equals("quit", StringComparison.OrdinalIgnoreCase) ||
                userInput.Equals("exit", StringComparison.OrdinalIgnoreCase))
            {
                System.Console.WriteLine("👋 Goodbye!");
                break;
            }

            if (userInput.Equals("help", StringComparison.OrdinalIgnoreCase))
            {
                System.Console.WriteLine("💬 Basic Chat Mode:");
                System.Console.WriteLine("  • Type any message to chat with the AI");
                System.Console.WriteLine("  • 'quit' or 'exit' - Exit the application");
                System.Console.WriteLine("  • 'clear' - Clear the console");
                System.Console.WriteLine();
                continue;
            }

            if (userInput.Equals("clear", StringComparison.OrdinalIgnoreCase))
            {
                System.Console.Clear();
                System.Console.WriteLine("================================================================================");
                System.Console.WriteLine("     Behavioral Health System - Azure OpenAI Basic Chat Mode                ");
                System.Console.WriteLine("================================================================================");
                System.Console.WriteLine();
                continue;
            }

            try
            {
                System.Console.Write("🤖 AI: ");
                var response = await chatService.GetChatMessageContentAsync(userInput);
                System.Console.WriteLine(response.Content);
                System.Console.WriteLine();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error processing message: {Message}", userInput);
                System.Console.WriteLine($"❌ Error: {ex.Message}");
                System.Console.WriteLine();
            }
        }
    }

    private static async Task StartChatLoop(BehavioralHealthGroupChat groupChat, ILogger<Program> logger)
    {
        var userId = "console-user-" + DateTime.Now.ToString("yyyyMMdd-HHmmss");
        System.Console.WriteLine($"👤 Your User ID: {userId}");
        System.Console.WriteLine();

        while (true)
        {
            // Get user input
            System.Console.Write("You: ");
            var userInput = System.Console.ReadLine();

            if (string.IsNullOrWhiteSpace(userInput))
            {
                continue;
            }

            // Check for exit commands
            if (userInput.Equals("quit", StringComparison.OrdinalIgnoreCase) ||
                userInput.Equals("exit", StringComparison.OrdinalIgnoreCase))
            {
                System.Console.WriteLine("👋 Goodbye! Thank you for testing the Behavioral Health System.");
                break;
            }

            // Handle special commands
            if (userInput.Equals("help", StringComparison.OrdinalIgnoreCase))
            {
                ShowUsageInstructions();
                continue;
            }

            if (userInput.Equals("clear", StringComparison.OrdinalIgnoreCase))
            {
                System.Console.Clear();
                System.Console.WriteLine("================================================================================");
                System.Console.WriteLine("     Behavioral Health System - Azure OpenAI Agent Console Test Interface   ");
                System.Console.WriteLine("================================================================================");
                System.Console.WriteLine();
                continue;
            }

            if (userInput.Equals("agents", StringComparison.OrdinalIgnoreCase))
            {
                System.Console.WriteLine("📋 Available Agents:");
                System.Console.WriteLine(groupChat.GetAgentInfo());
                System.Console.WriteLine();
                continue;
            }

            try
            {
                // Process message through group chat
                System.Console.WriteLine();
                System.Console.Write("🤖 Agent: ");
                
                var response = await groupChat.ProcessMessageAsync(userId, userInput);
                
                // Format and display response
                var formattedResponse = FormatAgentResponse(response);
                System.Console.WriteLine(formattedResponse);
                System.Console.WriteLine();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error processing message: {Message}", userInput);
                System.Console.WriteLine($"❌ Error processing message: {ex.Message}");
                System.Console.WriteLine();
            }
        }
    }

    private static string FormatAgentResponse(string response)
    {
        // Add some basic formatting to make responses more readable
        if (string.IsNullOrWhiteSpace(response))
        {
            return "No response received.";
        }

        // Add line breaks for better readability
        return response.Replace(". ", ".\n        ");
    }
}

/// <summary>
/// Configuration options for the console application
/// </summary>
public class ConsoleOptions
{
    public string OpenAIApiKey { get; set; } = string.Empty;
    public string DefaultUserId { get; set; } = "console-user";
    public LogLevel LogLevel { get; set; } = LogLevel.Information;
}