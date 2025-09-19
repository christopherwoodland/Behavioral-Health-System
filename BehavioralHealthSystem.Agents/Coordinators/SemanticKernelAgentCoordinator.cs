using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Agents;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using System.Text.Json;
using BehavioralHealthSystem.Agents.Services;
using BehavioralHealthSystem.Agents.Models;

namespace BehavioralHealthSystem.Agents.Coordinators;

/// <summary>
/// Semantic Kernel-based agent coordinator for managing behavioral health agents
/// Handles agent orchestration, session management, and conversation flow
/// </summary>
public class SemanticKernelAgentCoordinator : IDisposable
{
    private readonly ILogger<SemanticKernelAgentCoordinator> _logger;
    private readonly Kernel _kernel;
    private readonly SemanticKernelRealtimeService _realtimeService;
    private readonly ConcurrentDictionary<string, AgentSession> _sessions = new();
    private readonly ConcurrentDictionary<string, ChatAgent> _agents = new();
    
    // Agent definitions
    private readonly Dictionary<string, AgentDefinition> _agentDefinitions;
    
    // Events
    public event EventHandler<SessionStartedEventArgs>? SessionStarted;
    public event EventHandler<SessionEndedEventArgs>? SessionEnded;
    public event EventHandler<AgentSwitchedEventArgs>? AgentSwitched;
    public event EventHandler<MessageProcessedEventArgs>? MessageProcessed;
    public event EventHandler<AssessmentCompletedEventArgs>? AssessmentCompleted;

    public SemanticKernelAgentCoordinator(
        ILogger<SemanticKernelAgentCoordinator> logger,
        Kernel kernel,
        SemanticKernelRealtimeService realtimeService)
    {
        _logger = logger;
        _kernel = kernel;
        _realtimeService = realtimeService;
        
        // Initialize agent definitions
        _agentDefinitions = InitializeAgentDefinitions();
        
        // Subscribe to realtime service events
        _realtimeService.SessionCreated += OnSessionCreated;
        _realtimeService.AgentHandoffRequested += OnAgentHandoffRequested;
        _realtimeService.ConversationItemCompleted += OnConversationItemCompleted;
        _realtimeService.ErrorOccurred += OnErrorOccurred;
        
        // Initialize agents
        InitializeAgents();
    }

    /// <summary>
    /// Start a new behavioral health session
    /// </summary>
    public async Task<string> StartSessionAsync(
        string userId, 
        string? initialAgent = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var sessionId = Guid.NewGuid().ToString();
            var session = new AgentSession
            {
                SessionId = sessionId,
                UserId = userId,
                CurrentAgent = initialAgent ?? "coordinator",
                StartTime = DateTime.UtcNow,
                Status = SessionStatus.Active,
                ConversationHistory = new List<ConversationItem>(),
                Assessments = new Dictionary<string, object>()
            };

            _sessions.TryAdd(sessionId, session);

            // Connect to realtime service
            await _realtimeService.ConnectAsync(cancellationToken);

            _logger.LogInformation("Started session {SessionId} for user {UserId} with agent {Agent}", 
                sessionId, userId, session.CurrentAgent);

            SessionStarted?.Invoke(this, new SessionStartedEventArgs
            {
                SessionId = sessionId,
                UserId = userId,
                InitialAgent = session.CurrentAgent
            });

            return sessionId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting session for user {UserId}", userId);
            throw;
        }
    }

    /// <summary>
    /// Process audio input for a session
    /// </summary>
    public async Task ProcessAudioAsync(
        string sessionId, 
        byte[] audioData, 
        CancellationToken cancellationToken = default)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
        {
            _logger.LogWarning("Session {SessionId} not found", sessionId);
            return;
        }

        try
        {
            // Send audio to realtime service
            await _realtimeService.SendAudioAsync(audioData, cancellationToken);
            
            // Update session activity
            session.LastActivity = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing audio for session {SessionId}", sessionId);
            throw;
        }
    }

    /// <summary>
    /// Commit audio buffer and trigger response
    /// </summary>
    public async Task CommitAudioAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
        {
            _logger.LogWarning("Session {SessionId} not found", sessionId);
            return;
        }

        try
        {
            await _realtimeService.CommitAudioAsync(cancellationToken);
            session.LastActivity = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error committing audio for session {SessionId}", sessionId);
            throw;
        }
    }

    /// <summary>
    /// Process text message for a session
    /// </summary>
    public async Task ProcessTextMessageAsync(
        string sessionId, 
        string message, 
        CancellationToken cancellationToken = default)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
        {
            _logger.LogWarning("Session {SessionId} not found", sessionId);
            return;
        }

        try
        {
            // Add to conversation history
            session.ConversationHistory.Add(new ConversationItem
            {
                Role = "user",
                Content = message,
                Timestamp = DateTime.UtcNow,
                Agent = session.CurrentAgent
            });

            // Send to realtime service
            await _realtimeService.SendTextMessageAsync(message, cancellationToken);
            
            session.LastActivity = DateTime.UtcNow;

            MessageProcessed?.Invoke(this, new MessageProcessedEventArgs
            {
                SessionId = sessionId,
                Message = message,
                Role = "user",
                Agent = session.CurrentAgent
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing text message for session {SessionId}", sessionId);
            throw;
        }
    }

    /// <summary>
    /// Switch to a different agent
    /// </summary>
    public async Task SwitchAgentAsync(
        string sessionId, 
        string targetAgent, 
        string reason,
        object? context = null,
        CancellationToken cancellationToken = default)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
        {
            _logger.LogWarning("Session {SessionId} not found", sessionId);
            return;
        }

        if (!_agentDefinitions.ContainsKey(targetAgent))
        {
            _logger.LogWarning("Agent {Agent} not found", targetAgent);
            return;
        }

        try
        {
            var previousAgent = session.CurrentAgent;
            session.CurrentAgent = targetAgent;
            session.LastActivity = DateTime.UtcNow;

            // Add agent switch to conversation history
            session.ConversationHistory.Add(new ConversationItem
            {
                Role = "system",
                Content = $"Agent switched from {previousAgent} to {targetAgent}: {reason}",
                Timestamp = DateTime.UtcNow,
                Agent = targetAgent
            });

            // Switch agent in realtime service
            await _realtimeService.SwitchAgentAsync(targetAgent, reason, context, cancellationToken);

            _logger.LogInformation("Switched agent for session {SessionId} from {PreviousAgent} to {CurrentAgent}: {Reason}",
                sessionId, previousAgent, targetAgent, reason);

            AgentSwitched?.Invoke(this, new AgentSwitchedEventArgs
            {
                SessionId = sessionId,
                PreviousAgent = previousAgent,
                CurrentAgent = targetAgent,
                Reason = reason,
                Context = context
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error switching agent for session {SessionId}", sessionId);
            throw;
        }
    }

    /// <summary>
    /// Complete an assessment (PHQ-2, etc.)
    /// </summary>
    public async Task CompleteAssessmentAsync(
        string sessionId, 
        string assessmentType, 
        object assessmentResult,
        CancellationToken cancellationToken = default)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
        {
            _logger.LogWarning("Session {SessionId} not found", sessionId);
            return;
        }

        try
        {
            session.Assessments[assessmentType] = assessmentResult;
            session.LastActivity = DateTime.UtcNow;

            // Add assessment completion to conversation history
            session.ConversationHistory.Add(new ConversationItem
            {
                Role = "system",
                Content = $"Assessment completed: {assessmentType}",
                Timestamp = DateTime.UtcNow,
                Agent = session.CurrentAgent
            });

            _logger.LogInformation("Assessment {AssessmentType} completed for session {SessionId}", 
                assessmentType, sessionId);

            AssessmentCompleted?.Invoke(this, new AssessmentCompletedEventArgs
            {
                SessionId = sessionId,
                AssessmentType = assessmentType,
                Result = assessmentResult
            });

            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error completing assessment for session {SessionId}", sessionId);
            throw;
        }
    }

    /// <summary>
    /// End a session
    /// </summary>
    public async Task EndSessionAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        if (!_sessions.TryGetValue(sessionId, out var session))
        {
            _logger.LogWarning("Session {SessionId} not found", sessionId);
            return;
        }

        try
        {
            session.Status = SessionStatus.Completed;
            session.EndTime = DateTime.UtcNow;

            // Disconnect from realtime service
            await _realtimeService.DisconnectAsync();

            _logger.LogInformation("Ended session {SessionId}", sessionId);

            SessionEnded?.Invoke(this, new SessionEndedEventArgs
            {
                SessionId = sessionId,
                Duration = session.EndTime.Value - session.StartTime,
                MessageCount = session.ConversationHistory.Count,
                AssessmentsCompleted = session.Assessments.Keys.ToList()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error ending session {SessionId}", sessionId);
            throw;
        }
    }

    /// <summary>
    /// Get session information
    /// </summary>
    public AgentSession? GetSession(string sessionId)
    {
        _sessions.TryGetValue(sessionId, out var session);
        return session;
    }

    /// <summary>
    /// Get active sessions for a user
    /// </summary>
    public IEnumerable<AgentSession> GetUserSessions(string userId)
    {
        return _sessions.Values.Where(s => s.UserId == userId);
    }

    /// <summary>
    /// Initialize agent definitions
    /// </summary>
    private Dictionary<string, AgentDefinition> InitializeAgentDefinitions()
    {
        return new Dictionary<string, AgentDefinition>
        {
            ["coordinator"] = new AgentDefinition
            {
                Name = "coordinator",
                DisplayName = "Maestro",
                Description = "Compassionate coordinator for behavioral health services",
                Capabilities = new[] { "general_support", "triage", "handoff_coordination" },
                Instructions = @"
You are the Maestro, a compassionate coordinator for behavioral health services. Your role is to:
1. Welcome users and understand their needs
2. Provide general mental health support and information  
3. Assess when specialized agents are needed
4. Hand off to appropriate specialists (PHQ-2 for depression screening, comedian for mood lifting)
5. Maintain conversation flow and context

Guidelines:
- Be warm, empathetic, and professional
- Ask open-ended questions to understand user needs
- Recognize when PHQ-2 screening might be helpful
- Use humor appropriately but defer to comedian agent for intentional comedy
- Always prioritize user safety and well-being
- If user expresses suicidal thoughts, provide crisis resources immediately"
            },

            ["phq2"] = new AgentDefinition
            {
                Name = "phq2",
                DisplayName = "PHQ-2 Specialist",
                Description = "Specialized agent for conducting PHQ-2 depression screenings",
                Capabilities = new[] { "depression_screening", "clinical_assessment", "risk_evaluation" },
                Instructions = @"
You are a specialized agent for conducting PHQ-2 depression screenings through voice interaction.

PHQ-2 Questions:
1. 'Over the last 2 weeks, how often have you been bothered by little interest or pleasure in doing things?'
2. 'Over the last 2 weeks, how often have you been bothered by feeling down, depressed, or hopeless?'

Response options for each question:
- Not at all (0 points)
- Several days (1 point)  
- More than half the days (2 points)
- Nearly every day (3 points)

Protocol:
1. Explain the PHQ-2 screening process clearly
2. Ask questions one at a time, wait for complete responses
3. Clarify responses if unclear
4. Calculate total score (0-6)
5. Provide appropriate feedback based on score:
   - 0-2: Low risk, provide general wellness resources
   - 3+: Suggest further evaluation, provide mental health resources
6. Hand back to coordinator with results

Be empathetic, non-judgmental, and professional throughout the screening."
            },

            ["comedian"] = new AgentDefinition
            {
                Name = "comedian",
                DisplayName = "Therapeutic Comedian",
                Description = "Therapeutic comedian for mood lifting in mental health contexts",
                Capabilities = new[] { "therapeutic_humor", "mood_lifting", "stress_relief" },
                Instructions = @"
You are a therapeutic comedian agent designed to provide appropriate humor and mood lifting for mental health contexts.

Guidelines:
- Use clean, uplifting humor
- Avoid sensitive topics (mental illness, trauma, etc.)
- Focus on wordplay, observational humor, and light-hearted stories
- Be responsive to user's mood and adjust humor accordingly
- Know when to be serious - mental health is important
- Always check if user wants to continue with humor
- Hand back to coordinator when humor session is complete

Remember: Your goal is therapeutic benefit through appropriate levity, not entertainment."
            }
        };
    }

    /// <summary>
    /// Initialize Semantic Kernel agents
    /// </summary>
    private void InitializeAgents()
    {
        try
        {
            foreach (var agentDef in _agentDefinitions.Values)
            {
                var agent = new ChatCompletionAgent()
                {
                    Name = agentDef.Name,
                    Instructions = agentDef.Instructions,
                    Kernel = _kernel
                };

                _agents.TryAdd(agentDef.Name, agent);
                _logger.LogDebug("Initialized agent: {AgentName}", agentDef.Name);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initializing Semantic Kernel agents");
            throw;
        }
    }

    // Event Handlers
    private void OnSessionCreated(object? sender, SessionCreatedEventArgs e)
    {
        _logger.LogInformation("GPT-Realtime session created: {SessionId}", e.SessionId);
    }

    private async void OnAgentHandoffRequested(object? sender, AgentHandoffEventArgs e)
    {
        _logger.LogInformation("Agent handoff requested: {FromAgent} -> {ToAgent} ({Reason})", 
            e.FromAgent, e.ToAgent, e.Reason);

        // Find session for this handoff (would need session tracking in realtime service)
        // For now, we'll handle handoffs through the public API
        await Task.CompletedTask;
    }

    private void OnConversationItemCompleted(object? sender, ConversationItemEventArgs e)
    {
        _logger.LogDebug("Conversation item completed - Role: {Role}, Agent: {Agent}", e.Role, e.Agent);

        // Find the session and add to conversation history
        var session = _sessions.Values.FirstOrDefault(s => s.CurrentAgent == e.Agent);
        if (session != null)
        {
            session.ConversationHistory.Add(new ConversationItem
            {
                Role = e.Role,
                Content = e.Content,
                Timestamp = DateTime.UtcNow,
                Agent = e.Agent
            });

            MessageProcessed?.Invoke(this, new MessageProcessedEventArgs
            {
                SessionId = session.SessionId,
                Message = e.Content,
                Role = e.Role,
                Agent = e.Agent
            });
        }
    }

    private void OnErrorOccurred(object? sender, ErrorEventArgs e)
    {
        _logger.LogError("GPT-Realtime error: {Error}", e.Message);
    }

    public void Dispose()
    {
        try
        {
            // End all active sessions
            var activeSessions = _sessions.Values.Where(s => s.Status == SessionStatus.Active).ToList();
            foreach (var session in activeSessions)
            {
                EndSessionAsync(session.SessionId).GetAwaiter().GetResult();
            }

            // Dispose agents
            foreach (var agent in _agents.Values)
            {
                if (agent is IDisposable disposableAgent)
                {
                    disposableAgent.Dispose();
                }
            }

            _agents.Clear();
            _sessions.Clear();

            _realtimeService.SessionCreated -= OnSessionCreated;
            _realtimeService.AgentHandoffRequested -= OnAgentHandoffRequested;
            _realtimeService.ConversationItemCompleted -= OnConversationItemCompleted;
            _realtimeService.ErrorOccurred -= OnErrorOccurred;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error disposing SemanticKernelAgentCoordinator");
        }
    }
}

// Supporting Classes and Event Args
public class AgentDefinition
{
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string[] Capabilities { get; set; } = Array.Empty<string>();
    public string Instructions { get; set; } = string.Empty;
}

public class SessionStartedEventArgs : EventArgs
{
    public string SessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string InitialAgent { get; set; } = string.Empty;
}

public class SessionEndedEventArgs : EventArgs
{
    public string SessionId { get; set; } = string.Empty;
    public TimeSpan Duration { get; set; }
    public int MessageCount { get; set; }
    public List<string> AssessmentsCompleted { get; set; } = new();
}

public class AgentSwitchedEventArgs : EventArgs
{
    public string SessionId { get; set; } = string.Empty;
    public string PreviousAgent { get; set; } = string.Empty;
    public string CurrentAgent { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public object? Context { get; set; }
}

public class MessageProcessedEventArgs : EventArgs
{
    public string SessionId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Agent { get; set; } = string.Empty;
}

public class AssessmentCompletedEventArgs : EventArgs
{
    public string SessionId { get; set; } = string.Empty;
    public string AssessmentType { get; set; } = string.Empty;
    public object Result { get; set; } = new();
}