using Azure.Identity;

namespace BehavioralHealthSystem.Functions;

public class TranscriptionFunction
{
    private readonly ILogger<TranscriptionFunction> _logger;
    private readonly ISessionStorageService _sessionStorageService;

    public TranscriptionFunction(
        ILogger<TranscriptionFunction> logger,
        ISessionStorageService sessionStorageService)
    {
        _logger = logger;
        _sessionStorageService = sessionStorageService;
    }

    /// <summary>
    /// Transcribe audio using Azure Speech Service Fast Transcription API
    /// POST /api/transcribe-audio
    /// Docs: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/fast-transcription-create
    /// </summary>
    [Function("TranscribeAudio")]
    public async Task<HttpResponseData> TranscribeAudio(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "transcribe-audio")] HttpRequestData req)
    {
        _logger.LogInformation("[{FunctionName}] Transcription request received", nameof(TranscribeAudio));

        try
        {
            // Read audio data from request body
            using var memoryStream = new MemoryStream();
            await req.Body.CopyToAsync(memoryStream);
            var audioData = memoryStream.ToArray();

            if (audioData.Length == 0)
            {
                _logger.LogWarning("[{FunctionName}] No audio data provided", nameof(TranscribeAudio));
                var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "No audio data provided" }));
                return badResponse;
            }

            _logger.LogInformation("[{FunctionName}] Received {Size} bytes of audio data", nameof(TranscribeAudio), audioData.Length);

            // Detect actual format from magic bytes (file signature)
            var detectedFormat = DetectAudioFormat(audioData);
            _logger.LogInformation("[{FunctionName}] Detected format from bytes: {DetectedFormat}",
                nameof(TranscribeAudio), detectedFormat ?? "unknown");

            // Use detected format if available, otherwise default to wav
            var fileExtension = detectedFormat ?? "wav";

            // Map extension to proper content type for the API
            // NOTE: Azure Speech Fast Transcription API has specific format requirements
            // WebM with Opus codec should be sent as audio/ogg for better compatibility
            var mimeType = fileExtension switch
            {
                "wav" => "audio/wav",
                "mp3" => "audio/mpeg",
                "m4a" => "audio/mp4",
                "mp4" => "audio/mp4",
                "ogg" => "audio/ogg",
                "webm" => "audio/ogg", // WebM with Opus codec - use OGG MIME type for Azure Speech API compatibility
                "flac" => "audio/flac",
                "aac" => "audio/aac",
                "wma" => "audio/x-ms-wma",
                "amr" => "audio/amr",
                _ => "audio/wav"
            };

            // For WebM files, use .ogg extension as Azure Speech API handles OPUS/OGG better
            if (fileExtension == "webm")
            {
                fileExtension = "ogg";
                _logger.LogInformation("[{FunctionName}] Converting WebM to OGG for Azure Speech API compatibility",
                    nameof(TranscribeAudio));
            }

            _logger.LogInformation("[{FunctionName}] Using file extension: {Extension}, MIME type: {MimeType}",
                nameof(TranscribeAudio), fileExtension, mimeType);

            // Get configuration from environment - Azure Speech Service settings
            var speechEndpoint = Environment.GetEnvironmentVariable("AZURE_SPEECH_ENDPOINT");
            var speechLocale = Environment.GetEnvironmentVariable("AZURE_SPEECH_LOCALE") ?? "en-US";
            var apiVersion = Environment.GetEnvironmentVariable("AZURE_SPEECH_API_VERSION") ?? "2024-11-15";

            if (string.IsNullOrEmpty(speechEndpoint))
            {
                _logger.LogError("[{FunctionName}] Speech service endpoint not configured (AZURE_SPEECH_ENDPOINT)", nameof(TranscribeAudio));
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Speech transcription service not configured" }));
                return errorResponse;
            }

            // Build the Fast Transcription API URL
            // Format: https://{resource}.cognitiveservices.azure.com/speechtotext/transcriptions:transcribe?api-version={version}
            var transcriptionUrl = $"{speechEndpoint.TrimEnd('/')}/speechtotext/transcriptions:transcribe?api-version={apiVersion}";

            _logger.LogInformation("[{FunctionName}] Calling Azure Speech Fast Transcription API at endpoint: {Endpoint}",
                nameof(TranscribeAudio), speechEndpoint);

            // Get access token using managed identity (key auth is disabled on this resource)
            var credential = new DefaultAzureCredential();
            var tokenRequestContext = new Azure.Core.TokenRequestContext(new[] { "https://cognitiveservices.azure.com/.default" });
            var accessToken = await credential.GetTokenAsync(tokenRequestContext);

            _logger.LogInformation("[{FunctionName}] Acquired access token via managed identity", nameof(TranscribeAudio));

            using var httpClient = new HttpClient();
            using var formContent = new MultipartFormDataContent();

            // Add the audio file
            var audioContent = new ByteArrayContent(audioData);
            audioContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(mimeType);
            formContent.Add(audioContent, "audio", $"audio.{fileExtension}");

            // Add the definition JSON with locale (mono channel audio)
            var definition = JsonSerializer.Serialize(new
            {
                locales = new[] { speechLocale }
            });
            formContent.Add(new StringContent(definition), "definition");

            // Use Bearer token authentication (managed identity)
            httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken.Token);
            httpClient.DefaultRequestHeaders.Add("Accept", "application/json");

            var transcriptionResponse = await httpClient.PostAsync(transcriptionUrl, formContent);

            if (!transcriptionResponse.IsSuccessStatusCode)
            {
                var errorText = await transcriptionResponse.Content.ReadAsStringAsync();
                _logger.LogError("[{FunctionName}] Speech transcription API error: {StatusCode} - {Error}",
                    nameof(TranscribeAudio), transcriptionResponse.StatusCode, errorText);

                var errorResponse = req.CreateResponse(HttpStatusCode.BadGateway);
                await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    error = "Transcription failed",
                    details = errorText
                }));
                return errorResponse;
            }

            var resultJson = await transcriptionResponse.Content.ReadAsStringAsync();
            _logger.LogDebug("[{FunctionName}] Raw transcription response: {Response}", nameof(TranscribeAudio), resultJson);

            var transcriptionResult = JsonSerializer.Deserialize<JsonElement>(resultJson);

            // Parse the Fast Transcription API response format
            // Response contains: durationMilliseconds, combinedPhrases, phrases
            var combinedText = "";
            if (transcriptionResult.TryGetProperty("combinedPhrases", out var combinedPhrases) &&
                combinedPhrases.GetArrayLength() > 0)
            {
                var firstPhrase = combinedPhrases[0];
                combinedText = firstPhrase.TryGetProperty("text", out var textProp) ? textProp.GetString() ?? "" : "";
            }

            // Get duration in seconds (API returns milliseconds)
            double durationSeconds = 0;
            if (transcriptionResult.TryGetProperty("durationMilliseconds", out var durationMs))
            {
                durationSeconds = durationMs.GetInt32() / 1000.0;
            }

            // Get detected language from first phrase if available
            var detectedLanguage = speechLocale;
            if (transcriptionResult.TryGetProperty("phrases", out var phrases) &&
                phrases.GetArrayLength() > 0)
            {
                var firstPhraseDetail = phrases[0];
                if (firstPhraseDetail.TryGetProperty("locale", out var localeProp))
                {
                    detectedLanguage = localeProp.GetString() ?? speechLocale;
                }
            }

            // Calculate average confidence from phrases
            double avgConfidence = 1.0;
            if (transcriptionResult.TryGetProperty("phrases", out var phrasesForConfidence) &&
                phrasesForConfidence.GetArrayLength() > 0)
            {
                double totalConfidence = 0;
                int count = 0;
                foreach (var phrase in phrasesForConfidence.EnumerateArray())
                {
                    if (phrase.TryGetProperty("confidence", out var conf))
                    {
                        totalConfidence += conf.GetDouble();
                        count++;
                    }
                }
                if (count > 0)
                {
                    avgConfidence = totalConfidence / count;
                }
            }

            _logger.LogInformation("[{FunctionName}] Transcription successful: {TextLength} characters, duration: {Duration}s, language: {Language}, confidence: {Confidence:F2}",
                nameof(TranscribeAudio), combinedText.Length, durationSeconds, detectedLanguage, avgConfidence);

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");

            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                text = combinedText,
                confidence = avgConfidence,
                duration = durationSeconds,
                language = detectedLanguage
            }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error during transcription", nameof(TranscribeAudio));
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Internal server error", details = ex.Message }));
            return errorResponse;
        }
    }

    [Function("SaveTranscription")]
    public async Task<HttpResponseData> SaveTranscription(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req)
    {
        _logger.LogInformation("[{FunctionName}] Save transcription request received", nameof(SaveTranscription));

        try
        {
            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var request = JsonSerializer.Deserialize<SaveTranscriptionRequest>(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            if (request == null || string.IsNullOrWhiteSpace(request.SessionId))
            {
                _logger.LogWarning("[{FunctionName}] Invalid request: sessionId is null or empty", nameof(SaveTranscription));
                var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "SessionId is required" }));
                return badResponse;
            }

            if (string.IsNullOrWhiteSpace(request.Transcription))
            {
                _logger.LogWarning("[{FunctionName}] Invalid request: transcription is null or empty", nameof(SaveTranscription));
                var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Transcription text is required" }));
                return badResponse;
            }

            // Get existing session data
            var sessionData = await _sessionStorageService.GetSessionDataAsync(request.SessionId);
            if (sessionData == null)
            {
                _logger.LogWarning("[{FunctionName}] Session not found: {SessionId}", nameof(SaveTranscription), request.SessionId);
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Session not found" }));
                return notFoundResponse;
            }

            // Update session with transcription
            sessionData.Transcription = request.Transcription;
            sessionData.UpdatedAt = DateTime.UtcNow.ToString("O");

            // Save updated session data
            await _sessionStorageService.SaveSessionDataAsync(sessionData);

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");

            var responseData = new SaveTranscriptionResponse
            {
                Success = true,
                SessionId = request.SessionId,
                Message = "Transcription saved successfully"
            };

            await response.WriteStringAsync(JsonSerializer.Serialize(responseData, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            }));

            _logger.LogInformation("[{FunctionName}] Transcription saved successfully for session {SessionId}",
                nameof(SaveTranscription), request.SessionId);

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error saving transcription", nameof(SaveTranscription));
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Internal server error" }));
            return errorResponse;
        }
    }

    /// <summary>
    /// Detect audio format from magic bytes (file signature)
    /// </summary>
    private static string? DetectAudioFormat(byte[] data)
    {
        if (data.Length < 12) return null;

        // WAV: starts with "RIFF" and contains "WAVE"
        if (data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F' &&
            data[8] == 'W' && data[9] == 'A' && data[10] == 'V' && data[11] == 'E')
        {
            return "wav";
        }

        // MP3: starts with ID3 tag or frame sync (0xFF 0xFB, 0xFF 0xFA, 0xFF 0xF3, 0xFF 0xF2)
        if ((data[0] == 'I' && data[1] == 'D' && data[2] == '3') ||
            (data[0] == 0xFF && (data[1] & 0xE0) == 0xE0))
        {
            return "mp3";
        }

        // FLAC: starts with "fLaC"
        if (data[0] == 'f' && data[1] == 'L' && data[2] == 'a' && data[3] == 'C')
        {
            return "flac";
        }

        // OGG: starts with "OggS"
        if (data[0] == 'O' && data[1] == 'g' && data[2] == 'g' && data[3] == 'S')
        {
            return "ogg";
        }

        // WebM/Matroska: starts with 0x1A 0x45 0xDF 0xA3
        if (data[0] == 0x1A && data[1] == 0x45 && data[2] == 0xDF && data[3] == 0xA3)
        {
            return "webm";
        }

        // M4A/MP4: contains "ftyp" at offset 4
        if (data.Length >= 8 && data[4] == 'f' && data[5] == 't' && data[6] == 'y' && data[7] == 'p')
        {
            return "m4a";
        }

        return null;
    }
}

public class SaveTranscriptionRequest
{
    public string SessionId { get; set; } = string.Empty;
    public string Transcription { get; set; } = string.Empty;
}

public class SaveTranscriptionResponse
{
    public bool Success { get; set; }
    public string SessionId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}
