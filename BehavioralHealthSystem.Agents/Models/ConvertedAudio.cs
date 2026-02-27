namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Represents the result of audio conversion/cleanup via ffmpeg.
/// Output of the AudioConversionPlugin.
/// </summary>
public class ConvertedAudio
{
    /// <summary>Converted audio file content as byte array.</summary>
    public byte[] Data { get; set; } = Array.Empty<byte>();

    /// <summary>Output file name (always .wav).</summary>
    public string FileName { get; set; } = "audio.wav";

    /// <summary>Sample rate in Hz (44100).</summary>
    public int SampleRate { get; set; } = 44100;

    /// <summary>Number of audio channels (1 = mono).</summary>
    public int Channels { get; set; } = 1;

    /// <summary>Original file size before conversion.</summary>
    public long OriginalSize { get; set; }

    /// <summary>Converted file size.</summary>
    public long ConvertedSize => Data.Length;

    /// <summary>Whether ffmpeg filters were applied (highpass, lowpass, silence removal).</summary>
    public bool FiltersApplied { get; set; }

    /// <summary>Duration of conversion processing in milliseconds.</summary>
    public double ConversionElapsedMs { get; set; }
}
