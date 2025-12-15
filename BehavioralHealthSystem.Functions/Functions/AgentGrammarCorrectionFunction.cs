using System.Net;
using System.Text.Json;
using BehavioralHealthSystem.Agents.Interfaces;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace BehavioralHealthSystem.Functions;

/// <summary>
/// Azure Function for grammar correction using the Microsoft.Agents SDK.
/// This function uses the ChatClientAgent pattern for improved agent capabilities.
/// </summary>
public class AgentGrammarCorrectionFunction
{
    private readonly ILogger<AgentGrammarCorrectionFunction> _logger;
    private readonly IGrammarCorrectionAgent _grammarCorrectionAgent;

    public AgentGrammarCorrectionFunction(
        ILogger<AgentGrammarCorrectionFunction> logger,
        IGrammarCorrectionAgent grammarCorrectionAgent)
    {
        _logger = logger;
        _grammarCorrectionAgent = grammarCorrectionAgent;
    }

    /// <summary>
    /// Corrects grammar in the provided text using the Microsoft.Agents SDK.
    /// </summary>
    /// <param name="req">The HTTP request containing the text to correct.</param>
    /// <returns>The corrected text response.</returns>
    [Function("AgentCorrectGrammar")]
    public async Task<HttpResponseData> CorrectGrammar(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "agent/grammar/correct")] HttpRequestData req)
    {
        _logger.LogInformation("[{FunctionName}] Agent-based grammar correction request received", nameof(CorrectGrammar));

        try
        {
            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var request = JsonSerializer.Deserialize<AgentGrammarRequest>(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            if (request == null || string.IsNullOrWhiteSpace(request.Text))
            {
                _logger.LogWarning("[{FunctionName}] Invalid request: text is null or empty", nameof(CorrectGrammar));
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "Text is required");
            }

            if (request.Text.Length > 2000)
            {
                _logger.LogWarning("[{FunctionName}] Text too long: {Length} characters", nameof(CorrectGrammar), request.Text.Length);
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "Text must be 2000 characters or less");
            }

            // Use the agent to correct the text
            var result = await _grammarCorrectionAgent.CorrectGrammarAsync(
                request.Text,
                request.IncludeExplanations);

            if (!result.Success)
            {
                _logger.LogError("[{FunctionName}] Grammar correction agent failed: {Error}", nameof(CorrectGrammar), result.ErrorMessage);
                return await CreateErrorResponse(req, HttpStatusCode.InternalServerError, result.ErrorMessage ?? "Grammar correction agent failed");
            }

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");

            var responseData = new AgentGrammarResponse
            {
                OriginalText = request.Text,
                CorrectedText = result.CorrectedText,
                Explanations = result.Explanations,
                IncludedExplanations = request.IncludeExplanations,
                AgentName = "GrammarCorrectionAgent",
                CorrectionCount = result.CorrectionCount
            };

            await response.WriteStringAsync(JsonSerializer.Serialize(responseData, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true
            }));

            _logger.LogInformation("[{FunctionName}] Agent-based grammar correction completed successfully", nameof(CorrectGrammar));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error processing agent grammar correction request", nameof(CorrectGrammar));
            return await CreateErrorResponse(req, HttpStatusCode.InternalServerError, "Internal server error");
        }
    }

    /// <summary>
    /// Streams the grammar correction response using the Microsoft.Agents SDK.
    /// </summary>
    /// <param name="req">The HTTP request containing the text to correct.</param>
    /// <returns>A streamed response with corrections.</returns>
    [Function("AgentCorrectGrammarStream")]
    public async Task<HttpResponseData> CorrectGrammarStream(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "agent/grammar/correct/stream")] HttpRequestData req)
    {
        _logger.LogInformation("[{FunctionName}] Agent-based streaming grammar correction request received", nameof(CorrectGrammarStream));

        try
        {
            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var request = JsonSerializer.Deserialize<AgentGrammarRequest>(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            if (request == null || string.IsNullOrWhiteSpace(request.Text))
            {
                _logger.LogWarning("[{FunctionName}] Invalid request: text is null or empty", nameof(CorrectGrammarStream));
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "Text is required");
            }

            if (request.Text.Length > 2000)
            {
                _logger.LogWarning("[{FunctionName}] Text too long: {Length} characters", nameof(CorrectGrammarStream), request.Text.Length);
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "Text must be 2000 characters or less");
            }

            // Set up SSE response
            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "text/event-stream");
            response.Headers.Add("Cache-Control", "no-cache");
            response.Headers.Add("Connection", "keep-alive");

            using var stream = new MemoryStream();
            using var writer = new StreamWriter(stream, leaveOpen: true);

            await foreach (var chunk in _grammarCorrectionAgent.CorrectGrammarStreamingAsync(request.Text, request.IncludeExplanations))
            {
                await writer.WriteAsync($"data: {JsonSerializer.Serialize(new { chunk })}\n\n");
                await writer.FlushAsync();
            }

            // Write completion event
            await writer.WriteAsync("data: [DONE]\n\n");
            await writer.FlushAsync();

            stream.Position = 0;
            response.Body = stream;

            _logger.LogInformation("[{FunctionName}] Agent-based streaming grammar correction completed", nameof(CorrectGrammarStream));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error processing streaming grammar correction request", nameof(CorrectGrammarStream));
            return await CreateErrorResponse(req, HttpStatusCode.InternalServerError, "Internal server error");
        }
    }

    /// <summary>
    /// Gets information about the grammar correction agent.
    /// </summary>
    /// <param name="req">The HTTP request.</param>
    /// <returns>Agent information.</returns>
    [Function("AgentGrammarInfo")]
    public async Task<HttpResponseData> GetAgentInfo(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "agent/grammar/info")] HttpRequestData req)
    {
        _logger.LogInformation("[{FunctionName}] Agent info request received", nameof(GetAgentInfo));

        try
        {
            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");

            var info = new AgentInfoResponse
            {
                AgentName = "GrammarCorrectionAgent",
                Description = "Corrects grammar and spelling while preserving the original meaning and voice.",
                Capabilities = new[]
                {
                    "Basic grammar correction",
                    "Spelling correction",
                    "Corrections with explanations",
                    "Streaming responses"
                },
                Endpoints = new[]
                {
                    "POST /api/agent/grammar/correct - Correct grammar in text",
                    "POST /api/agent/grammar/correct/stream - Stream corrections",
                    "GET /api/agent/grammar/info - Get agent information"
                }
            };

            await response.WriteStringAsync(JsonSerializer.Serialize(info, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true
            }));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting agent info", nameof(GetAgentInfo));
            return await CreateErrorResponse(req, HttpStatusCode.InternalServerError, "Internal server error");
        }
    }

    private static async Task<HttpResponseData> CreateErrorResponse(HttpRequestData req, HttpStatusCode statusCode, string error)
    {
        var response = req.CreateResponse(statusCode);
        response.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await response.WriteStringAsync(JsonSerializer.Serialize(new { error }));
        return response;
    }
}

/// <summary>
/// Request model for agent-based grammar correction.
/// </summary>
public class AgentGrammarRequest
{
    /// <summary>
    /// The text to correct.
    /// </summary>
    public string Text { get; set; } = string.Empty;

    /// <summary>
    /// Whether to include explanations for the corrections made.
    /// </summary>
    public bool IncludeExplanations { get; set; } = false;
}

/// <summary>
/// Response model for agent-based grammar correction.
/// </summary>
public class AgentGrammarResponse
{
    /// <summary>
    /// The original text that was submitted.
    /// </summary>
    public string OriginalText { get; set; } = string.Empty;

    /// <summary>
    /// The corrected text.
    /// </summary>
    public string CorrectedText { get; set; } = string.Empty;

    /// <summary>
    /// Explanations of the corrections made (if requested).
    /// </summary>
    public string? Explanations { get; set; }

    /// <summary>
    /// Whether explanations were included in the response.
    /// </summary>
    public bool IncludedExplanations { get; set; }

    /// <summary>
    /// The name of the agent that processed the request.
    /// </summary>
    public string AgentName { get; set; } = string.Empty;

    /// <summary>
    /// The number of corrections made.
    /// </summary>
    public int CorrectionCount { get; set; }
}

/// <summary>
/// Response model for agent information.
/// </summary>
public class AgentInfoResponse
{
    /// <summary>
    /// The name of the agent.
    /// </summary>
    public string AgentName { get; set; } = string.Empty;

    /// <summary>
    /// Description of what the agent does.
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// List of agent capabilities.
    /// </summary>
    public string[] Capabilities { get; set; } = Array.Empty<string>();

    /// <summary>
    /// Available API endpoints for this agent.
    /// </summary>
    public string[] Endpoints { get; set; } = Array.Empty<string>();
}
