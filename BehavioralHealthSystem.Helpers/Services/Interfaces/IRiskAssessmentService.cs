namespace BehavioralHealthSystem.Services.Interfaces;

public interface IRiskAssessmentService
{
    Task<RiskAssessment?> GenerateRiskAssessmentAsync(SessionData sessionData);
    Task<bool> UpdateSessionWithRiskAssessmentAsync(string sessionId);
    
    /// <summary>
    /// Generates an extended risk assessment including schizophrenia evaluation using GPT-5
    /// This is an asynchronous long-running operation
    /// </summary>
    Task<ExtendedRiskAssessment?> GenerateExtendedRiskAssessmentAsync(SessionData sessionData);
    
    /// <summary>
    /// Updates a session with extended risk assessment asynchronously
    /// </summary>
    Task<bool> UpdateSessionWithExtendedRiskAssessmentAsync(string sessionId);
}
