namespace BehavioralHealthSystem.Configuration;

public class FoundryDeepAnalysisOptions
{
    public const string SectionName = "FoundryDeepAnalysis";

    public bool Enabled { get; set; }
    public string ProjectEndpoint { get; set; } = string.Empty;
    public string AgentName { get; set; } = string.Empty;
    public string AgentVersion { get; set; } = string.Empty;
    public int TimeoutSeconds { get; set; } = 300;
    public bool UseDirectCompletionFallback { get; set; } = true;
}
