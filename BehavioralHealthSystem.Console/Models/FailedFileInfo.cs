namespace BehavioralHealthSystem.Console.Models;

public class FailedFileInfo
{
    public string FileName { get; set; } = string.Empty;
    public string Error { get; set; } = string.Empty;
    public DateTime FailedAt { get; set; }
}
