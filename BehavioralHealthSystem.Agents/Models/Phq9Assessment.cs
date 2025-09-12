namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Represents a complete PHQ-9 assessment with all responses and calculated score
/// </summary>
public class Phq9Assessment
{
    public string UserId { get; set; } = string.Empty;
    public string AssessmentId { get; set; } = Guid.NewGuid().ToString();
    public DateTime StartDateTime { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedDateTime { get; set; }
    public List<Phq9Response> Responses { get; set; } = new();
    public Phq9Severity? Severity { get; set; }
    public int? TotalScore { get; set; }
    public bool IsComplete => Responses.Count == 9 && CompletedDateTime.HasValue;
    
    /// <summary>
    /// Calculates the total PHQ-9 score
    /// </summary>
    public int CalculateScore()
    {
        if (Responses.Count != 9)
            throw new InvalidOperationException("Cannot calculate score with incomplete responses");
            
        var score = Responses.Sum(r => (int)r.Score);
        TotalScore = score;
        return score;
    }
    
    /// <summary>
    /// Determines the severity level based on the total score
    /// </summary>
    public Phq9Severity DetermineSeverity()
    {
        var score = TotalScore ?? CalculateScore();
        
        var severity = score switch
        {
            >= 0 and <= 4 => Phq9Severity.Minimal,
            >= 5 and <= 9 => Phq9Severity.Mild,
            >= 10 and <= 14 => Phq9Severity.Moderate,
            >= 15 and <= 19 => Phq9Severity.ModeratelySevere,
            >= 20 and <= 27 => Phq9Severity.Severe,
            _ => throw new ArgumentOutOfRangeException(nameof(score), score, "Score must be between 0 and 27")
        };
        
        Severity = severity;
        return severity;
    }
}

/// <summary>
/// PHQ-9 severity levels based on total score
/// </summary>
public enum Phq9Severity
{
    Minimal = 0,        // 0-4: Minimal depression
    Mild = 1,           // 5-9: Mild depression
    Moderate = 2,       // 10-14: Moderate depression
    ModeratelySevere = 3, // 15-19: Moderately severe depression
    Severe = 4          // 20-27: Severe depression
}