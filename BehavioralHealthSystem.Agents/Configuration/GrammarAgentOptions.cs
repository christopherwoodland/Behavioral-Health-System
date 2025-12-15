namespace BehavioralHealthSystem.Agents.Configuration;

/// <summary>
/// Configuration options specific to the Grammar Correction Agent.
/// </summary>
public class GrammarAgentOptions
{
    /// <summary>
    /// Configuration section name in appsettings/local.settings.
    /// </summary>
    public const string SectionName = "GrammarAgent";

    /// <summary>
    /// The name of the grammar correction agent.
    /// </summary>
    public string AgentName { get; set; } = "GrammarCorrectionAgent";

    /// <summary>
    /// Whether to include explanations of corrections in the response.
    /// </summary>
    public bool IncludeExplanations { get; set; } = false;

    /// <summary>
    /// Whether to preserve the original formatting (paragraphs, line breaks).
    /// </summary>
    public bool PreserveFormatting { get; set; } = true;

    /// <summary>
    /// The language context for corrections (defaults to input language detection).
    /// </summary>
    public string? LanguageContext { get; set; }

    /// <summary>
    /// Whether to suggest alternative phrasings for clarity.
    /// </summary>
    public bool SuggestAlternatives { get; set; } = false;

    /// <summary>
    /// Override instructions for the agent (optional).
    /// When null, default grammar correction instructions are used.
    /// </summary>
    public string? CustomInstructions { get; set; }
}
