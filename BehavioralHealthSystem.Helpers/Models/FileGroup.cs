namespace BehavioralHealthSystem.Models;

/// <summary>
/// Represents a group that can contain multiple processed files/sessions
/// </summary>
public class FileGroup
{
    [JsonPropertyName("groupId")]
    public string GroupId { get; set; } = string.Empty;

    [JsonPropertyName("groupName")]
    public string GroupName { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("createdAt")]
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("O");

    [JsonPropertyName("updatedAt")]
    public string UpdatedAt { get; set; } = DateTime.UtcNow.ToString("O");

    [JsonPropertyName("createdBy")]
    public string CreatedBy { get; set; } = string.Empty;

    [JsonPropertyName("sessionCount")]
    public int SessionCount { get; set; } = 0;

    [JsonPropertyName("status")]
    public string Status { get; set; } = "active";
}

/// <summary>
/// Request model for creating a new file group
/// </summary>
public class CreateFileGroupRequest
{
    [JsonPropertyName("groupName")]
    public string GroupName { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("createdBy")]
    public string CreatedBy { get; set; } = string.Empty;
}

/// <summary>
/// Response model for file group operations
/// </summary>
public class FileGroupResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;

    [JsonPropertyName("fileGroup")]
    public FileGroup? FileGroup { get; set; }
}

/// <summary>
/// Response model for listing file groups
/// </summary>
public class FileGroupListResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("fileGroups")]
    public List<FileGroup> FileGroups { get; set; } = [];

    [JsonPropertyName("count")]
    public int Count { get; set; }
}
