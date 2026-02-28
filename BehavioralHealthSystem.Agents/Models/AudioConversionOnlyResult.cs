namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Result of audio conversion without prediction.
/// Used by the "convert only" pipeline for testing ffmpeg cleanup independently.
/// </summary>
public class AudioConversionOnlyResult
{
    /// <summary>Whether the conversion completed successfully.</summary>
    public bool Success { get; set; }

    /// <summary>Human-readable message about the result.</summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>Original file name.</summary>
    public string OriginalFileName { get; set; } = string.Empty;

    /// <summary>Original file size in bytes.</summary>
    public long OriginalFileSize { get; set; }

    /// <summary>Converted WAV file data.</summary>
    [JsonIgnore]
    public byte[] ConvertedData { get; set; } = Array.Empty<byte>();

    /// <summary>Converted file size in bytes.</summary>
    public long ConvertedFileSize { get; set; }

    /// <summary>Sample rate after conversion.</summary>
    public int ConvertedSampleRate { get; set; }

    /// <summary>Whether ffmpeg speech-enhancement filters were applied.</summary>
    public bool FiltersApplied { get; set; }

    /// <summary>Time taken for conversion in milliseconds.</summary>
    public double ConversionElapsedMs { get; set; }

    /// <summary>Error details if conversion failed.</summary>
    public string? Error { get; set; }
}
