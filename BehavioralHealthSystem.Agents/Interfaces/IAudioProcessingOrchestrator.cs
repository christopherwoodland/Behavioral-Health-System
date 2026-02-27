namespace BehavioralHealthSystem.Agents.Interfaces;

/// <summary>
/// Interface for the audio processing orchestration pipeline.
/// Provides deterministic sequential execution: Fetch → Convert → Predict.
/// </summary>
public interface IAudioProcessingOrchestrator
{
    /// <summary>
    /// Runs the complete audio processing pipeline for a given user session.
    /// </summary>
    /// <param name="userId">The user ID who owns the audio recording.</param>
    /// <param name="sessionId">The session ID associated with the recording.</param>
    /// <param name="fileName">Optional specific file name. If null, retrieves the most recent recording for the session.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The complete processing result including prediction scores.</returns>
    Task<AudioProcessingResult> ProcessAudioAsync(
        string userId,
        string sessionId,
        string? fileName = null,
        CancellationToken cancellationToken = default);
}
