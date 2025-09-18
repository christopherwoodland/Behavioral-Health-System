namespace BehavioralHealthSystem.Services.Interfaces;

/// <summary>
/// Interface for session storage operations with Azure Blob Storage
/// </summary>
public interface ISessionStorageService
{
    /// <summary>
    /// Save session data to storage
    /// </summary>
    /// <param name="sessionData">The session data to save</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if saved successfully, false otherwise</returns>
    Task<bool> SaveSessionDataAsync(SessionData sessionData, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Retrieve session data by session ID
    /// </summary>
    /// <param name="sessionId">The session ID to search for</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Session data if found, null otherwise</returns>
    Task<SessionData?> GetSessionDataAsync(string sessionId, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Get all sessions for a specific user
    /// </summary>
    /// <param name="userId">The user ID to get sessions for</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of session data for the user</returns>
    Task<List<SessionData>> GetUserSessionsAsync(string userId, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Get all sessions across all users (for system-wide analytics)
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of all session data in the system</returns>
    Task<List<SessionData>> GetAllSessionsAsync(CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Update existing session data
    /// </summary>
    /// <param name="sessionData">The session data to update</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if updated successfully, false otherwise</returns>
    Task<bool> UpdateSessionDataAsync(SessionData sessionData, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Delete session data by session ID
    /// </summary>
    /// <param name="sessionId">The session ID to delete</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if deleted successfully, false otherwise</returns>
    Task<bool> DeleteSessionDataAsync(string sessionId, CancellationToken cancellationToken = default);
}