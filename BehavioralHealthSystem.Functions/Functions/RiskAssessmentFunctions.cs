namespace BehavioralHealthSystem.Functions;

public class RiskAssessmentFunctions
{
    private readonly ILogger<RiskAssessmentFunctions> _logger;
    private readonly IRiskAssessmentService _riskAssessmentService;
    private readonly ISessionStorageService _sessionStorageService;
    private readonly JsonSerializerOptions _jsonOptions;

    public RiskAssessmentFunctions(
        ILogger<RiskAssessmentFunctions> logger,
        IRiskAssessmentService riskAssessmentService,
        ISessionStorageService sessionStorageService)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _riskAssessmentService = riskAssessmentService ?? throw new ArgumentNullException(nameof(riskAssessmentService));
        _sessionStorageService = sessionStorageService ?? throw new ArgumentNullException(nameof(sessionStorageService));
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };
    }

    [Function("GenerateRiskAssessment")]
    public async Task<HttpResponseData> GenerateRiskAssessment(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "sessions/{sessionId}/risk-assessment")] HttpRequestData req,
        string sessionId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Generating risk assessment for session: {SessionId}", 
                nameof(GenerateRiskAssessment), sessionId);

            var sessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
            if (sessionData == null)
            {
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = $"Session not found: {sessionId}"
                }, _jsonOptions));
                return notFoundResponse;
            }

            var riskAssessment = await _riskAssessmentService.GenerateRiskAssessmentAsync(sessionData);
            
            if (riskAssessment != null)
            {
                // Update session with the risk assessment
                sessionData.RiskAssessment = riskAssessment;
                sessionData.UpdatedAt = DateTime.UtcNow.ToString("O");
                await _sessionStorageService.UpdateSessionDataAsync(sessionData);

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = true,
                    message = "Risk assessment generated successfully",
                    riskAssessment = riskAssessment
                }, _jsonOptions));
                return response;
            }
            else
            {
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = "Failed to generate risk assessment"
                }, _jsonOptions));
                return errorResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error generating risk assessment for session: {SessionId}", 
                nameof(GenerateRiskAssessment), sessionId);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = false,
                message = "Error generating risk assessment",
                error = ex.Message
            }, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("GetRiskAssessment")]
    public async Task<HttpResponseData> GetRiskAssessment(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "sessions/{sessionId}/risk-assessment")] HttpRequestData req,
        string sessionId)
    {
        try
        {
                    _logger.LogInformation("[{FunctionName}] Starting risk assessment for session: {SessionId}", 
            nameof(GetRiskAssessment), sessionId);

            var sessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
            if (sessionData == null)
            {
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = $"Session not found: {sessionId}"
                }, _jsonOptions));
                return notFoundResponse;
            }

            if (sessionData.RiskAssessment != null)
            {
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = true,
                    riskAssessment = sessionData.RiskAssessment
                }, _jsonOptions));
                return response;
            }
            else
            {
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = "Risk assessment not found for this session"
                }, _jsonOptions));
                return notFoundResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting risk assessment for session: {SessionId}", 
                nameof(GetRiskAssessment), sessionId);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = false,
                message = "Error getting risk assessment",
                error = ex.Message
            }, _jsonOptions));
            return errorResponse;
        }
    }
}
