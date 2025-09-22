using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text.Json;
using BehavioralHealthSystem.Agents.Services;

namespace BehavioralHealthSystem.Functions.Functions;

// Speech Avatar request/response models (temporarily defined here)
public class InitiateSpeechSessionRequest
{
    public string AgentType { get; set; } = "coordinator";
    public string UserId { get; set; } = string.Empty;
    public SpeechSessionConfig? SessionConfig { get; set; }
}

public class SpeechSessionConfig
{
    public string AgentType { get; set; } = "coordinator";
    public string SessionId { get; set; } = string.Empty;
    public bool EnableAudio { get; set; } = true;
    public string PreferredVoice { get; set; } = "alloy";
}

public class SpeechInteractionRequest
{
    public string SessionId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string AudioData { get; set; } = string.Empty;
}

public class SpeechAvatarFunctions
{
    private readonly ILogger<SpeechAvatarFunctions> _logger;
    private readonly BehavioralHealthAgentService _agentService;
    private readonly JsonSerializerOptions _jsonOptions;

    public SpeechAvatarFunctions(
        ILogger<SpeechAvatarFunctions> logger,
        BehavioralHealthAgentService agentService)
    {
        _logger = logger;
        _agentService = agentService;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };
    }

    [Function("InitiateSpeechSession")]
    public async Task<HttpResponseData> InitiateSpeechSession(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "speech-avatar/sessions")] HttpRequestData req)
    {
        _logger.LogInformation("InitiateSpeechSession function triggered");

        try
        {
            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            
            if (string.IsNullOrEmpty(requestBody))
            {
                var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequestResponse.WriteStringAsync("Request body is required.");
                return badRequestResponse;
            }

            var request = JsonSerializer.Deserialize<InitiateSpeechSessionRequest>(requestBody, _jsonOptions);
            
            if (request == null)
            {
                var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequestResponse.WriteStringAsync("Invalid request format.");
                return badRequestResponse;
            }

            // Generate session ID
            var sessionId = Guid.NewGuid().ToString();
            var sessionConfig = request.SessionConfig ?? new SpeechSessionConfig
            {
                SessionId = sessionId,
                AgentType = request.AgentType,
                EnableAudio = true,
                PreferredVoice = "alloy"
            };

            // Initialize agent session (simplified for now)
            _logger.LogInformation($"Initializing session {sessionId} for agent type {sessionConfig.AgentType}");

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json");
            
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                sessionId = sessionId,
                agentType = sessionConfig.AgentType,
                status = "initialized",
                timestamp = DateTime.UtcNow.ToString("O")
            }, _jsonOptions));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in InitiateSpeechSession");
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync("Internal server error occurred.");
            return errorResponse;
        }
    }

    [Function("ProcessSpeechInteraction")]
    public async Task<HttpResponseData> ProcessSpeechInteraction(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "speech-avatar/sessions/{sessionId}/interact")] HttpRequestData req,
        string sessionId)
    {
        _logger.LogInformation($"ProcessSpeechInteraction triggered for session {sessionId}");

        try
        {
            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            
            if (string.IsNullOrEmpty(requestBody))
            {
                var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequestResponse.WriteStringAsync("Request body is required.");
                return badRequestResponse;
            }

            var request = JsonSerializer.Deserialize<SpeechInteractionRequest>(requestBody, _jsonOptions);
            
            if (request == null)
            {
                var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequestResponse.WriteStringAsync("Invalid request format.");
                return badRequestResponse;
            }

            // Process message through agent service (simplified for now)
            _logger.LogInformation($"Processing message for session {sessionId}: {request.Message}");
            
            // For now, return a simple response until we integrate with the actual agent service
            var agentResponse = "Thank you for your message. I'm here to help with your behavioral health needs.";

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json");
            
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                sessionId = sessionId,
                response = agentResponse,
                agentType = "coordinator",
                timestamp = DateTime.UtcNow.ToString("O")
            }, _jsonOptions));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error in ProcessSpeechInteraction for session {sessionId}");
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync("Internal server error occurred.");
            return errorResponse;
        }
    }

    [Function("GetSessionStatus")]
    public async Task<HttpResponseData> GetSessionStatus(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "speech-avatar/sessions/{sessionId}/status")] HttpRequestData req,
        string sessionId)
    {
        _logger.LogInformation($"GetSessionStatus triggered for session {sessionId}");

        try
        {
            // For now, return a simple status response
            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json");
            
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                sessionId = sessionId,
                status = "active",
                agentType = "coordinator",
                messageCount = 0,
                startTime = DateTime.UtcNow.ToString("O")
            }, _jsonOptions));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error in GetSessionStatus for session {sessionId}");
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync("Internal server error occurred.");
            return errorResponse;
        }
    }

    [Function("EndSpeechSession")]
    public async Task<HttpResponseData> EndSpeechSession(
        [HttpTrigger(AuthorizationLevel.Function, "delete", Route = "speech-avatar/sessions/{sessionId}")] HttpRequestData req,
        string sessionId)
    {
        _logger.LogInformation($"EndSpeechSession triggered for session {sessionId}");

        try
        {
            // For now, return a simple end response
            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json");
            
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                sessionId = sessionId,
                status = "ended",
                endTime = DateTime.UtcNow.ToString("O"),
                summary = "Session completed successfully"
            }, _jsonOptions));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error in EndSpeechSession for session {sessionId}");
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync("Internal server error occurred.");
            return errorResponse;
        }
    }

    [Function("SpeechAvatarHealthCheck")]
    public async Task<HttpResponseData> SpeechAvatarHealthCheck(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "speech-avatar/health")] HttpRequestData req)
    {
        _logger.LogInformation("SpeechAvatarHealthCheck triggered");

        var response = req.CreateResponse(HttpStatusCode.OK);
        response.Headers.Add("Content-Type", "application/json");
        
        await response.WriteStringAsync(JsonSerializer.Serialize(new
        {
            status = "healthy",
            service = "speech-avatar",
            timestamp = DateTime.UtcNow.ToString("O"),
            version = "1.0.0"
        }, _jsonOptions));

        return response;
    }
}