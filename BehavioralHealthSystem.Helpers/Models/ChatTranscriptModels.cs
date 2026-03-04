using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BehavioralHealthSystem.Helpers.Models;

/// <summary>
/// Request model for saving chat transcripts
/// </summary>
public class SaveChatTranscriptRequest
{
    public ChatTranscriptData TranscriptData { get; set; } = null!;
    public Dictionary<string, object>? Metadata { get; set; }
    public string? ContainerName { get; set; }
    public string? FileName { get; set; }
}

/// <summary>
/// Represents a chat transcript session with messages
/// </summary>
public class ChatTranscriptData
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

    public string CreatedAt { get; set; } = "";
    public string LastUpdated { get; set; } = "";
    public string? SessionEndedAt { get; set; }
    public bool IsActive { get; set; } = true;

    public List<ChatMessageData> Messages { get; set; } = new();
    public ChatSessionMetadata? Metadata { get; set; }
}

/// <summary>
/// Represents a single chat message within a transcript
/// </summary>
public class ChatMessageData
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int PrimaryKey { get; set; }

    [Required]
    [MaxLength(128)]
    public string Id { get; set; } = "";

    [MaxLength(16)]
    public string Role { get; set; } = ""; // "user", "assistant", "system"

    public string Content { get; set; } = "";
    public string Timestamp { get; set; } = "";

    [MaxLength(64)]
    public string? MessageType { get; set; } // Optional: "phq-assessment", "general-chat", etc.

    /// <summary>
    /// Additional data stored as JSON column
    /// </summary>
    [Column(TypeName = "jsonb")]
    public string? AdditionalDataJson { get; set; }

    [NotMapped]
    public Dictionary<string, object>? AdditionalData
    {
        get => string.IsNullOrEmpty(AdditionalDataJson)
            ? null
            : JsonSerializer.Deserialize<Dictionary<string, object>>(AdditionalDataJson);
        set => AdditionalDataJson = value == null ? null : JsonSerializer.Serialize(value);
    }

    // FK to transcript
    public int ChatTranscriptDataId { get; set; }

    [ForeignKey(nameof(ChatTranscriptDataId))]
    [JsonIgnore]
    public ChatTranscriptData? ChatTranscript { get; set; }
}

/// <summary>
/// Metadata about a chat session
/// </summary>
public class ChatSessionMetadata
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [MaxLength(512)]
    public string? UserAgent { get; set; }

    [MaxLength(64)]
    public string? ClientTimezone { get; set; }

    [MaxLength(64)]
    public string? IpAddress { get; set; }

    [MaxLength(64)]
    public string? Platform { get; set; }

    [Column(TypeName = "jsonb")]
    public string? CustomDataJson { get; set; }

    [NotMapped]
    public Dictionary<string, object>? CustomData
    {
        get => string.IsNullOrEmpty(CustomDataJson)
            ? null
            : JsonSerializer.Deserialize<Dictionary<string, object>>(CustomDataJson);
        set => CustomDataJson = value == null ? null : JsonSerializer.Serialize(value);
    }

    public int ChatTranscriptDataId { get; set; }

    [ForeignKey(nameof(ChatTranscriptDataId))]
    [JsonIgnore]
    public ChatTranscriptData? ChatTranscript { get; set; }
}
