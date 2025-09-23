namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Therapeutic interaction tracking
/// </summary>
public class TherapeuticInteraction
{
    public string InteractionId { get; set; } = Guid.NewGuid().ToString();
    public string SessionId { get; set; } = string.Empty;
    public string AgentType { get; set; } = string.Empty;
    public string InteractionType { get; set; } = string.Empty; // assessment, therapy, humor
    public Dictionary<string, object> Data { get; set; } = new();
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Outcome { get; set; } = string.Empty;
}