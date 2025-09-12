namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Represents a single question in the PHQ-9 questionnaire
/// </summary>
public class Phq9Question
{
    public int QuestionNumber { get; set; }
    public string QuestionText { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}

/// <summary>
/// The response scale values for PHQ-9 questions
/// </summary>
public enum Phq9ResponseScale
{
    NotAtAll = 0,
    SeveralDays = 1,
    MoreThanHalfTheDays = 2,
    NearlyEveryDay = 3
}

/// <summary>
/// Represents a user's response to a PHQ-9 question
/// </summary>
public class Phq9Response
{
    public int QuestionNumber { get; set; }
    public Phq9ResponseScale Score { get; set; }
    public DateTime ResponseDateTime { get; set; } = DateTime.UtcNow;
}