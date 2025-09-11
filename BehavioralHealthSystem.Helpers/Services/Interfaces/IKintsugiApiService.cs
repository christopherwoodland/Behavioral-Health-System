namespace BehavioralHealthSystem.Services.Interfaces;

public interface IKintsugiApiService
{
    Task<InitiateResponse?> InitiateSessionAsync(InitiateRequest request, CancellationToken cancellationToken = default);
    Task<PredictionResponse?> SubmitPredictionAsync(string sessionId, byte[] audioData, CancellationToken cancellationToken = default);
    Task<PredictionResponse?> SubmitPredictionAsync(string sessionId, string audioFileUrl, string audioFileName, CancellationToken cancellationToken = default);
    Task<List<PredictionResult>> GetPredictionResultsAsync(string userId, CancellationToken cancellationToken = default);
    Task<SessionPredictionResult?> GetPredictionResultBySessionIdAsync(string sessionId, CancellationToken cancellationToken = default);
}
