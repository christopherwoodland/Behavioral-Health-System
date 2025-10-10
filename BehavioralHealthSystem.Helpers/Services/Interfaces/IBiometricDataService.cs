namespace BehavioralHealthSystem.Helpers.Services.Interfaces;

/// <summary>
/// Interface for managing user biometric data in blob storage.
/// </summary>
public interface IBiometricDataService
{
    /// <summary>
    /// Checks if biometric data exists for a specific user.
    /// </summary>
    /// <param name="userId">The unique user identifier.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>True if biometric data exists; otherwise, false.</returns>
    Task<bool> UserBiometricDataExistsAsync(string userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Retrieves biometric data for a specific user.
    /// </summary>
    /// <param name="userId">The unique user identifier.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The user's biometric data, or null if not found.</returns>
    Task<UserBiometricData?> GetUserBiometricDataAsync(string userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Saves or updates biometric data for a user.
    /// </summary>
    /// <param name="biometricData">The biometric data to save.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A task representing the asynchronous operation.</returns>
    Task SaveUserBiometricDataAsync(UserBiometricData biometricData, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes biometric data for a specific user.
    /// </summary>
    /// <param name="userId">The unique user identifier.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>True if data was deleted; false if no data existed.</returns>
    Task<bool> DeleteUserBiometricDataAsync(string userId, CancellationToken cancellationToken = default);
}
