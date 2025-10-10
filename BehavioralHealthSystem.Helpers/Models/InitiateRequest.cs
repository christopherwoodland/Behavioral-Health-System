namespace BehavioralHealthSystem.Models;

/// <summary>
/// Represents a request to initiate a new behavioral health assessment session.
/// </summary>
public class InitiateRequest
{
    /// <summary>
    /// Gets or sets a value indicating whether the session has been initiated.
    /// Default value is true.
    /// </summary>
    [JsonPropertyName("isInitiated")]
    public bool IsInitiated { get; set; } = true;

    /// <summary>
    /// Gets or sets optional demographic and health metadata for the user.
    /// </summary>
    [JsonPropertyName("metadata")]
    public UserMetadata? Metadata { get; set; }

    /// <summary>
    /// Gets or sets the unique identifier for the user initiating the session.
    /// </summary>
    [JsonPropertyName("userId")]
    public string UserId { get; set; } = string.Empty;
}
