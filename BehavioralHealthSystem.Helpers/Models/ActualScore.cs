using System.Text.Json.Serialization;

namespace BehavioralHealthSystem.Models;

public class ActualScore
{
    [JsonPropertyName("average_total_score")]
    public string AverageTotalScore { get; set; } = string.Empty;
    
    [JsonPropertyName("is_score_processed")]
    public bool IsScoreProcessed { get; set; }
    
    [JsonPropertyName("max_score")]
    public string MaxScore { get; set; } = string.Empty;
    
    [JsonPropertyName("min_score")]
    public string MinScore { get; set; } = string.Empty;
    
    [JsonPropertyName("range_score")]
    public string RangeScore { get; set; } = string.Empty;
    
    [JsonPropertyName("std_score")]
    public string StdScore { get; set; } = string.Empty;
    
    [JsonPropertyName("total_score")]
    public string TotalScore { get; set; } = string.Empty;
}
