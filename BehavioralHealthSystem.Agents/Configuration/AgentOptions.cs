namespace BehavioralHealthSystem.Agents.Configuration;

/// <summary>
/// Configuration options for the Agent Framework.
/// Supports both API key authentication (local) and managed identity (production).
/// </summary>
public class AgentOptions
{
    /// <summary>
    /// Configuration section name in appsettings/local.settings.
    /// </summary>
    public const string SectionName = "Agent";

    /// <summary>
    /// Azure OpenAI endpoint URL.
    /// </summary>
    public string Endpoint { get; set; } = string.Empty;

    /// <summary>
    /// API key for local development. When null or empty, managed identity will be used.
    /// </summary>
    public string? ApiKey { get; set; }

    /// <summary>
    /// The model deployment name to use (e.g., "gpt-5", "gpt-4o-mini").
    /// </summary>
    public string ModelDeployment { get; set; } = "gpt-5";

    /// <summary>
    /// Whether agents are enabled.
    /// </summary>
    public bool Enabled { get; set; } = true;

    /// <summary>
    /// Temperature setting for the model (0.0 - 2.0).
    /// Lower values make output more deterministic.
    /// Set to null to use model defaults (recommended for newer models like gpt-5).
    /// </summary>
    public float? Temperature { get; set; }

    /// <summary>
    /// Maximum tokens for the response.
    /// Set to null to use model defaults (recommended for newer models like gpt-5).
    /// </summary>
    public int? MaxTokens { get; set; }

    /// <summary>
    /// Whether to send temperature parameter to the model.
    /// Some models (like gpt-5) handle this automatically and don't need it.
    /// </summary>
    public bool SupportsTemperature { get; set; } = false;

    /// <summary>
    /// Whether to send max tokens parameter to the model.
    /// Some models (like gpt-5) handle this automatically and don't need it.
    /// </summary>
    public bool SupportsMaxTokens { get; set; } = false;

    /// <summary>
    /// Timeout in seconds for agent operations.
    /// </summary>
    public int TimeoutSeconds { get; set; } = 60;

    /// <summary>
    /// Determines if API key authentication should be used.
    /// </summary>
    public bool UseApiKey => !string.IsNullOrWhiteSpace(ApiKey);
}
