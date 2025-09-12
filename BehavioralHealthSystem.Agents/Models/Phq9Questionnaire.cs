namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Contains the standardized PHQ-9 questionnaire questions
/// </summary>
public static class Phq9Questionnaire
{
    public static readonly string Instructions = 
        "Over the last 2 weeks, how often have you been bothered by any of the following problems?";
    
    public static readonly string ScaleDescription = 
        "Please rate each item: 0 = Not at all, 1 = Several days, 2 = More than half the days, 3 = Nearly every day";
    
    public static readonly List<Phq9Question> Questions = new()
    {
        new()
        {
            QuestionNumber = 1,
            QuestionText = "Little interest or pleasure in doing things",
            Description = "Anhedonia - loss of interest or pleasure in activities"
        },
        new()
        {
            QuestionNumber = 2,
            QuestionText = "Feeling down, depressed, or hopeless",
            Description = "Depressed mood"
        },
        new()
        {
            QuestionNumber = 3,
            QuestionText = "Trouble falling or staying asleep, or sleeping too much",
            Description = "Sleep disturbances"
        },
        new()
        {
            QuestionNumber = 4,
            QuestionText = "Feeling tired or having little energy",
            Description = "Fatigue or loss of energy"
        },
        new()
        {
            QuestionNumber = 5,
            QuestionText = "Poor appetite or overeating",
            Description = "Appetite changes"
        },
        new()
        {
            QuestionNumber = 6,
            QuestionText = "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
            Description = "Feelings of worthlessness or guilt"
        },
        new()
        {
            QuestionNumber = 7,
            QuestionText = "Trouble concentrating on things, such as reading the newspaper or watching television",
            Description = "Concentration difficulties"
        },
        new()
        {
            QuestionNumber = 8,
            QuestionText = "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
            Description = "Psychomotor agitation or retardation"
        },
        new()
        {
            QuestionNumber = 9,
            QuestionText = "Thoughts that you would be better off dead or of hurting yourself in some way",
            Description = "Suicidal ideation"
        }
    };
    
    /// <summary>
    /// Gets the response scale options with descriptions
    /// </summary>
    public static readonly Dictionary<Phq9ResponseScale, string> ResponseScaleDescriptions = new()
    {
        { Phq9ResponseScale.NotAtAll, "Not at all" },
        { Phq9ResponseScale.SeveralDays, "Several days" },
        { Phq9ResponseScale.MoreThanHalfTheDays, "More than half the days" },
        { Phq9ResponseScale.NearlyEveryDay, "Nearly every day" }
    };
    
    /// <summary>
    /// Gets severity level descriptions and recommendations
    /// </summary>
    public static readonly Dictionary<Phq9Severity, string> SeverityDescriptions = new()
    {
        { Phq9Severity.Minimal, "Minimal depression. May not require treatment." },
        { Phq9Severity.Mild, "Mild depression. Consider psychotherapy, counseling, or follow-up." },
        { Phq9Severity.Moderate, "Moderate depression. Consider psychotherapy or medication." },
        { Phq9Severity.ModeratelySevere, "Moderately severe depression. Active treatment recommended with medication and/or psychotherapy." },
        { Phq9Severity.Severe, "Severe depression. Immediate active treatment required with medication and/or psychotherapy." }
    };
}