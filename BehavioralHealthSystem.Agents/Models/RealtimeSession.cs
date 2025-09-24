namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Realtime session state
/// </summary>
public class RealtimeSession
{
    public string SessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public DateTime StartTime { get; set; } = DateTime.UtcNow;
    public RealtimeSessionState State { get; set; } = RealtimeSessionState.Idle;
    public string? CurrentAgentType { get; set; }
    public Dictionary<string, object> Context { get; set; } = new();
}