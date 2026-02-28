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

    /// <summary>
    /// Runs the complete audio processing pipeline using a local directory as the source.
    /// Steps: Fetch from local directory → Convert via ffmpeg → Predict via DAM.
    /// </summary>
    /// <param name="userId">The user ID (for metadata tracking).</param>
    /// <param name="sessionId">The session ID (for metadata tracking).</param>
    /// <param name="filePath">File path or name. Absolute paths read directly; relative names search the recordings directory; null picks the most recent file.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The complete processing result including prediction scores.</returns>
    Task<AudioProcessingResult> ProcessAudioFromLocalAsync(
        string userId,
        string sessionId,
        string? filePath = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Runs only the audio conversion/cleanup step (fetch + ffmpeg) without DAM prediction.
    /// Useful for testing audio cleanup independently.
    /// </summary>
    /// <param name="audioData">Raw audio bytes to convert.</param>
    /// <param name="inputFileName">Original file name (for format detection).</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The converted WAV audio bytes and conversion metadata.</returns>
    Task<AudioConversionOnlyResult> ConvertAudioOnlyAsync(
        byte[] audioData,
        string inputFileName,
        CancellationToken cancellationToken = default);
}
