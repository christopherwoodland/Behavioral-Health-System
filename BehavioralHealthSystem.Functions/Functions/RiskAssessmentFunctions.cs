namespace BehavioralHealthSystem.Functions;

/// <summary>
/// Azure Functions for mental health risk assessment using Kintsugi Health API.
/// Provides endpoints for generating and retrieving voice-based depression risk assessments.
/// </summary>
public class RiskAssessmentFunctions
{
    private readonly ILogger<RiskAssessmentFunctions> _logger;
    private readonly IRiskAssessmentService _riskAssessmentService;
    private readonly ISessionStorageService _sessionStorageService;
    private readonly JsonSerializerOptions _jsonOptions;

    /// <summary>
    /// Initializes a new instance of the <see cref="RiskAssessmentFunctions"/> class.
    /// </summary>
    /// <param name="logger">Logger for diagnostics and monitoring.</param>
    /// <param name="riskAssessmentService">Service for generating risk assessments via Kintsugi API.</param>
    /// <param name="sessionStorageService">Service for session data persistence.</param>
    /// <exception cref="ArgumentNullException">Thrown when any parameter is null.</exception>
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

    /// <summary>
    /// Generates a mental health risk assessment for a conversation session.
    /// Analyzes voice data from the session using Kintsugi Health API to assess depression risk.
    /// </summary>
    /// <param name="req">HTTP request data.</param>
    /// <param name="sessionId">The unique session identifier from the route.</param>
    /// <returns>
    /// HTTP 200 (OK) with risk assessment data if successful.
    /// HTTP 404 (Not Found) if session doesn't exist.
    /// HTTP 500 (Internal Server Error) if assessment generation fails.
    /// </returns>
    /// <remarks>
    /// Updates the session data with the generated risk assessment.
    /// Example response includes depression score, severity level, and clinical recommendations.
    /// </remarks>
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
