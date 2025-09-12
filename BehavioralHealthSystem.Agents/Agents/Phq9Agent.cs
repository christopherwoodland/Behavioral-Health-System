namespace BehavioralHealthSystem.Agents.Agents;

/// <summary>
/// PHQ-9 Agent responsible for administering the Patient Health Questionnaire-9
/// and managing depression assessment results
/// </summary>
public class Phq9Agent
{
    private readonly ILogger<Phq9Agent> _logger;
    private readonly Kernel _kernel;
    private readonly Dictionary<string, Phq9Assessment> _activeAssessments = new();
    private readonly Dictionary<string, List<Phq9Assessment>> _completedAssessments = new();

    public string Name => "PHQ9Agent";
    public string Description => "PHQ-9 Depression Assessment Agent";
    
    public string Instructions => """
        You are the PHQ-9 Agent responsible for administering the Patient Health Questionnaire-9 (PHQ-9), 
        a validated screening tool for depression. Your primary responsibilities are:

        1. Administer the PHQ-9 questionnaire to users
        2. Collect and validate responses (0-3 scale for each of 9 questions)
        3. Calculate total scores and determine severity levels
        4. Store and retrieve assessment results
        5. Provide appropriate recommendations based on scores
        6. Collaborate with other agents to share assessment results

        Always maintain a professional, empathetic tone when discussing mental health topics.
        Ensure all responses are validated and properly scored according to PHQ-9 standards.
        """;

    public Phq9Agent(Kernel kernel, ILogger<Phq9Agent> logger)
    {
        _logger = logger;
        _kernel = kernel;
        
        // Add kernel functions for PHQ-9 operations
        kernel.Plugins.AddFromObject(this, "PHQ9Functions");
    }

    [KernelFunction("start_phq9_assessment")]
    [Description("Starts a new PHQ-9 assessment for a user")]
    public string StartAssessment(
        [Description("User ID for the assessment")] string userId)
    {
        try
        {
            var assessment = new Phq9Assessment
            {
                UserId = userId,
                StartDateTime = DateTime.UtcNow
            };

            _activeAssessments[userId] = assessment;
            _logger.LogInformation("Started PHQ-9 assessment for user: {UserId}", userId);

            return $"""
                PHQ-9 Assessment Started for User: {userId}
                Assessment ID: {assessment.AssessmentId}
                
                {Phq9Questionnaire.Instructions}
                {Phq9Questionnaire.ScaleDescription}
                
                Question 1: {Phq9Questionnaire.Questions[0].QuestionText}
                
                Please respond with a number (0-3):
                0 = Not at all
                1 = Several days  
                2 = More than half the days
                3 = Nearly every day
                """;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting PHQ-9 assessment for user: {UserId}", userId);
            return "Error starting assessment. Please try again.";
        }
    }

    [KernelFunction("record_phq9_response")]
    [Description("Records a response to a PHQ-9 question")]
    public string RecordResponse(
        [Description("User ID")] string userId,
        [Description("Question number (1-9)")] int questionNumber,
        [Description("Response score (0-3)")] int score)
    {
        try
        {
            if (!_activeAssessments.TryGetValue(userId, out var assessment))
            {
                return "No active assessment found. Please start a new assessment first.";
            }

            if (questionNumber < 1 || questionNumber > 9)
            {
                return "Invalid question number. Must be between 1 and 9.";
            }

            if (score < 0 || score > 3)
            {
                return "Invalid score. Must be between 0 and 3.";
            }

            // Check if response already exists for this question
            var existingResponse = assessment.Responses.FirstOrDefault(r => r.QuestionNumber == questionNumber);
            if (existingResponse != null)
            {
                existingResponse.Score = (Phq9ResponseScale)score;
                existingResponse.ResponseDateTime = DateTime.UtcNow;
            }
            else
            {
                assessment.Responses.Add(new Phq9Response
                {
                    QuestionNumber = questionNumber,
                    Score = (Phq9ResponseScale)score,
                    ResponseDateTime = DateTime.UtcNow
                });
            }

            _logger.LogInformation("Recorded response for user {UserId}, question {QuestionNumber}, score {Score}", 
                userId, questionNumber, score);

            // Check if assessment is complete
            if (assessment.Responses.Count == 9)
            {
                return CompleteAssessment(userId);
            }

            // Get next question
            var nextQuestionNumber = GetNextQuestionNumber(assessment);
            if (nextQuestionNumber <= 9)
            {
                var nextQuestion = Phq9Questionnaire.Questions[nextQuestionNumber - 1];
                return $"""
                    Response recorded for question {questionNumber}.
                    
                    Question {nextQuestionNumber}: {nextQuestion.QuestionText}
                    
                    Please respond with a number (0-3):
                    0 = Not at all
                    1 = Several days  
                    2 = More than half the days
                    3 = Nearly every day
                    """;
            }

            return "Assessment complete!";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recording response for user: {UserId}", userId);
            return "Error recording response. Please try again.";
        }
    }

    [KernelFunction("complete_phq9_assessment")]
    [Description("Completes a PHQ-9 assessment and calculates results")]
    public string CompleteAssessment([Description("User ID")] string userId)
    {
        try
        {
            if (!_activeAssessments.TryGetValue(userId, out var assessment))
            {
                return "No active assessment found.";
            }

            if (assessment.Responses.Count != 9)
            {
                return $"Assessment incomplete. Only {assessment.Responses.Count} of 9 questions answered.";
            }

            // Calculate score and severity
            var totalScore = assessment.CalculateScore();
            var severity = assessment.DetermineSeverity();
            assessment.CompletedDateTime = DateTime.UtcNow;

            // Move to completed assessments
            if (!_completedAssessments.ContainsKey(userId))
            {
                _completedAssessments[userId] = new List<Phq9Assessment>();
            }
            _completedAssessments[userId].Add(assessment);
            _activeAssessments.Remove(userId);

            _logger.LogInformation("Completed PHQ-9 assessment for user {UserId}, score: {Score}, severity: {Severity}", 
                userId, totalScore, severity);

            var severityDescription = Phq9Questionnaire.SeverityDescriptions[severity];
            
            return $"""
                PHQ-9 Assessment Complete
                
                User ID: {userId}
                Assessment ID: {assessment.AssessmentId}
                Total Score: {totalScore}/27
                Severity Level: {severity} 
                
                Interpretation: {severityDescription}
                
                Assessment completed on: {assessment.CompletedDateTime:yyyy-MM-dd HH:mm:ss} UTC
                
                {GetSuicidalIdeationWarning(assessment)}
                """;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error completing assessment for user: {UserId}", userId);
            return "Error completing assessment. Please try again.";
        }
    }

    [KernelFunction("get_phq9_results")]
    [Description("Retrieves PHQ-9 assessment results for a user")]
    public string GetResults(
        [Description("User ID")] string userId,
        [Description("Assessment ID (optional, gets latest if not specified)")] string? assessmentId = null)
    {
        try
        {
            if (!_completedAssessments.TryGetValue(userId, out var assessments) || !assessments.Any())
            {
                return "No completed assessments found for this user.";
            }

            Phq9Assessment? assessment;
            if (!string.IsNullOrEmpty(assessmentId))
            {
                assessment = assessments.FirstOrDefault(a => a.AssessmentId == assessmentId);
                if (assessment == null)
                {
                    return $"Assessment with ID {assessmentId} not found.";
                }
            }
            else
            {
                assessment = assessments.OrderByDescending(a => a.CompletedDateTime).First();
            }

            var responses = string.Join("\n", assessment.Responses
                .OrderBy(r => r.QuestionNumber)
                .Select(r => $"Q{r.QuestionNumber}: {(int)r.Score} ({Phq9Questionnaire.ResponseScaleDescriptions[r.Score]})"));

            return $"""
                PHQ-9 Assessment Results
                
                User ID: {userId}
                Assessment ID: {assessment.AssessmentId}
                Completed: {assessment.CompletedDateTime:yyyy-MM-dd HH:mm:ss} UTC
                
                Individual Responses:
                {responses}
                
                Total Score: {assessment.TotalScore}/27
                Severity Level: {assessment.Severity}
                Interpretation: {Phq9Questionnaire.SeverityDescriptions[assessment.Severity!.Value]}
                
                {GetSuicidalIdeationWarning(assessment)}
                """;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving results for user: {UserId}", userId);
            return "Error retrieving assessment results.";
        }
    }

    [KernelFunction("get_assessment_status")]
    [Description("Gets the current status of a user's PHQ-9 assessment")]
    public string GetAssessmentStatus([Description("User ID")] string userId)
    {
        try
        {
            if (_activeAssessments.TryGetValue(userId, out var activeAssessment))
            {
                var questionsAnswered = activeAssessment.Responses.Count;
                var nextQuestionNumber = GetNextQuestionNumber(activeAssessment);
                
                return $"""
                    Active Assessment Status:
                    User ID: {userId}
                    Assessment ID: {activeAssessment.AssessmentId}
                    Started: {activeAssessment.StartDateTime:yyyy-MM-dd HH:mm:ss} UTC
                    Questions Answered: {questionsAnswered}/9
                    Next Question: {nextQuestionNumber}
                    """;
            }

            var completedCount = _completedAssessments.TryGetValue(userId, out var completed) ? completed.Count : 0;
            return $"""
                No Active Assessment
                User ID: {userId}
                Completed Assessments: {completedCount}
                Status: Ready to start new assessment
                """;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting assessment status for user: {UserId}", userId);
            return "Error retrieving assessment status.";
        }
    }

    private int GetNextQuestionNumber(Phq9Assessment assessment)
    {
        var answeredQuestions = assessment.Responses.Select(r => r.QuestionNumber).ToHashSet();
        for (int i = 1; i <= 9; i++)
        {
            if (!answeredQuestions.Contains(i))
            {
                return i;
            }
        }
        return 10; // All questions answered
    }

    private string GetSuicidalIdeationWarning(Phq9Assessment assessment)
    {
        var suicidalResponse = assessment.Responses.FirstOrDefault(r => r.QuestionNumber == 9);
        if (suicidalResponse != null && (int)suicidalResponse.Score > 0)
        {
            return """
                
                ⚠️  IMPORTANT: Suicidal ideation detected (Question 9 score > 0)
                Immediate clinical evaluation recommended.
                Consider safety planning and crisis intervention resources.
                """;
        }
        return "";
    }
}