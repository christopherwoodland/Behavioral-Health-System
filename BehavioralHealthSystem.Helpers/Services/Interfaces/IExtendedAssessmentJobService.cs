namespace BehavioralHealthSystem.Helpers.Services;

/// <summary>
/// Service for managing extended assessment jobs with async processing
/// </summary>
public interface IExtendedAssessmentJobService
{
    /// <summary>
    /// Creates a new job for extended assessment processing
    /// </summary>
    /// <param name="sessionId">Session ID to process</param>
    /// <returns>Job ID for tracking</returns>
    Task<string> CreateJobAsync(string sessionId);

    /// <summary>
    /// Gets the status and details of a job
    /// </summary>
    /// <param name="jobId">Job ID to query</param>
    /// <returns>Job details or null if not found</returns>
    Task<ExtendedAssessmentJob?> GetJobAsync(string jobId);

    /// <summary>
    /// Updates job status and progress
    /// </summary>
    /// <param name="jobId">Job ID to update</param>
    /// <param name="status">New status</param>
    /// <param name="progressPercentage">Progress percentage (0-100)</param>
    /// <param name="currentStep">Current step description</param>
    /// <returns>Success flag</returns>
    Task<bool> UpdateJobStatusAsync(string jobId, ExtendedAssessmentJobStatus status, int progressPercentage = 0, string? currentStep = null);

    /// <summary>
    /// Marks a job as completed with results
    /// </summary>
    /// <param name="jobId">Job ID to complete</param>
    /// <param name="result">Assessment result</param>
    /// <param name="processingTimeMs">Processing time in milliseconds</param>
    /// <param name="modelUsed">Model used for assessment</param>
    /// <returns>Success flag</returns>
    Task<bool> CompleteJobAsync(string jobId, ExtendedRiskAssessment result, long processingTimeMs, string? modelUsed = null);

    /// <summary>
    /// Marks a job as failed with error information
    /// </summary>
    /// <param name="jobId">Job ID to fail</param>
    /// <param name="errorMessage">Error message</param>
    /// <param name="errorDetails">Detailed error information</param>
    /// <returns>Success flag</returns>
    Task<bool> FailJobAsync(string jobId, string errorMessage, string? errorDetails = null);

    /// <summary>
    /// Cancels a job if it's still pending or processing
    /// </summary>
    /// <param name="jobId">Job ID to cancel</param>
    /// <returns>Success flag</returns>
    Task<bool> CancelJobAsync(string jobId);

    /// <summary>
    /// Gets all jobs for a specific session
    /// </summary>
    /// <param name="sessionId">Session ID to query</param>
    /// <returns>List of jobs for the session</returns>
    Task<List<ExtendedAssessmentJob>> GetJobsBySessionAsync(string sessionId);

    /// <summary>
    /// Cleans up old completed jobs (older than specified days)
    /// </summary>
    /// <param name="olderThanDays">Number of days to keep jobs</param>
    /// <returns>Number of jobs cleaned up</returns>
    Task<int> CleanupOldJobsAsync(int olderThanDays = 7);

    /// <summary>
    /// Retries a failed job if retry count hasn't been exceeded
    /// </summary>
    /// <param name="jobId">Job ID to retry</param>
    /// <returns>Success flag</returns>
    Task<bool> RetryJobAsync(string jobId);
}