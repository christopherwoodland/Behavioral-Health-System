namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Agent response with audio
/// </summary>
public class AgentResponse
{
    public string Text { get; set; } = string.Empty;
    public byte[]? AudioData { get; set; }
    public string AgentType { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public Dictionary<string, object> Metadata { get; set; } = new();
}