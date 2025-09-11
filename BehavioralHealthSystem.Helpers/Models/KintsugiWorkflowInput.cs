namespace BehavioralHealthSystem.Models;

public class KintsugiWorkflowInput
{
    public string UserId { get; set; } = string.Empty;
    public UserMetadata? Metadata { get; set; }
    public byte[] AudioData { get; set; } = Array.Empty<byte>();
    public string AudioFileUrl { get; set; } = string.Empty;
    public string AudioFileName { get; set; } = string.Empty;
}
