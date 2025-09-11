using System.Text.Json.Serialization;

namespace BehavioralHealthSystem.Models;

public class SessionPredictError
{
    [JsonPropertyName("error")]
    public string Error { get; set; } = string.Empty;
    
    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;
}
