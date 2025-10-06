namespace BehavioralHealthSystem.Console.Models;

/// <summary>
/// Progress tracking for DSM-5 import operations
/// </summary>
public class ImportProgress
{
    public DateTime StartedAt { get; set; }
    public DateTime? LastUpdatedAt { get; set; }
    public int TotalFiles { get; set; }
    public int CompletedFiles { get; set; }
    public int FailedFiles { get; set; }
    public List<string> CompletedFileNames { get; set; } = new();
    public List<FailedFileInfo> FailedFilesList { get; set; } = new();
}
