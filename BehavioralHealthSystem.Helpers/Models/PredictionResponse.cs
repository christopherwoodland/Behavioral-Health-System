namespace BehavioralHealthSystem.Models;

public class PredictionResponse
{
    [JsonPropertyName("session_id")]
    public string SessionId { get; set; } = string.Empty;
    
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;
}
