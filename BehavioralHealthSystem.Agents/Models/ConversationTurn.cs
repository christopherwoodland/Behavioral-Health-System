namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Conversation turn for tracking conversation history
/// </summary>
public class ConversationTurn
{
    public string Role { get; set; } = string.Empty; // user, assistant, system
    public string Content { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? AgentType { get; set; }
}