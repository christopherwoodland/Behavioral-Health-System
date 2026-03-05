using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BehavioralHealthSystem.Helpers.Models;

// ==================== PHQ Assessment Models ====================

/// <summary>
/// Request model for saving PHQ assessments
/// </summary>
public class SaveAssessmentRequest
{
    public PhqAssessmentData AssessmentData { get; set; } = null!;
    public Dictionary<string, object>? Metadata { get; set; }
    public string? ContainerName { get; set; }
    public string? FileName { get; set; }
}

/// <summary>
/// Represents a completed PHQ assessment
/// </summary>
public class PhqAssessmentData
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    [MaxLength(128)]
    public string AssessmentId { get; set; } = "";

    [Required]
    [MaxLength(128)]
    public string UserId { get; set; } = "";

    [Required]
    [MaxLength(16)]
    public string AssessmentType { get; set; } = "";

    public string StartTime { get; set; } = "";
    public string? CompletedTime { get; set; }
    public bool IsCompleted { get; set; }

    public List<PhqQuestionData> Questions { get; set; } = new();

    public int? TotalScore { get; set; }

    [MaxLength(32)]
    public string? Severity { get; set; }

    public string? Interpretation { get; set; }

    [Column(TypeName = "jsonb")]
    public string? RecommendationsJson { get; set; }

    [NotMapped]
    public List<string>? Recommendations
    {
        get => string.IsNullOrEmpty(RecommendationsJson)
            ? null
            : JsonSerializer.Deserialize<List<string>>(RecommendationsJson);
        set => RecommendationsJson = value == null ? null : JsonSerializer.Serialize(value);
    }

    public PhqMetadata? Metadata { get; set; }
}

/// <summary>
/// Represents a single PHQ question and its answer
/// </summary>
public class PhqQuestionData
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    public int QuestionNumber { get; set; }
    public string QuestionText { get; set; } = "";
    public int? Answer { get; set; }
    public int Attempts { get; set; }
    public bool Skipped { get; set; }
    public string? Timestamp { get; set; }

    // FK to assessment
    public int PhqAssessmentDataId { get; set; }

    [ForeignKey(nameof(PhqAssessmentDataId))]
    [JsonIgnore]
    public PhqAssessmentData? Assessment { get; set; }
}

/// <summary>
/// Metadata for a PHQ assessment
/// </summary>
public class PhqMetadata
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [MaxLength(512)]
    public string? UserAgent { get; set; }

    [MaxLength(64)]
    public string? IpAddress { get; set; }

    [MaxLength(128)]
    public string? SessionId { get; set; }

    [MaxLength(16)]
    public string Version { get; set; } = "1.0.0";

    public int PhqAssessmentDataId { get; set; }

    [ForeignKey(nameof(PhqAssessmentDataId))]
    [JsonIgnore]
    public PhqAssessmentData? Assessment { get; set; }
}

// ==================== PHQ Progress Models ====================

/// <summary>
/// Request model for saving PHQ progress
/// </summary>
public class SavePhqProgressRequest
{
    public PhqProgressData ProgressData { get; set; } = null!;
    public Dictionary<string, object>? Metadata { get; set; }
    public string? ContainerName { get; set; }
    public string? FileName { get; set; }
}

/// <summary>
/// Represents in-progress PHQ assessment data
/// </summary>
public class PhqProgressData
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [Required]
    [MaxLength(128)]
    public string UserId { get; set; } = "";

    [Required]
    [MaxLength(128)]
    public string AssessmentId { get; set; } = "";

    [Required]
    [MaxLength(16)]
    public string AssessmentType { get; set; } = ""; // "PHQ-2" or "PHQ-9"

    public string StartedAt { get; set; } = "";
    public string LastUpdated { get; set; } = "";
    public string? CompletedAt { get; set; }
    public bool IsCompleted { get; set; } = false;
    public int TotalQuestions { get; set; }

    public List<PhqAnsweredQuestion> AnsweredQuestions { get; set; } = new();

    public int? TotalScore { get; set; }

    [MaxLength(32)]
    public string? Severity { get; set; }

    public string? Interpretation { get; set; }

    [Column(TypeName = "jsonb")]
    public string? RecommendationsJson { get; set; }

    [NotMapped]
    public List<string>? Recommendations
    {
        get => string.IsNullOrEmpty(RecommendationsJson)
            ? null
            : JsonSerializer.Deserialize<List<string>>(RecommendationsJson);
        set => RecommendationsJson = value == null ? null : JsonSerializer.Serialize(value);
    }

    public PhqProgressMetadata? Metadata { get; set; }
}

/// <summary>
/// Represents a single answered PHQ question
/// </summary>
public class PhqAnsweredQuestion
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    public int QuestionNumber { get; set; }
    public string QuestionText { get; set; } = "";
    public int Answer { get; set; }
    public string AnsweredAt { get; set; } = "";
    public int Attempts { get; set; } = 1;
    public bool WasSkipped { get; set; } = false;

    // FK to progress
    public int PhqProgressDataId { get; set; }

    [ForeignKey(nameof(PhqProgressDataId))]
    [JsonIgnore]
    public PhqProgressData? Progress { get; set; }
}

/// <summary>
/// Metadata for PHQ progress tracking
/// </summary>
public class PhqProgressMetadata
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [MaxLength(128)]
    public string? SessionId { get; set; }

    [MaxLength(512)]
    public string? UserAgent { get; set; }

    [MaxLength(64)]
    public string? ClientTimezone { get; set; }

    [MaxLength(64)]
    public string? IpAddress { get; set; }

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

    public int PhqProgressDataId { get; set; }

    [ForeignKey(nameof(PhqProgressDataId))]
    [JsonIgnore]
    public PhqProgressData? Progress { get; set; }
}

// ==================== PHQ Session Models ====================

/// <summary>
/// Request model for saving PHQ sessions
/// </summary>
public class SaveSessionRequest
{
    public PhqSessionData SessionData { get; set; } = null!;
    public Dictionary<string, object>? Metadata { get; set; }
    public string? ContainerName { get; set; }
    public string? FileName { get; set; }
}

/// <summary>
/// Represents a PHQ assessment session with progressive saves
/// </summary>
public class PhqSessionData
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

    [Required]
    [MaxLength(128)]
    public string AssessmentId { get; set; } = "";

    [Required]
    [MaxLength(16)]
    public string AssessmentType { get; set; } = "";

    public string CreatedAt { get; set; } = "";
    public string LastUpdated { get; set; } = "";
    public string? CompletedAt { get; set; }
    public bool IsCompleted { get; set; }

    public List<PhqQuestionResponse> Questions { get; set; } = new();

    public int? TotalScore { get; set; }

    [MaxLength(32)]
    public string? Severity { get; set; }

    public PhqSessionMetadata? Metadata { get; set; }
}

/// <summary>
/// Represents a PHQ question response within a session
/// </summary>
public class PhqQuestionResponse
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    public int QuestionNumber { get; set; }
    public string QuestionText { get; set; } = "";
    public int? Answer { get; set; }
    public int Attempts { get; set; }
    public bool Skipped { get; set; }
    public string? AnsweredAt { get; set; }

    // FK to session
    public int PhqSessionDataId { get; set; }

    [ForeignKey(nameof(PhqSessionDataId))]
    [JsonIgnore]
    public PhqSessionData? Session { get; set; }
}

/// <summary>
/// Metadata for a PHQ session
/// </summary>
public class PhqSessionMetadata
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }

    [MaxLength(128)]
    public string ConversationSessionId { get; set; } = "";

    [MaxLength(512)]
    public string? UserAgent { get; set; }

    [MaxLength(64)]
    public string? ClientTimezone { get; set; }

    [MaxLength(16)]
    public string Version { get; set; } = "1.0.0";

    public int PhqSessionDataId { get; set; }

    [ForeignKey(nameof(PhqSessionDataId))]
    [JsonIgnore]
    public PhqSessionData? Session { get; set; }
}
