namespace BehavioralHealthSystem.Models;

public class ApiErrorResponse
{
    public string Message { get; set; } = string.Empty;
    public string Error { get; set; } = string.Empty;
    public Dictionary<string, object> AdditionalData { get; set; } = new();
    public string? Details { get; set; }
}
