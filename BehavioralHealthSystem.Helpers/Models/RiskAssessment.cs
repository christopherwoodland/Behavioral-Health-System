using System.Text.Json.Serialization;

namespace BehavioralHealthSystem.Models;

public class RiskAssessment
{
    [JsonPropertyName("overallRiskLevel")]
    public string OverallRiskLevel { get; set; } = string.Empty;
    
    [JsonPropertyName("riskScore")]
    public int RiskScore { get; set; } // 1-10 scale
    
    [JsonPropertyName("summary")]
    public string Summary { get; set; } = string.Empty;
    
    [JsonPropertyName("keyFactors")]
    public List<string> KeyFactors { get; set; } = new();
    
    [JsonPropertyName("recommendations")]
    public List<string> Recommendations { get; set; } = new();
    
    [JsonPropertyName("immediateActions")]
    public List<string> ImmediateActions { get; set; } = new();
    
    [JsonPropertyName("followUpRecommendations")]
    public List<string> FollowUpRecommendations { get; set; } = new();
    
    [JsonPropertyName("confidenceLevel")]
    public double ConfidenceLevel { get; set; } // 0-1 scale
    
    [JsonPropertyName("generatedAt")]
    public string GeneratedAt { get; set; } = DateTime.UtcNow.ToString("O");
    
    [JsonPropertyName("modelVersion")]
    public string ModelVersion { get; set; } = string.Empty;
}
