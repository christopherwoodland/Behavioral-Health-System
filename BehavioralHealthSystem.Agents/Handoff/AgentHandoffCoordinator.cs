using BehavioralHealthSystem.Agents.Interfaces;
using BehavioralHealthSystem.Agents.Models;

namespace BehavioralHealthSystem.Agents.Handoff;

/// <summary>
/// Manages agent handoffs in a human-in-the-loop conversation system
/// Ensures only one agent interacts with the user at a time
/// </summary>
public class AgentHandoffCoordinator
{
    private readonly ILogger<AgentHandoffCoordinator> _logger;
    private readonly Dictionary<string, IHandoffAgent> _registeredAgents = new();
    private readonly Dictionary<string, HandoffSession> _activeSessions = new();
    private readonly IHandoffAuditLogger _auditLogger;

    public AgentHandoffCoordinator(ILogger<AgentHandoffCoordinator> logger, IHandoffAuditLogger auditLogger)
    {
        _logger = logger;
        _auditLogger = auditLogger;
    }

    /// <summary>
    /// Registers an agent for handoff participation
    /// </summary>
    public void RegisterAgent(IHandoffAgent agent)
    {
        _registeredAgents[agent.AgentId] = agent;
        _logger.LogInformation("Registered handoff agent: {AgentId} - {Name}", agent.AgentId, agent.Name);
    }

    /// <summary>
    /// Starts a new handoff session for a user
    /// </summary>
    public async Task<HandoffSession> StartSessionAsync(string userId, IHandoffAgent coordinatorAgent)
    {
        var session = new HandoffSession
        {
            SessionId = Guid.NewGuid().ToString(),
            UserId = userId,
            StartTime = DateTime.UtcNow,
            CurrentAgent = coordinatorAgent,
            Context = new Dictionary<string, object>()
        };

        _activeSessions[userId] = session;
        
        await _auditLogger.LogSessionStartAsync(session);
        _logger.LogInformation("Started handoff session {SessionId} for user {UserId}", session.SessionId, userId);

        return session;
    }

    /// <summary>
    /// Processes user input and manages handoffs
    /// </summary>
    public async Task<HandoffResponse> ProcessUserInputAsync(string userId, string userInput)
    {
        if (!_activeSessions.TryGetValue(userId, out var session))
        {
            throw new InvalidOperationException($"No active session found for user {userId}");
        }

        try
        {
            await _auditLogger.LogUserInputAsync(session.SessionId, userInput);

            // Check if current agent can continue or needs to hand off
            var processingResult = await session.CurrentAgent.ProcessInputAsync(userId, userInput, session.Context);

            // Update session context
            foreach (var kvp in processingResult.UpdatedContext)
            {
                session.Context[kvp.Key] = kvp.Value;
            }

            // Handle crisis situations immediately
            if (processingResult.CrisisLevel >= HandoffCrisisLevel.High)
            {
                await HandleCrisisAsync(session, processingResult.CrisisLevel, processingResult.ResponseMessage);
                return new HandoffResponse
                {
                    Success = true,
                    Message = processingResult.ResponseMessage ?? "Crisis detected. Emergency protocols activated.",
                    CurrentAgent = session.CurrentAgent.Name,
                    CrisisLevel = processingResult.CrisisLevel
                };
            }

            // Check if agent wants to complete or hand back
            if (processingResult.IsComplete || processingResult.RequiresImmediateHandback)
            {
                var completionResult = await session.CurrentAgent.CompleteHandoffAsync(userId, session.Context);
                
                // Log completion
                await _auditLogger.LogAgentCompletionAsync(session.SessionId, session.CurrentAgent.AgentId, completionResult);

                // Update context with completion data
                foreach (var kvp in completionResult.UpdatedContext)
                {
                    session.Context[kvp.Key] = kvp.Value;
                }

                // Determine next agent
                IHandoffAgent? nextAgent = null;
                
                if (!string.IsNullOrEmpty(completionResult.SuggestedNextAgent))
                {
                    _registeredAgents.TryGetValue(completionResult.SuggestedNextAgent, out nextAgent);
                }

                // If no specific next agent, find the coordinator agent
                if (nextAgent == null)
                {
                    nextAgent = _registeredAgents.Values.FirstOrDefault(a => a.AgentId == "coordinator");
                }

                if (nextAgent != null && nextAgent != session.CurrentAgent)
                {
                    await HandoffToAgentAsync(session, nextAgent, "Task completion");
                }

                return new HandoffResponse
                {
                    Success = true,
                    Message = BuildCompletionMessage(processingResult.ResponseMessage, completionResult.CompletionMessage),
                    CurrentAgent = session.CurrentAgent.Name,
                    HandoffOccurred = nextAgent != null && nextAgent != session.CurrentAgent
                };
            }

            // Check if we need to hand off to a different agent
            var targetAgent = await DetectHandoffTriggerAsync(userInput, session.Context);
            
            if (targetAgent != null && targetAgent != session.CurrentAgent)
            {
                await HandoffToAgentAsync(session, targetAgent, $"User input triggered handoff: {userInput}");
                
                var initResult = await targetAgent.InitializeHandoffAsync(userId, session.Context);
                
                return new HandoffResponse
                {
                    Success = initResult.Success,
                    Message = initResult.InitialMessage ?? processingResult.ResponseMessage,
                    ErrorMessage = initResult.ErrorMessage,
                    CurrentAgent = session.CurrentAgent.Name,
                    HandoffOccurred = true
                };
            }

            // Continue with current agent
            return new HandoffResponse
            {
                Success = processingResult.Success,
                Message = processingResult.ResponseMessage,
                ErrorMessage = processingResult.ErrorMessage,
                CurrentAgent = session.CurrentAgent.Name,
                CrisisLevel = processingResult.CrisisLevel
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing user input for session {SessionId}", session.SessionId);
            await _auditLogger.LogErrorAsync(session.SessionId, ex.Message);
            
            return new HandoffResponse
            {
                Success = false,
                ErrorMessage = "I encountered an error processing your request. Please try again.",
                CurrentAgent = session.CurrentAgent.Name
            };
        }
    }

    /// <summary>
    /// Forces a handoff to a specific agent
    /// </summary>
    public async Task<HandoffResponse> ForceHandoffAsync(string userId, string targetAgentId, string reason)
    {
        if (!_activeSessions.TryGetValue(userId, out var session))
        {
            throw new InvalidOperationException($"No active session found for user {userId}");
        }

        if (!_registeredAgents.TryGetValue(targetAgentId, out var targetAgent))
        {
            throw new ArgumentException($"Agent {targetAgentId} not found");
        }

        await HandoffToAgentAsync(session, targetAgent, $"Forced handoff: {reason}");
        
        var initResult = await targetAgent.InitializeHandoffAsync(userId, session.Context);
        
        return new HandoffResponse
        {
            Success = initResult.Success,
            Message = initResult.InitialMessage,
            ErrorMessage = initResult.ErrorMessage,
            CurrentAgent = session.CurrentAgent.Name,
            HandoffOccurred = true
        };
    }

    /// <summary>
    /// Ends a handoff session
    /// </summary>
    public async Task EndSessionAsync(string userId, string reason = "Session ended")
    {
        if (_activeSessions.TryGetValue(userId, out var session))
        {
            session.EndTime = DateTime.UtcNow;
            
            try
            {
                await session.CurrentAgent.CompleteHandoffAsync(userId, session.Context);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error completing agent during session end");
            }

            await _auditLogger.LogSessionEndAsync(session, reason);
            _activeSessions.Remove(userId);
            
            _logger.LogInformation("Ended handoff session {SessionId} for user {UserId}: {Reason}", 
                session.SessionId, userId, reason);
        }
    }

    /// <summary>
    /// Gets current session info for a user
    /// </summary>
    public HandoffSession? GetCurrentSession(string userId)
    {
        _activeSessions.TryGetValue(userId, out var session);
        return session;
    }

    private async Task HandoffToAgentAsync(HandoffSession session, IHandoffAgent targetAgent, string reason)
    {
        var previousAgent = session.CurrentAgent;
        
        try
        {
            // Complete current agent
            await previousAgent.CompleteHandoffAsync(session.UserId, session.Context);
            
            // Update session
            session.CurrentAgent = targetAgent;
            session.LastHandoffTime = DateTime.UtcNow;
            
            // Log the handoff
            await _auditLogger.LogHandoffAsync(session.SessionId, previousAgent.AgentId, targetAgent.AgentId, reason);
            
            _logger.LogInformation("Handed off from {FromAgent} to {ToAgent} in session {SessionId}: {Reason}",
                previousAgent.Name, targetAgent.Name, session.SessionId, reason);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during handoff from {FromAgent} to {ToAgent}", 
                previousAgent.Name, targetAgent.Name);
            
            // Attempt to revert
            try
            {
                await targetAgent.HandleInterruptionAsync(session.UserId, "Handoff failed");
            }
            catch { }
            
            throw;
        }
    }

    private Task<IHandoffAgent?> DetectHandoffTriggerAsync(string userInput, Dictionary<string, object> context)
    {
        var eligibleAgents = new List<(IHandoffAgent agent, int priority)>();
        
        foreach (var agent in _registeredAgents.Values)
        {
            if (agent.CanHandle(userInput, context))
            {
                eligibleAgents.Add((agent, agent.Priority));
            }
        }

        // Return highest priority agent
        var selectedAgent = eligibleAgents
            .OrderByDescending(x => x.priority)
            .FirstOrDefault().agent;
            
        return Task.FromResult<IHandoffAgent?>(selectedAgent);
    }

    private async Task HandleCrisisAsync(HandoffSession session, HandoffCrisisLevel level, string? message)
    {
        await _auditLogger.LogCrisisAsync(session.SessionId, level, message ?? "Crisis detected");
        
        // TODO: Implement crisis escalation procedures
        // - Notify supervisors
        // - Log to emergency systems
        // - Potentially contact emergency services
        
        _logger.LogWarning("Crisis level {Level} detected in session {SessionId}", level, session.SessionId);
    }

    private static string BuildCompletionMessage(string? processingMessage, string? completionMessage)
    {
        if (!string.IsNullOrEmpty(processingMessage) && !string.IsNullOrEmpty(completionMessage))
        {
            return $"{processingMessage}\n\n{completionMessage}";
        }
        
        return processingMessage ?? completionMessage ?? "Task completed.";
    }
}

/// <summary>
/// Response from handoff coordinator
/// </summary>
public class HandoffResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? ErrorMessage { get; set; }
    public string CurrentAgent { get; set; } = "";
    public bool HandoffOccurred { get; set; }
    public HandoffCrisisLevel CrisisLevel { get; set; } = HandoffCrisisLevel.None;
}