namespace BehavioralHealthSystem.Models;

public class KintsugiWorkflowResult
{
    public string SessionId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public List<PredictionResult> Results { get; set; } = new();
    public bool IsSuccess { get; set; }
    public string? ErrorMessage { get; set; }
}
