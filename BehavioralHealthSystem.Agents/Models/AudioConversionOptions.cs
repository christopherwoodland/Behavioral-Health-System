namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Configuration options for ffmpeg audio conversion.
/// </summary>
public class AudioConversionOptions
{
    /// <summary>Path to the ffmpeg binary. Defaults to "ffmpeg" (assumes on PATH).</summary>
    public string FfmpegPath { get; set; } = "ffmpeg";

    /// <summary>Target sample rate in Hz.</summary>
    public int SampleRate { get; set; } = 44100;

    /// <summary>Number of output channels (1 = mono).</summary>
    public int Channels { get; set; } = 1;

    /// <summary>High-pass filter frequency in Hz (removes rumble/noise below this).</summary>
    public int HighPassFrequency { get; set; } = 80;

    /// <summary>Low-pass filter frequency in Hz (removes hiss/noise above this).</summary>
    public int LowPassFrequency { get; set; } = 12000;

    /// <summary>Whether to apply silence removal.</summary>
    public bool EnableSilenceRemoval { get; set; } = true;

    /// <summary>Silence detection threshold in dB (e.g., -35).</summary>
    public int SilenceThresholdDb { get; set; } = -35;

    /// <summary>Minimum silence duration in seconds before removal.</summary>
    public double SilenceMinDuration { get; set; } = 0.5;

    /// <summary>Maximum allowed duration in seconds (0 = no limit).</summary>
    public int MaxDurationSeconds { get; set; } = 0;

    /// <summary>Timeout for ffmpeg process in seconds.</summary>
    public int ProcessTimeoutSeconds { get; set; } = 120;

    /// <summary>
    /// When true, skips filter processing if the input is already a clean WAV
    /// at the target sample rate, mono, 16-bit PCM (passthrough mode).
    /// Set via FFMPEG_SKIP_CLEAN_WAV environment variable.
    /// </summary>
    public bool SkipFiltersIfCleanWav { get; set; } = true;

    /// <summary>
    /// Use RAM-backed temp directory (/dev/shm on Linux) for intermediate files
    /// instead of disk. Falls back to system temp if /dev/shm is unavailable.
    /// Set via FFMPEG_USE_TMPFS environment variable.
    /// </summary>
    public bool UseTmpfs { get; set; } = true;

    /// <summary>
    /// Use stdin/stdout piping instead of temp files for ffmpeg I/O.
    /// Avoids disk writes entirely. Takes precedence over UseTmpfs when enabled.
    /// Set via FFMPEG_USE_PIPE_MODE environment variable.
    /// </summary>
    public bool UsePipeMode { get; set; } = true;
}
