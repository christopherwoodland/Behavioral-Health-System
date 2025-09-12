namespace BehavioralHealthSystem.Agents.Chat;

/// <summary>
/// Manages group chat coordination between multiple agents
/// </summary>
public class BehavioralHealthGroupChat
{
    private readonly ILogger<BehavioralHealthGroupChat> _logger;
    private readonly ILoggerFactory _loggerFactory;
    private readonly Kernel _kernel;
    private readonly Dictionary<string, object> _agents = new();
    private IChatCompletionService? _chatService;

    public BehavioralHealthGroupChat(Kernel kernel, ILogger<BehavioralHealthGroupChat> logger, ILoggerFactory loggerFactory)
    {
        _kernel = kernel;
        _logger = logger;
        _loggerFactory = loggerFactory;
    }

    /// <summary>
    /// Initializes the group chat with available agents
    /// </summary>
    public async Task InitializeAsync()
    {
        try
        {
            _logger.LogInformation("Initializing Behavioral Health Group Chat");

            // Get chat completion service
            _chatService = _kernel.GetRequiredService<IChatCompletionService>();

            // Create PHQ-2 Agent
            var phq2Agent = new Phq2Agent(_kernel, _loggerFactory.CreateLogger<Phq2Agent>());
            _agents.Add("PHQ2Agent", phq2Agent);

            // Create PHQ-9 Agent
            var phq9Agent = new Phq9Agent(_kernel, _loggerFactory.CreateLogger<Phq9Agent>());
            _agents.Add("PHQ9Agent", phq9Agent);

            // Create Coordinator Agent
            var coordinatorAgent = new CoordinatorAgent(_kernel, _loggerFactory.CreateLogger<CoordinatorAgent>());
            _agents.Add("CoordinatorAgent", coordinatorAgent);

            _logger.LogInformation("Group chat initialized with {AgentCount} agents", _agents.Count);
            
            await Task.CompletedTask; // Make method async for future extensibility
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initializing group chat");
            throw;
        }
    }

    /// <summary>
    /// Processes a user message through the agent group chat
    /// </summary>
    public async Task<string> ProcessMessageAsync(string userId, string message)
    {
        if (_chatService == null)
        {
            throw new InvalidOperationException("Group chat not initialized. Call InitializeAsync first.");
        }

        try
        {
            _logger.LogInformation("Processing message from user {UserId}: {Message}", userId, message);

            // Route to coordinator agent first
            var coordinatorAgent = (CoordinatorAgent)_agents["CoordinatorAgent"];
            var routingResult = coordinatorAgent.RouteRequest(userId, message);

            // Check if we need to route to PHQ-2 agent
            if (routingResult.Contains("PHQ2Agent"))
            {
                return await InvokeAgentDirectlyAsync("PHQ2Agent", userId, message);
            }

            // Check if we need to route to PHQ-9 agent
            if (routingResult.Contains("PHQ9Agent"))
            {
                return await InvokeAgentDirectlyAsync("PHQ9Agent", userId, message);
            }

            _logger.LogInformation("Completed processing message for user {UserId}", userId);
            return routingResult;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing message for user {UserId}", userId);
            return "Sorry, I encountered an error processing your request. Please try again.";
        }
    }

    /// <summary>
    /// Gets information about available agents
    /// </summary>
    public string GetAgentInfo()
    {
        if (!_agents.Any())
        {
            return "No agents available.";
        }

        var agentInfo = _agents.Select(kvp =>
        {
            return kvp.Value switch
            {
                Phq2Agent phq2 => $"- {kvp.Key}: {phq2.Description}",
                Phq9Agent phq9 => $"- {kvp.Key}: {phq9.Description}",
                CoordinatorAgent coord => $"- {kvp.Key}: {coord.Description}",
                _ => $"- {kvp.Key}: Unknown Agent"
            };
        });
        
        return $"Available Agents:\n{string.Join("\n", agentInfo)}";
    }

    /// <summary>
    /// Directly invokes a specific agent
    /// </summary>
    public string InvokeAgentDirectly(string agentName, string userId, string message)
    {
        if (!_agents.TryGetValue(agentName, out var agent))
        {
            return $"Agent '{agentName}' not found.";
        }

        try
        {
            _logger.LogInformation("Directly invoking agent {AgentName} for user {UserId}", agentName, userId);

            // Route to specific agent based on message content and agent type
            return agent switch
            {
                Phq2Agent phq2Agent => ProcessPhq2Message(phq2Agent, userId, message),
                Phq9Agent phq9Agent => ProcessPhq9Message(phq9Agent, userId, message),
                CoordinatorAgent coordAgent => coordAgent.RouteRequest(userId, message),
                _ => "Unknown agent type."
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error invoking agent {AgentName} directly", agentName);
            return $"Error invoking {agentName}. Please try again.";
        }
    }

    /// <summary>
    /// Directly invokes a specific agent (async version for compatibility)
    /// </summary>
    public async Task<string> InvokeAgentDirectlyAsync(string agentName, string userId, string message)
    {
        return await Task.FromResult(InvokeAgentDirectly(agentName, userId, message));
    }

    private string ProcessPhq9Message(Phq9Agent agent, string userId, string message)
    {
        var lowerMessage = message.ToLowerInvariant();

        // Parse different PHQ-9 operations
        if (lowerMessage.Contains("start") || lowerMessage.Contains("begin"))
        {
            return agent.StartAssessment(userId);
        }
        else if (lowerMessage.Contains("status"))
        {
            return agent.GetAssessmentStatus(userId);
        }
        else if (lowerMessage.Contains("results") || lowerMessage.Contains("get my"))
        {
            return agent.GetResults(userId);
        }
        else if (lowerMessage.Contains("record") || lowerMessage.Contains("response"))
        {
            // Try to parse question and score from message
            if (TryParseResponse(message, out var questionNumber, out var score))
            {
                return agent.RecordResponse(userId, questionNumber, score);
            }
            return "Please specify question number (1-9) and score (0-3). Example: 'Record response: Question 1, Score 2'";
        }
        else if (char.IsDigit(lowerMessage.FirstOrDefault()))
        {
            // Assume this is a direct response to a question
            if (int.TryParse(lowerMessage.Trim(), out var score) && score >= 0 && score <= 3)
            {
                // Get current assessment to find next question
                var status = agent.GetAssessmentStatus(userId);
                if (status.Contains("Next Question:"))
                {
                    var nextQuestionMatch = System.Text.RegularExpressions.Regex.Match(status, @"Next Question: (\d+)");
                    if (nextQuestionMatch.Success && int.TryParse(nextQuestionMatch.Groups[1].Value, out var nextQ))
                    {
                        return agent.RecordResponse(userId, nextQ, score);
                    }
                }
                return "No active assessment found. Please start a new assessment first.";
            }
            return "Invalid score. Please enter a number between 0 and 3.";
        }

        return "I can help you with PHQ-9 assessments. Try: 'start assessment', 'get status', 'get results', or respond with a number (0-3) to answer questions.";
    }

    private string ProcessPhq2Message(Phq2Agent agent, string userId, string message)
    {
        var lowerMessage = message.ToLowerInvariant();

        // Parse different PHQ-2 operations
        if (lowerMessage.Contains("start") || lowerMessage.Contains("begin"))
        {
            return agent.StartAssessment(userId);
        }
        else if (lowerMessage.Contains("status"))
        {
            return agent.GetAssessmentStatus(userId);
        }
        else if (lowerMessage.Contains("results") || lowerMessage.Contains("get my"))
        {
            return agent.GetResults(userId);
        }
        else if (lowerMessage.Contains("clinical") || lowerMessage.Contains("info"))
        {
            return agent.GetClinicalInfo();
        }
        else if (lowerMessage.Contains("record") || lowerMessage.Contains("response"))
        {
            // Try to parse question and score from message
            if (TryParseResponse(message, out var questionNumber, out var score))
            {
                return agent.RecordResponse(userId, questionNumber, score);
            }
            return "Please specify question number (1-2) and score (0-3). Example: 'Record response: Question 1, Score 2'";
        }
        else if (char.IsDigit(lowerMessage.FirstOrDefault()))
        {
            // Assume this is a direct response to a question
            if (int.TryParse(lowerMessage.Trim(), out var score) && score >= 0 && score <= 3)
            {
                // Get current assessment to find next question
                var status = agent.GetAssessmentStatus(userId);
                if (status.Contains("Next Question:"))
                {
                    var nextQuestionMatch = System.Text.RegularExpressions.Regex.Match(status, @"Next Question: (\d+)");
                    if (nextQuestionMatch.Success && int.TryParse(nextQuestionMatch.Groups[1].Value, out var nextQ))
                    {
                        return agent.RecordResponse(userId, nextQ, score);
                    }
                }
                return "No active assessment found. Please start a new assessment first.";
            }
            return "Invalid score. Please enter a number between 0 and 3.";
        }

        return "I can help you with PHQ-2 rapid screening. Try: 'start assessment', 'get status', 'get results', or respond with a number (0-3) to answer questions.";
    }

    private bool TryParseResponse(string message, out int questionNumber, out int score)
    {
        questionNumber = 0;
        score = 0;

        var questionMatch = System.Text.RegularExpressions.Regex.Match(message, @"question\s+(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        var scoreMatch = System.Text.RegularExpressions.Regex.Match(message, @"score\s+(\d+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        if (questionMatch.Success && scoreMatch.Success)
        {
            return int.TryParse(questionMatch.Groups[1].Value, out questionNumber) &&
                   int.TryParse(scoreMatch.Groups[1].Value, out score);
        }

        return false;
    }
}