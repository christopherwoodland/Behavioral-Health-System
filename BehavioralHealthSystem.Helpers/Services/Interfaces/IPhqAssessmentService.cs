namespace BehavioralHealthSystem.Helpers.Services.Interfaces;

/// <summary>
/// Interface for PHQ assessment storage operations
/// </summary>
public interface IPhqAssessmentService
{
    /// <summary>
    /// Save a PHQ assessment
    /// </summary>
    Task<bool> SaveAssessmentAsync(PhqAssessmentData assessment, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get a PHQ assessment by user ID and assessment ID
    /// </summary>
    Task<PhqAssessmentData?> GetAssessmentAsync(string userId, string assessmentId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get all PHQ assessments for a user
    /// </summary>
    Task<List<PhqAssessmentData>> GetUserAssessmentsAsync(string userId, CancellationToken cancellationToken = default);
}
