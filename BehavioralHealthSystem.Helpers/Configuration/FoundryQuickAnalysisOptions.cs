namespace BehavioralHealthSystem.Configuration;

public class FoundryQuickAnalysisOptions
{
    public const string SectionName = "FoundryQuickAnalysis";

    public bool Enabled { get; set; }
    public string ProjectEndpoint { get; set; } = string.Empty;
    public string AgentName { get; set; } = string.Empty;
    public string AgentVersion { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 120;
    public bool UseDirectCompletionFallback { get; set; } = true;
}
