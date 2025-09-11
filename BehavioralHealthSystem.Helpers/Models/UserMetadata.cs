namespace BehavioralHealthSystem.Models;

public class UserMetadata
{
    [JsonPropertyName("age")]
    public int Age { get; set; }
    
    [JsonPropertyName("ethnicity")]
    public string Ethnicity { get; set; } = string.Empty;
    
    [JsonPropertyName("gender")]
    public string Gender { get; set; } = string.Empty;
    
    [JsonPropertyName("language")]
    public bool Language { get; set; }
    
    [JsonPropertyName("race")]
    public string Race { get; set; } = string.Empty;
    
    [JsonPropertyName("weight")]
    public int Weight { get; set; }
    
    [JsonPropertyName("zipcode")]
    public string Zipcode { get; set; } = string.Empty;
}
