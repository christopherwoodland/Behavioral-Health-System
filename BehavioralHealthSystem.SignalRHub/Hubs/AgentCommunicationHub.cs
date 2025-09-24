using Microsoft.AspNetCore.SignalR;

namespace BehavioralHealthSystem.SignalRHub.Hubs;

public class AgentCommunicationHub : Hub
{
    private readonly ILogger<AgentCommunicationHub> _logger;

    public AgentCommunicationHub(ILogger<AgentCommunicationHub> logger)
    {
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Join a session group
    /// </summary>
    public async Task JoinSession(string sessionId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"session_{sessionId}");
        _logger.LogInformation("Connection {ConnectionId} joined session {SessionId}", Context.ConnectionId, sessionId);
    }

    /// <summary>
    /// Leave a session group
    /// </summary>
    public async Task LeaveSession(string sessionId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"session_{sessionId}");
        _logger.LogInformation("Connection {ConnectionId} left session {SessionId}", Context.ConnectionId, sessionId);
    }

    /// <summary>
    /// Send a user message to the server
    /// </summary>
    public async Task SendUserMessage(string sessionId, string content, string? audioData = null)
    {
        _logger.LogInformation("Received user message for session {SessionId}: {Content}", sessionId, content);
        
        // TODO: Call Azure Functions to process the message with agents
        // For now, echo back a simple response
        await Clients.Group($"session_{sessionId}").SendAsync("AgentMessage", new
        {
            agentName = "Echo Agent",
            content = $"You said: {content}",
            timestamp = DateTime.UtcNow.ToString("O"),
            confidence = 1.0
        });
    }

    /// <summary>
    /// Send an agent message to clients in a session
    /// </summary>
    public async Task SendAgentMessage(string sessionId, string agentName, string content, double? confidence = null, string[]? suggestedActions = null)
    {
        var message = new
        {
            agentName,
            content,
            timestamp = DateTime.UtcNow.ToString("O"),
            confidence,
            suggestedActions
        };

        await Clients.Group($"session_{sessionId}").SendAsync("AgentMessage", message);
        _logger.LogInformation("Sent agent message from {AgentName} to session {SessionId}", agentName, sessionId);
    }

    /// <summary>
    /// Send agent handoff notification
    /// </summary>
    public async Task SendAgentHandoff(string sessionId, string fromAgent, string toAgent, string reason)
    {
        var notification = new
        {
            fromAgent,
            toAgent,
            reason,
            timestamp = DateTime.UtcNow.ToString("O")
        };

        await Clients.Group($"session_{sessionId}").SendAsync("AgentHandoff", notification);
        _logger.LogInformation("Agent handoff from {FromAgent} to {ToAgent} in session {SessionId}: {Reason}", 
            fromAgent, toAgent, sessionId, reason);
    }

    /// <summary>
    /// Send agent typing notification
    /// </summary>
    public async Task SendAgentTyping(string sessionId, string agentName, bool isTyping)
    {
        var notification = new
        {
            agentName,
            isTyping,
            timestamp = DateTime.UtcNow.ToString("O")
        };

        await Clients.Group($"session_{sessionId}").SendAsync("AgentTyping", notification);
    }
}