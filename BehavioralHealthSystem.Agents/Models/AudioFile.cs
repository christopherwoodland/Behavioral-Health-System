namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Represents a retrieved audio file from blob storage.
/// Output of the AudioRetrievalPlugin.
/// </summary>
public class AudioFile
{
    /// <summary>Audio file content as byte array.</summary>
    public byte[] Data { get; set; } = Array.Empty<byte>();

    /// <summary>Original file name (e.g., "session-abc-20260226.wav").</summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>MIME content type (e.g., "audio/wav").</summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>Full blob path (e.g., "users/user1/session-abc-20260226.wav").</summary>
    public string BlobPath { get; set; } = string.Empty;

    /// <summary>File size in bytes.</summary>
    public long FileSize => Data.Length;

    /// <summary>User ID who owns the recording.</summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>Session ID associated with the recording.</summary>
    public string SessionId { get; set; } = string.Empty;
}
