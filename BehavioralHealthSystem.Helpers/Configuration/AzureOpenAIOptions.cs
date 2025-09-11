namespace BehavioralHealthSystem.Configuration;

public class AzureOpenAIOptions
{
    public const string SectionName = "AzureOpenAI";
    
    public string Endpoint { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string DeploymentName { get; set; } = string.Empty;
    public string ApiVersion { get; set; } = "2024-02-01";
    public int MaxTokens { get; set; } = 1500;
    public double Temperature { get; set; } = 0.3;
    public bool Enabled { get; set; } = false;
}
