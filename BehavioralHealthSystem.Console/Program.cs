using Microsoft.Extensions.Configuration;

namespace BehavioralHealthSystem.Console;

/// <summary>
/// Interactive console application for testing the Behavioral Health Group Chat system
/// </summary>
public class Program
{
    public static async Task Main(string[] args)
    {
        System.Console.WriteLine("================================================================================");
        System.Console.WriteLine("           Behavioral Health System - Agent Console Test Interface             ");
        System.Console.WriteLine("================================================================================");
        System.Console.WriteLine();

        // Build configuration
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddUserSecrets<Program>(optional: true)
            .AddEnvironmentVariables()
            .Build();

        // Get OpenAI API key
        var openAiApiKey = configuration["OpenAI:ApiKey"] ?? 
                          Environment.GetEnvironmentVariable("OPENAI_API_KEY");

        if (string.IsNullOrEmpty(openAiApiKey))
        {
            System.Console.WriteLine("❌ OpenAI API Key not found!");
            System.Console.WriteLine("Please set either:");
            System.Console.WriteLine("  1. Environment variable: OPENAI_API_KEY");
            System.Console.WriteLine("  2. User secrets: dotnet user-secrets set \"OpenAI:ApiKey\" \"your-key\"");
            System.Console.WriteLine("  3. appsettings.json: \"OpenAI\": { \"ApiKey\": \"your-key\" }");
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
                services.AddOpenAIChatCompletion(
                    modelId: "gpt-4o-mini", // Using GPT-4o-mini for cost efficiency
                    apiKey: openAiApiKey);

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
            // Initialize the group chat
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
                System.Console.WriteLine("           Behavioral Health System - Agent Console Test Interface             ");
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