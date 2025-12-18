using System.Text.Json.Serialization;

namespace BehavioralHealthSystem.Models;

public class PredictionRequest
{
    [JsonPropertyName("sessionId")]
    public string SessionId { get; set; } = string.Empty;

    [JsonPropertyName("audioData")]
    public byte[] AudioData { get; set; } = Array.Empty<byte>();

    [JsonPropertyName("audioFileUrl")]
    public string AudioFileUrl { get; set; } = string.Empty;

    [JsonPropertyName("audioFileName")]
    public string AudioFileName { get; set; } = string.Empty;
}
