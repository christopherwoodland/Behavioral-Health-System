using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text.Json;
using BehavioralHealthSystem.Services;

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