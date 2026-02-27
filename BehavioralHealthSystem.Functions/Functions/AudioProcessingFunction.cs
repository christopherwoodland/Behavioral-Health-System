using BehavioralHealthSystem.Agents.Interfaces;
using BehavioralHealthSystem.Agents.Models;

namespace BehavioralHealthSystem.Functions;

/// <summary>
/// Azure Function endpoint for the Semantic Kernel audio processing pipeline.
/// Provides a single HTTP trigger that invokes the deterministic 3-step orchestration:
///   1. Fetch audio from blob storage
///   2. Convert and clean via ffmpeg
///   3. Run DAM model prediction
///
/// This endpoint can be called by an agent as a single tool.
/// </summary>
public class AudioProcessingFunction
{
    private readonly IAudioProcessingOrchestrator _orchestrator;
    private readonly ILogger<AudioProcessingFunction> _logger;
    private readonly JsonSerializerOptions _jsonOptions;

    public AudioProcessingFunction(
        IAudioProcessingOrchestrator orchestrator,
        ILogger<AudioProcessingFunction> logger)
    {
        _orchestrator = orchestrator ?? throw new ArgumentNullException(nameof(orchestrator));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _jsonOptions = JsonSerializerOptionsFactory.Default;
    }

    /// <summary>
    /// Processes an audio file through the complete pipeline: fetch → convert → predict.
    ///
    /// Request body:
    /// {
    ///   "userId": "user123",          // Required
    ///   "sessionId": "session456",    // Required
    ///   "fileName": "recording.wav"   // Optional — if omitted, uses most recent for session
    /// }
    /// </summary>
    [Function("ProcessAudio")]
    public async Task<HttpResponseData> ProcessAudio(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "process-audio")] HttpRequestData req)
    {
        try
        {
            var requestBody = await req.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(requestBody))
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "Request body is required.");
            }

            var request = JsonSerializer.Deserialize<AudioProcessingRequest>(requestBody, _jsonOptions);
            if (request == null)
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "Invalid JSON format.");
            }

            if (string.IsNullOrWhiteSpace(request.UserId))
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "userId is required.");
            }

            if (string.IsNullOrWhiteSpace(request.SessionId))
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "sessionId is required.");
            }

            _logger.LogInformation(
                "[{FunctionName}] Processing audio. UserId={UserId}, SessionId={SessionId}, FileName={FileName}",
                nameof(ProcessAudio), request.UserId, request.SessionId, request.FileName ?? "(latest)");

            var result = await _orchestrator.ProcessAudioAsync(
                request.UserId,
                request.SessionId,
                request.FileName);

            var statusCode = result.Success ? HttpStatusCode.OK : HttpStatusCode.InternalServerError;
            var response = req.CreateResponse(statusCode);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");
            await response.WriteStringAsync(JsonSerializer.Serialize(result, _jsonOptions));
            return response;
        }
        catch (FileNotFoundException ex)
        {
            _logger.LogWarning(ex, "[{FunctionName}] Audio file not found.", nameof(ProcessAudio));
            return await CreateErrorResponse(req, HttpStatusCode.NotFound, ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Unexpected error processing audio.", nameof(ProcessAudio));
            return await CreateErrorResponse(req, HttpStatusCode.InternalServerError,
                $"Unexpected error: {ex.Message}");
        }
    }

    private async Task<HttpResponseData> CreateErrorResponse(
        HttpRequestData req, HttpStatusCode statusCode, string message)
    {
        var response = req.CreateResponse(statusCode);
        response.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await response.WriteStringAsync(JsonSerializer.Serialize(new
        {
            success = false,
            message
        }, _jsonOptions));
        return response;
    }
}

/// <summary>
/// Request model for the audio processing endpoint.
/// </summary>
public class AudioProcessingRequest
{
    [JsonPropertyName("userId")]
    public string UserId { get; set; } = string.Empty;

    [JsonPropertyName("sessionId")]
    public string SessionId { get; set; } = string.Empty;

    [JsonPropertyName("fileName")]
    public string? FileName { get; set; }
}
