using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Net;

namespace BehavioralHealthSystem.Functions.Functions;

/// <summary>
/// Simple real-time agent orchestrator for processing user messages
/// </summary>
public class SimpleAgentOrchestrator
{
    private readonly ILogger<SimpleAgentOrchestrator> _logger;

    public SimpleAgentOrchestrator(ILogger<SimpleAgentOrchestrator> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Process user input and return agent response
    /// </summary>
    [Function("ProcessUserInput")]
    public async Task<HttpResponseData> ProcessUserInput(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "processinput")] HttpRequestData req)
    {
        try
        {
            var requestBody = await req.ReadAsStringAsync();
            var inputData = JsonSerializer.Deserialize<UserInputRequest>(requestBody ?? "{}");

            if (inputData?.SessionId == null || string.IsNullOrEmpty(inputData.Content))
            {
                var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync("Invalid input data");
                return badResponse;
            }

            _logger.LogInformation("Processing user input for session {SessionId}", inputData.SessionId);

            // Simple mock response based on content
            var response = GenerateMockResponse(inputData.Content);

            var httpResponse = req.CreateResponse(HttpStatusCode.OK);
            await httpResponse.WriteStringAsync(JsonSerializer.Serialize(response));
            return httpResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing user input");
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync("Internal server error");
            return errorResponse;
        }
    }

    private AgentResponse GenerateMockResponse(string userInput)
    {
        var lowerInput = userInput.ToLowerInvariant();
        
        // Simple keyword-based routing
        if (lowerInput.Contains("phq") || lowerInput.Contains("depression") || lowerInput.Contains("screening"))
        {
            return new AgentResponse
            {
                AgentName = "PHQ-2 Screening Agent",
                Content = "I can help you with a depression screening using the PHQ-2 questionnaire. This is a quick 2-question assessment. Would you like to begin?",
                Confidence = 0.95,
                SuggestedActions = new[] { "Begin PHQ-2", "Learn more about screening", "Talk to coordinator" }
            };
        }
        
        if (lowerInput.Contains("crisis") || lowerInput.Contains("emergency") || lowerInput.Contains("suicide"))
        {
            return new AgentResponse
            {
                AgentName = "Crisis Intervention Agent",
                Content = "I'm here to help during this difficult time. If you're in immediate danger, please call 911 or the Suicide & Crisis Lifeline at 988. I'm here to support you and connect you with appropriate resources.",
                Confidence = 1.0,
                SuggestedActions = new[] { "Call 988", "Emergency contacts", "Crisis resources" }
            };
        }
        
        if (lowerInput.Contains("joke") || lowerInput.Contains("funny") || lowerInput.Contains("humor"))
        {
            return new AgentResponse
            {
                AgentName = "Therapeutic Humor Agent",
                Content = "Laughter can be great medicine! 😊 Here's a gentle one: Why don't scientists trust atoms? Because they make up everything! How are you feeling today?",
                Confidence = 0.8,
                SuggestedActions = new[] { "Another joke", "Mood check", "Serious conversation" }
            };
        }

        // Default response
        return new AgentResponse
        {
            AgentName = "Behavioral Health Coordinator",
            Content = "I understand what you're sharing with me. I'm here to listen and help you explore your thoughts and feelings. What would you like to talk about today?",
            Confidence = 0.7,
            SuggestedActions = new[] { "Depression screening", "Mood tracking", "Coping strategies", "Crisis resources" }
        };
    }
}

// Request/Response models
public class UserInputRequest
{
    public string? SessionId { get; set; }
    public string? Content { get; set; }
    public string? Timestamp { get; set; }
    public UserInputMetadata? Metadata { get; set; }
}

public class UserInputMetadata
{
    public double? SpeechConfidence { get; set; }
    public double? VoiceActivityLevel { get; set; }
    public double? ProcessingTime { get; set; }
}

public class AgentResponse
{
    public string AgentName { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public string[] SuggestedActions { get; set; } = Array.Empty<string>();
    public string Timestamp { get; set; } = DateTime.UtcNow.ToString("O");
}