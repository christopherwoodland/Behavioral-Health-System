namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Represents an active agent session
/// </summary>
public class AgentSession
{
    public string SessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string CurrentAgent { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public DateTime LastActivity { get; set; }
    public SessionStatus Status { get; set; }
    public List<ConversationItem> ConversationHistory { get; set; } = new();
    public Dictionary<string, object> Assessments { get; set; } = new();
    public Dictionary<string, object> Metadata { get; set; } = new();
}

/// <summary>
/// Session status enumeration
/// </summary>
public enum SessionStatus
{
    Active,
    Completed,
    Cancelled,
    Error
}

/// <summary>
/// Represents a conversation item in the session history
/// </summary>
public class ConversationItem
{
    public string Role { get; set; } = string.Empty; // "user", "assistant", "system"
    public string Content { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
    public string Agent { get; set; } = string.Empty;
    public Dictionary<string, object> Metadata { get; set; } = new();
}

/// <summary>
/// PHQ-2 Assessment model enhanced for C# implementation
/// </summary>
public class Phq2Assessment
{
    public string ScreeningId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public DateTime CompletedAt { get; set; }
    public int TotalScore { get; set; }
    public string RiskLevel { get; set; } = string.Empty;
    public List<Phq2Response> Responses { get; set; } = new();
    public List<string> Recommendations { get; set; } = new();
    public TimeSpan Duration { get; set; }
    public Dictionary<string, object> Metadata { get; set; } = new();
}

/// <summary>
/// PHQ-2 Question model
/// </summary>
public class Phq2Question
{
    public int Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public List<string> ResponseOptions { get; set; } = new()
    {
        "Not at all",
        "Several days",
        "More than half the days",
        "Nearly every day"
    };
}

/// <summary>
/// Enhanced session configuration
/// </summary>
public class SessionConfig
{
    public string InitialAgent { get; set; } = "coordinator";
    public bool EnableAudioRecording { get; set; } = true;
    public bool EnableVoiceActivityDetection { get; set; } = true;
    public string PreferredVoice { get; set; } = "alloy";
    public double Temperature { get; set; } = 0.7;
    public int MaxTokens { get; set; } = 1500;
    public Dictionary<string, object> AgentConfigurations { get; set; } = new();
}

/// <summary>
/// Agent capability model
/// </summary>
public class AgentCapability
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;
    public Dictionary<string, object> Parameters { get; set; } = new();
}

/// <summary>
/// Session metrics for analytics
/// </summary>
public class SessionMetrics
{
    public string SessionId { get; set; } = string.Empty;
    public TimeSpan Duration { get; set; }
    public int MessageCount { get; set; }
    public int AgentSwitches { get; set; }
    public int AssessmentsCompleted { get; set; }
    public double AudioDuration { get; set; } // in seconds
    public double SpeechToSilenceRatio { get; set; }
    public List<string> AgentsUsed { get; set; } = new();
    public Dictionary<string, object> CustomMetrics { get; set; } = new();
}

/// <summary>
/// Error information model
/// </summary>
public class ErrorInfo
{
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? Details { get; set; }
    public DateTime Timestamp { get; set; }
    public string? SessionId { get; set; }
    public string? Component { get; set; }
}

/// <summary>
/// Audio stream configuration
/// </summary>
public class AudioStreamConfig
{
    public int SampleRate { get; set; } = 16000;
    public int BitsPerSample { get; set; } = 16;
    public int Channels { get; set; } = 1;
    public string Format { get; set; } = "pcm16";
    public int ChunkSize { get; set; } = 1024;
    public bool EnableNoiseSuppression { get; set; } = true;
    public bool EnableEchoCancellation { get; set; } = true;
}

/// <summary>
/// Real-time communication status
/// </summary>
public class RealtimeStatus
{
    public bool IsConnected { get; set; }
    public DateTime LastHeartbeat { get; set; }
    public string ConnectionState { get; set; } = string.Empty;
    public int MessagesProcessed { get; set; }
    public double Latency { get; set; } // in milliseconds
    public List<string> ActiveFeatures { get; set; } = new();
}

/// <summary>
/// User preferences for the session
/// </summary>
public class UserPreferences
{
    public string PreferredVoice { get; set; } = "alloy";
    public double SpeechRate { get; set; } = 1.0;
    public double Volume { get; set; } = 1.0;
    public bool EnableTranscription { get; set; } = true;
    public bool EnableVoiceActivityVisualization { get; set; } = true;
    public string Language { get; set; } = "en-US";
    public Dictionary<string, object> AccessibilitySettings { get; set; } = new();
}

/// <summary>
/// Agent performance metrics
/// </summary>
public class AgentPerformanceMetrics
{
    public string AgentName { get; set; } = string.Empty;
    public TimeSpan TotalActiveTime { get; set; }
    public int MessagesProcessed { get; set; }
    public int SuccessfulHandoffs { get; set; }
    public int Errors { get; set; }
    public double AverageResponseTime { get; set; }
    public double UserSatisfactionScore { get; set; }
    public DateTime LastUsed { get; set; }
}

/// <summary>
/// Clinical data model for assessments
/// </summary>
public class ClinicalData
{
    public string AssessmentType { get; set; } = string.Empty;
    public DateTime AssessmentDate { get; set; }
    public Dictionary<string, object> Scores { get; set; } = new();
    public List<string> RiskFactors { get; set; } = new();
    public List<string> Recommendations { get; set; } = new();
    public string ClinicalNotes { get; set; } = string.Empty;
    public bool RequiresFollowUp { get; set; }
}

/// <summary>
/// Integration configuration for external services
/// </summary>
public class IntegrationConfig
{
    public string ServiceName { get; set; } = string.Empty;
    public string Endpoint { get; set; } = string.Empty;
    public Dictionary<string, string> Headers { get; set; } = new();
    public Dictionary<string, object> Settings { get; set; } = new();
    public bool IsEnabled { get; set; } = true;
    public int TimeoutMs { get; set; } = 30000;
}

/// <summary>
/// Audit log entry for compliance and tracking
/// </summary>
public class AuditLogEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string SessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Component { get; set; } = string.Empty;
    public Dictionary<string, object> Details { get; set; } = new();
    public string? Outcome { get; set; }
}