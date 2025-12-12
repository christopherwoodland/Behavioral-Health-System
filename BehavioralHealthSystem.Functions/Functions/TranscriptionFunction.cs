using Azure;
using Azure.AI.OpenAI;
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
    /// Transcribe audio using Azure OpenAI gpt-4o-transcribe model
    /// POST /api/transcribe-audio
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

            // Get configuration from environment
            var endpoint = Environment.GetEnvironmentVariable("TRANSCRIPTION_OPENAI_ENDPOINT")
                ?? Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
            var apiKey = Environment.GetEnvironmentVariable("TRANSCRIPTION_OPENAI_API_KEY")
                ?? Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");
            var deploymentName = Environment.GetEnvironmentVariable("TRANSCRIPTION_OPENAI_DEPLOYMENT") ?? "gpt-4o-transcribe";
            var apiVersion = Environment.GetEnvironmentVariable("TRANSCRIPTION_OPENAI_API_VERSION") ?? "2025-03-01-preview";

            if (string.IsNullOrEmpty(endpoint))
            {
                _logger.LogError("[{FunctionName}] Transcription endpoint not configured", nameof(TranscribeAudio));
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Transcription service not configured" }));
                return errorResponse;
            }

            // Build the transcription URL
            var transcriptionUrl = $"{endpoint.TrimEnd('/')}/openai/deployments/{deploymentName}/audio/transcriptions?api-version={apiVersion}";

            using var httpClient = new HttpClient();
            using var formContent = new MultipartFormDataContent();

            // Add the audio file
            var audioContent = new ByteArrayContent(audioData);
            audioContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("audio/wav");
            formContent.Add(audioContent, "file", "audio.wav");

            // Add model parameter
            formContent.Add(new StringContent(deploymentName), "model");
            formContent.Add(new StringContent("json"), "response_format");
            formContent.Add(new StringContent("en"), "language");

            // Use managed identity if no API key, otherwise use API key
            if (string.IsNullOrEmpty(apiKey))
            {
                var credential = new DefaultAzureCredential();
                var tokenResult = await credential.GetTokenAsync(
                    new Azure.Core.TokenRequestContext(new[] { "https://cognitiveservices.azure.com/.default" }));
                httpClient.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokenResult.Token);
            }
            else
            {
                httpClient.DefaultRequestHeaders.Add("api-key", apiKey);
            }

            _logger.LogInformation("[{FunctionName}] Calling Azure OpenAI transcription API", nameof(TranscribeAudio));

            var transcriptionResponse = await httpClient.PostAsync(transcriptionUrl, formContent);

            if (!transcriptionResponse.IsSuccessStatusCode)
            {
                var errorText = await transcriptionResponse.Content.ReadAsStringAsync();
                _logger.LogError("[{FunctionName}] Transcription API error: {StatusCode} - {Error}",
                    nameof(TranscribeAudio), transcriptionResponse.StatusCode, errorText);

                var errorResponse = req.CreateResponse(HttpStatusCode.BadGateway);
                await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new {
                    error = "Transcription failed",
                    details = errorText
                }));
                return errorResponse;
            }

            var resultJson = await transcriptionResponse.Content.ReadAsStringAsync();
            var transcriptionResult = JsonSerializer.Deserialize<JsonElement>(resultJson);

            var text = transcriptionResult.TryGetProperty("text", out var textProp) ? textProp.GetString() : "";
            var duration = transcriptionResult.TryGetProperty("duration", out var durationProp) ? durationProp.GetDouble() : 0;
            var language = transcriptionResult.TryGetProperty("language", out var langProp) ? langProp.GetString() : "en";

            _logger.LogInformation("[{FunctionName}] Transcription successful: {TextLength} characters",
                nameof(TranscribeAudio), text?.Length ?? 0);

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");

            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                text = text,
                confidence = 1.0,
                duration = duration,
                language = language
            }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error during transcription", nameof(TranscribeAudio));
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Internal server error" }));
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
