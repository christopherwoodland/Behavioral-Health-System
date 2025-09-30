namespace BehavioralHealthSystem.Configuration;

/// <summary>
/// Configuration options for Extended Risk Assessment using GPT-5/O3 models
/// Allows separate endpoint and model configuration from standard Azure OpenAI
/// </summary>
public class ExtendedAssessmentOpenAIOptions
{
    public const string SectionName = "ExtendedAssessmentOpenAI";
    
    /// <summary>
    /// Azure OpenAI endpoint URL for extended assessments (can be different from standard endpoint)
    /// Example: https://your-gpt5-resource.openai.azure.com/
    /// </summary>
    public string Endpoint { get; set; } = string.Empty;
    
    /// <summary>
    /// API key for the extended assessment Azure OpenAI resource
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;
    
    /// <summary>
    /// Deployment name for GPT-5 or O3 model
    /// Example: "gpt-5-turbo", "o3-mini", etc.
    /// </summary>
    public string DeploymentName { get; set; } = string.Empty;
    
    /// <summary>
    /// Azure OpenAI API version
    /// Default: "2024-08-01-preview" (required for GPT-5/O3)
    /// </summary>
    public string ApiVersion { get; set; } = "2024-08-01-preview";
    
    /// <summary>
    /// Maximum tokens for extended assessment response
    /// Default: 4000 (extended assessments are more comprehensive)
    /// </summary>
    public int MaxTokens { get; set; } = 4000;
    
    /// <summary>
    /// Temperature for AI responses (0.0-1.0)
    /// Default: 0.2 (slightly higher than standard for nuanced clinical assessment)
    /// </summary>
    public double Temperature { get; set; } = 0.2;
    
    /// <summary>
    /// Enable extended risk assessment feature
    /// Default: false
    /// </summary>
    public bool Enabled { get; set; } = false;
    
    /// <summary>
    /// Timeout in seconds for extended assessment API calls
    /// Default: 120 (2 minutes)
    /// </summary>
    public int TimeoutSeconds { get; set; } = 120;
    
    /// <summary>
    /// If true, falls back to standard AzureOpenAI configuration when extended config is not available
    /// Default: true
    /// </summary>
    public bool UseFallbackToStandardConfig { get; set; } = true;
}
