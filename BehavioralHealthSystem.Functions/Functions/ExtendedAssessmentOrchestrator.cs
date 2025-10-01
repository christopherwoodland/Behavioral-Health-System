using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;

namespace BehavioralHealthSystem.Functions;

/// <summary>
/// Durable Functions orchestrator for processing extended risk assessments asynchronously
/// This allows long-running GPT-5/O3 calls to execute without hitting function timeout limits
/// </summary>
public class ExtendedAssessmentOrchestrator
{
    private readonly ILogger<ExtendedAssessmentOrchestrator> _logger;

    public ExtendedAssessmentOrchestrator(ILogger<ExtendedAssessmentOrchestrator> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Orchestrator function that manages the extended assessment workflow
    /// </summary>
    /// <param name="context">Durable orchestration context</param>
    /// <returns>Orchestration result</returns>
    [Function("ExtendedAssessmentOrchestrator")]
    public async Task<ExtendedAssessmentOrchestrationResult> ExtendedAssessmentOrchestratorFunction(
        [OrchestrationTrigger] TaskOrchestrationContext context)
    {
        var input = context.GetInput<ExtendedAssessmentOrchestrationInput>();
        if (input == null)
        {
            throw new ArgumentNullException(nameof(input), "Orchestration input is null");
        }

        var result = new ExtendedAssessmentOrchestrationResult
        {
            JobId = input.JobId,
            SessionId = input.SessionId,
            StartTime = context.CurrentUtcDateTime
        };

        try
        {
            _logger.LogInformation("[{OrchestratorName}] Starting orchestration for job {JobId}, session {SessionId}", 
                nameof(ExtendedAssessmentOrchestrator), input.JobId, input.SessionId);

            // Step 1: Update job status to processing
            await context.CallActivityAsync("UpdateJobStatus", new JobStatusUpdate
            {
                JobId = input.JobId,
                Status = ExtendedAssessmentJobStatus.Processing,
                ProgressPercentage = 10,
                CurrentStep = "Validating session and preparing assessment..."
            });

            // Step 2: Validate session and prepare for assessment
            var validationResult = await context.CallActivityAsync<bool>("ValidateSessionForAssessment", new SessionValidationInput
            {
                JobId = input.JobId,
                SessionId = input.SessionId
            });

            if (!validationResult)
            {
                result.Success = false;
                result.ErrorMessage = "Session validation failed or extended assessment already exists";
                result.EndTime = context.CurrentUtcDateTime;
                
                await context.CallActivityAsync("FailJob", new JobFailure
                {
                    JobId = input.JobId,
                    ErrorMessage = result.ErrorMessage
                });

                return result;
            }

            // Step 3: Generate the extended assessment (this is the long-running operation)
            await context.CallActivityAsync("UpdateJobStatus", new JobStatusUpdate
            {
                JobId = input.JobId,
                Status = ExtendedAssessmentJobStatus.Processing,
                ProgressPercentage = 30,
                CurrentStep = "Calling Azure OpenAI for extended assessment... This may take 30-120 seconds."
            });

            var assessmentResult = await context.CallActivityAsync<ExtendedRiskAssessment?>("GenerateExtendedAssessmentActivity", new AssessmentGenerationInput
            {
                JobId = input.JobId,
                SessionId = input.SessionId
            });

            if (assessmentResult == null)
            {
                result.Success = false;
                result.ErrorMessage = "Failed to generate extended assessment";
                result.EndTime = context.CurrentUtcDateTime;
                
                await context.CallActivityAsync("FailJob", new JobFailure
                {
                    JobId = input.JobId,
                    ErrorMessage = result.ErrorMessage
                });

                return result;
            }

            // Step 4: Save results to session
            await context.CallActivityAsync("UpdateJobStatus", new JobStatusUpdate
            {
                JobId = input.JobId,
                Status = ExtendedAssessmentJobStatus.Processing,
                ProgressPercentage = 90,
                CurrentStep = "Saving assessment results to session..."
            });

            var saveResult = await context.CallActivityAsync<bool>("SaveAssessmentToSession", new SaveAssessmentInput
            {
                JobId = input.JobId,
                SessionId = input.SessionId,
                Assessment = assessmentResult
            });

            if (!saveResult)
            {
                result.Success = false;
                result.ErrorMessage = "Failed to save assessment to session";
                result.EndTime = context.CurrentUtcDateTime;
                
                await context.CallActivityAsync("FailJob", new JobFailure
                {
                    JobId = input.JobId,
                    ErrorMessage = result.ErrorMessage
                });

                return result;
            }

            // Step 5: Complete the job
            result.EndTime = context.CurrentUtcDateTime;
            result.ProcessingTimeMs = (long)(result.EndTime.Value - result.StartTime).TotalMilliseconds;
            result.Assessment = assessmentResult;
            result.Success = true;

            await context.CallActivityAsync("CompleteJob", new JobCompletion
            {
                JobId = input.JobId,
                Assessment = assessmentResult,
                ProcessingTimeMs = result.ProcessingTimeMs,
                ModelUsed = "GPT-5/O3" // Default model identifier for extended assessments
            });

            _logger.LogInformation("[{OrchestratorName}] Orchestration completed successfully for job {JobId} in {ProcessingTime}ms", 
                nameof(ExtendedAssessmentOrchestrator), input.JobId, result.ProcessingTimeMs);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{OrchestratorName}] Orchestration failed for job {JobId}", 
                nameof(ExtendedAssessmentOrchestrator), input.JobId);

            result.Success = false;
            result.ErrorMessage = ex.Message;
            result.EndTime = context.CurrentUtcDateTime;

            await context.CallActivityAsync("FailJob", new JobFailure
            {
                JobId = input.JobId,
                ErrorMessage = ex.Message,
                ErrorDetails = ex.ToString()
            });

            return result;
        }
    }
}

/// <summary>
/// Input for the extended assessment orchestration
/// </summary>
public class ExtendedAssessmentOrchestrationInput
{
    public string JobId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
}

/// <summary>
/// Result of the extended assessment orchestration
/// </summary>
public class ExtendedAssessmentOrchestrationResult
{
    public string JobId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public long ProcessingTimeMs { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public ExtendedRiskAssessment? Assessment { get; set; }
}

/// <summary>
/// Job status update data
/// </summary>
public class JobStatusUpdate
{
    public string JobId { get; set; } = string.Empty;
    public ExtendedAssessmentJobStatus Status { get; set; }
    public int ProgressPercentage { get; set; }
    public string? CurrentStep { get; set; }
}

/// <summary>
/// Job completion data
/// </summary>
public class JobCompletion
{
    public string JobId { get; set; } = string.Empty;
    public ExtendedRiskAssessment Assessment { get; set; } = null!;
    public long ProcessingTimeMs { get; set; }
    public string? ModelUsed { get; set; }
}

/// <summary>
/// Job failure data
/// </summary>
public class JobFailure
{
    public string JobId { get; set; } = string.Empty;
    public string ErrorMessage { get; set; } = string.Empty;
    public string? ErrorDetails { get; set; }
}

/// <summary>
/// Input for validation activity
/// </summary>
public class SessionValidationInput
{
    public string JobId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
}

/// <summary>
/// Input for assessment generation activity
/// </summary>
public class AssessmentGenerationInput
{
    public string JobId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
}

/// <summary>
/// Input for save assessment activity
/// </summary>
public class SaveAssessmentInput
{
    public string JobId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public ExtendedRiskAssessment Assessment { get; set; } = null!;
}