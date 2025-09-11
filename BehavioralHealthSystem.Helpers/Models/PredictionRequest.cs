namespace BehavioralHealthSystem.Models;

public class PredictionRequest
{
    public string SessionId { get; set; } = string.Empty;
    public byte[] AudioData { get; set; } = Array.Empty<byte>();
    public string AudioFileUrl { get; set; } = string.Empty;
    public string AudioFileName { get; set; } = string.Empty;
}
