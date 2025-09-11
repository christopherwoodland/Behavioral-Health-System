namespace BehavioralHealthSystem.Models;

public class InitiateRequest
{
    [JsonPropertyName("isInitiated")]
    public bool IsInitiated { get; set; } = true;
    
    [JsonPropertyName("metadata")]
    public UserMetadata? Metadata { get; set; }
    
    [JsonPropertyName("userId")]
    public string UserId { get; set; } = string.Empty;
}
