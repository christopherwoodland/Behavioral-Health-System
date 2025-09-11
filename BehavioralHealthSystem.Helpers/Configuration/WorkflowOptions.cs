namespace BehavioralHealthSystem.Configuration;

public class WorkflowOptions
{
    public const string SectionName = "Workflow";
    public int MaxRetries { get; set; } = 100;
    public int RetryDelaySeconds { get; set; } = 30;
}
