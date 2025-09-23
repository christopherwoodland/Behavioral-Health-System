namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Audio chunk for processing
/// </summary>
public class AudioChunk
{
    public byte[] Data { get; set; } = Array.Empty<byte>();
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public bool IsLastChunk { get; set; }
    public string Format { get; set; } = "pcm16";
}