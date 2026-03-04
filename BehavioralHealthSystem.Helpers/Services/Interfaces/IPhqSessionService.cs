namespace BehavioralHealthSystem.Helpers.Services.Interfaces;

/// <summary>
/// Interface for PHQ session storage operations
/// </summary>
public interface IPhqSessionService
{
    /// <summary>
    /// Save or update a PHQ session
    /// </summary>
    Task<bool> SaveSessionAsync(PhqSessionData session, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get a PHQ session by user ID and assessment ID
    /// </summary>
    Task<PhqSessionData?> GetSessionAsync(string userId, string assessmentId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get all PHQ sessions for a user
    /// </summary>
    Task<List<PhqSessionData>> GetUserSessionsAsync(string userId, CancellationToken cancellationToken = default);
}
