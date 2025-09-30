namespace BehavioralHealthSystem.Functions;

/// <summary>
/// Azure Functions for Extended Risk Assessment with Schizophrenia Evaluation (GPT-5/O3)
/// Provides HTTP endpoints for generating and retrieving comprehensive psychiatric assessments
/// </summary>
public class ExtendedRiskAssessmentFunctions
{
    private readonly ILogger<ExtendedRiskAssessmentFunctions> _logger;
    private readonly IRiskAssessmentService _riskAssessmentService;
    private readonly ISessionStorageService _sessionStorageService;
    private readonly JsonSerializerOptions _jsonOptions;

    public ExtendedRiskAssessmentFunctions(
        ILogger<ExtendedRiskAssessmentFunctions> logger,
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
    /// Generates an extended risk assessment with schizophrenia evaluation using GPT-5/O3
    /// POST /api/sessions/{sessionId}/extended-risk-assessment
    /// </summary>
    /// <remarks>
    /// This endpoint triggers an asynchronous extended assessment that includes:
    /// - Comprehensive risk evaluation
    /// - DSM-5 compliant schizophrenia assessment (Criteria A, B, C)
    /// - Functional impairment analysis
    /// - Differential diagnosis considerations
    /// 
    /// Note: This operation can take 30-120 seconds due to GPT-5/O3 processing time
    /// </remarks>
    [Function("GenerateExtendedRiskAssessment")]
    public async Task<HttpResponseData> GenerateExtendedRiskAssessment(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "sessions/{sessionId}/extended-risk-assessment")] HttpRequestData req,
        string sessionId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Starting extended risk assessment generation for session: {SessionId}", 
                nameof(GenerateExtendedRiskAssessment), sessionId);

            // Validate session exists
            var sessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
            if (sessionData == null)
            {
                _logger.LogWarning("[{FunctionName}] Session not found: {SessionId}", 
                    nameof(GenerateExtendedRiskAssessment), sessionId);
                
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = $"Session not found: {sessionId}"
                }, _jsonOptions));
                return notFoundResponse;
            }

            // Check if extended assessment already exists
            if (sessionData.ExtendedRiskAssessment != null)
            {
                _logger.LogInformation("[{FunctionName}] Extended risk assessment already exists for session: {SessionId}", 
                    nameof(GenerateExtendedRiskAssessment), sessionId);
                
                var existingResponse = req.CreateResponse(HttpStatusCode.OK);
                await existingResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = true,
                    message = "Extended risk assessment already exists",
                    extendedRiskAssessment = sessionData.ExtendedRiskAssessment,
                    cached = true
                }, _jsonOptions));
                return existingResponse;
            }

            // Generate extended risk assessment (this can take 30-120 seconds)
            var startTime = DateTime.UtcNow;
            var extendedRiskAssessment = await _riskAssessmentService.GenerateExtendedRiskAssessmentAsync(sessionData);
            var elapsedSeconds = (DateTime.UtcNow - startTime).TotalSeconds;
            
            if (extendedRiskAssessment != null)
            {
                // Update session with the extended risk assessment
                sessionData.ExtendedRiskAssessment = extendedRiskAssessment;
                sessionData.UpdatedAt = DateTime.UtcNow.ToString("O");
                
                var updateSuccess = await _sessionStorageService.UpdateSessionDataAsync(sessionData);
                
                if (updateSuccess)
                {
                    _logger.LogInformation("[{FunctionName}] Extended risk assessment generated and saved successfully for session: {SessionId} in {ElapsedSeconds}s", 
                        nameof(GenerateExtendedRiskAssessment), sessionId, elapsedSeconds);

                    var response = req.CreateResponse(HttpStatusCode.OK);
                    await response.WriteStringAsync(JsonSerializer.Serialize(new
                    {
                        success = true,
                        message = "Extended risk assessment generated successfully",
                        extendedRiskAssessment = extendedRiskAssessment,
                        processingTimeSeconds = elapsedSeconds,
                        cached = false
                    }, _jsonOptions));
                    return response;
                }
                else
                {
                    _logger.LogError("[{FunctionName}] Failed to update session {SessionId} with extended risk assessment", 
                        nameof(GenerateExtendedRiskAssessment), sessionId);
                    
                    var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                    await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
                    {
                        success = false,
                        message = "Extended risk assessment generated but failed to save to session"
                    }, _jsonOptions));
                    return errorResponse;
                }
            }
            else
            {
                _logger.LogError("[{FunctionName}] Failed to generate extended risk assessment for session: {SessionId}", 
                    nameof(GenerateExtendedRiskAssessment), sessionId);
                
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = "Failed to generate extended risk assessment. This may be due to Azure OpenAI configuration, timeout, or model availability."
                }, _jsonOptions));
                return errorResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error generating extended risk assessment for session: {SessionId}", 
                nameof(GenerateExtendedRiskAssessment), sessionId);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = false,
                message = "Error generating extended risk assessment",
                error = ex.Message
            }, _jsonOptions));
            return errorResponse;
        }
    }

    /// <summary>
    /// Retrieves an existing extended risk assessment for a session
    /// GET /api/sessions/{sessionId}/extended-risk-assessment
    /// </summary>
    [Function("GetExtendedRiskAssessment")]
    public async Task<HttpResponseData> GetExtendedRiskAssessment(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "sessions/{sessionId}/extended-risk-assessment")] HttpRequestData req,
        string sessionId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Retrieving extended risk assessment for session: {SessionId}", 
                nameof(GetExtendedRiskAssessment), sessionId);

            var sessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
            if (sessionData == null)
            {
                _logger.LogWarning("[{FunctionName}] Session not found: {SessionId}", 
                    nameof(GetExtendedRiskAssessment), sessionId);
                
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = $"Session not found: {sessionId}"
                }, _jsonOptions));
                return notFoundResponse;
            }

            if (sessionData.ExtendedRiskAssessment != null)
            {
                _logger.LogInformation("[{FunctionName}] Extended risk assessment found for session: {SessionId}", 
                    nameof(GetExtendedRiskAssessment), sessionId);
                
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = true,
                    extendedRiskAssessment = sessionData.ExtendedRiskAssessment
                }, _jsonOptions));
                return response;
            }
            else
            {
                _logger.LogInformation("[{FunctionName}] Extended risk assessment not found for session: {SessionId}", 
                    nameof(GetExtendedRiskAssessment), sessionId);
                
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = "Extended risk assessment not found for this session. Generate one first using POST endpoint."
                }, _jsonOptions));
                return notFoundResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting extended risk assessment for session: {SessionId}", 
                nameof(GetExtendedRiskAssessment), sessionId);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = false,
                message = "Error getting extended risk assessment",
                error = ex.Message
            }, _jsonOptions));
            return errorResponse;
        }
    }

    /// <summary>
    /// Deletes an extended risk assessment from a session
    /// DELETE /api/sessions/{sessionId}/extended-risk-assessment
    /// </summary>
    /// <remarks>
    /// This allows regeneration of an extended assessment if needed
    /// </remarks>
    [Function("DeleteExtendedRiskAssessment")]
    public async Task<HttpResponseData> DeleteExtendedRiskAssessment(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "sessions/{sessionId}/extended-risk-assessment")] HttpRequestData req,
        string sessionId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Deleting extended risk assessment for session: {SessionId}", 
                nameof(DeleteExtendedRiskAssessment), sessionId);

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

            if (sessionData.ExtendedRiskAssessment != null)
            {
                sessionData.ExtendedRiskAssessment = null;
                sessionData.UpdatedAt = DateTime.UtcNow.ToString("O");
                
                var updateSuccess = await _sessionStorageService.UpdateSessionDataAsync(sessionData);
                
                if (updateSuccess)
                {
                    _logger.LogInformation("[{FunctionName}] Extended risk assessment deleted for session: {SessionId}", 
                        nameof(DeleteExtendedRiskAssessment), sessionId);
                    
                    var response = req.CreateResponse(HttpStatusCode.OK);
                    await response.WriteStringAsync(JsonSerializer.Serialize(new
                    {
                        success = true,
                        message = "Extended risk assessment deleted successfully"
                    }, _jsonOptions));
                    return response;
                }
            }

            var noContentResponse = req.CreateResponse(HttpStatusCode.NoContent);
            return noContentResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error deleting extended risk assessment for session: {SessionId}", 
                nameof(DeleteExtendedRiskAssessment), sessionId);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = false,
                message = "Error deleting extended risk assessment",
                error = ex.Message
            }, _jsonOptions));
            return errorResponse;
        }
    }

    /// <summary>
    /// Gets the status/availability of extended risk assessment for a session
    /// GET /api/sessions/{sessionId}/extended-risk-assessment/status
    /// </summary>
    /// <remarks>
    /// Useful for checking if an assessment exists before attempting to generate or retrieve it
    /// </remarks>
    [Function("GetExtendedRiskAssessmentStatus")]
    public async Task<HttpResponseData> GetExtendedRiskAssessmentStatus(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "sessions/{sessionId}/extended-risk-assessment/status")] HttpRequestData req,
        string sessionId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Checking extended risk assessment status for session: {SessionId}", 
                nameof(GetExtendedRiskAssessmentStatus), sessionId);

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

            var hasExtendedAssessment = sessionData.ExtendedRiskAssessment != null;
            var hasStandardAssessment = sessionData.RiskAssessment != null;
            var hasTranscription = !string.IsNullOrEmpty(sessionData.Transcription);
            var hasPrediction = sessionData.Prediction != null;

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = true,
                sessionId = sessionId,
                hasExtendedAssessment = hasExtendedAssessment,
                hasStandardAssessment = hasStandardAssessment,
                hasTranscription = hasTranscription,
                hasPrediction = hasPrediction,
                generatedAt = sessionData.ExtendedRiskAssessment?.GeneratedAt,
                processingTimeMs = sessionData.ExtendedRiskAssessment?.ProcessingTimeMs,
                overallLikelihood = sessionData.ExtendedRiskAssessment?.SchizophreniaAssessment?.OverallLikelihood,
                canGenerate = hasPrediction // Can generate if we have at least prediction data
            }, _jsonOptions));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error checking extended risk assessment status for session: {SessionId}", 
                nameof(GetExtendedRiskAssessmentStatus), sessionId);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = false,
                message = "Error checking extended risk assessment status",
                error = ex.Message
            }, _jsonOptions));
            return errorResponse;
        }
    }
}
