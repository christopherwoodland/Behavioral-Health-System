namespace BehavioralHealthSystem.Services;

public class KintsugiApiService : BaseHttpService, IKintsugiApiService
{
    private readonly KintsugiApiOptions _options;

    public KintsugiApiService(
        HttpClient httpClient, 
        ILogger<KintsugiApiService> logger,
        IOptions<KintsugiApiOptions> options)
        : base(httpClient, logger)
    {
        _options = options?.Value ?? throw new ArgumentNullException(nameof(options));
        
        // Validate and configure HttpClient if not already configured
        if (HttpClient.BaseAddress == null)
        {
            ValidateConfiguration(new Dictionary<string, string?>
            {
                ["KINTSUGI_API_KEY"] = _options.KintsugiApiKey,
                ["KINTSUGI_BASE_URL"] = _options.KintsugiBaseUrl
            });

            var defaultHeaders = new Dictionary<string, string>
            {
                ["X-API-Key"] = _options.KintsugiApiKey!
            };
            
            ConfigureHttpClient(_options.KintsugiBaseUrl!, defaultHeaders);
            
            Logger.LogInformation("[{ClassName}] HttpClient configured with BaseAddress: {BaseAddress}", 
                nameof(KintsugiApiService), HttpClient.BaseAddress);
        }
        else
        {
            Logger.LogInformation("[{ClassName}] HttpClient already configured with BaseAddress: {BaseAddress}", 
                nameof(KintsugiApiService), HttpClient.BaseAddress);
        }
    }

    public async Task<InitiateResponse?> InitiateSessionAsync(InitiateRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        
        try
        {
            Logger.LogInformation("[{MethodName}] Initiating session for user: {UserId}", nameof(InitiateSessionAsync), request.UserId);
            
            // Additional validation and logging
            if (string.IsNullOrWhiteSpace(request.UserId))
            {
                Logger.LogError("[{MethodName}] InitiateRequest.UserId is null, empty, or whitespace: '{UserId}'", nameof(InitiateSessionAsync), request.UserId);
                throw new ArgumentException("UserId cannot be null, empty, or whitespace", nameof(request));
            }
            
            // The external Kintsugi API expects snake_case keys (user_id, is_initiated).
            // Our internal model uses camelCase for better .NET ergonomics and inbound client consistency.
            // To avoid breaking existing callers, map explicitly to the wire contract here instead of
            // changing data annotations on the shared model.
            object payload;
            Logger.LogDebug("[{MethodName}] AutoProvideConsent option value: {AutoProvideConsent}", nameof(InitiateSessionAsync), _options.AutoProvideConsent);
            
            // Check if metadata has any actual values
            bool hasMetadata = request.Metadata != null && HasAnyMetadataValues(request.Metadata);
            Logger.LogDebug("[{MethodName}] Metadata provided: {HasMetadata}", nameof(InitiateSessionAsync), hasMetadata);
            
            if (_options.AutoProvideConsent)
            {
                Logger.LogDebug("[{MethodName}] Including consent fields in initiate payload", nameof(InitiateSessionAsync));
                if (hasMetadata)
                {
                    payload = new
                    {
                        user_id = request.UserId,
                        is_initiated = request.IsInitiated,
                        consent = true,
                        consent_timestamp = DateTimeOffset.UtcNow.ToUniversalTime().ToString("o"),
                        metadata = request.Metadata
                    };
                }
                else
                {
                    payload = new
                    {
                        user_id = request.UserId,
                        is_initiated = request.IsInitiated,
                        consent = true,
                        consent_timestamp = DateTimeOffset.UtcNow.ToUniversalTime().ToString("o")
                    };
                }
            }
            else
            {
                Logger.LogDebug("[{MethodName}] Not including consent fields (AutoProvideConsent disabled)", nameof(InitiateSessionAsync));
                if (hasMetadata)
                {
                    payload = new
                    {
                        user_id = request.UserId,
                        is_initiated = request.IsInitiated,
                        metadata = request.Metadata
                    };
                }
                else
                {
                    payload = new
                    {
                        user_id = request.UserId,
                        is_initiated = request.IsInitiated
                    };
                }
            }

            var json = JsonSerializer.Serialize(payload, JsonOptions);
            Logger.LogInformation("[{MethodName}] Sending InitiateRequest JSON to Kintsugi API (mapped payload): {RequestJson}", nameof(InitiateSessionAsync), json);
            
            using var content = new StringContent(json, Encoding.UTF8, ApplicationConstants.ContentTypes.ApplicationJson);
            
            using var response = await HttpClient.PostAsync("initiate", content, cancellationToken);
            
            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
                var result = JsonSerializer.Deserialize<InitiateResponse>(responseContent, JsonOptions);
                
                Logger.LogInformation("[{MethodName}] Session initiated successfully with ID: {SessionId}", nameof(InitiateSessionAsync), result?.SessionId);
                return result;
            }
            
            await HandleErrorResponseAsync(response, nameof(InitiateSessionAsync), cancellationToken);
            return null;
        }
        catch (OperationCanceledException)
        {
            Logger.LogWarning("[{MethodName}] Session initiation was cancelled for user: {UserId}", nameof(InitiateSessionAsync), request.UserId);
            throw;
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "[{MethodName}] Error initiating session for user: {UserId}", nameof(InitiateSessionAsync), request.UserId);
            throw;
        }
    }

    public async Task<PredictionResponse?> SubmitPredictionAsync(string sessionId, byte[] audioData, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(sessionId);
        ArgumentNullException.ThrowIfNull(audioData);
        
        try
        {
            Logger.LogInformation("[{MethodName}] Submitting prediction for session: {SessionId}, Audio size: {AudioSize} bytes", 
                nameof(SubmitPredictionAsync), sessionId, audioData.Length);
            
            using var form = new MultipartFormDataContent();
            
            // Add session_id
            form.Add(new StringContent(sessionId), "session_id");
            
            // Add audio file
            var audioContent = new ByteArrayContent(audioData);
            audioContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("audio/wav");
            form.Add(audioContent, "file", "audio.wav");

            return await ExecutePostMultipartAsync<PredictionResponse>("prediction/", form, cancellationToken, 
                $"SubmitPrediction for session {sessionId}");
        }
        catch (OperationCanceledException)
        {
            Logger.LogWarning("[{MethodName}] Prediction submission was cancelled for session: {SessionId}", nameof(SubmitPredictionAsync), sessionId);
            throw;
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "[{MethodName}] Error submitting prediction for session: {SessionId}", nameof(SubmitPredictionAsync), sessionId);
            throw;
        }
    }

    public async Task<PredictionResponse?> SubmitPredictionAsync(string sessionId, string audioFileUrl, string audioFileName, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(sessionId);
        ArgumentException.ThrowIfNullOrEmpty(audioFileUrl);
        ArgumentException.ThrowIfNullOrEmpty(audioFileName);
        
        try
        {
            Logger.LogInformation("[{MethodName}] Downloading audio file from URL for session: {SessionId}, URL: {AudioFileUrl}, FileName: {AudioFileName}", 
                nameof(SubmitPredictionAsync), sessionId, audioFileUrl, audioFileName);
            
            // Download the audio file using the base class method
            var audioData = await DownloadBinaryDataAsync(audioFileUrl, cancellationToken, 
                $"audio file for session {sessionId}");
            
            // Call the existing method with the downloaded audio data
            return await SubmitPredictionAsync(sessionId, audioData, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            Logger.LogWarning("[{MethodName}] Audio file download and prediction submission was cancelled for session: {SessionId}", nameof(SubmitPredictionAsync), sessionId);
            throw;
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "[{MethodName}] Error downloading audio file and submitting prediction for session: {SessionId}, URL: {AudioFileUrl}", 
                nameof(SubmitPredictionAsync), sessionId, audioFileUrl);
            throw;
        }
    }

    public async Task<List<PredictionResult>> GetPredictionResultsAsync(string userId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(userId);
        
        var results = await ExecuteGetAsync<List<PredictionResult>>($"predict/users/{userId}", cancellationToken, 
            $"GetPredictionResults for user {userId}");
        
        return results ?? [];
    }

    public async Task<SessionPredictionResult?> GetPredictionResultBySessionIdAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(sessionId);
        
        return await ExecuteGetAsync<SessionPredictionResult>($"predict/sessions/{sessionId}", cancellationToken, 
            $"GetPredictionResultBySession for {sessionId}");
    }

    private static bool HasAnyMetadataValues(UserMetadata metadata)
    {
        if (metadata == null) return false;
        
        // Check if any meaningful values are provided (not just default values)
        return metadata.Age > 0 ||
               !string.IsNullOrWhiteSpace(metadata.Gender) ||
               !string.IsNullOrWhiteSpace(metadata.Race) ||
               !string.IsNullOrWhiteSpace(metadata.Ethnicity) ||
               metadata.Weight > 0 ||
               !string.IsNullOrWhiteSpace(metadata.Zipcode);
        // Note: Language is a bool with default false, so we can't distinguish 
        // between explicitly set false vs not provided. We'll include it if any other field is set.
    }
}
