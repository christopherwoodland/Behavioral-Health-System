namespace BehavioralHealthSystem.Functions.Services;

public class LocalDamModelOptions
{
    public string BaseUrl { get; set; } = "http://localhost:8000";
    public string InitiatePath { get; set; } = "initiate";
    public string PredictionPath { get; set; } = "predict";
    public string? ApiKey { get; set; }
    public string ModelId { get; set; } = "KintsugiHealth/dam";
    public int TimeoutSeconds { get; set; } = 300;
}
