using Microsoft.DurableTask;

namespace BehavioralHealthSystem.Functions;

public class KintsugiActivityFunctions
{
    private readonly ILogger<KintsugiActivityFunctions> _logger;
    private readonly IKintsugiApiService _kintsugiApiService;

    public KintsugiActivityFunctions(ILogger<KintsugiActivityFunctions> logger, IKintsugiApiService kintsugiApiService)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _kintsugiApiService = kintsugiApiService ?? throw new ArgumentNullException(nameof(kintsugiApiService));
    }

    // Ultra-fast no-op activity used solely to force a durable checkpoint so early custom statuses persist.
    [Function(nameof(NoOpActivity))]
    public string NoOpActivity([ActivityTrigger] object? input)
    {
        _logger.LogDebug("[{FunctionName}] NoOpActivity invoked to force checkpoint", nameof(NoOpActivity));
        return "ok";
    }

    [Function(nameof(InitiateSessionActivity))]
    public async Task<InitiateResponse?> InitiateSessionActivity([ActivityTrigger] InitiateRequest request)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Initiating session for user: {UserId}", nameof(InitiateSessionActivity), request.UserId);
            
            var response = await _kintsugiApiService.InitiateSessionAsync(request);
            
            if (response != null)
            {
                _logger.LogInformation("[{FunctionName}] Session initiated successfully with ID: {SessionId}", nameof(InitiateSessionActivity), response.SessionId);
            }
            else
            {
                _logger.LogWarning("[{FunctionName}] Failed to initiate session for user: {UserId}", nameof(InitiateSessionActivity), request.UserId);
            }
            
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error initiating session for user: {UserId}", nameof(InitiateSessionActivity), request.UserId);
            throw;
        }
    }

    [Function(nameof(SubmitPredictionActivity))]
    public async Task<PredictionResponse?> SubmitPredictionActivity([ActivityTrigger] PredictionRequest request)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Submitting prediction for session: {SessionId}", nameof(SubmitPredictionActivity), request.SessionId);
            
            PredictionResponse? response;
            
            // Use the new URL-based method if URL and filename are provided
            if (!string.IsNullOrEmpty(request.AudioFileUrl) && !string.IsNullOrEmpty(request.AudioFileName))
            {
                _logger.LogInformation("[{FunctionName}] Using URL-based prediction submission for session: {SessionId}, URL: {AudioFileUrl}", 
                    nameof(SubmitPredictionActivity), request.SessionId, request.AudioFileUrl);
                response = await _kintsugiApiService.SubmitPredictionAsync(request.SessionId, request.AudioFileUrl, request.AudioFileName);
            }
            // Fall back to byte array method if URL is not available
            else if (request.AudioData != null && request.AudioData.Length > 0)
            {
                _logger.LogInformation("[{FunctionName}] Using byte array prediction submission for session: {SessionId}, Size: {AudioSize} bytes", 
                    nameof(SubmitPredictionActivity), request.SessionId, request.AudioData.Length);
                response = await _kintsugiApiService.SubmitPredictionAsync(request.SessionId, request.AudioData);
            }
            else
            {
                _logger.LogError("[{FunctionName}] No audio data provided for session: {SessionId}. Neither AudioFileUrl nor AudioData are available.", 
                    nameof(SubmitPredictionActivity), request.SessionId);
                throw new ArgumentException("No audio data provided. Either AudioFileUrl/AudioFileName or AudioData must be specified.");
            }
            
            if (response != null)
            {
                _logger.LogInformation("[{FunctionName}] Prediction submitted successfully for session: {SessionId}, Status: {Status}", 
                    nameof(SubmitPredictionActivity), request.SessionId, response.Status);
            }
            else
            {
                _logger.LogWarning("[{FunctionName}] Failed to submit prediction for session: {SessionId}", nameof(SubmitPredictionActivity), request.SessionId);
            }
            
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error submitting prediction for session: {SessionId}", nameof(SubmitPredictionActivity), request.SessionId);
            throw;
        }
    }

    [Function(nameof(GetPredictionResultsActivity))]
    public async Task<List<PredictionResult>> GetPredictionResultsActivity([ActivityTrigger] string userId)
    {
        try
        {
            // Clean userId of any JSON serialization artifacts (remove surrounding quotes if present)
            var cleanUserId = userId?.Trim('"') ?? string.Empty;
            
            _logger.LogInformation("[{FunctionName}] Getting prediction results for user: {UserId} (cleaned from: {OriginalUserId})", nameof(GetPredictionResultsActivity), cleanUserId, userId);
            
            var results = await _kintsugiApiService.GetPredictionResultsAsync(cleanUserId);
            
            _logger.LogInformation("[{FunctionName}] Retrieved {Count} prediction results for user: {UserId}", nameof(GetPredictionResultsActivity), results.Count, cleanUserId);
            
            return results;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting prediction results for user: {UserId}", nameof(GetPredictionResultsActivity), userId);
            throw;
        }
    }

    [Function(nameof(GetPredictionResultBySessionIdActivity))]
    public async Task<SessionPredictionResult?> GetPredictionResultBySessionIdActivity([ActivityTrigger] string sessionId)
    {
        try
        {
            // Clean sessionId of any JSON serialization artifacts (remove surrounding quotes if present)
            var cleanSessionId = sessionId?.Trim('"') ?? string.Empty;
            
            _logger.LogInformation("[{FunctionName}] Getting prediction result for session: {SessionId} (cleaned from: {OriginalSessionId})", nameof(GetPredictionResultBySessionIdActivity), cleanSessionId, sessionId);
            
            var result = await _kintsugiApiService.GetPredictionResultBySessionIdAsync(cleanSessionId);
            
            if (result != null)
            {
                _logger.LogInformation("[{FunctionName}] Retrieved prediction result for session: {SessionId}, Status: {Status}", 
                    nameof(GetPredictionResultBySessionIdActivity), cleanSessionId, result.Status);
            }
            else
            {
                _logger.LogWarning("[{FunctionName}] No prediction result found for session: {SessionId}", nameof(GetPredictionResultBySessionIdActivity), cleanSessionId);
            }
            
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting prediction result for session: {SessionId}", nameof(GetPredictionResultBySessionIdActivity), sessionId);
            throw;
        }
    }
}
