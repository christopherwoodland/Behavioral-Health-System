namespace BehavioralHealthSystem.Helpers.Services.Interfaces;

/// <summary>
/// Interface for audio upload metadata storage operations.
/// The actual audio binary stays in Azure Blob Storage; this tracks metadata only.
/// </summary>
public interface IAudioMetadataService
{
    /// <summary>
    /// Save audio upload metadata
    /// </summary>
    Task<bool> SaveMetadataAsync(AudioMetadata metadata, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get all audio metadata for a user
    /// </summary>
    Task<List<AudioMetadata>> GetUserAudioMetadataAsync(string userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get audio metadata for a specific session
    /// </summary>
    Task<List<AudioMetadata>> GetSessionAudioMetadataAsync(string userId, string sessionId, CancellationToken cancellationToken = default);
}
