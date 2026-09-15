namespace BehavioralHealthSystem.Services.Interfaces;

public interface IDeepAnalysisAgentService
{
    bool IsEnabled { get; }
    string ModelVersion { get; }
    Task<string?> GenerateAssessmentAsync(string clinicalData, CancellationToken cancellationToken = default);
}
