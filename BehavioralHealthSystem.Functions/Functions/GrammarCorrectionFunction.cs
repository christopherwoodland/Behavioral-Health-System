namespace BehavioralHealthSystem.Functions;

public class GrammarCorrectionFunction
{
    private readonly ILogger<GrammarCorrectionFunction> _logger;
    private readonly IGrammarCorrectionService _grammarCorrectionService;

    public GrammarCorrectionFunction(
        ILogger<GrammarCorrectionFunction> logger,
        IGrammarCorrectionService grammarCorrectionService)
    {
        _logger = logger;
        _grammarCorrectionService = grammarCorrectionService;
    }

    [Function("CorrectGrammar")]
    public async Task<HttpResponseData> CorrectGrammar(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req)
    {
        _logger.LogInformation("[{FunctionName}] Grammar correction request received", nameof(CorrectGrammar));

        try
        {
            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var request = JsonSerializer.Deserialize<GrammarCorrectionRequest>(requestBody, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            if (request == null || string.IsNullOrWhiteSpace(request.Text))
            {
                _logger.LogWarning("[{FunctionName}] Invalid request: text is null or empty", nameof(CorrectGrammar));
                var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                badResponse.Headers.Add("Content-Type", "application/json; charset=utf-8");
                await badResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Text is required" }));
                return badResponse;
            }

            if (request.Text.Length > 500)
            {
                _logger.LogWarning("[{FunctionName}] Text too long: {Length} characters", nameof(CorrectGrammar), request.Text.Length);
                var badResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                badResponse.Headers.Add("Content-Type", "application/json; charset=utf-8");
                await badResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Text must be 500 characters or less" }));
                return badResponse;
            }

            var correctedText = await _grammarCorrectionService.CorrectTextAsync(request.Text);

            if (correctedText == null)
            {
                _logger.LogError("[{FunctionName}] Grammar correction service returned null", nameof(CorrectGrammar));
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                errorResponse.Headers.Add("Content-Type", "application/json; charset=utf-8");
                await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Grammar correction service unavailable" }));
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

            _logger.LogInformation("[{FunctionName}] Grammar correction completed successfully", nameof(CorrectGrammar));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error processing grammar correction request", nameof(CorrectGrammar));
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            errorResponse.Headers.Add("Content-Type", "application/json; charset=utf-8");
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { error = "Internal server error" }));
            return errorResponse;
        }
    }
}

public class GrammarCorrectionRequest
{
    public string Text { get; set; } = string.Empty;
}

public class GrammarCorrectionResponse
{
    public string OriginalText { get; set; } = string.Empty;
    public string CorrectedText { get; set; } = string.Empty;
}