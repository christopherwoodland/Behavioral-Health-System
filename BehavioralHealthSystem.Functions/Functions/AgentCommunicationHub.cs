using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Functions.Worker.Extensions.SignalRService;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Net;

namespace BehavioralHealthSystem.Functions.Functions;

public class AgentCommunicationHub
{
    private readonly ILogger<AgentCommunicationHub> _logger;

    public AgentCommunicationHub(ILogger<AgentCommunicationHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// SignalR negotiate endpoint
    /// </summary>
    [Function("negotiate")]
    public SignalRConnectionInfo GetSignalRInfo(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "negotiate")] HttpRequestData req,
        [SignalRConnectionInfoInput(HubName = "AgentHub")] SignalRConnectionInfo connectionInfo)
    {
        _logger.LogInformation("SignalR connection negotiation requested");
        return connectionInfo;
    }

    /// <summary>
    /// Send message from agent to client
    /// </summary>
    [Function("SendAgentMessage")]
    [SignalROutput(HubName = "AgentHub")]
    public async Task<SignalRMessageAction> SendAgentMessage(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "sendagentmessage")] HttpRequestData req)
    {
        try
        {
            var requestBody = await req.ReadAsStringAsync();
            var messageData = JsonSerializer.Deserialize<AgentMessageRequest>(requestBody ?? "{}");

            if (messageData?.SessionId == null || string.IsNullOrEmpty(messageData.Content))
            {
                throw new ArgumentException("Invalid message data");
            }

            _logger.LogInformation("Sending agent message for session {SessionId}", messageData.SessionId);

            return new SignalRMessageAction("AgentMessage")
            {
                GroupName = $"session_{messageData.SessionId}",
                Arguments = new object[]
                {
                    new
                    {
                        agentName = messageData.AgentName ?? "Agent",
                        content = messageData.Content,
                        timestamp = DateTime.UtcNow.ToString("O"),
                        confidence = messageData.Confidence,
                        suggestedActions = messageData.SuggestedActions
                    }
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending agent message");
            throw;
        }
    }

    /// <summary>
    /// Handle user message and trigger agent processing
    /// </summary>
    [Function("SendUserMessage")]
    public async Task<HttpResponseData> SendUserMessage(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "sendusermessage")] HttpRequestData req)
    {
        try
        {
            var requestBody = await req.ReadAsStringAsync();
            var messageData = JsonSerializer.Deserialize<UserMessageRequest>(requestBody ?? "{}");

            if (messageData?.SessionId == null || string.IsNullOrEmpty(messageData.Content))
            {
                var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync("Invalid message data");
                return badResponse;
            }

            _logger.LogInformation("Processing user message for session {SessionId}", messageData.SessionId);

            // TODO: Integrate with RealtimeAgentOrchestrator
            // For now, return success
            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync("Message received");
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing user message");
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync("Internal server error");
            return errorResponse;
        }
    }
}

// Request models
public class AgentMessageRequest
{
    public string? SessionId { get; set; }
    public string? AgentName { get; set; }
    public string? Content { get; set; }
    public double? Confidence { get; set; }
    public string[]? SuggestedActions { get; set; }
}

public class UserMessageRequest
{
    public string? SessionId { get; set; }
    public string? Content { get; set; }
    public string? Timestamp { get; set; }
    public string? AudioData { get; set; }
    public MessageMetadata? Metadata { get; set; }
}

public class MessageMetadata
{
    public double? SpeechConfidence { get; set; }
    public double? VoiceActivityLevel { get; set; }
    public double? ProcessingTime { get; set; }
}