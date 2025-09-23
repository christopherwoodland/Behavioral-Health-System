namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Mood analysis result
/// </summary>
public class MoodAnalysis
{
    public string PrimaryMood { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public Dictionary<string, double> MoodScores { get; set; } = new();
    public List<string> EmotionalIndicators { get; set; } = new();
    public string Recommendation { get; set; } = string.Empty;
}