namespace BehavioralHealthSystem.Models;

public class PredictError
{
    [JsonPropertyName("detail")]
    public string Detail { get; set; } = string.Empty;
    
    [JsonPropertyName("status")]
    public int Status { get; set; }
    
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;
    
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;
}
