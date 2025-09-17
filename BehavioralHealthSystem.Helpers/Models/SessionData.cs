namespace BehavioralHealthSystem.Models;

public class SessionData
{
    [JsonPropertyName("sessionId")]
    public string SessionId { get; set; } = string.Empty;
    
    [JsonPropertyName("userId")]
    public string UserId { get; set; } = string.Empty;
    
    [JsonPropertyName("prediction")]
    public PredictionResult? Prediction { get; set; }
    
    [JsonPropertyName("userMetadata")]
    public UserMetadata? UserMetadata { get; set; }
    
    [JsonPropertyName("audioUrl")]
    public string AudioUrl { get; set; } = string.Empty;
    
    [JsonPropertyName("audioFileName")]
    public string AudioFileName { get; set; } = string.Empty;
    
    [JsonPropertyName("createdAt")]
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("O");
    
    [JsonPropertyName("updatedAt")]
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("O");
    
    [JsonPropertyName("status")]
    public string Status { get; set; } = "created";
    
    [JsonPropertyName("analysisResults")]
    public AnalysisResults? AnalysisResults { get; set; }
    
    [JsonPropertyName("riskAssessment")]
    public RiskAssessment? RiskAssessment { get; set; }
}

public class AnalysisResults
{
    [JsonPropertyName("depressionScore")]
    public double? DepressionScore { get; set; }
    
    [JsonPropertyName("anxietyScore")]
    public double? AnxietyScore { get; set; }
    
    [JsonPropertyName("riskLevel")]
    public string RiskLevel { get; set; } = string.Empty;
    
    [JsonPropertyName("confidence")]
    public double? Confidence { get; set; }
    
    [JsonPropertyName("insights")]
    public List<string> Insights { get; set; } = new();
    
    [JsonPropertyName("completedAt")]
    public string CompletedAt { get; set; } = string.Empty;
}
