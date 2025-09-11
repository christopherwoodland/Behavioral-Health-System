namespace BehavioralHealthSystem.Services;

public class KintsugiApiService : IKintsugiApiService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<KintsugiApiService> _logger;
    private readonly KintsugiApiOptions _options;
    private readonly JsonSerializerOptions _jsonOptions;

    public KintsugiApiService(
        HttpClient httpClient, 
        ILogger<KintsugiApiService> logger,
        IOptions<KintsugiApiOptions> options)
    {
        _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _options = options?.Value ?? throw new ArgumentNullException(nameof(options));
        
        // Validate and configure HttpClient if not already configured
        if (_httpClient.BaseAddress == null)
        {
            _logger.LogInformation("HttpClient BaseAddress is null, configuring from options");
            
            if (string.IsNullOrEmpty(_options.KintsugiApiKey))
            {
                _logger.LogError("KINTSUGI_API_KEY is not configured");
                throw new InvalidOperationException("KINTSUGI_API_KEY is not configured");
            }

            if (string.IsNullOrEmpty(_options.KintsugiBaseUrl))
            {
                _logger.LogError("KINTSUGI_BASE_URL is not configured");
                throw new InvalidOperationException("KINTSUGI_BASE_URL is not configured");
            }

            // Ensure BaseUrl ends with a slash for relative URL resolution
            var baseUrl = _options.KintsugiBaseUrl.TrimEnd('/') + "/";
            _httpClient.BaseAddress = new Uri(baseUrl);
            _httpClient.DefaultRequestHeaders.Accept.Clear();
            _httpClient.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
            _httpClient.DefaultRequestHeaders.Add("X-API-Key", _options.KintsugiApiKey);
            _httpClient.Timeout = TimeSpan.FromMinutes(5);
            
            _logger.LogInformation("HttpClient configured in constructor with BaseAddress: {BaseAddress}", _httpClient.BaseAddress);
        }
        else
        {
            _logger.LogInformation("HttpClient already has BaseAddress: {BaseAddress}", _httpClient.BaseAddress);
        }
        
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
    }

    public async Task<InitiateResponse?> InitiateSessionAsync(InitiateRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        
        try
        {
            _logger.LogInformation("Initiating session for user: {UserId}", request.UserId);
            
            // Additional validation and logging
            if (string.IsNullOrWhiteSpace(request.UserId))
            {
                _logger.LogError("InitiateRequest.UserId is null, empty, or whitespace: '{UserId}'", request.UserId);
                throw new ArgumentException("UserId cannot be null, empty, or whitespace", nameof(request));
            }
            
            // The external Kintsugi API expects snake_case keys (user_id, is_initiated).
            // Our internal model uses camelCase for better .NET ergonomics and inbound client consistency.
            // To avoid breaking existing callers, map explicitly to the wire contract here instead of
            // changing data annotations on the shared model.
            object payload;
            _logger.LogDebug("AutoProvideConsent option value: {AutoProvideConsent}", _options.AutoProvideConsent);
            
            // Check if metadata has any actual values
            bool hasMetadata = request.Metadata != null && HasAnyMetadataValues(request.Metadata);
            _logger.LogDebug("Metadata provided: {HasMetadata}", hasMetadata);
            
            if (_options.AutoProvideConsent)
            {
                _logger.LogDebug("Including consent fields in initiate payload");
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
                _logger.LogDebug("Not including consent fields (AutoProvideConsent disabled)");
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

            var json = JsonSerializer.Serialize(payload, _jsonOptions);
            _logger.LogInformation("Sending InitiateRequest JSON to Kintsugi API (mapped payload): {RequestJson}", json);
            
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            
            using var response = await _httpClient.PostAsync("initiate", content, cancellationToken);
            
            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
                var result = JsonSerializer.Deserialize<InitiateResponse>(responseContent, _jsonOptions);
                
                _logger.LogInformation("Session initiated successfully with ID: {SessionId}", result?.SessionId);
                return result;
            }
            
            await HandleErrorResponseAsync(response, cancellationToken);
            return null;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Session initiation was cancelled for user: {UserId}", request.UserId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initiating session for user: {UserId}", request.UserId);
            throw;
        }
    }

    public async Task<PredictionResponse?> SubmitPredictionAsync(string sessionId, byte[] audioData, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(sessionId);
        ArgumentNullException.ThrowIfNull(audioData);
        
        try
        {
            _logger.LogInformation("Submitting prediction for session: {SessionId}, Audio size: {AudioSize} bytes", 
                sessionId, audioData.Length);
            
            using var form = new MultipartFormDataContent();
            
            // Add session_id
            form.Add(new StringContent(sessionId), "session_id");
            
            // Add audio file
            var audioContent = new ByteArrayContent(audioData);
            audioContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("audio/wav");
            form.Add(audioContent, "file", "audio.wav");

            using var response = await _httpClient.PostAsync("prediction/", form, cancellationToken);
            
            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
                var result = JsonSerializer.Deserialize<PredictionResponse>(responseContent, _jsonOptions);
                
                _logger.LogInformation("Prediction submitted successfully for session: {SessionId}, Status: {Status}", 
                    sessionId, result?.Status);
                return result;
            }
            
            await HandleErrorResponseAsync(response, cancellationToken);
            return null;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Prediction submission was cancelled for session: {SessionId}", sessionId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting prediction for session: {SessionId}", sessionId);
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
            _logger.LogInformation("Downloading audio file from URL for session: {SessionId}, URL: {AudioFileUrl}, FileName: {AudioFileName}", 
                sessionId, audioFileUrl, audioFileName);
            
            // Download the audio file from the provided URL using a separate HttpClient
            byte[] audioData;
            using (var downloadClient = new HttpClient())
            {
                downloadClient.Timeout = TimeSpan.FromMinutes(10); // Set a reasonable timeout for file downloads
                
                using var downloadResponse = await downloadClient.GetAsync(audioFileUrl, cancellationToken);
                
                if (!downloadResponse.IsSuccessStatusCode)
                {
                    var errorMessage = $"Failed to download audio file from {audioFileUrl}. Status: {downloadResponse.StatusCode}";
                    _logger.LogError(errorMessage);
                    throw new HttpRequestException(errorMessage, null, downloadResponse.StatusCode);
                }
                
                audioData = await downloadResponse.Content.ReadAsByteArrayAsync(cancellationToken);
                _logger.LogInformation("Successfully downloaded audio file: {FileSize} bytes", audioData.Length);
            }
            
            // Call the existing method with the downloaded audio data
            return await SubmitPredictionAsync(sessionId, audioData, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Audio file download and prediction submission was cancelled for session: {SessionId}", sessionId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading audio file and submitting prediction for session: {SessionId}, URL: {AudioFileUrl}", 
                sessionId, audioFileUrl);
            throw;
        }
    }

    public async Task<List<PredictionResult>> GetPredictionResultsAsync(string userId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(userId);
        
        try
        {
            _logger.LogInformation("Getting prediction results for user: {UserId}", userId);
            
            using var response = await _httpClient.GetAsync($"predict/users/{userId}", cancellationToken);
            
            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
                var results = JsonSerializer.Deserialize<List<PredictionResult>>(responseContent, _jsonOptions);
                
                _logger.LogInformation("Retrieved {Count} prediction results for user: {UserId}", 
                    results?.Count ?? 0, userId);
                return results ?? [];
            }
            
            await HandleErrorResponseAsync(response, cancellationToken);
            return [];
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Getting prediction results was cancelled for user: {UserId}", userId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting prediction results for user: {UserId}", userId);
            throw;
        }
    }

    public async Task<SessionPredictionResult?> GetPredictionResultBySessionIdAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(sessionId);
        
        try
        {
            _logger.LogInformation("Getting prediction result for session: {SessionId}", sessionId);
            
            using var response = await _httpClient.GetAsync($"predict/sessions/{sessionId}", cancellationToken);
            
            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
                var result = JsonSerializer.Deserialize<SessionPredictionResult>(responseContent, _jsonOptions);
                
                _logger.LogInformation("Retrieved prediction result for session: {SessionId}, Status: {Status}", 
                    sessionId, result?.Status ?? "Unknown");
                return result;
            }
            
            await HandleErrorResponseAsync(response, cancellationToken);
            return null;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Getting prediction result was cancelled for session: {SessionId}", sessionId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting prediction result for session: {SessionId}", sessionId);
            throw;
        }
    }

    private async Task HandleErrorResponseAsync(HttpResponseMessage response, CancellationToken cancellationToken = default)
    {
        var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
        
        ApiErrorResponse? errorResponse = null;
        try
        {
            errorResponse = JsonSerializer.Deserialize<ApiErrorResponse>(errorContent, _jsonOptions);
        }
        catch (JsonException)
        {
            // If we can't parse the error response, use the raw content
            _logger.LogWarning("Could not parse error response as JSON: {ErrorContent}", errorContent);
        }

        var errorMessage = response.StatusCode switch
        {
            System.Net.HttpStatusCode.Unauthorized => $"Not authorized: {errorResponse?.Message ?? errorContent}",
            System.Net.HttpStatusCode.Forbidden => $"Not authenticated: {errorResponse?.Message ?? errorContent}",
            System.Net.HttpStatusCode.NotAcceptable => $"Consent not provided: {errorResponse?.Message ?? errorContent}",
            System.Net.HttpStatusCode.NotFound => $"Resource not found: {errorResponse?.Message ?? errorContent}",
            System.Net.HttpStatusCode.Conflict => $"Request conflict: {errorResponse?.Message ?? errorContent}",
            System.Net.HttpStatusCode.UnprocessableEntity => $"Validation error: {errorResponse?.Message ?? errorContent}",
            (System.Net.HttpStatusCode)417 => $"Expectation failed: {errorResponse?.Message ?? errorContent}",
            System.Net.HttpStatusCode.InternalServerError => $"Server error: {errorResponse?.Message ?? errorContent}",
            _ => $"API error ({response.StatusCode}): {errorResponse?.Message ?? errorContent}"
        };
        
        _logger.LogError("Kintsugi API error: {StatusCode} - {ErrorMessage}, Raw Response: {RawResponse}", 
            response.StatusCode, errorMessage, errorContent);

        // For 417 errors, create a more detailed exception with all error information
        if (response.StatusCode == (System.Net.HttpStatusCode)417)
        {
            var detailedException = new HttpRequestException(errorMessage, null, response.StatusCode);
            
            // Add the raw error response as data for upstream handling
            detailedException.Data["RawErrorResponse"] = errorContent;
            detailedException.Data["ErrorDetails"] = errorResponse;
            detailedException.Data["StatusCode"] = response.StatusCode;
            
            throw detailedException;
        }
        
        throw new HttpRequestException(errorMessage, null, response.StatusCode);
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
