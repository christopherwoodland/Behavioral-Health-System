namespace BehavioralHealthSystem.Configuration;

public class KintsugiApiOptions
{
    public const string SectionName = "KintsugiApi";
    
    public string KintsugiApiKey { get; set; } = string.Empty;
    public string KintsugiBaseUrl { get; set; } = "https://api.kintsugihealth.com/v2";
    public int TimeoutSeconds { get; set; } = 300; // 5 minutes
    public int MaxRetryAttempts { get; set; } = 3;
    public int RetryDelayMilliseconds { get; set; } = 1000;
    // Some Kintsugi endpoints require explicit user consent confirmation. If the
    // backend rejects with 406 NotAcceptable / "consent not provided", enabling this
    // flag will add consent indicators to the initiate payload.
    public bool AutoProvideConsent { get; set; } = true;
}
