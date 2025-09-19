using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Functions.Worker.Extensions.SignalRService;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Net;
using BehavioralHealthSystem.Agents.Models;
using BehavioralHealthSystem.Agents.Services;

namespace BehavioralHealthSystem.Functions.Functions;

/// <summary>
/// Azure Functions for Realtime Speech Agent support
/// Handles session management, agent coordination, and PHQ-2 assessment persistence
/// </summary>
public class RealtimeSpeechAgentFunctions
{
    private readonly ILogger<RealtimeSpeechAgentFunctions> _logger;
    private readonly BehavioralHealthAgentService _agentService;

    public RealtimeSpeechAgentFunctions(
        ILogger<RealtimeSpeechAgentFunctions> logger,
        BehavioralHealthAgentService agentService)
    {
        _logger = logger;
        _agentService = agentService;
    }

    /// <summary>
    /// Initialize a new realtime speech session
    /// </summary>
    [Function("InitializeRealtimeSession")]
    public async Task<HttpResponseData> InitializeRealtimeSession(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "realtime/session/initialize")] HttpRequestData req)
    {
        try
        {
            var requestBody = await req.ReadAsStringAsync();
            var sessionRequest = JsonSerializer.Deserialize<RealtimeSessionRequest>(requestBody ?? "{}");

            if (sessionRequest == null || string.IsNullOrEmpty(sessionRequest.UserId))
            {
                var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    error = "Invalid session request. UserId is required."
                }));
                return badResponse;
            }

            var sessionId = Guid.NewGuid().ToString();
            var session = new RealtimeSession
            {
                SessionId = sessionId,
                UserId = sessionRequest.UserId,
                StartTime = DateTime.UtcNow,
                CurrentAgent = "coordinator",
                IsActive = true,
                AudioEnabled = sessionRequest.AudioEnabled ?? true,
                Language = sessionRequest.Language ?? "en-US",
                VoiceSettings = sessionRequest.VoiceSettings ?? new VoiceSettings()
            };

            // Store session in cache/database
            await StoreSessionAsync(session);

            _logger.LogInformation("Initialized realtime session {SessionId} for user {UserId}", 
                sessionId, sessionRequest.UserId);

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                sessionId = sessionId,
                userId = sessionRequest.UserId,
                currentAgent = "coordinator",
                audioEnabled = session.AudioEnabled,
                language = session.Language,
                timestamp = session.StartTime.ToString("O")
            }));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initializing realtime session");
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                error = "Failed to initialize session"
            }));
            return errorResponse;
        }
    }

    /// <summary>
    /// Handle agent handoff requests
    /// </summary>
    [Function("ProcessAgentHandoff")]
    [SignalROutput(HubName = "AgentHub")]
    public async Task<MultipleSignalRMessageAction> ProcessAgentHandoff(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "realtime/agent/handoff")] HttpRequestData req)
    {
        try
        {
            var requestBody = await req.ReadAsStringAsync();
            var handoffRequest = JsonSerializer.Deserialize<AgentHandoffRequest>(requestBody ?? "{}");

            if (handoffRequest == null || string.IsNullOrEmpty(handoffRequest.SessionId))
            {
                throw new ArgumentException("Invalid handoff request");
            }

            var session = await GetSessionAsync(handoffRequest.SessionId);
            if (session == null)
            {
                throw new ArgumentException("Session not found");
            }

            var previousAgent = session.CurrentAgent;
            session.CurrentAgent = handoffRequest.TargetAgent;
            session.LastActivity = DateTime.UtcNow;

            // Log handoff in conversation history
            var handoffMessage = new ConversationMessage
            {
                Id = Guid.NewGuid().ToString(),
                SessionId = session.SessionId,
                Role = "system",
                Content = $"Agent handoff from {previousAgent} to {handoffRequest.TargetAgent}. Reason: {handoffRequest.Reason}",
                Timestamp = DateTime.UtcNow,
                Agent = handoffRequest.TargetAgent
            };

            await StoreConversationMessageAsync(handoffMessage);
            await UpdateSessionAsync(session);

            _logger.LogInformation("Agent handoff in session {SessionId}: {FromAgent} -> {ToAgent}", 
                handoffRequest.SessionId, previousAgent, handoffRequest.TargetAgent);

            return new MultipleSignalRMessageAction(new[]
            {
                new SignalRMessageAction("AgentHandoff")
                {
                    GroupName = $"session_{handoffRequest.SessionId}",
                    Arguments = new object[]
                    {
                        new
                        {
                            sessionId = handoffRequest.SessionId,
                            fromAgent = previousAgent,
                            toAgent = handoffRequest.TargetAgent,
                            reason = handoffRequest.Reason,
                            timestamp = DateTime.UtcNow.ToString("O"),
                            context = handoffRequest.Context
                        }
                    }
                },
                new SignalRMessageAction("AgentMessage")
                {
                    GroupName = $"session_{handoffRequest.SessionId}",
                    Arguments = new object[]
                    {
                        new
                        {
                            agentName = handoffRequest.TargetAgent,
                            content = GetAgentWelcomeMessage(handoffRequest.TargetAgent),
                            timestamp = DateTime.UtcNow.ToString("O"),
                            isHandoffMessage = true
                        }
                    }
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing agent handoff");
            throw;
        }
    }

    /// <summary>
    /// Store PHQ-2 assessment data
    /// </summary>
    [Function("StorePHQ2Assessment")]
    public async Task<HttpResponseData> StorePHQ2Assessment(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "realtime/phq2/store")] HttpRequestData req)
    {
        try
        {
            var requestBody = await req.ReadAsStringAsync();
            var assessmentData = JsonSerializer.Deserialize<PHQ2AssessmentRequest>(requestBody ?? "{}");

            if (assessmentData == null || string.IsNullOrEmpty(assessmentData.SessionId))
            {
                var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    error = "Invalid assessment data"
                }));
                return badResponse;
            }

            // Convert to domain model
            var assessment = new Phq2Assessment
            {
                UserId = assessmentData.UserId,
                StartDate = DateTime.Parse(assessmentData.StartDate),
                CompletedDate = assessmentData.CompletedDate != null 
                    ? DateTime.Parse(assessmentData.CompletedDate) 
                    : null,
                Responses = assessmentData.Responses.Select(r => new Phq2Response
                {
                    QuestionNumber = r.QuestionNumber,
                    Score = (Phq2ResponseScale)r.Score,
                    ResponseDate = DateTime.Parse(r.ResponseDate)
                }).ToList()
            };

            // Store assessment using existing service
            await StorePhq2AssessmentAsync(assessment, assessmentData.SessionId);

            _logger.LogInformation("Stored PHQ-2 assessment for session {SessionId}, user {UserId}, score {Score}", 
                assessmentData.SessionId, assessmentData.UserId, assessment.TotalScore);

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                assessmentId = assessment.UserId,
                totalScore = assessment.TotalScore,
                severity = assessment.Severity?.ToString(),
                isCompleted = assessment.IsCompleted,
                interpretation = assessment.GetInterpretation(),
                recommendations = assessment.GetRecommendations()
            }));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error storing PHQ-2 assessment");
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                error = "Failed to store assessment"
            }));
            return errorResponse;
        }
    }

    /// <summary>
    /// Get session status and conversation history
    /// </summary>
    [Function("GetRealtimeSessionStatus")]
    public async Task<HttpResponseData> GetRealtimeSessionStatus(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "realtime/session/{sessionId}/status")] HttpRequestData req,
        string sessionId)
    {
        try
        {
            var session = await GetSessionAsync(sessionId);
            if (session == null)
            {
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    error = "Session not found"
                }));
                return notFoundResponse;
            }

            var messages = await GetConversationHistoryAsync(sessionId);
            var phq2Assessment = await GetLatestPhq2AssessmentAsync(sessionId);

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                session = new
                {
                    sessionId = session.SessionId,
                    userId = session.UserId,
                    currentAgent = session.CurrentAgent,
                    isActive = session.IsActive,
                    startTime = session.StartTime.ToString("O"),
                    lastActivity = session.LastActivity?.ToString("O"),
                    audioEnabled = session.AudioEnabled,
                    language = session.Language,
                    messageCount = messages.Count
                },
                conversation = messages.Select(m => new
                {
                    id = m.Id,
                    role = m.Role,
                    content = m.Content,
                    timestamp = m.Timestamp.ToString("O"),
                    agent = m.Agent
                }),
                phq2Assessment = phq2Assessment != null ? new
                {
                    isCompleted = phq2Assessment.IsCompleted,
                    totalScore = phq2Assessment.TotalScore,
                    severity = phq2Assessment.Severity?.ToString(),
                    startDate = phq2Assessment.StartDate.ToString("O"),
                    completedDate = phq2Assessment.CompletedDate?.ToString("O"),
                    responses = phq2Assessment.Responses.Select(r => new
                    {
                        questionNumber = r.QuestionNumber,
                        score = (int)r.Score,
                        responseDate = r.ResponseDate.ToString("O")
                    })
                } : null
            }));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting session status for {SessionId}", sessionId);
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                error = "Failed to get session status"
            }));
            return errorResponse;
        }
    }

    /// <summary>
    /// End a realtime session
    /// </summary>
    [Function("EndRealtimeSession")]
    [SignalROutput(HubName = "AgentHub")]
    public async Task<SignalRMessageAction> EndRealtimeSession(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "realtime/session/{sessionId}/end")] HttpRequestData req,
        string sessionId)
    {
        try
        {
            var session = await GetSessionAsync(sessionId);
            if (session == null)
            {
                throw new ArgumentException("Session not found");
            }

            session.IsActive = false;
            session.EndTime = DateTime.UtcNow;
            session.LastActivity = DateTime.UtcNow;

            await UpdateSessionAsync(session);

            _logger.LogInformation("Ended realtime session {SessionId}", sessionId);

            return new SignalRMessageAction("SessionEnded")
            {
                GroupName = $"session_{sessionId}",
                Arguments = new object[]
                {
                    new
                    {
                        sessionId = sessionId,
                        endTime = session.EndTime?.ToString("O"),
                        duration = session.EndTime.HasValue && session.StartTime != default
                            ? (session.EndTime.Value - session.StartTime).TotalMinutes
                            : 0
                    }
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error ending session {SessionId}", sessionId);
            throw;
        }
    }

    /// <summary>
    /// Store conversation message
    /// </summary>
    [Function("StoreConversationMessage")]
    public async Task<HttpResponseData> StoreConversationMessage(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "realtime/conversation/store")] HttpRequestData req)
    {
        try
        {
            var requestBody = await req.ReadAsStringAsync();
            var messageRequest = JsonSerializer.Deserialize<StoreMessageRequest>(requestBody ?? "{}");

            if (messageRequest == null || string.IsNullOrEmpty(messageRequest.SessionId))
            {
                var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    error = "Invalid message request"
                }));
                return badResponse;
            }

            var message = new ConversationMessage
            {
                Id = Guid.NewGuid().ToString(),
                SessionId = messageRequest.SessionId,
                Role = messageRequest.Role,
                Content = messageRequest.Content,
                Timestamp = DateTime.UtcNow,
                Agent = messageRequest.Agent,
                AudioData = messageRequest.AudioData,
                Transcription = messageRequest.Transcription
            };

            await StoreConversationMessageAsync(message);

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                messageId = message.Id,
                timestamp = message.Timestamp.ToString("O")
            }));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error storing conversation message");
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                error = "Failed to store message"
            }));
            return errorResponse;
        }
    }

    // Helper methods
    private string GetAgentWelcomeMessage(string agentType)
    {
        return agentType switch
        {
            "coordinator" => "Hello! I'm your behavioral health coordinator. How can I assist you today?",
            "phq2" => "I'll help you complete a PHQ-2 depression screening. This is a brief 2-question assessment. Are you ready to begin?",
            "comedian" => "Hi there! I'm here to share some uplifting humor if you'd like. What kind of day are you having?",
            _ => $"Hello! I'm the {agentType} agent. How can I help you?"
        };
    }

    // Storage methods (implement based on your storage strategy)
    private async Task StoreSessionAsync(RealtimeSession session)
    {
        // Implement session storage (Redis, SQL, etc.)
        await Task.CompletedTask;
    }

    private async Task<RealtimeSession?> GetSessionAsync(string sessionId)
    {
        // Implement session retrieval
        await Task.CompletedTask;
        return null;
    }

    private async Task UpdateSessionAsync(RealtimeSession session)
    {
        // Implement session update
        await Task.CompletedTask;
    }

    private async Task StoreConversationMessageAsync(ConversationMessage message)
    {
        // Implement message storage
        await Task.CompletedTask;
    }

    private async Task<List<ConversationMessage>> GetConversationHistoryAsync(string sessionId)
    {
        // Implement conversation history retrieval
        await Task.CompletedTask;
        return new List<ConversationMessage>();
    }

    private async Task StorePhq2AssessmentAsync(Phq2Assessment assessment, string sessionId)
    {
        // Implement PHQ-2 assessment storage
        await Task.CompletedTask;
    }

    private async Task<Phq2Assessment?> GetLatestPhq2AssessmentAsync(string sessionId)
    {
        // Implement PHQ-2 assessment retrieval
        await Task.CompletedTask;
        return null;
    }
}

// Request/Response Models
public class RealtimeSessionRequest
{
    public string UserId { get; set; } = string.Empty;
    public bool? AudioEnabled { get; set; }
    public string? Language { get; set; }
    public VoiceSettings? VoiceSettings { get; set; }
}

public class AgentHandoffRequest
{
    public string SessionId { get; set; } = string.Empty;
    public string TargetAgent { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public object? Context { get; set; }
}

public class PHQ2AssessmentRequest
{
    public string SessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string StartDate { get; set; } = string.Empty;
    public string? CompletedDate { get; set; }
    public List<PHQ2ResponseRequest> Responses { get; set; } = new();
}

public class PHQ2ResponseRequest
{
    public int QuestionNumber { get; set; }
    public int Score { get; set; }
    public string ResponseDate { get; set; } = string.Empty;
}

public class StoreMessageRequest
{
    public string SessionId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Agent { get; set; }
    public string? AudioData { get; set; }
    public string? Transcription { get; set; }
}

// Domain Models
public class RealtimeSession
{
    public string SessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public DateTime? LastActivity { get; set; }
    public string CurrentAgent { get; set; } = "coordinator";
    public bool IsActive { get; set; }
    public bool AudioEnabled { get; set; } = true;
    public string Language { get; set; } = "en-US";
    public VoiceSettings VoiceSettings { get; set; } = new();
}

public class VoiceSettings
{
    public double Speed { get; set; } = 1.0;
    public double Pitch { get; set; } = 1.0;
    public double Volume { get; set; } = 1.0;
}

public class ConversationMessage
{
    public string Id { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty; // user, assistant, system
    public string Content { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string? Agent { get; set; }
    public string? AudioData { get; set; }
    public string? Transcription { get; set; }
}