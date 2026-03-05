namespace BehavioralHealthSystem.Helpers.Services.Interfaces;

/// <summary>
/// Interface for Smart Band data storage operations
/// </summary>
public interface ISmartBandDataService
{
    /// <summary>
    /// Save a Smart Band sensor data snapshot
    /// </summary>
    Task<bool> SaveSnapshotAsync(SmartBandDataSnapshot snapshot, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get all snapshots for a user
    /// </summary>
    Task<List<SmartBandDataSnapshot>> GetUserSnapshotsAsync(string userId, int? limit = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get a specific snapshot by ID
    /// </summary>
    Task<SmartBandDataSnapshot?> GetSnapshotAsync(int id, CancellationToken cancellationToken = default);
}
