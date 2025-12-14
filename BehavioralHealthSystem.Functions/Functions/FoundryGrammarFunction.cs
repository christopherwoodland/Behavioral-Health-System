using System.Net;
using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using BehavioralHealthSystem.Services;
using BehavioralHealthSystem.Models;

namespace BehavioralHealthSystem.Functions;

/// <summary>
/// Azure Function for grammar correction using Foundry agents
/// </summary>
public class FoundryGrammarFunction
{
    private readonly ILogger<FoundryGrammarFunction> _logger;
    private readonly IFoundryGrammarService _foundryGrammarService;

    public FoundryGrammarFunction(
        ILogger<FoundryGrammarFunction> logger,
        IFoundryGrammarService foundryGrammarService)
    {
        _logger = logger;
        _foundryGrammarService = foundryGrammarService;
    }

    /// <summary>
    /// Correct grammar using Azure AI Foundry agent
    /// POST /api/correct-grammar-agent
    /// </summary>
    [Function("correct-grammar-agent")]
    public async Task<HttpResponseData> CorrectGrammarAgent(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req)
    {
        _logger.LogInformation("[{FunctionName}] Foundry grammar agent correction request received", nameof(CorrectGrammarAgent));

        try
        {
            // Check if service is available
            if (!_foundryGrammarService.IsAvailable())
            {
                _logger.LogWarning("[{FunctionName}] Foundry grammar service is not available", nameof(CorrectGrammarAgent));
                var unavailableResponse = req.CreateResponse(HttpStatusCode.ServiceUnavailable);
                unavailableResponse.Headers.Add("Content-Type", "application/json; charset=utf-8");
                await unavailableResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Foundry grammar service is not configured or disabled" }));
                return unavailableResponse;
            }

            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var request = JsonSerializer.Deserialize<GrammarCorrectionRequest>(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            if (request == null || string.IsNullOrWhiteSpace(request.Text))
            {
                _logger.LogWarning("[{FunctionName}] Invalid request: text is null or empty", nameof(CorrectGrammarAgent));
                var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                badResponse.Headers.Add("Content-Type", "application/json; charset=utf-8");
                await badResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Text is required" }));
                return badResponse;
            }

            if (request.Text.Length > 500)
            {
                _logger.LogWarning("[{FunctionName}] Text too long: {Length} characters", nameof(CorrectGrammarAgent), request.Text.Length);
                var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                badResponse.Headers.Add("Content-Type", "application/json; charset=utf-8");
                await badResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Text must be 500 characters or less" }));
                return badResponse;
            }

            var correctedText = await _foundryGrammarService.CorrectGrammarAsync(request.Text);

            if (correctedText == null)
            {
                _logger.LogError("[{FunctionName}] Foundry grammar agent returned null", nameof(CorrectGrammarAgent));
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                errorResponse.Headers.Add("Content-Type", "application/json; charset=utf-8");
                await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Grammar correction agent unavailable" }));
                return errorResponse;
            }

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");

            var responseData = new GrammarCorrectionResponse
            {
                OriginalText = request.Text,
                CorrectedText = correctedText
            };

            await response.WriteStringAsync(JsonSerializer.Serialize(responseData, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            }));

            _logger.LogInformation("[{FunctionName}] Grammar correction via Foundry agent completed successfully", nameof(CorrectGrammarAgent));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error processing Foundry grammar correction request", nameof(CorrectGrammarAgent));
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            errorResponse.Headers.Add("Content-Type", "application/json; charset=utf-8");
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "An unexpected error occurred while correcting grammar" }));
            return errorResponse;
        }
    }
}
