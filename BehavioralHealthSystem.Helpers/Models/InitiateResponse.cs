namespace BehavioralHealthSystem.Models;

/// <summary>
/// Represents the response from initiating a behavioral health assessment session.
/// </summary>
public class InitiateResponse
{
    /// <summary>
    /// Gets or sets the unique identifier for the newly created session.
    /// </summary>
    [JsonPropertyName("session_id")]
    public string SessionId { get; set; } = string.Empty;
}
