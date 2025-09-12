namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Represents a PHQ-2 questionnaire question
/// </summary>
public class Phq2Question
{
    public int Number { get; set; }
    public string Text { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

/// <summary>
/// Response scale for PHQ-2 questions (0-3)
/// </summary>
public enum Phq2ResponseScale
{
    NotAtAll = 0,
    SeveralDays = 1,
    MoreThanHalfTheDays = 2,
    NearlyEveryDay = 3
}

/// <summary>
/// Represents a response to a PHQ-2 question
/// </summary>
public class Phq2Response
{
    public int QuestionNumber { get; set; }
    public Phq2ResponseScale Score { get; set; }
    public DateTime ResponseDate { get; set; } = DateTime.UtcNow;
    
    /// <summary>
    /// Gets the numeric score value (0-3)
    /// </summary>
    public int NumericScore => (int)Score;
}

/// <summary>
/// PHQ-2 severity levels based on total score
/// </summary>
public enum Phq2Severity
{
    Minimal = 0,        // 0-2: Minimal depression likelihood
    Positive = 1        // 3-6: Positive screen - further evaluation recommended
}