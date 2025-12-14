using Azure.Identity;
using Azure.Security.KeyVault.Secrets;
using NAudio.Wave;

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
    /// Get a secret value from Key Vault or fall back to environment variable
    /// </summary>
    private string? GetSecretOrEnvVar(string envVarName, string secretName)
    {
        // First try environment variable
        var value = Environment.GetEnvironmentVariable(envVarName);
        if (!string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        // Try Key Vault
        var keyVaultUri = Environment.GetEnvironmentVariable("KEY_VAULT_URI") 
                       ?? Environment.GetEnvironmentVariable("KEY_VAULT_URL");
        if (string.IsNullOrWhiteSpace(keyVaultUri))
        {
            return null;
        }

        try
        {
            var client = new SecretClient(new Uri(keyVaultUri), new DefaultAzureCredential());
            var secret = client.GetSecret(secretName);
            return secret.Value?.Value;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("[TranscriptionFunction] Could not retrieve {SecretName} from Key Vault: {Error}", 
                secretName, ex.Message);
            return null;
        }
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

            // Determine how to handle the audio format
            // Azure Speech Fast Transcription API supports: WAV, MP3, OGG (with Opus), FLAC, and some other formats
            byte[] processedAudioData;
            string fileExtension;
            string mimeType;

            if (detectedFormat == "wav")
            {
                // WAV is natively supported - use as-is
                processedAudioData = audioData;
                fileExtension = "wav";
                mimeType = "audio/wav";
                _logger.LogInformation("[{FunctionName}] Audio is WAV format (natively supported)", nameof(TranscribeAudio));
            }
            else if (detectedFormat == "mp3")
            {
                // MP3 is natively supported by Azure Speech - try as-is first, convert if needed
                processedAudioData = audioData;
                fileExtension = "mp3";
                mimeType = "audio/mpeg";
                _logger.LogInformation("[{FunctionName}] Audio is MP3 format (natively supported)", nameof(TranscribeAudio));
            }
            else if (detectedFormat == "ogg")
            {
                // OGG with Opus is supported by Azure Speech API
                processedAudioData = audioData;
                fileExtension = "ogg";
                mimeType = "audio/ogg";
                _logger.LogInformation("[{FunctionName}] Audio is OGG format (natively supported)", nameof(TranscribeAudio));
            }
            else if (detectedFormat == "flac")
            {
                // FLAC is natively supported
                processedAudioData = audioData;
                fileExtension = "flac";
                mimeType = "audio/flac";
                _logger.LogInformation("[{FunctionName}] Audio is FLAC format (natively supported)", nameof(TranscribeAudio));
            }
            else if (detectedFormat == "webm")
            {
                // WebM with Opus codec - Azure Speech Fast Transcription API does NOT support WebM container
                // We need to convert to WAV. Try using MediaFoundation if available on the system.
                _logger.LogInformation("[{FunctionName}] Audio is WebM format - attempting conversion to WAV", nameof(TranscribeAudio));

                try
                {
                    processedAudioData = ConvertToWavUsingMediaFoundation(audioData, detectedFormat);
                    fileExtension = "wav";
                    mimeType = "audio/wav";
                    _logger.LogInformation("[{FunctionName}] Successfully converted WebM to WAV: {OriginalSize} -> {NewSize} bytes",
                        nameof(TranscribeAudio), audioData.Length, processedAudioData.Length);
                }
                catch (Exception ex)
                {
                    // MediaFoundation conversion failed - WebM is not supported
                    _logger.LogError(ex, "[{FunctionName}] Failed to convert WebM to WAV. WebM/Opus format is not supported by Azure Speech Fast Transcription API. Please record audio in WAV or MP3 format.",
                        nameof(TranscribeAudio));

                    var unsupportedResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await unsupportedResponse.WriteStringAsync(JsonSerializer.Serialize(new
                    {
                        error = "Unsupported audio format",
                        details = "WebM/Opus audio format is not supported. Please record in WAV or MP3 format.",
                        detectedFormat = detectedFormat
                    }));
                    return unsupportedResponse;
                }
            }
            else if (detectedFormat == "m4a" || detectedFormat == "mp4")
            {
                // M4A/MP4 - try MediaFoundation conversion to WAV
                _logger.LogInformation("[{FunctionName}] Audio is {Format} format - attempting conversion to WAV",
                    nameof(TranscribeAudio), detectedFormat);

                try
                {
                    processedAudioData = ConvertToWavUsingMediaFoundation(audioData, detectedFormat);
                    fileExtension = "wav";
                    mimeType = "audio/wav";
                    _logger.LogInformation("[{FunctionName}] Successfully converted {Format} to WAV",
                        nameof(TranscribeAudio), detectedFormat);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[{FunctionName}] Failed to convert {Format} to WAV, trying as MP4 audio",
                        nameof(TranscribeAudio), detectedFormat);
                    processedAudioData = audioData;
                    fileExtension = "m4a";
                    mimeType = "audio/mp4";
                }
            }
            else
            {
                // Unknown format - return error with details
                _logger.LogWarning("[{FunctionName}] Unknown audio format detected. First 16 bytes: {Bytes}",
                    nameof(TranscribeAudio),
                    BitConverter.ToString(audioData.Take(Math.Min(16, audioData.Length)).ToArray()));

                var unknownFormatResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await unknownFormatResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    error = "Unknown audio format",
                    details = "Could not detect audio format. Supported formats: WAV, MP3, OGG, FLAC. Please ensure you are recording in a supported format.",
                    detectedFormat = detectedFormat ?? "unknown"
                }));
                return unknownFormatResponse;
            }

            _logger.LogInformation("[{FunctionName}] Using file extension: {Extension}, MIME type: {MimeType}, data size: {Size} bytes",
                nameof(TranscribeAudio), fileExtension, mimeType, processedAudioData.Length);

            // Get configuration from environment or Key Vault - Azure Speech Service settings
            var speechEndpoint = Environment.GetEnvironmentVariable("AZURE_SPEECH_ENDPOINT");
            var speechKey = GetSecretOrEnvVar("AZURE_SPEECH_KEY", "AzureSpeechKey");
            var speechRegion = GetSecretOrEnvVar("AZURE_SPEECH_REGION", "AzureSpeechRegion") ?? "eastus2";
            var speechLocale = Environment.GetEnvironmentVariable("AZURE_SPEECH_LOCALE") ?? "en-US";
            var apiVersion = Environment.GetEnvironmentVariable("AZURE_SPEECH_API_VERSION") ?? "2024-11-15";
            var useEnhancedMode = Environment.GetEnvironmentVariable("AZURE_SPEECH_ENHANCED_MODE") ?? "false";

            if (string.IsNullOrEmpty(speechEndpoint) && string.IsNullOrEmpty(speechKey))
            {
                _logger.LogError("[{FunctionName}] Speech service not configured (need AZURE_SPEECH_ENDPOINT or AZURE_SPEECH_KEY)", nameof(TranscribeAudio));
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Speech transcription service not configured" }));
                return errorResponse;
            }

            // Build the Fast Transcription API URL
            // Format: https://{region}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version={version}
            string transcriptionUrl;
            bool useKeyAuth = !string.IsNullOrEmpty(speechKey);

            if (!string.IsNullOrEmpty(speechEndpoint))
            {
                // Use the configured endpoint directly
                transcriptionUrl = $"{speechEndpoint.TrimEnd('/')}/speechtotext/transcriptions:transcribe?api-version={apiVersion}";
            }
            else
            {
                // Fallback: build URL from region
                transcriptionUrl = $"https://{speechRegion}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version={apiVersion}";
            }

            _logger.LogInformation("[{FunctionName}] Calling Azure Speech Fast Transcription API: {Url}, KeyAuth: {UseKeyAuth}",
                nameof(TranscribeAudio), transcriptionUrl, useKeyAuth);

            using var httpClient = new HttpClient();

            if (useKeyAuth)
            {
                // Use subscription key authentication
                httpClient.DefaultRequestHeaders.Add("Ocp-Apim-Subscription-Key", speechKey);
                _logger.LogInformation("[{FunctionName}] Using subscription key authentication", nameof(TranscribeAudio));
            }
            else
            {
                // Get access token using managed identity
                var credential = new DefaultAzureCredential();
                var tokenRequestContext = new Azure.Core.TokenRequestContext(new[] { "https://cognitiveservices.azure.com/.default" });
                var accessToken = await credential.GetTokenAsync(tokenRequestContext);
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken.Token);
                _logger.LogInformation("[{FunctionName}] Acquired access token via managed identity", nameof(TranscribeAudio));
            }

            using var formContent = new MultipartFormDataContent();

            // Add the audio file (use processed audio data which may have been converted to WAV)
            var audioContent = new ByteArrayContent(processedAudioData);
            audioContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue(mimeType);
            formContent.Add(audioContent, "audio", $"audio.{fileExtension}");

            // Add the definition JSON - support enhanced mode for newer API versions
            object definitionObj;
            if (bool.TryParse(useEnhancedMode, out var enhanced) && enhanced)
            {
                // Enhanced mode definition (API version 2025-10-15+)
                definitionObj = new
                {
                    locales = new[] { speechLocale },
                    enhancedMode = new
                    {
                        enabled = true,
                        task = "transcribe"
                    }
                };
                _logger.LogInformation("[{FunctionName}] Using enhanced transcription mode", nameof(TranscribeAudio));
            }
            else
            {
                // Standard definition
                definitionObj = new
                {
                    locales = new[] { speechLocale }
                };
            }

            var definition = JsonSerializer.Serialize(definitionObj);
            formContent.Add(new StringContent(definition), "definition");

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

    /// <summary>
    /// Attempt to convert audio to WAV using Windows MediaFoundation.
    /// This works for formats that MediaFoundation supports (MP3, M4A, AAC, etc.)
    /// but will fail for WebM/Opus which requires external codec support.
    /// </summary>
    private static byte[] ConvertToWavUsingMediaFoundation(byte[] audioData, string sourceFormat)
    {
        // Write audio data to a temp file (MediaFoundation needs a file path or proper stream)
        var tempInputPath = Path.Combine(Path.GetTempPath(), $"audio_input_{Guid.NewGuid()}.{sourceFormat}");
        var tempOutputPath = Path.Combine(Path.GetTempPath(), $"audio_output_{Guid.NewGuid()}.wav");

        try
        {
            File.WriteAllBytes(tempInputPath, audioData);

            // Use MediaFoundationReader which can handle many formats
            using var reader = new MediaFoundationReader(tempInputPath);

            // Target format: 16kHz mono 16-bit PCM (optimal for speech recognition)
            var targetFormat = new WaveFormat(16000, 16, 1);

            using var resampler = new MediaFoundationResampler(reader, targetFormat);
            resampler.ResamplerQuality = 60; // Highest quality

            WaveFileWriter.CreateWaveFile(tempOutputPath, resampler);

            return File.ReadAllBytes(tempOutputPath);
        }
        finally
        {
            // Clean up temp files
            try { if (File.Exists(tempInputPath)) File.Delete(tempInputPath); } catch { }
            try { if (File.Exists(tempOutputPath)) File.Delete(tempOutputPath); } catch { }
        }
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
