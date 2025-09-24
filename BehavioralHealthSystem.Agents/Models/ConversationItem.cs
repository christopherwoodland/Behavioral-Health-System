namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Represents a conversation item in the session history
/// </summary>
public class ConversationItem
{
    public string Role { get; set; } = string.Empty; // "user", "assistant", "system"
    public string Content { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string Agent { get; set; } = string.Empty;
    public Dictionary<string, object> Metadata { get; set; } = new();
}