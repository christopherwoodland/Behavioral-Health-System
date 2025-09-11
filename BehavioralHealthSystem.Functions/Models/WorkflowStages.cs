namespace BehavioralHealthSystem.Functions.Models;

// Enum representing orchestrator lifecycle stages for custom status consistency
public enum WorkflowStage
{
    Starting,
    InitiatingSession,
    SessionInitiated,
    SubmittingPrediction,
    PredictionSubmitted,
    PollingForResults,
    Completed,
    TimedOut,
    Failed
}

// Payload used for Durable Functions SetCustomStatus (must be serializable)
public sealed class WorkflowCustomStatus
{
    public string Stage { get; set; } = string.Empty;      // value from WorkflowStage enum ToString()
    public string? SessionId { get; set; }
    public string? UserId { get; set; }
    public string? Message { get; set; }
    public int? Attempt { get; set; }
    public int? Attempts { get; set; }        // total attempts on completion
    public int? MaxRetries { get; set; }
    public string? Reason { get; set; }
}
