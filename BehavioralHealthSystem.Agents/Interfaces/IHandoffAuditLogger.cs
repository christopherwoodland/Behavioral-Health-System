namespace BehavioralHealthSystem.Agents.Interfaces;

/// <summary>
/// Interface for auditing and logging handoff activities
/// </summary>
public interface IHandoffAuditLogger
{
    Task LogSessionStartAsync(HandoffSession session);
    Task LogSessionEndAsync(HandoffSession session, string reason);
    Task LogUserInputAsync(string sessionId, string userInput);
    Task LogHandoffAsync(string sessionId, string fromAgentId, string toAgentId, string reason);
    Task LogAgentCompletionAsync(string sessionId, string agentId, HandoffCompletionResult result);
    Task LogCrisisAsync(string sessionId, HandoffCrisisLevel level, string message);
    Task LogErrorAsync(string sessionId, string errorMessage);
}

/// <summary>
/// Default implementation of handoff audit logger
/// </summary>
public class HandoffAuditLogger : IHandoffAuditLogger
{
    private readonly ILogger<HandoffAuditLogger> _logger;

    public HandoffAuditLogger(ILogger<HandoffAuditLogger> logger)
    {
        _logger = logger;
    }

    public Task LogSessionStartAsync(HandoffSession session)
    {
        _logger.LogInformation("[HANDOFF_AUDIT] Session started: {SessionId} for user {UserId} at {StartTime}",
            session.SessionId, session.UserId, session.StartTime);
        return Task.CompletedTask;
    }

    public Task LogSessionEndAsync(HandoffSession session, string reason)
    {
        var duration = session.EndTime - session.StartTime;
        _logger.LogInformation("[HANDOFF_AUDIT] Session ended: {SessionId} for user {UserId}. Duration: {Duration}. Reason: {Reason}",
            session.SessionId, session.UserId, duration, reason);
        return Task.CompletedTask;
    }

    public Task LogUserInputAsync(string sessionId, string userInput)
    {
        _logger.LogInformation("[HANDOFF_AUDIT] User input in session {SessionId}: {UserInput}",
            sessionId, userInput);
        return Task.CompletedTask;
    }

    public Task LogHandoffAsync(string sessionId, string fromAgentId, string toAgentId, string reason)
    {
        _logger.LogInformation("[HANDOFF_AUDIT] Agent handoff in session {SessionId}: {FromAgent} -> {ToAgent}. Reason: {Reason}",
            sessionId, fromAgentId, toAgentId, reason);
        return Task.CompletedTask;
    }

    public Task LogAgentCompletionAsync(string sessionId, string agentId, HandoffCompletionResult result)
    {
        _logger.LogInformation("[HANDOFF_AUDIT] Agent completion in session {SessionId}: {AgentId}. Success: {Success}",
            sessionId, agentId, result.Success);
        return Task.CompletedTask;
    }

    public Task LogCrisisAsync(string sessionId, HandoffCrisisLevel level, string message)
    {
        _logger.LogWarning("[HANDOFF_AUDIT] CRISIS DETECTED in session {SessionId}: Level {Level} - {Message}",
            sessionId, level, message);
        return Task.CompletedTask;
    }

    public Task LogErrorAsync(string sessionId, string errorMessage)
    {
        _logger.LogError("[HANDOFF_AUDIT] Error in session {SessionId}: {ErrorMessage}",
            sessionId, errorMessage);
        return Task.CompletedTask;
    }
}