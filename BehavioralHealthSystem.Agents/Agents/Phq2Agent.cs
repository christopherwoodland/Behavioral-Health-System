namespace BehavioralHealthSystem.Agents.Agents;

/// <summary>
/// PHQ-2 Depression Screening Agent
/// Implements the Patient Health Questionnaire-2 for initial depression screening
/// </summary>
public class Phq2Agent
{
    private readonly ILogger<Phq2Agent> _logger;
    private readonly Kernel _kernel;
    private readonly Dictionary<string, Phq2Assessment> _activeAssessments = new();

    public string Name => "PHQ2Agent";
    public string Description => "PHQ-2 Depression Screening Agent - Rapid 2-question depression screening tool";
    
    public string Instructions => """
        You are the PHQ-2 Agent specialized in administering the Patient Health Questionnaire-2 (PHQ-2).
        
        Your responsibilities include:
        1. Conducting rapid 2-question depression screenings
        2. Scoring responses (0-3 scale per question, 0-6 total)
        3. Interpreting results using clinical cutpoints
        4. Providing appropriate recommendations
        5. Identifying patients who need PHQ-9 follow-up
        
        PHQ-2 Administration:
        - Ask 2 questions about the past 2 weeks
        - Each question scored 0-3 (Not at all, Several days, More than half the days, Nearly every day)
        - Total score 0-6, cutpoint ≥3 indicates positive screen
        - Positive screens should be followed up with PHQ-9 or clinical evaluation
        
        Always maintain professional, empathetic communication and follow clinical guidelines.
        """;

    public Phq2Agent(Kernel kernel, ILogger<Phq2Agent> logger)
    {
        _logger = logger;
        _kernel = kernel;
        
        kernel.Plugins.AddFromObject(this, "Phq2Functions");
    }

    [KernelFunction("start_assessment")]
    [Description("Starts a new PHQ-2 depression screening assessment")]
    public string StartAssessment([Description("User ID")] string userId)
    {
        try
        {
            _logger.LogInformation("Starting PHQ-2 assessment for user {UserId}", userId);

            // Check for existing active assessment
            if (_activeAssessments.ContainsKey(userId))
            {
                var existing = _activeAssessments[userId];
                if (!existing.IsCompleted)
                {
                    var nextQ = existing.GetNextQuestionNumber();
                    if (nextQ.HasValue)
                    {
                        return $"You have an ongoing PHQ-2 assessment. {Phq2Questionnaire.GetFormattedQuestion(nextQ.Value)}";
                    }
                }
            }

            // Create new assessment
            var assessment = new Phq2Assessment { UserId = userId };
            _activeAssessments[userId] = assessment;

            return $"""
                Starting PHQ-2 Depression Screening
                
                The PHQ-2 is a brief 2-question screening tool for depression.
                It asks about your experiences over the past 2 weeks.
                
                This should take about 1 minute to complete.
                
                {Phq2Questionnaire.GetFormattedQuestion(1)}
                """;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting PHQ-2 assessment for user {UserId}", userId);
            return "Sorry, I encountered an error starting your assessment. Please try again.";
        }
    }

    [KernelFunction("record_response")]
    [Description("Records a response to a PHQ-2 question")]
    public string RecordResponse(
        [Description("User ID")] string userId,
        [Description("Question number (1-2)")] int questionNumber,
        [Description("Response score (0-3)")] int score)
    {
        try
        {
            _logger.LogInformation("Recording PHQ-2 response for user {UserId}: Q{QuestionNumber} = {Score}", 
                userId, questionNumber, score);

            // Validate inputs
            if (questionNumber < 1 || questionNumber > 2)
            {
                return "Invalid question number. PHQ-2 has only 2 questions (1-2).";
            }

            if (score < 0 || score > 3)
            {
                return "Invalid score. Please enter a number between 0 and 3.";
            }

            // Get or create assessment
            if (!_activeAssessments.TryGetValue(userId, out var assessment))
            {
                return "No active PHQ-2 assessment found. Please start a new assessment first.";
            }

            if (assessment.IsCompleted)
            {
                return "Your PHQ-2 assessment is already completed. Start a new assessment if needed.";
            }

            // Check if question already answered
            if (assessment.Responses.Any(r => r.QuestionNumber == questionNumber))
            {
                return $"Question {questionNumber} has already been answered. Use 'get status' to see your progress.";
            }

            // Record the response
            var response = new Phq2Response
            {
                QuestionNumber = questionNumber,
                Score = (Phq2ResponseScale)score,
                ResponseDate = DateTime.UtcNow
            };

            assessment.Responses.Add(response);

            // Check if assessment is complete
            if (assessment.IsCompleted)
            {
                assessment.CompletedDate = DateTime.UtcNow;
                return CompleteAssessment(userId);
            }

            // Get next question
            var nextQuestionNumber = assessment.GetNextQuestionNumber();
            if (nextQuestionNumber.HasValue)
            {
                return $"""
                    Response recorded: {Phq2Questionnaire.ResponseOptions[(Phq2ResponseScale)score]}
                    
                    {Phq2Questionnaire.GetFormattedQuestion(nextQuestionNumber.Value)}
                    """;
            }

            return "Assessment should be completed but next question not found. Please check your status.";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recording PHQ-2 response for user {UserId}", userId);
            return "Sorry, I encountered an error recording your response. Please try again.";
        }
    }

    [KernelFunction("complete_assessment")]
    [Description("Completes the PHQ-2 assessment and provides results")]
    public string CompleteAssessment([Description("User ID")] string userId)
    {
        try
        {
            _logger.LogInformation("Completing PHQ-2 assessment for user {UserId}", userId);

            if (!_activeAssessments.TryGetValue(userId, out var assessment))
            {
                return "No active PHQ-2 assessment found.";
            }

            if (!assessment.IsCompleted)
            {
                return $"Assessment not yet complete. You have answered {assessment.Responses.Count}/2 questions.";
            }

            var totalScore = assessment.CalculateScore();
            var severity = assessment.DetermineSeverity(totalScore);
            var interpretation = assessment.GetInterpretation();
            var recommendations = assessment.GetRecommendations();

            var result = $"""
                PHQ-2 Assessment Completed
                ========================
                
                Total Score: {totalScore}/6
                Screening Result: {severity}
                
                {interpretation}
                
                Recommendations:
                {recommendations}
                
                Assessment completed on: {assessment.CompletedDate:yyyy-MM-dd HH:mm} UTC
                """;

            // Add follow-up recommendation for positive screens
            if (totalScore >= 3)
            {
                result += """
                    
                    
                    NEXT STEPS:
                    Your PHQ-2 screen was positive. For a complete evaluation, please:
                    • Take the PHQ-9 assessment for comprehensive depression screening
                    • Consider discussing these results with a healthcare provider
                    • Seek professional mental health support if needed
                    
                    Would you like to start the PHQ-9 assessment now?
                    """;
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error completing PHQ-2 assessment for user {UserId}", userId);
            return "Sorry, I encountered an error completing your assessment. Please try again.";
        }
    }

    [KernelFunction("get_results")]
    [Description("Gets the results of the most recent PHQ-2 assessment")]
    public string GetResults([Description("User ID")] string userId)
    {
        try
        {
            _logger.LogInformation("Getting PHQ-2 results for user {UserId}", userId);

            if (!_activeAssessments.TryGetValue(userId, out var assessment))
            {
                return "No PHQ-2 assessment found. Please start a new assessment.";
            }

            if (!assessment.IsCompleted)
            {
                return $"""
                    PHQ-2 Assessment In Progress
                    ===========================
                    
                    Questions answered: {assessment.Responses.Count}/2
                    Started: {assessment.StartDate:yyyy-MM-dd HH:mm} UTC
                    
                    Use 'get status' to continue where you left off.
                    """;
            }

            var totalScore = assessment.CalculateScore();
            var interpretation = assessment.GetInterpretation();
            var recommendations = assessment.GetRecommendations();

            return $"""
                PHQ-2 Assessment Results
                ======================
                
                Total Score: {totalScore}/6
                Completed: {assessment.CompletedDate:yyyy-MM-dd HH:mm} UTC
                
                {interpretation}
                
                Recommendations:
                {recommendations}
                """;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting PHQ-2 results for user {UserId}", userId);
            return "Sorry, I encountered an error retrieving your results. Please try again.";
        }
    }

    [KernelFunction("get_assessment_status")]
    [Description("Gets the current status of the PHQ-2 assessment")]
    public string GetAssessmentStatus([Description("User ID")] string userId)
    {
        try
        {
            _logger.LogInformation("Getting PHQ-2 assessment status for user {UserId}", userId);

            if (!_activeAssessments.TryGetValue(userId, out var assessment))
            {
                return """
                    No active PHQ-2 assessment found.
                    
                    The PHQ-2 is a quick 2-question depression screening tool.
                    Say 'start PHQ-2 assessment' to begin.
                    """;
            }

            if (assessment.IsCompleted)
            {
                return $"""
                    PHQ-2 Assessment Status: COMPLETED
                    
                    Completed: {assessment.CompletedDate:yyyy-MM-dd HH:mm} UTC
                    Total Score: {assessment.CalculateScore()}/6
                    
                    Use 'get results' to see your full assessment results.
                    """;
            }

            var nextQuestionNumber = assessment.GetNextQuestionNumber();
            var progress = $"{assessment.Responses.Count}/2 questions completed";

            if (nextQuestionNumber.HasValue)
            {
                return $"""
                    PHQ-2 Assessment Status: IN PROGRESS
                    
                    Progress: {progress}
                    Started: {assessment.StartDate:yyyy-MM-dd HH:mm} UTC
                    Next Question: {nextQuestionNumber.Value}
                    
                    {Phq2Questionnaire.GetFormattedQuestion(nextQuestionNumber.Value)}
                    """;
            }

            return $"""
                PHQ-2 Assessment Status: IN PROGRESS
                
                Progress: {progress}
                Started: {assessment.StartDate:yyyy-MM-dd HH:mm} UTC
                
                Ready to complete assessment.
                """;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting PHQ-2 assessment status for user {UserId}", userId);
            return "Sorry, I encountered an error getting your assessment status. Please try again.";
        }
    }

    [KernelFunction("get_clinical_info")]
    [Description("Provides clinical information about the PHQ-2")]
    public string GetClinicalInfo()
    {
        return Phq2Questionnaire.ClinicalInformation;
    }
}