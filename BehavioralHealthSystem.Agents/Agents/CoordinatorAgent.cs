using BehavioralHealthSystem.Agents.Interfaces;

namespace BehavioralHealthSystem.Agents.Agents;

/// <summary>
/// Main coordination agent that manages general conversation and delegates to specialized agents
/// Serves as the primary human-facing agent in the handoff pattern
/// </summary>
public class CoordinatorAgent : IHandoffAgent
{
    private readonly ILogger<CoordinatorAgent> _logger;
    private readonly Kernel _kernel;
    private readonly IChatCompletionService _chatService;
    private readonly Dictionary<string, ChatHistory> _userChatHistories = new();

    public string AgentId => "coordinator";
    public string Name => "Behavioral Health Coordinator";
    public string Description => "Primary coordination agent for behavioral health conversations and task delegation";
    public string[] TriggerKeywords => new[] { "hello", "hi", "help", "start", "begin", "coordinator" };
    public int Priority => 1; // Lower priority - should be default fallback

    public string Instructions => """
        Behavioral Health Coordinator Agent Instructions
        
        Purpose:
        You are the primary coordination agent for a behavioral health system. Your role is to:
        1. Maintain natural, empathetic conversation with users
        2. Detect when specialized agents (PHQ-2, PHQ-9, Comedy, etc.) should take over
        3. Provide general support and guidance
        4. Coordinate seamless handoffs to and from specialized agents
        
        Conversation Guidelines:
        - Be warm, professional, and empathetic
        - Listen actively to user concerns
        - Ask clarifying questions when needed
        - Provide general mental health support and encouragement
        - Avoid providing medical advice or diagnoses
        
        Handoff Detection:
        Watch for these triggers to delegate to specialized agents:
        - Depression screening requests → PHQ-2 or PHQ-9 agents
        - Mood lifting/humor requests → Comedy agent  
        - Crisis/suicidal ideation → Immediate crisis protocols
        - Specific assessment requests → Appropriate assessment agent
        
        When delegating:
        - Explain briefly what will happen next
        - Ensure user consent for the handoff
        - Provide reassurance about the process
        
        Safety Protocols:
        - Always prioritize user safety
        - Escalate crisis situations immediately
        - Maintain professional boundaries
        - Document concerns appropriately
        
        Remember: You are the central hub that ensures users feel heard and supported throughout their entire experience.
        """;

    public CoordinatorAgent(Kernel kernel, ILogger<CoordinatorAgent> logger)
    {
        _kernel = kernel;
        _logger = logger;
        _chatService = kernel.GetRequiredService<IChatCompletionService>();
        
        kernel.Plugins.AddFromObject(this, "CoordinatorFunctions");
    }

    public bool CanHandle(string userInput, Dictionary<string, object> context)
    {
        // Coordinator can handle general conversation but has low priority
        // It should only be selected if no other agent can handle the input
        var lowerInput = userInput.ToLowerInvariant();
        
        // Don't handle if other agents would be more appropriate
        if (lowerInput.Contains("phq") || lowerInput.Contains("depression") || lowerInput.Contains("screening"))
            return false;
            
        if (lowerInput.Contains("joke") || lowerInput.Contains("funny") || lowerInput.Contains("humor"))
            return false;
            
        // Handle general conversation
        return true;
    }

    public async Task<HandoffInitializationResult> InitializeHandoffAsync(string userId, Dictionary<string, object> context)
    {
        try
        {
            _logger.LogInformation("Initializing coordinator agent for user {UserId}", userId);

            // Initialize or get existing chat history
            if (!_userChatHistories.TryGetValue(userId, out var chatHistory))
            {
                chatHistory = new ChatHistory();
                chatHistory.AddSystemMessage(Instructions);
                _userChatHistories[userId] = chatHistory;
            }

            // Check if this is a return from another agent
            var isReturn = context.ContainsKey("returning_from_agent");
            string initialMessage;

            if (isReturn)
            {
                var fromAgent = context.GetValueOrDefault("returning_from_agent", "another agent").ToString();
                var completionData = context.GetValueOrDefault("completion_data") as Dictionary<string, object>;
                
                initialMessage = BuildReturnMessage(fromAgent, completionData);
            }
            else
            {
                initialMessage = """
                    Hello! I'm here to support you with your behavioral health needs. 
                    
                    I can help you with:
                    • General conversation and support
                    • Depression and anxiety screenings
                    • Connecting you with appropriate resources
                    • A bit of humor when you need it
                    
                    What would you like to talk about today?
                    """;
            }

            return new HandoffInitializationResult
            {
                Success = true,
                InitialMessage = initialMessage,
                EstimatedDuration = TimeSpan.FromMinutes(5), // General conversation
                UpdatedContext = new Dictionary<string, object>
                {
                    ["coordinator_initialized"] = DateTime.UtcNow,
                    ["session_type"] = "general_conversation"
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initializing coordinator agent for user {UserId}", userId);
            return new HandoffInitializationResult
            {
                Success = false,
                ErrorMessage = "I'm having trouble getting started. Please try again in a moment."
            };
        }
    }

    public async Task<HandoffProcessingResult> ProcessInputAsync(string userId, string userInput, Dictionary<string, object> context)
    {
        try
        {
            // Get chat history
            if (!_userChatHistories.TryGetValue(userId, out var chatHistory))
            {
                // Reinitialize if needed
                var initResult = await InitializeHandoffAsync(userId, context);
                if (!initResult.Success)
                {
                    return new HandoffProcessingResult
                    {
                        Success = false,
                        ErrorMessage = "I'm having trouble accessing our conversation. Could you try again?"
                    };
                }
                chatHistory = _userChatHistories[userId];
            }

            // Check for crisis situations first
            var crisisLevel = DetectCrisisLevel(userInput);
            if (crisisLevel >= HandoffCrisisLevel.High)
            {
                return new HandoffProcessingResult
                {
                    Success = true,
                    ResponseMessage = GetCrisisResponse(crisisLevel),
                    CrisisLevel = crisisLevel,
                    RequiresImmediateHandback = true
                };
            }

            // Check for handoff triggers
            var suggestedAgent = DetectHandoffTrigger(userInput, context);
            if (!string.IsNullOrEmpty(suggestedAgent))
            {
                var handoffMessage = BuildHandoffMessage(suggestedAgent, userInput);
                
                return new HandoffProcessingResult
                {
                    Success = true,
                    ResponseMessage = handoffMessage,
                    IsComplete = true,
                    UpdatedContext = new Dictionary<string, object>
                    {
                        ["handoff_reason"] = userInput,
                        ["suggested_agent"] = suggestedAgent,
                        ["handoff_timestamp"] = DateTime.UtcNow
                    }
                };
            }

            // Continue general conversation
            chatHistory.AddUserMessage(userInput);
            
            var response = await _chatService.GetChatMessageContentAsync(chatHistory, kernel: _kernel);
            var responseText = response.Content ?? "I'm here to listen. Could you tell me more?";
            
            chatHistory.AddAssistantMessage(responseText);

            return new HandoffProcessingResult
            {
                Success = true,
                ResponseMessage = responseText,
                UpdatedContext = new Dictionary<string, object>
                {
                    ["last_interaction"] = DateTime.UtcNow,
                    ["message_count"] = chatHistory.Count
                }
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing input for user {UserId}", userId);
            return new HandoffProcessingResult
            {
                Success = false,
                ErrorMessage = "I encountered an issue processing your message. Could you try rephrasing that?"
            };
        }
    }

    public async Task<HandoffCompletionResult> CompleteHandoffAsync(string userId, Dictionary<string, object> context)
    {
        try
        {
            _logger.LogInformation("Completing coordinator agent handoff for user {UserId}", userId);

            // Save conversation state
            var completionData = new Dictionary<string, object>
            {
                ["conversation_length"] = _userChatHistories.GetValueOrDefault(userId)?.Count ?? 0,
                ["completion_time"] = DateTime.UtcNow
            };

            // Determine if this is a handoff or session end
            var suggestedAgent = context.GetValueOrDefault("suggested_agent")?.ToString();
            
            if (!string.IsNullOrEmpty(suggestedAgent))
            {
                return new HandoffCompletionResult
                {
                    Success = true,
                    CompletionMessage = "I'm connecting you with the right specialist now.",
                    SuggestedNextAgent = suggestedAgent,
                    CompletionData = completionData,
                    UpdatedContext = new Dictionary<string, object>
                    {
                        ["handoff_source"] = "coordinator",
                        ["handoff_target"] = suggestedAgent
                    }
                };
            }

            return new HandoffCompletionResult
            {
                Success = true,
                CompletionMessage = "Thank you for our conversation. I'm here whenever you need support.",
                CompletionData = completionData
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error completing coordinator handoff for user {UserId}", userId);
            return new HandoffCompletionResult
            {
                Success = false,
                ErrorMessage = "I had trouble wrapping up our conversation, but I'm still here to help."
            };
        }
    }

    public async Task HandleInterruptionAsync(string userId, string reason)
    {
        _logger.LogWarning("Coordinator agent interrupted for user {UserId}: {Reason}", userId, reason);
        
        // Clean up any resources
        // Note: We keep chat history for potential resume
        
        await Task.CompletedTask;
    }

    [KernelFunction("route_request")]
    [Description("Routes user requests to appropriate agents")]
    public string RouteRequest(
        [Description("User ID")] string userId,
        [Description("User message/request")] string message)
    {
        try
        {
            _logger.LogInformation("Routing request for user {UserId}: {Message}", userId, message);

            var suggestedAgent = DetectHandoffTrigger(message, new Dictionary<string, object>());
            
            return suggestedAgent switch
            {
                "phq2" => $"Routing to PHQ2Agent for rapid depression screening. User: {userId}",
                "phq9" => $"Routing to PHQ9Agent for comprehensive depression assessment. User: {userId}",
                "comedian" => $"Routing to ComedianAgent for humor and lighthearted conversation. User: {userId}",
                _ => "Continuing with general coordination conversation."
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error routing request for user {UserId}", userId);
            return "Error processing your request. Please try again.";
        }
    }

    private HandoffCrisisLevel DetectCrisisLevel(string userInput)
    {
        var lowerInput = userInput.ToLowerInvariant();
        
        // Emergency level
        if (lowerInput.Contains("kill myself") || 
            lowerInput.Contains("end my life") ||
            lowerInput.Contains("suicide plan") ||
            lowerInput.Contains("going to hurt myself"))
        {
            return HandoffCrisisLevel.Emergency;
        }
        
        // High level
        if (lowerInput.Contains("suicide") ||
            lowerInput.Contains("suicidal") ||
            lowerInput.Contains("hurt myself") ||
            lowerInput.Contains("self-harm") ||
            lowerInput.Contains("don't want to live"))
        {
            return HandoffCrisisLevel.High;
        }
        
        // Medium level
        if (lowerInput.Contains("hopeless") ||
            lowerInput.Contains("worthless") ||
            lowerInput.Contains("can't go on") ||
            lowerInput.Contains("better off dead"))
        {
            return HandoffCrisisLevel.Medium;
        }
        
        return HandoffCrisisLevel.None;
    }

    private string GetCrisisResponse(HandoffCrisisLevel level)
    {
        return level switch
        {
            HandoffCrisisLevel.Emergency => """
                🚨 I'm very concerned about your safety right now. Please reach out for immediate help:
                
                • Call 988 (Suicide & Crisis Lifeline) - available 24/7
                • Text "HELLO" to 741741 (Crisis Text Line)
                • Go to your nearest emergency room
                • Call 911 if you're in immediate danger
                
                You don't have to go through this alone. Help is available.
                """,
                
            HandoffCrisisLevel.High => """
                I'm worried about you and want to make sure you're safe. If you're having thoughts of hurting yourself, please reach out for support:
                
                • 988 Suicide & Crisis Lifeline (call or text)
                • Crisis Text Line: Text HOME to 741741
                • Your local emergency services: 911
                
                Would you like to talk about what's making you feel this way? I'm here to listen.
                """,
                
            HandoffCrisisLevel.Medium => """
                It sounds like you're going through a really difficult time. These feelings can be overwhelming, but you don't have to face them alone.
                
                If you start having thoughts of hurting yourself, please reach out:
                • 988 Suicide & Crisis Lifeline
                • Crisis Text Line: 741741
                
                Would you like to talk about what's been troubling you? Sometimes it helps to share.
                """,
                
            _ => "I'm here to support you. What's on your mind?"
        };
    }

    private string? DetectHandoffTrigger(string userInput, Dictionary<string, object> context)
    {
        var lowerInput = userInput.ToLowerInvariant();
        
        // PHQ-2 triggers
        if (lowerInput.Contains("phq-2") || 
            lowerInput.Contains("depression screening") ||
            lowerInput.Contains("quick depression") ||
            (lowerInput.Contains("depression") && lowerInput.Contains("check")))
        {
            return "phq2";
        }
        
        // PHQ-9 triggers  
        if (lowerInput.Contains("phq-9") ||
            lowerInput.Contains("full depression") ||
            lowerInput.Contains("comprehensive depression"))
        {
            return "phq9";
        }
        
        // Comedy agent triggers
        if (lowerInput.Contains("joke") ||
            lowerInput.Contains("funny") ||
            lowerInput.Contains("humor") ||
            lowerInput.Contains("cheer me up") ||
            lowerInput.Contains("make me laugh"))
        {
            return "comedian";
        }
        
        // General assessment triggers
        if (lowerInput.Contains("assessment") ||
            lowerInput.Contains("screening") ||
            lowerInput.Contains("test") ||
            lowerInput.Contains("questionnaire"))
        {
            return "phq2"; // Default to PHQ-2 for general assessment requests
        }
        
        return null;
    }

    private string BuildHandoffMessage(string targetAgent, string userInput)
    {
        return targetAgent switch
        {
            "phq2" => """
                I can help you with a quick depression screening using the PHQ-2. It's just 2 simple questions that take about a minute to complete.
                
                This screening can help identify if you might benefit from further evaluation. Would you like to proceed with the PHQ-2 screening?
                """,
                
            "phq9" => """
                I'll connect you with our comprehensive depression screening (PHQ-9). This is a more detailed assessment that provides a thorough evaluation of depression symptoms.
                
                It takes about 5 minutes and gives us a better understanding of how you've been feeling. Shall we begin?
                """,
                
            "comedian" => """
                I think some humor might be exactly what you need right now! I'm going to connect you with our comedy specialist who has a great collection of jokes and funny stories.
                
                Sometimes a good laugh can really help shift our perspective. Ready for some fun?
                """,
                
            _ => "I'm connecting you with a specialist who can better help with your request."
        };
    }

    private string BuildReturnMessage(string? fromAgent, Dictionary<string, object>? completionData)
    {
        var baseMessage = "I'm back! ";
        
        return fromAgent switch
        {
            "phq2" => baseMessage + "How are you feeling after completing the PHQ-2 screening? I'm here if you'd like to talk about the results or if there's anything else I can help you with.",
            
            "phq9" => baseMessage + "Thank you for completing the comprehensive screening. That took some thoughtfulness and courage. What would you like to discuss next?",
            
            "comedian" => baseMessage + "I hope you enjoyed some laughs! Humor can be such good medicine. How are you feeling now? Is there anything else I can help you with?",
            
            _ => baseMessage + "How are you feeling? Is there anything else I can help you with today?"
        };
    }
}