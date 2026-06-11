namespace BehavioralHealthSystem.Functions;

/// <summary>
/// Activity functions for extended assessment orchestration
/// These functions perform the actual work steps in the background processing workflow
/// </summary>
public class ExtendedAssessmentActivities
{
    private readonly ILogger<ExtendedAssessmentActivities> _logger;
    private readonly IRiskAssessmentService _riskAssessmentService;
    private readonly ISessionStorageService _sessionStorageService;
    private readonly IExtendedAssessmentJobService _jobService;
    private readonly ExtendedAssessmentOpenAIOptions _extendedOpenAIOptions;

    public ExtendedAssessmentActivities(
        ILogger<ExtendedAssessmentActivities> logger,
        IRiskAssessmentService riskAssessmentService,
        ISessionStorageService sessionStorageService,
        IExtendedAssessmentJobService jobService,
        IOptions<ExtendedAssessmentOpenAIOptions> extendedOpenAIOptions)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _riskAssessmentService = riskAssessmentService ?? throw new ArgumentNullException(nameof(riskAssessmentService));
        _sessionStorageService = sessionStorageService ?? throw new ArgumentNullException(nameof(sessionStorageService));
        _jobService = jobService ?? throw new ArgumentNullException(nameof(jobService));
        _extendedOpenAIOptions = extendedOpenAIOptions.Value;
    }

    /// <summary>
    /// Updates job status and progress
    /// </summary>
    [Function("UpdateJobStatus")]
    public async Task<bool> UpdateJobStatus([ActivityTrigger] JobStatusUpdate update)
    {
        _logger.LogInformation("[{ActivityName}] Updating job {JobId} status to {Status} ({Progress}%): {Step}",
            nameof(UpdateJobStatus), update.JobId, update.Status, update.ProgressPercentage, update.CurrentStep ?? "");

        return await _jobService.UpdateJobStatusAsync(update.JobId, update.Status, update.ProgressPercentage, update.CurrentStep);
    }

    /// <summary>
    /// Validates that the session exists and doesn't already have an extended assessment
    /// </summary>
    [Function("ValidateSessionForAssessment")]
    public async Task<bool> ValidateSessionForAssessment([ActivityTrigger] SessionValidationInput input)
    {
        string jobId = input.JobId;
        string sessionId = input.SessionId;

        try
        {
            _logger.LogInformation("[{ActivityName}] Validating session {SessionId} for job {JobId}",
                nameof(ValidateSessionForAssessment), sessionId, jobId);

            var sessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
            if (sessionData == null)
            {
                _logger.LogWarning("[{ActivityName}] Session {SessionId} not found for job {JobId}",
                    nameof(ValidateSessionForAssessment), sessionId, jobId);
                return false;
            }

            // Allow regeneration by not checking if extended assessment already exists
            // The frontend can delete existing assessment before requesting new one

            _logger.LogInformation("[{ActivityName}] Session {SessionId} validation successful for job {JobId}",
                nameof(ValidateSessionForAssessment), sessionId, jobId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ActivityName}] Error validating session {SessionId} for job {JobId}",
                nameof(ValidateSessionForAssessment), sessionId, jobId);
            return false;
        }
    }

    /// <summary>
    /// Generates the extended assessment using the risk assessment service
    /// This is the long-running operation that calls GPT-5/O3
    /// </summary>
    [Function("GenerateExtendedAssessmentActivity")]
    public async Task<ExtendedRiskAssessment?> GenerateExtendedAssessmentActivity([ActivityTrigger] AssessmentGenerationInput input)
    {
        string jobId = input.JobId;
        string sessionId = input.SessionId;

        try
        {
            _logger.LogInformation("[{ActivityName}] Starting extended assessment generation for job {JobId}, session {SessionId}",
                nameof(GenerateExtendedAssessmentActivity), jobId, sessionId);

            // Update progress to show we're loading session data
            await _jobService.UpdateJobStatusAsync(jobId, ExtendedAssessmentJobStatus.Processing, 35,
                "Loading session data and clinical information...");

            var sessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
            if (sessionData == null)
            {
                _logger.LogError("[{ActivityName}] Session {SessionId} not found during assessment generation for job {JobId}",
                    nameof(GenerateExtendedAssessmentActivity), sessionId, jobId);
                return null;
            }

            // Detect air-gap mode and inform user about condition limits
            bool isAirGap = _extendedOpenAIOptions.Enabled
                && !string.IsNullOrEmpty(_extendedOpenAIOptions.Endpoint)
                && (_extendedOpenAIOptions.Endpoint.Contains(":11434") || _extendedOpenAIOptions.Endpoint.Contains("localhost") || _extendedOpenAIOptions.Endpoint.Contains("host.docker.internal"));

            int conditionCount = sessionData.DSM5Conditions?.Count ?? 1;
            string buildingPromptMsg = "Building clinical assessment prompt with DSM-5 criteria...";
            if (isAirGap && conditionCount > 2)
            {
                buildingPromptMsg = $"Air-gap mode: Limited to 2 of {conditionCount} selected conditions (local model context window constraint). Building prompt...";
            }
            else if (isAirGap)
            {
                buildingPromptMsg = $"Air-gap mode: Evaluating {conditionCount} condition(s) with local model. Building prompt...";
            }

            await _jobService.UpdateJobStatusAsync(jobId, ExtendedAssessmentJobStatus.Processing, 40, buildingPromptMsg);

            // Small delay to allow polling to pick up state change
            await Task.Delay(500);

            // Update progress to show we're sending to the model
            string sendingMsg = isAirGap
                ? "Sending prompt to local AI model \u2014 this may take 1-3 minutes in air-gap mode..."
                : "Sending prompt to AI model \u2014 waiting for response...";
            await _jobService.UpdateJobStatusAsync(jobId, ExtendedAssessmentJobStatus.Processing, 50, sendingMsg);

            // This is the long-running call that can take 30-120+ seconds
            var startTime = DateTime.UtcNow;
            var assessment = await _riskAssessmentService.GenerateExtendedRiskAssessmentAsync(sessionData);
            var elapsedMs = (DateTime.UtcNow - startTime).TotalMilliseconds;

            if (assessment != null)
            {
                _logger.LogInformation("[{ActivityName}] Extended assessment generated successfully for job {JobId} in {ElapsedMs}ms",
                    nameof(GenerateExtendedAssessmentActivity), jobId, elapsedMs);

                // Update progress to show completion of AI processing
                await _jobService.UpdateJobStatusAsync(jobId, ExtendedAssessmentJobStatus.Processing, 80,
                    $"Assessment generated successfully in {elapsedMs / 1000:F1} seconds. Finalizing...");

                return assessment;
            }
            else
            {
                _logger.LogError("[{ActivityName}] Failed to generate extended assessment for job {JobId}",
                    nameof(GenerateExtendedAssessmentActivity), jobId);
                return null;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ActivityName}] Error generating extended assessment for job {JobId}",
                nameof(GenerateExtendedAssessmentActivity), jobId);

            // Update job with error details
            await _jobService.UpdateJobStatusAsync(jobId, ExtendedAssessmentJobStatus.Processing, 50,
                $"Error during assessment generation: {ex.Message}");

            return null;
        }
    }

    /// <summary>
    /// Saves the generated assessment to the session
    /// </summary>
    [Function("SaveAssessmentToSession")]
    public async Task<bool> SaveAssessmentToSession([ActivityTrigger] SaveAssessmentInput input)
    {
        string jobId = input.JobId;
        string sessionId = input.SessionId;
        ExtendedRiskAssessment assessment = input.Assessment;

        try
        {
            _logger.LogInformation("[{ActivityName}] Saving assessment to session {SessionId} for job {JobId}",
                nameof(SaveAssessmentToSession), sessionId, jobId);

            var sessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
            if (sessionData == null)
            {
                _logger.LogError("[{ActivityName}] Session {SessionId} not found when saving assessment for job {JobId}",
                    nameof(SaveAssessmentToSession), sessionId, jobId);
                return false;
            }

            sessionData.ExtendedRiskAssessment = assessment;
            sessionData.UpdatedAt = DateTime.UtcNow.ToString("O");

            var updateSuccess = await _sessionStorageService.UpdateSessionDataAsync(sessionData);

            if (updateSuccess)
            {
                _logger.LogInformation("[{ActivityName}] Assessment saved successfully to session {SessionId} for job {JobId}",
                    nameof(SaveAssessmentToSession), sessionId, jobId);
            }
            else
            {
                _logger.LogError("[{ActivityName}] Failed to save assessment to session {SessionId} for job {JobId}",
                    nameof(SaveAssessmentToSession), sessionId, jobId);
            }

            return updateSuccess;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ActivityName}] Error saving assessment to session {SessionId} for job {JobId}",
                nameof(SaveAssessmentToSession), sessionId, jobId);
            return false;
        }
    }

    /// <summary>
    /// Completes a job with successful results
    /// </summary>
    [Function("CompleteJob")]
    public async Task<bool> CompleteJob([ActivityTrigger] JobCompletion completion)
    {
        _logger.LogInformation("[{ActivityName}] Completing job {JobId} with processing time {ProcessingTime}ms",
            nameof(CompleteJob), completion.JobId, completion.ProcessingTimeMs);

        return await _jobService.CompleteJobAsync(completion.JobId, completion.Assessment, completion.ProcessingTimeMs, completion.ModelUsed);
    }

    /// <summary>
    /// Fails a job with error information
    /// </summary>
    [Function("FailJob")]
    public async Task<bool> FailJob([ActivityTrigger] JobFailure failure)
    {
        _logger.LogError("[{ActivityName}] Failing job {JobId}: {ErrorMessage}",
            nameof(FailJob), failure.JobId, failure.ErrorMessage);

        return await _jobService.FailJobAsync(failure.JobId, failure.ErrorMessage, failure.ErrorDetails);
    }
}
