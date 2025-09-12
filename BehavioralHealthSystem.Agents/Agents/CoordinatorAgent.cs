namespace BehavioralHealthSystem.Agents.Agents;

/// <summary>
/// Coordinator agent that manages workflow between other agents
/// </summary>
public class CoordinatorAgent
{
    private readonly ILogger<CoordinatorAgent> _logger;
    private readonly Kernel _kernel;

    public string Name => "CoordinatorAgent";
    public string Description => "Workflow Coordinator Agent";
    
    public string Instructions => """
        You are the Coordinator Agent responsible for managing workflows between different specialized agents.
        Your primary responsibilities are:

        1. Route user requests to appropriate specialized agents
        2. Coordinate multi-step workflows
        3. Aggregate results from multiple agents
        4. Provide unified responses to users
        5. Handle escalation scenarios

        Available Agents:
        - PHQ2Agent: Handles PHQ-2 rapid depression screening (2 questions)
        - PHQ9Agent: Handles PHQ-9 comprehensive depression assessments (9 questions)

        When routing requests:
        - For rapid/initial depression screening, route to PHQ2Agent
        - For comprehensive depression assessments, route to PHQ9Agent
        - For general coordination, handle directly
        - Always provide clear communication about next steps
        """;

    public CoordinatorAgent(Kernel kernel, ILogger<CoordinatorAgent> logger)
    {
        _logger = logger;
        _kernel = kernel;
        
        kernel.Plugins.AddFromObject(this, "CoordinatorFunctions");
    }

    [KernelFunction("route_request")]
    [Description("Routes user requests to appropriate agents")]
    public string RouteRequest(
        [Description("User ID")] string userId,
        [Description("User message/request")] string message)
    {
        try
        {
            _logger.LogInformation("Routing request for user {UserId}: {Message}", userId, message);

            // Analyze the message to determine routing
            var lowerMessage = message.ToLowerInvariant();

            // Route to PHQ-2 for rapid screening
            if (lowerMessage.Contains("phq-2") || lowerMessage.Contains("phq2") || 
                lowerMessage.Contains("rapid screen") || lowerMessage.Contains("quick screen") ||
                lowerMessage.Contains("initial screen") || lowerMessage.Contains("brief screen"))
            {
                return $"Routing to PHQ2Agent for rapid depression screening. User: {userId}";
            }

            // Route to PHQ-9 for comprehensive assessment
            if (lowerMessage.Contains("phq-9") || lowerMessage.Contains("phq9") || 
                lowerMessage.Contains("comprehensive") || lowerMessage.Contains("full assessment") ||
                lowerMessage.Contains("9 question") || lowerMessage.Contains("complete questionnaire"))
            {
                return $"Routing to PHQ9Agent for comprehensive depression assessment. User: {userId}";
            }

            // General depression/assessment routing - default to PHQ-2 for initial screening
            if (lowerMessage.Contains("phq") || lowerMessage.Contains("depression") || 
                lowerMessage.Contains("questionnaire") || lowerMessage.Contains("assessment") ||
                lowerMessage.Contains("screening"))
            {
                return $"Routing to PHQ2Agent for initial depression screening. User: {userId}";
            }

            if (lowerMessage.Contains("help") || lowerMessage.Contains("available") || 
                lowerMessage.Contains("what can"))
            {
                return """
                    Available Services:
                    
                    1. PHQ-2 Rapid Depression Screening
                       - Quick 2-question screening tool
                       - Initial depression assessment
                       - Takes about 1 minute
                       - Identifies need for further evaluation
                    
                    2. PHQ-9 Comprehensive Depression Assessment
                       - Complete 9-question depression evaluation
                       - Detailed severity scoring
                       - Clinical recommendations
                       - Takes about 5 minutes
                    
                    Commands:
                    - "Start PHQ-2" - Begin rapid depression screening
                    - "Start PHQ-9" - Begin comprehensive depression assessment
                    - "Get my results" - Retrieve latest assessment results
                    - "Assessment status" - Check current assessment progress
                    
                    Recommendation: Start with PHQ-2 for initial screening, then PHQ-9 if needed.
                    
                    How can I assist you today?
                    """;
            }

            return $"""
                I understand you said: "{message}"
                
                I can help you with:
                - PHQ-2 Rapid Depression Screening (2 questions, ~1 minute)
                - PHQ-9 Comprehensive Depression Assessment (9 questions, ~5 minutes)
                - Mental health screening coordination
                
                For initial screening, I recommend starting with PHQ-2.
                Please let me know what you'd like to do, or type 'help' for more options.
                """;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error routing request for user {UserId}", userId);
            return "Error processing your request. Please try again.";
        }
    }
}