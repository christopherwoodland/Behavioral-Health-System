namespace BehavioralHealthSystem.Agents.Interfaces;

/// <summary>
/// Defines the contract for agents that can participate in handoff scenarios
/// </summary>
public interface IHandoffAgent
{
    /// <summary>
    /// Unique identifier for this agent
    /// </summary>
    string AgentId { get; }

    /// <summary>
    /// Human-readable name for this agent
    /// </summary>
    string Name { get; }

    /// <summary>
    /// Description of what this agent does
    /// </summary>
    string Description { get; }

    /// <summary>
    /// Capabilities or keywords that trigger this agent
    /// </summary>
    string[] TriggerKeywords { get; }

    /// <summary>
    /// Priority level for conflict resolution when multiple agents match
    /// </summary>
    int Priority { get; }

    /// <summary>
    /// Indicates if this agent can handle the given user input
    /// </summary>
    bool CanHandle(string userInput, Dictionary<string, object> context);

    /// <summary>
    /// Initializes the agent with handoff context and returns the greeting message
    /// </summary>
    Task<HandoffInitializationResult> InitializeHandoffAsync(string userId, Dictionary<string, object> context);

    /// <summary>
    /// Processes user input and returns response
    /// Returns null when the agent is ready to hand back control
    /// </summary>
    Task<HandoffProcessingResult> ProcessInputAsync(string userId, string userInput, Dictionary<string, object> context);

    /// <summary>
    /// Finalizes the agent's work and prepares for handoff back to coordinator
    /// </summary>
    Task<HandoffCompletionResult> CompleteHandoffAsync(string userId, Dictionary<string, object> context);

    /// <summary>
    /// Emergency cleanup when handoff is forcibly interrupted
    /// </summary>
    Task HandleInterruptionAsync(string userId, string reason);
}

/// <summary>
/// Result of agent initialization
/// </summary>
public class HandoffInitializationResult
{
    public bool Success { get; set; }
    public string? InitialMessage { get; set; }
    public string? ErrorMessage { get; set; }
    public Dictionary<string, object> UpdatedContext { get; set; } = new();
    public TimeSpan EstimatedDuration { get; set; }
}

/// <summary>
/// Result of processing user input
/// </summary>
public class HandoffProcessingResult
{
    public bool Success { get; set; }
    public string? ResponseMessage { get; set; }
    public string? ErrorMessage { get; set; }
    public bool IsComplete { get; set; }
    public bool RequiresImmediateHandback { get; set; }
    public Dictionary<string, object> UpdatedContext { get; set; } = new();
    public HandoffCrisisLevel CrisisLevel { get; set; } = HandoffCrisisLevel.None;
}

/// <summary>
/// Result of agent completion
/// </summary>
public class HandoffCompletionResult
{
    public bool Success { get; set; }
    public string? CompletionMessage { get; set; }
    public string? ErrorMessage { get; set; }
    public Dictionary<string, object> CompletionData { get; set; } = new();
    public string? SuggestedNextAgent { get; set; }
    public Dictionary<string, object> UpdatedContext { get; set; } = new();
}

/// <summary>
/// Crisis levels for immediate escalation
/// </summary>
public enum HandoffCrisisLevel
{
    None = 0,
    Low = 1,
    Medium = 2,
    High = 3,
    Emergency = 4
}