using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.SignalR.Management;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using BehavioralHealthSystem.Agents.Services;
using BehavioralHealthSystem.Agents.Coordinators;
using BehavioralHealthSystem.Agents.Specialized;
using BehavioralHealthSystem.Agents.Models;
using System.Text.Json;
using System.ComponentModel.DataAnnotations;

namespace BehavioralHealthSystem.Functions;

/// <summary>
/// Azure Functions for C# Semantic Kernel speech agents
/// Provides SignalR integration, session management, and agent coordination
/// </summary>
public class SemanticKernelSpeechAgentFunctions
{
    private readonly ILogger<SemanticKernelSpeechAgentFunctions> _logger;
    private readonly Kernel _kernel;
    private readonly SemanticKernelAgentCoordinator _agentCoordinator;
    private readonly SemanticKernelRealtimeService _realtimeService;
    private readonly AudioProcessingService _audioService;
    private readonly IServiceHubContext _serviceHubContext;

    public SemanticKernelSpeechAgentFunctions(
        ILogger<SemanticKernelSpeechAgentFunctions> logger,
        Kernel kernel,
        SemanticKernelAgentCoordinator agentCoordinator,
        SemanticKernelRealtimeService realtimeService,
        AudioProcessingService audioService,
        IServiceHubContext serviceHubContext)
    {
        _logger = logger;
        _kernel = kernel;
        _agentCoordinator = agentCoordinator;
        _realtimeService = realtimeService;
        _audioService = audioService;
        _serviceHubContext = serviceHubContext;
        
        // Subscribe to agent coordinator events
        _agentCoordinator.SessionStarted += OnSessionStarted;
        _agentCoordinator.SessionEnded += OnSessionEnded;
        _agentCoordinator.AgentSwitched += OnAgentSwitched;
        _agentCoordinator.MessageProcessed += OnMessageProcessed;
        _agentCoordinator.AssessmentCompleted += OnAssessmentCompleted;
        
        // Subscribe to realtime service events
        _realtimeService.AudioReceived += OnAudioReceived;
        _realtimeService.ErrorOccurred += OnRealtimeError;
        
        // Subscribe to audio service events
        _audioService.VoiceActivityChanged += OnVoiceActivityChanged;
    }

    /// <summary>
    /// Start a new speech agent session
    /// </summary>
    [Function("StartSpeechSession")]
    public async Task<IActionResult> StartSpeechSession(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "speech/session/start")] HttpRequest req)
    {
        try
        {
            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var request = JsonSerializer.Deserialize<StartSessionRequest>(requestBody);

            if (request == null || string.IsNullOrEmpty(request.UserId))
            {
                return new BadRequestObjectResult("Invalid request: UserId is required");
            }

            var sessionId = await _agentCoordinator.StartSessionAsync(
                request.UserId, 
                request.InitialAgent ?? "coordinator");

            var response = new
            {
                sessionId = sessionId,
                status = "started",
                initialAgent = request.InitialAgent ?? "coordinator",
                timestamp = DateTime.UtcNow
            };

            _logger.LogInformation("Started speech session {SessionId} for user {UserId}", sessionId, request.UserId);

            return new OkObjectResult(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting speech session");
            return new StatusCodeResult(500);
        }
    }

    /// <summary>
    /// Process audio data for a session
    /// </summary>
    [Function("ProcessAudio")]
    public async Task<IActionResult> ProcessAudio(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "speech/session/{sessionId}/audio")] HttpRequest req,
        string sessionId)
    {
        try
        {
            if (string.IsNullOrEmpty(sessionId))
            {
                return new BadRequestObjectResult("SessionId is required");
            }

            using var memoryStream = new MemoryStream();
            await req.Body.CopyToAsync(memoryStream);
            var audioData = memoryStream.ToArray();

            if (audioData.Length == 0)
            {
                return new BadRequestObjectResult("No audio data received");
            }

            await _agentCoordinator.ProcessAudioAsync(sessionId, audioData);

            var response = new
            {
                sessionId = sessionId,
                status = "processed",
                audioLength = audioData.Length,
                timestamp = DateTime.UtcNow
            };

            return new OkObjectResult(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing audio for session {SessionId}", sessionId);
            return new StatusCodeResult(500);
        }
    }

    /// <summary>
    /// Commit audio buffer and trigger response
    /// </summary>
    [Function("CommitAudio")]
    public async Task<IActionResult> CommitAudio(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "speech/session/{sessionId}/audio/commit")] HttpRequest req,
        string sessionId)
    {
        try
        {
            if (string.IsNullOrEmpty(sessionId))
            {
                return new BadRequestObjectResult("SessionId is required");
            }

            await _agentCoordinator.CommitAudioAsync(sessionId);

            var response = new
            {
                sessionId = sessionId,
                status = "committed",
                timestamp = DateTime.UtcNow
            };

            return new OkObjectResult(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error committing audio for session {SessionId}", sessionId);
            return new StatusCodeResult(500);
        }
    }

    /// <summary>
    /// Send text message to a session
    /// </summary>
    [Function("SendMessage")]
    public async Task<IActionResult> SendMessage(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "speech/session/{sessionId}/message")] HttpRequest req,
        string sessionId)
    {
        try
        {
            if (string.IsNullOrEmpty(sessionId))
            {
                return new BadRequestObjectResult("SessionId is required");
            }

            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var request = JsonSerializer.Deserialize<SendMessageRequest>(requestBody);

            if (request == null || string.IsNullOrEmpty(request.Message))
            {
                return new BadRequestObjectResult("Invalid request: Message is required");
            }

            await _agentCoordinator.ProcessTextMessageAsync(sessionId, request.Message);

            var response = new
            {
                sessionId = sessionId,
                status = "sent",
                message = request.Message,
                timestamp = DateTime.UtcNow
            };

            return new OkObjectResult(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message for session {SessionId}", sessionId);
            return new StatusCodeResult(500);
        }
    }

    /// <summary>
    /// Switch agent for a session
    /// </summary>
    [Function("SwitchAgent")]
    public async Task<IActionResult> SwitchAgent(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "speech/session/{sessionId}/agent/switch")] HttpRequest req,
        string sessionId)
    {
        try
        {
            if (string.IsNullOrEmpty(sessionId))
            {
                return new BadRequestObjectResult("SessionId is required");
            }

            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var request = JsonSerializer.Deserialize<SwitchAgentRequest>(requestBody);

            if (request == null || string.IsNullOrEmpty(request.TargetAgent))
            {
                return new BadRequestObjectResult("Invalid request: TargetAgent is required");
            }

            await _agentCoordinator.SwitchAgentAsync(
                sessionId, 
                request.TargetAgent, 
                request.Reason ?? "Manual switch", 
                request.Context);

            var response = new
            {
                sessionId = sessionId,
                targetAgent = request.TargetAgent,
                reason = request.Reason,
                status = "switched",
                timestamp = DateTime.UtcNow
            };

            return new OkObjectResult(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error switching agent for session {SessionId}", sessionId);
            return new StatusCodeResult(500);
        }
    }

    /// <summary>
    /// Start PHQ-2 assessment
    /// </summary>
    [Function("StartPhq2Assessment")]
    public async Task<IActionResult> StartPhq2Assessment(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "speech/session/{sessionId}/assessment/phq2/start")] HttpRequest req,
        string sessionId)
    {
        try
        {
            if (string.IsNullOrEmpty(sessionId))
            {
                return new BadRequestObjectResult("SessionId is required");
            }

            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var request = JsonSerializer.Deserialize<StartAssessmentRequest>(requestBody);

            if (request == null || string.IsNullOrEmpty(request.UserId))
            {
                return new BadRequestObjectResult("Invalid request: UserId is required");
            }

            // Switch to PHQ-2 agent first
            await _agentCoordinator.SwitchAgentAsync(sessionId, "phq2", "Starting PHQ-2 assessment");

            var response = new
            {
                sessionId = sessionId,
                assessmentType = "phq2",
                status = "started",
                timestamp = DateTime.UtcNow
            };

            return new OkObjectResult(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting PHQ-2 assessment for session {SessionId}", sessionId);
            return new StatusCodeResult(500);
        }
    }

    /// <summary>
    /// Start comedy session
    /// </summary>
    [Function("StartComedySession")]
    public async Task<IActionResult> StartComedySession(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "speech/session/{sessionId}/comedy/start")] HttpRequest req,
        string sessionId)
    {
        try
        {
            if (string.IsNullOrEmpty(sessionId))
            {
                return new BadRequestObjectResult("SessionId is required");
            }

            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var request = JsonSerializer.Deserialize<StartComedyRequest>(requestBody);

            if (request == null || string.IsNullOrEmpty(request.UserId))
            {
                return new BadRequestObjectResult("Invalid request: UserId is required");
            }

            // Switch to comedian agent
            await _agentCoordinator.SwitchAgentAsync(sessionId, "comedian", "Starting therapeutic comedy session");

            var response = new
            {
                sessionId = sessionId,
                comedyType = "therapeutic",
                userMood = request.UserMood,
                status = "started",
                timestamp = DateTime.UtcNow
            };

            return new OkObjectResult(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting comedy session for session {SessionId}", sessionId);
            return new StatusCodeResult(500);
        }
    }

    /// <summary>
    /// Get session information
    /// </summary>
    [Function("GetSession")]
    public async Task<IActionResult> GetSession(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "speech/session/{sessionId}")] HttpRequest req,
        string sessionId)
    {
        try
        {
            if (string.IsNullOrEmpty(sessionId))
            {
                return new BadRequestObjectResult("SessionId is required");
            }

            var session = _agentCoordinator.GetSession(sessionId);
            if (session == null)
            {
                return new NotFoundObjectResult("Session not found");
            }

            var response = new
            {
                sessionId = session.SessionId,
                userId = session.UserId,
                currentAgent = session.CurrentAgent,
                status = session.Status.ToString(),
                startTime = session.StartTime,
                lastActivity = session.LastActivity,
                messageCount = session.ConversationHistory.Count,
                assessments = session.Assessments.Keys.ToList()
            };

            return new OkObjectResult(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting session {SessionId}", sessionId);
            return new StatusCodeResult(500);
        }
    }

    /// <summary>
    /// End a session
    /// </summary>
    [Function("EndSession")]
    public async Task<IActionResult> EndSession(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "speech/session/{sessionId}/end")] HttpRequest req,
        string sessionId)
    {
        try
        {
            if (string.IsNullOrEmpty(sessionId))
            {
                return new BadRequestObjectResult("SessionId is required");
            }

            await _agentCoordinator.EndSessionAsync(sessionId);

            var response = new
            {
                sessionId = sessionId,
                status = "ended",
                timestamp = DateTime.UtcNow
            };

            return new OkObjectResult(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error ending session {SessionId}", sessionId);
            return new StatusCodeResult(500);
        }
    }

    /// <summary>
    /// Get available audio devices
    /// </summary>
    [Function("GetAudioDevices")]
    public async Task<IActionResult> GetAudioDevices(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "audio/devices")] HttpRequest req)
    {
        try
        {
            var inputDevices = _audioService.GetAvailableInputDevices();
            var outputDevices = _audioService.GetAvailableOutputDevices();

            var response = new
            {
                inputDevices = inputDevices,
                outputDevices = outputDevices,
                timestamp = DateTime.UtcNow
            };

            return new OkObjectResult(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting audio devices");
            return new StatusCodeResult(500);
        }
    }

    /// <summary>
    /// Get audio levels for visualization
    /// </summary>
    [Function("GetAudioLevels")]
    public async Task<IActionResult> GetAudioLevels(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "audio/levels")] HttpRequest req)
    {
        try
        {
            var levels = _audioService.GetAudioLevels();

            var response = new
            {
                rmsLevel = levels.RmsLevel,
                peakLevel = levels.PeakLevel,
                isSpeaking = levels.IsSpeaking,
                timestamp = DateTime.UtcNow
            };

            return new OkObjectResult(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting audio levels");
            return new StatusCodeResult(500);
        }
    }

    /// <summary>
    /// Health check endpoint
    /// </summary>
    [Function("HealthCheck")]
    public async Task<IActionResult> HealthCheck(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health")] HttpRequest req)
    {
        try
        {
            var response = new
            {
                status = "healthy",
                services = new
                {
                    agentCoordinator = "running",
                    realtimeService = "running",
                    audioService = "running",
                    signalR = "connected"
                },
                timestamp = DateTime.UtcNow,
                version = "1.0.0"
            };

            return new OkObjectResult(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Health check failed");
            return new StatusCodeResult(500);
        }
    }

    // SignalR Event Handlers
    private async void OnSessionStarted(object? sender, SessionStartedEventArgs e)
    {
        try
        {
            await _serviceHubContext.Clients.Group($"session_{e.SessionId}")
                .SendAsync("SessionStarted", new
                {
                    sessionId = e.SessionId,
                    userId = e.UserId,
                    initialAgent = e.InitialAgent,
                    timestamp = DateTime.UtcNow
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending SessionStarted event");
        }
    }

    private async void OnSessionEnded(object? sender, SessionEndedEventArgs e)
    {
        try
        {
            await _serviceHubContext.Clients.Group($"session_{e.SessionId}")
                .SendAsync("SessionEnded", new
                {
                    sessionId = e.SessionId,
                    duration = e.Duration,
                    messageCount = e.MessageCount,
                    assessmentsCompleted = e.AssessmentsCompleted,
                    timestamp = DateTime.UtcNow
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending SessionEnded event");
        }
    }

    private async void OnAgentSwitched(object? sender, AgentSwitchedEventArgs e)
    {
        try
        {
            await _serviceHubContext.Clients.Group($"session_{e.SessionId}")
                .SendAsync("AgentSwitched", new
                {
                    sessionId = e.SessionId,
                    previousAgent = e.PreviousAgent,
                    currentAgent = e.CurrentAgent,
                    reason = e.Reason,
                    context = e.Context,
                    timestamp = DateTime.UtcNow
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending AgentSwitched event");
        }
    }

    private async void OnMessageProcessed(object? sender, MessageProcessedEventArgs e)
    {
        try
        {
            await _serviceHubContext.Clients.Group($"session_{e.SessionId}")
                .SendAsync("MessageProcessed", new
                {
                    sessionId = e.SessionId,
                    message = e.Message,
                    role = e.Role,
                    agent = e.Agent,
                    timestamp = DateTime.UtcNow
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending MessageProcessed event");
        }
    }

    private async void OnAssessmentCompleted(object? sender, AssessmentCompletedEventArgs e)
    {
        try
        {
            await _serviceHubContext.Clients.Group($"session_{e.SessionId}")
                .SendAsync("AssessmentCompleted", new
                {
                    sessionId = e.SessionId,
                    assessmentType = e.AssessmentType,
                    result = e.Result,
                    timestamp = DateTime.UtcNow
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending AssessmentCompleted event");
        }
    }

    private async void OnAudioReceived(object? sender, AudioReceivedEventArgs e)
    {
        try
        {
            // Send audio data to clients for playback
            await _serviceHubContext.Clients.All
                .SendAsync("AudioReceived", new
                {
                    audioData = Convert.ToBase64String(e.AudioData),
                    timestamp = DateTime.UtcNow
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending AudioReceived event");
        }
    }

    private async void OnVoiceActivityChanged(object? sender, VoiceActivityEventArgs e)
    {
        try
        {
            await _serviceHubContext.Clients.All
                .SendAsync("VoiceActivityChanged", new
                {
                    isSpeaking = e.IsSpeaking,
                    confidence = e.Confidence,
                    timestamp = e.Timestamp
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending VoiceActivityChanged event");
        }
    }

    private async void OnRealtimeError(object? sender, ErrorEventArgs e)
    {
        try
        {
            await _serviceHubContext.Clients.All
                .SendAsync("RealtimeError", new
                {
                    message = e.Message,
                    timestamp = DateTime.UtcNow
                });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending RealtimeError event");
        }
    }
}

// Request/Response Models
public class StartSessionRequest
{
    [Required]
    public string UserId { get; set; } = string.Empty;
    public string? InitialAgent { get; set; }
}

public class SendMessageRequest
{
    [Required]
    public string Message { get; set; } = string.Empty;
}

public class SwitchAgentRequest
{
    [Required]
    public string TargetAgent { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public object? Context { get; set; }
}

public class StartAssessmentRequest
{
    [Required]
    public string UserId { get; set; } = string.Empty;
}

public class StartComedyRequest
{
    [Required]
    public string UserId { get; set; } = string.Empty;
    public string? UserMood { get; set; }
}