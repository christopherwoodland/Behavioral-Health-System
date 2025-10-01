using System.ComponentModel.DataAnnotations;

namespace BehavioralHealthSystem.Helpers.Models;

/// <summary>
/// Represents an asynchronous job for extended risk assessment processing
/// </summary>
public class ExtendedAssessmentJob
{
    /// <summary>
    /// Unique identifier for the job
    /// </summary>
    [Required]
    public string JobId { get; set; } = string.Empty;

    /// <summary>
    /// Session ID associated with this job
    /// </summary>
    [Required]
    public string SessionId { get; set; } = string.Empty;

    /// <summary>
    /// Current status of the job
    /// </summary>
    [Required]
    public ExtendedAssessmentJobStatus Status { get; set; } = ExtendedAssessmentJobStatus.Pending;

    /// <summary>
    /// When the job was created
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// When the job was started (processing began)
    /// </summary>
    public DateTime? StartedAt { get; set; }

    /// <summary>
    /// When the job completed or failed
    /// </summary>
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// Progress percentage (0-100)
    /// </summary>
    public int ProgressPercentage { get; set; } = 0;

    /// <summary>
    /// Current step description for user feedback
    /// </summary>
    public string? CurrentStep { get; set; }

    /// <summary>
    /// Error message if job failed
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// Stack trace if job failed (for debugging)
    /// </summary>
    public string? ErrorDetails { get; set; }

    /// <summary>
    /// Result data when job completes successfully
    /// </summary>
    public ExtendedRiskAssessment? Result { get; set; }

    /// <summary>
    /// Processing time in milliseconds
    /// </summary>
    public long? ProcessingTimeMs { get; set; }

    /// <summary>
    /// Model used for the assessment (e.g., "gpt-5", "gpt-4.1")
    /// </summary>
    public string? ModelUsed { get; set; }

    /// <summary>
    /// Durable Functions instance ID for tracking
    /// </summary>
    public string? DurableFunctionInstanceId { get; set; }

    /// <summary>
    /// Number of retry attempts made
    /// </summary>
    public int RetryCount { get; set; } = 0;

    /// <summary>
    /// Maximum number of retries allowed
    /// </summary>
    public int MaxRetries { get; set; } = 3;

    /// <summary>
    /// Gets the elapsed time since job creation
    /// </summary>
    public TimeSpan ElapsedTime => DateTime.UtcNow - CreatedAt;

    /// <summary>
    /// Gets the processing time if job has started
    /// </summary>
    public TimeSpan? ProcessingTime => StartedAt.HasValue ? DateTime.UtcNow - StartedAt.Value : null;

    /// <summary>
    /// Checks if the job is in a completed state (success or failure)
    /// </summary>
    public bool IsCompleted => Status == ExtendedAssessmentJobStatus.Completed || 
                              Status == ExtendedAssessmentJobStatus.Failed;

    /// <summary>
    /// Checks if the job is currently processing
    /// </summary>
    public bool IsProcessing => Status == ExtendedAssessmentJobStatus.Processing;

    /// <summary>
    /// Checks if the job can be retried
    /// </summary>
    public bool CanRetry => Status == ExtendedAssessmentJobStatus.Failed && RetryCount < MaxRetries;
}

/// <summary>
/// Status enumeration for extended assessment jobs
/// </summary>
public enum ExtendedAssessmentJobStatus
{
    /// <summary>
    /// Job created but not yet started
    /// </summary>
    Pending = 0,

    /// <summary>
    /// Job is currently being processed
    /// </summary>
    Processing = 1,

    /// <summary>
    /// Job completed successfully
    /// </summary>
    Completed = 2,

    /// <summary>
    /// Job failed with an error
    /// </summary>
    Failed = 3,

    /// <summary>
    /// Job was cancelled
    /// </summary>
    Cancelled = 4,

    /// <summary>
    /// Job timed out
    /// </summary>
    TimedOut = 5
}