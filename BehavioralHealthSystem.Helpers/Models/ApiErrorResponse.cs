namespace BehavioralHealthSystem.Models;

/// <summary>
/// Represents a standardized error response for API operations.
/// </summary>
public class ApiErrorResponse
{
    /// <summary>
    /// Gets or sets the human-readable error message.
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the error type or code.
    /// </summary>
    public string Error { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets additional contextual data related to the error.
    /// </summary>
    public Dictionary<string, object> AdditionalData { get; set; } = new();

    /// <summary>
    /// Gets or sets optional detailed information about the error.
    /// </summary>
    public string? Details { get; set; }
}
