namespace BehavioralHealthSystem.Models;

/// <summary>
/// Represents actual clinical scores from Kintsugi Health API assessment results.
/// Contains statistical metrics about the assessment scores.
/// </summary>
public class ActualScore
{
    /// <summary>
    /// Gets or sets the average of all total scores calculated.
    /// </summary>
    [JsonPropertyName("average_total_score")]
    public string AverageTotalScore { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets a value indicating whether the score has been successfully processed by the API.
    /// </summary>
    [JsonPropertyName("is_score_processed")]
    public bool IsScoreProcessed { get; set; }

    /// <summary>
    /// Gets or sets the maximum score from all assessments.
    /// </summary>
    [JsonPropertyName("max_score")]
    public string MaxScore { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the minimum score from all assessments.
    /// </summary>
    [JsonPropertyName("min_score")]
    public string MinScore { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the range of scores (max - min).
    /// </summary>
    [JsonPropertyName("range_score")]
    public string RangeScore { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the standard deviation of scores.
    /// </summary>
    [JsonPropertyName("std_score")]
    public string StdScore { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the total clinical score for the assessment.
    /// </summary>
    [JsonPropertyName("total_score")]
    public string TotalScore { get; set; } = string.Empty;
}
