namespace BehavioralHealthSystem.Helpers.Services.Interfaces;

/// <summary>
/// Interface for chat transcript storage operations
/// </summary>
public interface IChatTranscriptService
{
    /// <summary>
    /// Save or merge a chat transcript
    /// </summary>
    Task<ChatTranscriptData> SaveTranscriptAsync(ChatTranscriptData transcript, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get a transcript by user ID and session ID
    /// </summary>
    Task<ChatTranscriptData?> GetTranscriptAsync(string userId, string sessionId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Get all transcripts for a user
    /// </summary>
    Task<List<ChatTranscriptData>> GetUserTranscriptsAsync(string userId, int? limit = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Delete a transcript by user ID and session ID
    /// </summary>
    Task<bool> DeleteTranscriptAsync(string userId, string sessionId, CancellationToken cancellationToken = default);
}
