namespace BehavioralHealthSystem.Models;

public class SessionActualScore
{
    [JsonPropertyName("anxiety_binary")]
    public string AnxietyBinary { get; set; } = string.Empty;
    
    [JsonPropertyName("depression_binary")]
    public string DepressionBinary { get; set; } = string.Empty;
    
    [JsonPropertyName("phq_2")]
    public int[] Phq2 { get; set; } = [];
    
    [JsonPropertyName("phq_9")]
    public int[] Phq9 { get; set; } = [];
    
    [JsonPropertyName("gad_7")]
    public int[] Gad7 { get; set; } = [];
}
