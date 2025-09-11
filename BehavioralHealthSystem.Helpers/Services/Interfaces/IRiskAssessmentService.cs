using BehavioralHealthSystem.Models;

namespace BehavioralHealthSystem.Services.Interfaces;

public interface IRiskAssessmentService
{
    Task<RiskAssessment?> GenerateRiskAssessmentAsync(SessionData sessionData);
    Task<bool> UpdateSessionWithRiskAssessmentAsync(string sessionId);
}
