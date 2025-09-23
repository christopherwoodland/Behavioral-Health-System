namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Represents an active agent session
/// </summary>
public class AgentSession
{
    public string SessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string CurrentAgent { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public DateTime LastActivity { get; set; }
    public SessionStatus Status { get; set; }
    public List<ConversationItem> ConversationHistory { get; set; } = new();
    public Dictionary<string, object> Assessments { get; set; } = new();
    public Dictionary<string, object> Metadata { get; set; } = new();
}