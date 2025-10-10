namespace BehavioralHealthSystem.Console.Models;

/// <summary>
/// Information about a file that failed during DSM-5 import.
/// Contains error details and timestamp for diagnostics and retry logic.
/// </summary>
public class FailedFileInfo
{
    /// <summary>
    /// Gets or sets the name of the file that failed to import.
    /// </summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the error message describing why the import failed.
    /// </summary>
    public string Error { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the UTC timestamp when the failure occurred.
    /// </summary>
    public DateTime FailedAt { get; set; }
}
