using BehavioralHealthSystem.Agents.Interfaces;

namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Represents an active handoff session between agents
/// </summary>
public class HandoffSession
{
    public string SessionId { get; set; } = Guid.NewGuid().ToString();
    public string UserId { get; set; } = string.Empty;
    public string CurrentAgentId { get; set; } = string.Empty;
    public IHandoffAgent CurrentAgent { get; set; } = null!;
    public Dictionary<string, object> Context { get; set; } = new();
    public DateTime StartTime { get; set; } = DateTime.UtcNow;
    public DateTime? EndTime { get; set; }
    public DateTime? LastHandoffTime { get; set; }
    public List<string> AgentHistory { get; set; } = new();
}