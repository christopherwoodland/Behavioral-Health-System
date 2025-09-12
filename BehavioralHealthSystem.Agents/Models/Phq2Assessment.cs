namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Represents a complete PHQ-2 assessment
/// </summary>
public class Phq2Assessment
{
    public string UserId { get; set; } = string.Empty;
    public DateTime StartDate { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedDate { get; set; }
    public List<Phq2Response> Responses { get; set; } = new();
    public bool IsCompleted => Responses.Count == 2;
    public int? TotalScore => IsCompleted ? Responses.Sum(r => r.NumericScore) : null;
    public Phq2Severity? Severity => TotalScore.HasValue ? DetermineSeverity(TotalScore.Value) : null;

    /// <summary>
    /// Calculates the total PHQ-2 score (0-6)
    /// </summary>
    public int CalculateScore()
    {
        return Responses.Sum(r => r.NumericScore);
    }

    /// <summary>
    /// Determines severity level based on total score
    /// </summary>
    public Phq2Severity DetermineSeverity(int totalScore)
    {
        return totalScore switch
        {
            >= 0 and <= 2 => Phq2Severity.Minimal,
            >= 3 and <= 6 => Phq2Severity.Positive,
            _ => Phq2Severity.Minimal
        };
    }

    /// <summary>
    /// Gets the next question number to be answered (1-2)
    /// </summary>
    public int? GetNextQuestionNumber()
    {
        if (IsCompleted) return null;
        
        var answeredQuestions = Responses.Select(r => r.QuestionNumber).ToHashSet();
        
        for (int i = 1; i <= 2; i++)
        {
            if (!answeredQuestions.Contains(i))
                return i;
        }
        
        return null;
    }

    /// <summary>
    /// Gets interpretation text for the assessment results
    /// </summary>
    public string GetInterpretation()
    {
        if (!IsCompleted || !TotalScore.HasValue)
            return "Assessment not completed.";

        var score = TotalScore.Value;
        var interpretation = score switch
        {
            >= 0 and <= 2 => "Minimal depression likelihood. Score indicates low probability of major depressive disorder.",
            >= 3 and <= 6 => "Positive screen for depression. Further evaluation with PHQ-9 or clinical interview is recommended.",
            _ => "Invalid score range."
        };

        return $"PHQ-2 Score: {score}/6 - {interpretation}";
    }

    /// <summary>
    /// Gets recommendations based on the assessment results
    /// </summary>
    public string GetRecommendations()
    {
        if (!IsCompleted || !TotalScore.HasValue)
            return "Complete the assessment to receive recommendations.";

        return TotalScore.Value switch
        {
            >= 0 and <= 2 => "Continue routine care. Monitor for any changes in mood or symptoms.",
            >= 3 and <= 6 => "Further evaluation recommended:\n" +
                           "• Complete PHQ-9 for comprehensive depression screening\n" +
                           "• Consider clinical interview with mental health professional\n" +
                           "• Discuss symptoms and concerns with healthcare provider",
            _ => "Please consult with a healthcare professional for proper evaluation."
        };
    }
}