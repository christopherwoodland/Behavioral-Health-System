namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Conversation context for agents
/// </summary>
public class ConversationContext
{
    public string SessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public List<ConversationTurn> History { get; set; } = new();
    public Dictionary<string, object> UserData { get; set; } = new();
    public string CurrentMood { get; set; } = "neutral";
    public List<string> Topics { get; set; } = new();
}