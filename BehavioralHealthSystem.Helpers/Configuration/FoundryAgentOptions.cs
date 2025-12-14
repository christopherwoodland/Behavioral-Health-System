namespace BehavioralHealthSystem.Configuration;

/// <summary>
/// Configuration options for Azure AI Foundry agent services
/// </summary>
public class FoundryAgentOptions
{
    /// <summary>
    /// Whether Foundry agent integration is enabled
    /// </summary>
    public bool Enabled { get; set; } = false;

    /// <summary>
    /// The Azure AI Foundry project endpoint
    /// Example: https://bhs-development-public-foundry-r.services.ai.azure.com/api/projects/bhs-development-public-foundry
    /// </summary>
    public string ProjectEndpoint { get; set; } = string.Empty;

    /// <summary>
    /// The name of the grammar correction agent
    /// </summary>
    public string GrammarAgentName { get; set; } = "agent-grammar";
}
