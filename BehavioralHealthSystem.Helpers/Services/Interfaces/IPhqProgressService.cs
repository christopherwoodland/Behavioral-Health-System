namespace BehavioralHealthSystem.Helpers.Services.Interfaces;

/// <summary>
/// Interface for PHQ progress storage operations
/// </summary>
public interface IPhqProgressService
{
    /// <summary>
    /// Save or merge PHQ progress data
    /// </summary>
    Task<PhqProgressData> SaveProgressAsync(PhqProgressData progress, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get PHQ progress by user ID and assessment ID
    /// </summary>
    Task<PhqProgressData?> GetProgressAsync(string userId, string assessmentId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get all PHQ progress records for a user
    /// </summary>
    Task<List<PhqProgressData>> GetUserProgressAsync(string userId, CancellationToken cancellationToken = default);
}
