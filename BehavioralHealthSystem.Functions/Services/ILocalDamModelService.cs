namespace BehavioralHealthSystem.Functions.Services;

public interface ILocalDamModelService
{
    Task<InitiateResponse?> InitiateSessionAsync(InitiateRequest request, CancellationToken cancellationToken = default);
    Task<PredictionResponse?> SubmitPredictionAsync(PredictionRequest request, CancellationToken cancellationToken = default);
}
