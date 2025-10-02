using BehavioralHealthSystem.Models;

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
    
    /// <summary>
    /// Generates a multi-condition extended risk assessment for selected DSM-5 conditions
    /// This is an asynchronous long-running operation using GPT-5/O3
    /// </summary>
    Task<MultiConditionExtendedRiskAssessment?> GenerateMultiConditionAssessmentAsync(SessionData sessionData, List<string> selectedConditions, AssessmentOptions? options = null);
    
    /// <summary>
    /// Updates a session with multi-condition assessment asynchronously
    /// </summary>
    Task<bool> UpdateSessionWithMultiConditionAssessmentAsync(string sessionId, List<string> selectedConditions, AssessmentOptions? options = null);
}
