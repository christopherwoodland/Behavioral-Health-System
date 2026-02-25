namespace BehavioralHealthSystem.Models;

public class PredictionResponse
{
    [JsonPropertyName("session_id")]
    public string SessionId { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("predicted_score")]
    public string PredictedScore { get; set; } = string.Empty;

    [JsonPropertyName("predicted_score_depression")]
    public string PredictedScoreDepression { get; set; } = string.Empty;

    [JsonPropertyName("predicted_score_anxiety")]
    public string PredictedScoreAnxiety { get; set; } = string.Empty;

    [JsonPropertyName("created_at")]
    public string CreatedAt { get; set; } = string.Empty;

    [JsonPropertyName("updated_at")]
    public string UpdatedAt { get; set; } = string.Empty;

    [JsonPropertyName("model_category")]
    public string ModelCategory { get; set; } = string.Empty;

    [JsonPropertyName("model_granularity")]
    public string ModelGranularity { get; set; } = string.Empty;

    [JsonPropertyName("is_calibrated")]
    public bool IsCalibrated { get; set; }

    [JsonPropertyName("provider")]
    public string Provider { get; set; } = string.Empty;

    [JsonPropertyName("model")]
    public string Model { get; set; } = string.Empty;

    [JsonPropertyName("actual_score")]
    public ActualScore? ActualScore { get; set; }

    [JsonPropertyName("predict_error")]
    public PredictError? PredictError { get; set; }
}
