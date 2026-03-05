using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BehavioralHealthSystem.Helpers.Models;

/// <summary>
/// Represents metadata for an uploaded audio file.
/// The actual audio binary stays in Azure Blob Storage; this table tracks metadata.
/// </summary>
public class AudioMetadata
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    [MaxLength(128)]
    public string UserId { get; set; } = "";

    [Required]
    [MaxLength(128)]
    public string SessionId { get; set; } = "";

    [MaxLength(512)]
    public string OriginalFileName { get; set; } = "";

    /// <summary>
    /// The blob path in Azure Storage (e.g., audio-uploads/users/{userId}/session-xxx.wav)
    /// </summary>
    [MaxLength(1024)]
    public string BlobPath { get; set; } = "";

    /// <summary>
    /// Full blob URL
    /// </summary>
    [MaxLength(2048)]
    public string? BlobUrl { get; set; }

    [MaxLength(64)]
    public string? ContentType { get; set; }

    public long FileSizeBytes { get; set; }

    [MaxLength(64)]
    public string? Source { get; set; } = "jekyll-voice-recording";

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
