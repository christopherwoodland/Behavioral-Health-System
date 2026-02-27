namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// The complete result of the audio processing orchestration pipeline.
/// Contains outputs from all three steps: fetch, convert, predict.
/// </summary>
public class AudioProcessingResult
{
    /// <summary>Whether the entire pipeline completed successfully.</summary>
    public bool Success { get; set; }

    /// <summary>Human-readable message about the result.</summary>
    public string Message { get; set; } = string.Empty;

    // ── Step 1: Fetch ────────────────────────────────────────

    /// <summary>Blob path of the retrieved audio file.</summary>
    public string SourceBlobPath { get; set; } = string.Empty;

    /// <summary>Original file name from blob storage.</summary>
    public string OriginalFileName { get; set; } = string.Empty;

    /// <summary>Original file size in bytes.</summary>
    public long OriginalFileSize { get; set; }

    // ── Step 2: Convert ──────────────────────────────────────

    /// <summary>Converted file size in bytes.</summary>
    public long ConvertedFileSize { get; set; }

    /// <summary>Sample rate after conversion.</summary>
    public int ConvertedSampleRate { get; set; }

    /// <summary>Whether ffmpeg speech-enhancement filters were applied.</summary>
    public bool FiltersApplied { get; set; }

    /// <summary>Time taken for conversion in milliseconds.</summary>
    public double ConversionElapsedMs { get; set; }

    // ── Step 3: Predict ──────────────────────────────────────

    /// <summary>The session ID used for prediction.</summary>
    public string SessionId { get; set; } = string.Empty;

    /// <summary>The prediction provider used (e.g., "local-dam").</summary>
    public string Provider { get; set; } = "local-dam";

    /// <summary>The full prediction response from the DAM model.</summary>
    public PredictionResponse? PredictionResponse { get; set; }

    // ── Pipeline Metadata ────────────────────────────────────

    /// <summary>Total time for the entire pipeline in milliseconds.</summary>
    public double TotalElapsedMs { get; set; }

    /// <summary>UTC timestamp when processing started.</summary>
    public DateTime StartedAtUtc { get; set; }

    /// <summary>UTC timestamp when processing completed.</summary>
    public DateTime CompletedAtUtc { get; set; }

    /// <summary>User ID that owns the audio.</summary>
    public string UserId { get; set; } = string.Empty;

    /// <summary>Error details if the pipeline failed.</summary>
    public string? Error { get; set; }

    /// <summary>Which step failed (if any): "fetch", "convert", or "predict".</summary>
    public string? FailedStep { get; set; }
}
