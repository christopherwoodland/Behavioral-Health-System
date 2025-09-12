namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Static repository of PHQ-2 questions and clinical information
/// </summary>
public static class Phq2Questionnaire
{
    /// <summary>
    /// The two PHQ-2 questions (same as first two PHQ-9 questions)
    /// </summary>
    public static readonly List<Phq2Question> Questions = new()
    {
        new Phq2Question
        {
            Number = 1,
            Text = "Little interest or pleasure in doing things",
            Description = "Over the last 2 weeks, how often have you been bothered by little interest or pleasure in doing things?"
        },
        new Phq2Question
        {
            Number = 2,
            Text = "Feeling down, depressed or hopeless",
            Description = "Over the last 2 weeks, how often have you been bothered by feeling down, depressed or hopeless?"
        }
    };

    /// <summary>
    /// Response options with descriptions
    /// </summary>
    public static readonly Dictionary<Phq2ResponseScale, string> ResponseOptions = new()
    {
        { Phq2ResponseScale.NotAtAll, "Not at all (0 points)" },
        { Phq2ResponseScale.SeveralDays, "Several days (1 point)" },
        { Phq2ResponseScale.MoreThanHalfTheDays, "More than half the days (2 points)" },
        { Phq2ResponseScale.NearlyEveryDay, "Nearly every day (3 points)" }
    };

    /// <summary>
    /// Severity interpretations based on score ranges
    /// </summary>
    public static readonly Dictionary<Phq2Severity, string> SeverityDescriptions = new()
    {
        {
            Phq2Severity.Minimal,
            "Minimal depression likelihood (Score 0-2): Low probability of major depressive disorder"
        },
        {
            Phq2Severity.Positive,
            "Positive depression screen (Score 3-6): Further evaluation recommended with PHQ-9 or clinical interview"
        }
    };

    /// <summary>
    /// Clinical information about PHQ-2
    /// </summary>
    public static readonly string ClinicalInformation = """
        PHQ-2 (Patient Health Questionnaire-2) Clinical Information:
        
        Purpose: First-step depression screening tool
        Questions: 2 items (first two questions from PHQ-9)
        Scoring: 0-6 total points (each question scored 0-3)
        Optimal Cutpoint: Score ≥3 indicates positive screen
        
        Clinical Usage:
        • Rapid depression screening in primary care
        • Initial assessment before comprehensive evaluation
        • Population-level screening programs
        
        Next Steps for Positive Screens (≥3):
        • Administer PHQ-9 for comprehensive assessment
        • Clinical interview by mental health professional
        • Further diagnostic evaluation as indicated
        
        Operating Characteristics (at cutpoint ≥3):
        • Sensitivity: 82.9% for Major Depressive Disorder
        • Specificity: 90.0% for Major Depressive Disorder
        • Positive Predictive Value: 38.4% (varies with population prevalence)
        
        Reference: Kroenke K, et al. Medical Care. 2003;41:1284-92.
        """;

    /// <summary>
    /// Gets a question by its number
    /// </summary>
    public static Phq2Question? GetQuestion(int questionNumber)
    {
        return Questions.FirstOrDefault(q => q.Number == questionNumber);
    }

    /// <summary>
    /// Gets the formatted question text for display
    /// </summary>
    public static string GetFormattedQuestion(int questionNumber)
    {
        var question = GetQuestion(questionNumber);
        if (question == null)
            return "Invalid question number. PHQ-2 has only 2 questions.";

        var responseText = string.Join("\n", ResponseOptions.Select(kvp => 
            $"{(int)kvp.Key}. {kvp.Value}"));

        return $"""
            Question {question.Number}: {question.Text}
            
            {question.Description}
            
            Please respond with a number (0-3):
            {responseText}
            """;
    }
}