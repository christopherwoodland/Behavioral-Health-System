namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Configuration for Azure AI Foundry Realtime endpoint
/// </summary>
public class RealtimeConfig
{
    public string Endpoint { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string DeploymentId { get; set; } = string.Empty;
    public string ApiVersion { get; set; } = "2024-10-01-preview";
}