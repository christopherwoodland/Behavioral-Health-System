namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Voice activity detection result
/// </summary>
public class VoiceActivityResult
{
    public bool HasVoice { get; set; }
    public double Confidence { get; set; }
    public TimeSpan Duration { get; set; }
    public double VolumeLevel { get; set; }
}