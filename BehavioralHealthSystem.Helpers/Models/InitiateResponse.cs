namespace BehavioralHealthSystem.Models;

public class InitiateResponse
{
    [JsonPropertyName("session_id")]
    public string SessionId { get; set; } = string.Empty;
}
