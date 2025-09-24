namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Audio processing configuration
/// </summary>
public class AudioConfig
{
    public int SampleRate { get; set; } = 24000;
    public int Channels { get; set; } = 1;
    public int BitsPerSample { get; set; } = 16;
    public bool EnableVAD { get; set; } = true;
    public double SilenceThreshold { get; set; } = 0.01;
    public int SilenceDurationMs { get; set; } = 1000;
}