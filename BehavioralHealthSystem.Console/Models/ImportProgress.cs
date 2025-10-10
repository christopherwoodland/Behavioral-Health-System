namespace BehavioralHealthSystem.Console.Models;

/// <summary>
/// Progress tracking for DSM-5 import operations.
/// Tracks import status, completed files, and failures for resumable imports.
/// </summary>
public class ImportProgress
{
    /// <summary>
    /// Gets or sets the UTC timestamp when the import started.
    /// </summary>
    public DateTime StartedAt { get; set; }

    /// <summary>
    /// Gets or sets the UTC timestamp of the last progress update.
    /// </summary>
    public DateTime? LastUpdatedAt { get; set; }

    /// <summary>
    /// Gets or sets the total number of files to import.
    /// </summary>
    public int TotalFiles { get; set; }

    /// <summary>
    /// Gets or sets the number of files successfully imported.
    /// </summary>
    public int CompletedFiles { get; set; }

    /// <summary>
    /// Gets or sets the number of files that failed to import.
    /// </summary>
    public int FailedFiles { get; set; }

    /// <summary>
    /// Gets or sets the list of successfully imported file names.
    /// Used to skip already processed files on resume.
    /// </summary>
    public List<string> CompletedFileNames { get; set; } = new();

    /// <summary>
    /// Gets or sets the list of failed file information including error details.
    /// </summary>
    public List<FailedFileInfo> FailedFilesList { get; set; } = new();
}
