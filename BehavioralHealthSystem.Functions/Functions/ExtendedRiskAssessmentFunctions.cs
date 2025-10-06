using Microsoft.DurableTask.Client;

namespace BehavioralHealthSystem.Functions;

/// <summary>
/// Azure Functions for Extended Risk Assessment with Schizophrenia Evaluation (GPT-5/O3)
/// Provides HTTP endpoints for generating and retrieving comprehensive psychiatric assessments
/// Uses async job pattern to handle long-running GPT-5/O3 calls without timeout issues
/// </summary>
public class ExtendedRiskAssessmentFunctions
{
    private readonly ILogger<ExtendedRiskAssessmentFunctions> _logger;
    private readonly IRiskAssessmentService _riskAssessmentService;
    private readonly ISessionStorageService _sessionStorageService;
    private readonly IExtendedAssessmentJobService _jobService;
    private readonly JsonSerializerOptions _jsonOptions;

    public ExtendedRiskAssessmentFunctions(
        ILogger<ExtendedRiskAssessmentFunctions> logger,
        IRiskAssessmentService riskAssessmentService,
        ISessionStorageService sessionStorageService,
        IExtendedAssessmentJobService jobService)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _riskAssessmentService = riskAssessmentService ?? throw new ArgumentNullException(nameof(riskAssessmentService));
        _sessionStorageService = sessionStorageService ?? throw new ArgumentNullException(nameof(sessionStorageService));
        _jobService = jobService ?? throw new ArgumentNullException(nameof(jobService));
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };
    }

    /// <summary>
    /// Starts an asynchronous extended risk assessment job using GPT-5/O3
    /// POST /api/sessions/{sessionId}/extended-risk-assessment
    /// </summary>
    /// <remarks>
    /// This endpoint immediately returns a job ID for tracking the assessment progress.
    /// The actual processing happens asynchronously in the background to avoid timeout issues.
    /// 
    /// Use the returned job ID to poll for status using GET /api/jobs/{jobId}
    /// </remarks>
    [Function("StartExtendedRiskAssessmentJob")]
    public async Task<HttpResponseData> StartExtendedRiskAssessmentJob(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "sessions/{sessionId}/extended-risk-assessment")] HttpRequestData req,
        [DurableClient] DurableTaskClient durableClient,
        string sessionId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Starting extended risk assessment job for session: {SessionId}", 
                nameof(StartExtendedRiskAssessmentJob), sessionId);

            // Parse request body for selected DSM-5 conditions
            ExtendedRiskAssessmentRequest? requestBody = null;
            try
            {
                var requestBodyText = await new StreamReader(req.Body).ReadToEndAsync();
                if (!string.IsNullOrWhiteSpace(requestBodyText))
                {
                    requestBody = JsonSerializer.Deserialize<ExtendedRiskAssessmentRequest>(requestBodyText, _jsonOptions);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[{FunctionName}] Error parsing request body, will use default schizophrenia assessment", 
                    nameof(StartExtendedRiskAssessmentJob));
            }

            // Validate session exists
            var sessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
            if (sessionData == null)
            {
                _logger.LogWarning("[{FunctionName}] Session not found: {SessionId}", 
                    nameof(StartExtendedRiskAssessmentJob), sessionId);
                
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = $"Session not found: {sessionId}"
                }, _jsonOptions));
                return notFoundResponse;
            }

            // Update session data with selected DSM-5 conditions
            if (requestBody?.SelectedConditions != null && requestBody.SelectedConditions.Count > 0)
            {
                sessionData.DSM5Conditions = requestBody.SelectedConditions;
                await _sessionStorageService.UpdateSessionDataAsync(sessionData);
                _logger.LogInformation("[{FunctionName}] Updated session {SessionId} with {Count} selected DSM-5 conditions: {Conditions}", 
                    nameof(StartExtendedRiskAssessmentJob), sessionId, 
                    requestBody.SelectedConditions.Count, 
                    string.Join(", ", requestBody.SelectedConditions));
            }
            else
            {
                _logger.LogInformation("[{FunctionName}] No DSM-5 conditions specified, will default to schizophrenia for backwards compatibility", 
                    nameof(StartExtendedRiskAssessmentJob));
            }

            // Create a new job
            var jobId = await _jobService.CreateJobAsync(sessionId);
            
            // Start the durable function orchestration
            var instanceId = await durableClient.ScheduleNewOrchestrationInstanceAsync(
                "ExtendedAssessmentOrchestrator",
                new ExtendedAssessmentOrchestrationInput
                {
                    JobId = jobId,
                    SessionId = sessionId,
                    SelectedConditions = requestBody?.SelectedConditions ?? new List<string>()
                });

            _logger.LogInformation("[{FunctionName}] Started orchestration {InstanceId} for job {JobId}, session {SessionId}", 
                nameof(StartExtendedRiskAssessmentJob), instanceId, jobId, sessionId);

            var response = req.CreateResponse(HttpStatusCode.Accepted);
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = true,
                message = "Extended risk assessment job started",
                jobId = jobId,
                instanceId = instanceId,
                sessionId = sessionId,
                statusUrl = $"/api/jobs/{jobId}",
                resultUrl = $"/api/sessions/{sessionId}/extended-risk-assessment",
                estimatedProcessingTime = "30-120 seconds"
            }, _jsonOptions));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error starting extended risk assessment job for session: {SessionId}", 
                nameof(StartExtendedRiskAssessmentJob), sessionId);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = false,
                message = "Error starting extended risk assessment job",
                error = ex.Message
            }, _jsonOptions));
            return errorResponse;
        }
    }

    /// <summary>
    /// Retrieves an existing extended risk assessment for a session
    /// GET /api/sessions/{sessionId}/extended-risk-assessment
    /// </summary>
    /// <remarks>
    /// Returns 200 OK regardless of whether assessment exists:
    /// - If assessment exists: Returns the full assessment data
    /// - If assessment doesn't exist: Returns informational response with hasExtendedAssessment=false
    /// 
    /// This is expected behavior for new sessions - use POST endpoint to generate assessment.
    /// For a simple availability check, consider using GET /api/sessions/{sessionId}/extended-risk-assessment/status
    /// </remarks>
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
                _logger.LogInformation("[{FunctionName}] Extended risk assessment not yet generated for session: {SessionId}", 
                    nameof(GetExtendedRiskAssessment), sessionId);
                
                // Return 200 OK with informational response - this is expected for new sessions
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = true,
                    hasExtendedAssessment = false,
                    message = "Extended risk assessment not yet generated for this session. Use POST endpoint to generate one.",
                    generateUrl = $"/api/sessions/{sessionId}/extended-risk-assessment",
                    statusUrl = $"/api/sessions/{sessionId}/extended-risk-assessment/status"
                }, _jsonOptions));
                return response;
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
    /// Gets the status of an extended assessment job
    /// GET /api/jobs/{jobId}
    /// </summary>
    /// <remarks>
    /// Use this endpoint to poll for job completion status and progress
    /// </remarks>
    [Function("GetExtendedAssessmentJobStatus")]
    public async Task<HttpResponseData> GetExtendedAssessmentJobStatus(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "jobs/{jobId}")] HttpRequestData req,
        string jobId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Getting job status for: {JobId}", 
                nameof(GetExtendedAssessmentJobStatus), jobId);

            var job = await _jobService.GetJobAsync(jobId);
            if (job == null)
            {
                _logger.LogWarning("[{FunctionName}] Job not found: {JobId}", 
                    nameof(GetExtendedAssessmentJobStatus), jobId);
                
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = $"Job not found: {jobId}"
                }, _jsonOptions));
                return notFoundResponse;
            }

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = true,
                job = new
                {
                    jobId = job.JobId,
                    sessionId = job.SessionId,
                    status = job.Status.ToString().ToLowerInvariant(),
                    progressPercentage = job.ProgressPercentage,
                    currentStep = job.CurrentStep,
                    createdAt = job.CreatedAt,
                    startedAt = job.StartedAt,
                    completedAt = job.CompletedAt,
                    processingTimeMs = job.ProcessingTimeMs,
                    elapsedTimeMs = job.ElapsedTime.TotalMilliseconds,
                    isCompleted = job.IsCompleted,
                    isProcessing = job.IsProcessing,
                    errorMessage = job.ErrorMessage,
                    modelUsed = job.ModelUsed,
                    retryCount = job.RetryCount,
                    canRetry = job.CanRetry
                }
            }, _jsonOptions));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting job status for: {JobId}", 
                nameof(GetExtendedAssessmentJobStatus), jobId);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = false,
                message = "Error getting job status",
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

/// <summary>
/// Request body for extended risk assessment with optional DSM-5 condition selection
/// </summary>
public class ExtendedRiskAssessmentRequest
{
    [JsonPropertyName("selectedConditions")]
    public List<string> SelectedConditions { get; set; } = new();
}
