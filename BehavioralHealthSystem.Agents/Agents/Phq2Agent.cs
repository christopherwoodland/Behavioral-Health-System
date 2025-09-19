namespace BehavioralHealthSystem.Agents.Agents;

/// <summary>
/// PHQ-2 Depression Screening Agent with handoff capabilities
/// Implements the Patient Health Questionnaire-2 for initial depression screening
/// </summary>
public class Phq2Agent : IHandoffAgent
{
    private readonly ILogger<Phq2Agent> _logger;
    private readonly Kernel _kernel;
    private readonly IChatCompletionService _chatService;
    private readonly Dictionary<string, Phq2Assessment> _activeAssessments = new();
    private readonly Dictionary<string, ChatHistory> _userChatHistories = new();

    // IHandoffAgent properties
    public string AgentId => "phq2";
    public string Name => "PHQ-2 Depression Screening Agent";
    public string Description => "Rapid 2-question depression screening tool";
    public string[] TriggerKeywords => new[] { "phq-2", "phq2", "depression screening", "quick screening", "rapid screening" };
    public int Priority => 5; // High priority for specific PHQ-2 requests
    
    public string Instructions => """
        PHQ‑2 Agent Instructions
        Purpose
        Administer the PHQ‑2 depression screening questionnaire. Ask one question at a time, validate numeric input, handle retries and skips, and produce a structured JSON output for storage and future reference.

        1. Question Flow

        Ask the two PHQ‑2 questions one at a time:

        Little interest or pleasure in doing things
        Feeling down, depressed, or hopeless


        Each question refers to the past 2 weeks.
        Provide the response scale every time:

        0 = Not at all
        1 = Several days
        2 = More than half the days
        3 = Nearly every day




        2. Input Validation

        Accept only numeric values: 0, 1, 2, or 3.
        If the user enters anything else:

        Show an error message:
        “Please reply with 0, 1, 2, or 3 only. (0=Not at all, 1=Several days, 2=More than half the days, 3=Nearly every day)”
        Re-ask the same question.


        Track invalid attempts per question.


        3. Retry and Skip Logic

        Allow up to 3 invalid attempts for each question.
        After 3 invalid attempts:

        Inform the user:
        “We’ll skip this question for now and return to it later.”
        Move to the next question.


        After finishing all questions, revisit any skipped ones with the same 3-attempt rule.
        If still unanswered after revisit, mark as null and mark the survey as incomplete.


        4. Completion and Scoring

        If both questions are answered:

        Compute PHQ‑2 total score = sum of the two answers (0–6).


        If any question remains unanswered:

        Do not compute a total; mark as incomplete.


        If total ≥ 3, flag as a positive screen (per common practice).


        5. JSON Output
        After all questions are processed, return a JSON object with:

        instrument: "PHQ-2"
        session_id, subject_id, timestamps
        items: array with each question, answer, attempts, skip flags
        complete: true/false
        score_total: integer or null
        screen_positive: true/false/null
        screen_cutpoint: 3
        proposed_next_step: "PHQ-9" if positive
        metadata: agent version, locale, etc.

        Example:
        JSON{  "instrument": "PHQ-2",  "session_id": "uuid",  "subject_id": "user-id",  "timestamp_start": "2025-09-14T21:12:03-04:00",  "timestamp_end": "2025-09-14T21:14:09-04:00",  "items": [    {      "item_id": "PHQ2_Q1",      "prompt": "Little interest or pleasure in doing things",      "answer_value": 2,      "attempts_initial": 1,      "attempts_revisit": 0,      "skipped_initial": false,      "skipped_final": false    },    {      "item_id": "PHQ2_Q2",      "prompt": "Feeling down, depressed, or hopeless",      "answer_value": 1,      "attempts_initial": 2,      "attempts_revisit": 0,      "skipped_initial": false,      "skipped_final": false    }  ],  "complete": true,  "score_total": 3,  "screen_positive": true,  "screen_cutpoint": 3,  "proposed_next_step": "PHQ-9"}Show more lines

        6. Safety Rule
        If the user mentions self-harm or suicidal thoughts:

        Stop the questionnaire immediately.
        Display crisis resources (e.g., “If you are in crisis, call 988 in the U.S. or your local emergency number.”).


        Message Templates
        Intro / Consent

        “I’ll ask you 2 quick questions about how you’ve felt over the last 2 weeks.
        Your answers help with screening, not diagnosis.
        Please respond with a number 0–3:
        0 = Not at all
        1 = Several days
        2 = More than half the days
        3 = Nearly every day
        Ready to start?”


        Question Prompt

        “Q1. Over the last 2 weeks, how often have you been bothered by:
        Little interest or pleasure in doing things?
        (Reply with 0, 1, 2, or 3)”


        “Q2. Over the last 2 weeks, how often have you been bothered by:
        Feeling down, depressed, or hopeless?
        (Reply with 0, 1, 2, or 3)”


        Invalid Input

        “I’m expecting a number 0–3 only.
        Please reply with 0, 1, 2, or 3:
        0 = Not at all
        1 = Several days
        2 = More than half the days
        3 = Nearly every day”


        Skip After 3 Invalid Attempts

        “No problem—we’ll skip this question for now and come back to it later.”


        Revisit Skipped Question

        “Let’s return to the skipped question.
        Please answer with 0, 1, 2, or 3 only.”


        Summary After Completion

        “Thank you. I’ve recorded your answers.
        This is a screening tool only, not a diagnosis.
        If your total score is 3 or higher, it may be helpful to complete the PHQ‑9 or speak with a healthcare professional.”


        Crisis Safety Message

        “If you are thinking about harming yourself or are in crisis, please seek help immediately:

        In the U.S., call or text 988 (Suicide & Crisis Lifeline)
        Or contact your local emergency services right away.”
        """;

    public Phq2Agent(Kernel kernel, ILogger<Phq2Agent> logger)
    {
        _logger = logger;
        _kernel = kernel;
        _chatService = kernel.GetRequiredService<IChatCompletionService>();
        
        kernel.Plugins.AddFromObject(this, "Phq2Functions");
    }

    [KernelFunction("start_assessment")]
    [Description("Starts a new PHQ-2 depression screening assessment")]
    public string StartAssessment([Description("User ID")] string userId)
    {
        try
        {
            _logger.LogInformation("Starting PHQ-2 assessment for user {UserId}", userId);

            return $"""
                Starting PHQ-2 Depression Screening
                
                The PHQ-2 is a brief 2-question screening tool for depression.
                It asks about your experiences over the past 2 weeks.
                
                This should take about 1 minute to complete.
                
                
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

    /// <summary>
    /// Initializes an independent PHQ-2 assessment and returns the initial state
    /// </summary>
    public Task<(ChatHistory chatHistory, Phq2Assessment assessment, string initialMessage)> InitializeIndependentAssessmentAsync(string userId)
    {
        try
        {
            _logger.LogInformation("Initializing independent PHQ-2 assessment for user {UserId}", userId);

            // Initialize or get existing chat history
            if (!_userChatHistories.TryGetValue(userId, out var chatHistory))
            {
                chatHistory = new ChatHistory();
                chatHistory.AddSystemMessage(Instructions);
                _userChatHistories[userId] = chatHistory;
            }

            // Initialize assessment if not exists
            if (!_activeAssessments.ContainsKey(userId))
            {
                _activeAssessments[userId] = new Phq2Assessment { StartDate = DateTime.UtcNow };
            }

            var assessment = _activeAssessments[userId];

            // Create the initial message
            var initialMessage = """
                Hello! I'm the PHQ-2 screening agent. I'd like to help you with a brief depression screening.

                I'll ask you 2 quick questions about how you've felt over the last 2 weeks. This is a screening tool to help identify if you might benefit from further evaluation - it's not a diagnosis.

                Each question uses a simple 0-3 scale:
                • 0 = Not at all
                • 1 = Several days  
                • 2 = More than half the days
                • 3 = Nearly every day

                This should take about 1-2 minutes. Are you ready to begin?
                """;

            chatHistory.AddAssistantMessage(initialMessage);

            return Task.FromResult((chatHistory, assessment, initialMessage));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initializing independent PHQ-2 assessment for user {UserId}", userId);
            throw;
        }
    }

    /// <summary>
    /// Gets an AI chat response for the given input
    /// </summary>
    public async Task<string> GetChatResponseAsync(ChatHistory chatHistory, string userId, string userResponse)
    {
        try
        {
            // Get AI response
            var aiResponse = await _chatService.GetChatMessageContentAsync(chatHistory, kernel: _kernel);
            var responseText = aiResponse.Content ?? "I'm sorry, I didn't understand that. Could you please try again?";

            // Process the response to update assessment state
            ProcessAssessmentResponse(userId, userResponse);

            return responseText;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting chat response for user {UserId}", userId);
            return "I'm sorry, I encountered an error. Could you please try again?";
        }
    }

    /// <summary>
    /// Checks if the user input indicates they want to exit the assessment
    /// </summary>
    public bool IsExitRequest(string userInput)
    {
        var lowerInput = userInput.ToLowerInvariant();
        return lowerInput.Contains("exit") || 
               lowerInput.Contains("quit") || 
               lowerInput.Contains("back to menu") ||
               lowerInput.Contains("main menu") ||
               lowerInput.Contains("coordinator") ||
               lowerInput.Contains("cancel") ||
               lowerInput.Contains("stop assessment");
    }

    /// <summary>
    /// Checks if the user input indicates a crisis situation
    /// </summary>
    public bool IsCrisisSignal(string userInput)
    {
        var lowerInput = userInput.ToLowerInvariant();
        return lowerInput.Contains("kill myself") ||
               lowerInput.Contains("suicide") ||
               lowerInput.Contains("end my life") ||
               lowerInput.Contains("hurt myself") ||
               lowerInput.Contains("self-harm") ||
               lowerInput.Contains("don't want to live") ||
               lowerInput.Contains("better off dead");
    }

    #region IHandoffAgent Implementation

    public bool CanHandle(string userInput, Dictionary<string, object> context)
    {
        var lowerInput = userInput.ToLowerInvariant();
        return lowerInput.Contains("phq-2") || 
               lowerInput.Contains("phq2") ||
               lowerInput.Contains("depression screening") ||
               lowerInput.Contains("quick depression") ||
               lowerInput.Contains("rapid depression") ||
               (lowerInput.Contains("depression") && (lowerInput.Contains("screen") || lowerInput.Contains("check")));
    }

    public async Task<HandoffInitializationResult> InitializeHandoffAsync(string userId, Dictionary<string, object> context)
    {
        try
        {
            _logger.LogInformation("Initializing PHQ-2 handoff for user {UserId}", userId);

            // Initialize or get existing chat history
            if (!_userChatHistories.TryGetValue(userId, out var chatHistory))
            {
                chatHistory = new ChatHistory();
                chatHistory.AddSystemMessage(Instructions);
                _userChatHistories[userId] = chatHistory;
            }

            // Initialize assessment if not exists
            if (!_activeAssessments.ContainsKey(userId))
            {
                _activeAssessments[userId] = new Phq2Assessment { StartDate = DateTime.UtcNow };
            }

            var initialMessage = """
                Hello! I'm going to help you with a PHQ-2 depression screening. This is a quick, 2-question screening tool that takes about a minute to complete.

                The PHQ-2 helps identify if you might benefit from a more comprehensive evaluation. It asks about your experiences over the past 2 weeks.

                Each question uses a simple scale:
                • 0 = Not at all
                • 1 = Several days  
                • 2 = More than half the days
                • 3 = Nearly every day

                Are you ready to begin?
                """;

            return new HandoffInitializationResult
            {
                Success = true,
                InitialMessage = initialMessage,
                EstimatedDuration = TimeSpan.FromMinutes(2),
                UpdatedContext = new Dictionary<string, object>
                {
                    ["phq2_started"] = DateTime.UtcNow,
                    ["assessment_type"] = "phq2"
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initializing PHQ-2 handoff for user {UserId}", userId);
            return new HandoffInitializationResult
            {
                Success = false,
                ErrorMessage = "I'm having trouble starting the PHQ-2 screening. Please try again."
            };
        }
    }

    public async Task<HandoffProcessingResult> ProcessInputAsync(string userId, string userInput, Dictionary<string, object> context)
    {
        try
        {
            // Check for exit requests
            if (IsExitRequest(userInput))
            {
                return new HandoffProcessingResult
                {
                    Success = true,
                    ResponseMessage = "I understand you'd like to stop the PHQ-2 screening. I'm returning you to the main conversation.",
                    IsComplete = true,
                    UpdatedContext = new Dictionary<string, object>
                    {
                        ["exit_reason"] = "user_request",
                        ["completed"] = false
                    }
                };
            }

            // Check for crisis situations
            if (IsCrisisSignal(userInput))
            {
                return new HandoffProcessingResult
                {
                    Success = true,
                    ResponseMessage = """
                        ⚠️ I'm concerned about your safety. Please reach out for immediate help:
                        
                        • Call 988 (Suicide & Crisis Lifeline)
                        • Text HOME to 741741 (Crisis Text Line)
                        • Call 911 if you're in immediate danger
                        
                        Your safety is the most important thing right now.
                        """,
                    CrisisLevel = HandoffCrisisLevel.High,
                    RequiresImmediateHandback = true
                };
            }

            // Get or create assessment
            if (!_activeAssessments.TryGetValue(userId, out var assessment))
            {
                // Reinitialize if assessment is missing
                var initResult = await InitializeHandoffAsync(userId, context);
                if (!initResult.Success)
                {
                    return new HandoffProcessingResult
                    {
                        Success = false,
                        ErrorMessage = "I lost track of your assessment. Let me restart it for you."
                    };
                }
                assessment = _activeAssessments[userId];
            }

            // Check if ready to begin (user said yes/ready/etc.)
            if (assessment.Responses.Count == 0 && IsReadyResponse(userInput))
            {
                var question1 = """
                    Q1. Over the last 2 weeks, how often have you been bothered by:
                    Little interest or pleasure in doing things?
                    
                    Please respond with 0, 1, 2, or 3:
                    0 = Not at all
                    1 = Several days
                    2 = More than half the days
                    3 = Nearly every day
                    """;

                return new HandoffProcessingResult
                {
                    Success = true,
                    ResponseMessage = question1,
                    UpdatedContext = new Dictionary<string, object>
                    {
                        ["current_question"] = 1,
                        ["awaiting_response"] = true
                    }
                };
            }

            // Process numeric responses
            if (int.TryParse(userInput.Trim(), out var score) && score >= 0 && score <= 3)
            {
                var nextQuestionNumber = assessment.GetNextQuestionNumber();
                
                if (nextQuestionNumber.HasValue)
                {
                    var recordResult = RecordResponse(userId, nextQuestionNumber.Value, score);
                    
                    // Check if assessment is now complete
                    if (assessment.IsCompleted)
                    {
                        var results = CompleteAssessment(userId);
                        
                        return new HandoffProcessingResult
                        {
                            Success = true,
                            ResponseMessage = $"Response recorded.\n\n{results}",
                            IsComplete = true,
                            UpdatedContext = new Dictionary<string, object>
                            {
                                ["assessment_completed"] = DateTime.UtcNow,
                                ["total_score"] = assessment.CalculateScore(),
                                ["completion_data"] = new Dictionary<string, object>
                                {
                                    ["score"] = assessment.CalculateScore(),
                                    ["severity"] = assessment.DetermineSeverity(assessment.CalculateScore()),
                                    ["completed_date"] = DateTime.UtcNow
                                }
                            }
                        };
                    }
                    else
                    {
                        // Ask next question
                        var question2 = """
                            Q2. Over the last 2 weeks, how often have you been bothered by:
                            Feeling down, depressed, or hopeless?
                            
                            Please respond with 0, 1, 2, or 3:
                            0 = Not at all
                            1 = Several days
                            2 = More than half the days
                            3 = Nearly every day
                            """;

                        return new HandoffProcessingResult
                        {
                            Success = true,
                            ResponseMessage = $"Response recorded: {Phq2Questionnaire.ResponseOptions[(Phq2ResponseScale)score]}\n\n{question2}",
                            UpdatedContext = new Dictionary<string, object>
                            {
                                ["current_question"] = 2,
                                ["awaiting_response"] = true
                            }
                        };
                    }
                }
            }

            // Invalid response
            return new HandoffProcessingResult
            {
                Success = true,
                ResponseMessage = """
                    Please respond with a number 0, 1, 2, or 3 only:
                    0 = Not at all
                    1 = Several days
                    2 = More than half the days
                    3 = Nearly every day
                    """,
                UpdatedContext = new Dictionary<string, object>
                {
                    ["invalid_response"] = userInput,
                    ["retry_needed"] = true
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PHQ-2 input for user {UserId}", userId);
            return new HandoffProcessingResult
            {
                Success = false,
                ErrorMessage = "I encountered an error during the screening. Could you try your last response again?"
            };
        }
    }

    public async Task<HandoffCompletionResult> CompleteHandoffAsync(string userId, Dictionary<string, object> context)
    {
        try
        {
            _logger.LogInformation("Completing PHQ-2 handoff for user {UserId}", userId);

            var completionData = new Dictionary<string, object>
            {
                ["completion_time"] = DateTime.UtcNow
            };

            // Get assessment results if completed
            if (_activeAssessments.TryGetValue(userId, out var assessment) && assessment.IsCompleted)
            {
                var score = assessment.CalculateScore();
                completionData["total_score"] = score;
                completionData["severity"] = assessment.DetermineSeverity(score);
                completionData["assessment_data"] = assessment;
                
                // Suggest next steps
                string? suggestedNextAgent = null;
                if (score >= 3)
                {
                    suggestedNextAgent = "phq9"; // Suggest comprehensive assessment
                }

                return new HandoffCompletionResult
                {
                    Success = true,
                    CompletionMessage = "PHQ-2 screening completed successfully.",
                    SuggestedNextAgent = suggestedNextAgent,
                    CompletionData = completionData,
                    UpdatedContext = new Dictionary<string, object>
                    {
                        ["returning_from_agent"] = "phq2",
                        ["completion_data"] = completionData
                    }
                };
            }
            else
            {
                // Assessment was not completed
                completionData["completed"] = false;
                completionData["reason"] = "Assessment not finished";
                
                return new HandoffCompletionResult
                {
                    Success = true,
                    CompletionMessage = "PHQ-2 screening was not completed.",
                    CompletionData = completionData,
                    UpdatedContext = new Dictionary<string, object>
                    {
                        ["returning_from_agent"] = "phq2",
                        ["completion_data"] = completionData
                    }
                };
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error completing PHQ-2 handoff for user {UserId}", userId);
            return new HandoffCompletionResult
            {
                Success = false,
                ErrorMessage = "I had trouble wrapping up the screening, but your responses were recorded."
            };
        }
    }

    public async Task HandleInterruptionAsync(string userId, string reason)
    {
        _logger.LogWarning("PHQ-2 agent interrupted for user {UserId}: {Reason}", userId, reason);
        
        // Clean up resources if needed
        // Keep assessment data for potential resume
        
        await Task.CompletedTask;
    }

    private bool IsReadyResponse(string userInput)
    {
        var lowerInput = userInput.ToLowerInvariant();
        return lowerInput.Contains("yes") || 
               lowerInput.Contains("ready") ||
               lowerInput.Contains("ok") ||
               lowerInput.Contains("sure") ||
               lowerInput.Contains("begin") ||
               lowerInput.Contains("start") ||
               lowerInput.Contains("let's go");
    }

    #endregion

    /// <summary>
    /// Processes user responses to update assessment state
    /// </summary>
    private void ProcessAssessmentResponse(string userId, string userResponse)
    {
        // Try to parse numeric responses
        if (int.TryParse(userResponse.Trim(), out var score) && score >= 0 && score <= 3)
        {
            var assessment = _activeAssessments[userId];
            var nextQuestionNumber = assessment.GetNextQuestionNumber();
            
            if (nextQuestionNumber.HasValue)
            {
                RecordResponse(userId, nextQuestionNumber.Value, score);
            }
        }
    }
}
