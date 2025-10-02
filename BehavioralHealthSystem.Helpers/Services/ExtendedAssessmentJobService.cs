namespace BehavioralHealthSystem.Helpers.Services;

/// <summary>
/// In-memory implementation of job service for extended assessment processing
/// Note: In production, consider using Azure Table Storage or Cosmos DB for persistence
/// </summary>
public class ExtendedAssessmentJobService : IExtendedAssessmentJobService
{
    private readonly ILogger<ExtendedAssessmentJobService> _logger;
    private readonly IMemoryCache _cache;
    private readonly ISessionStorageService _sessionStorageService;
    private const string JobKeyPrefix = "ExtendedAssessmentJob_";
    private const string SessionJobsKeyPrefix = "SessionJobs_";

    public ExtendedAssessmentJobService(
        ILogger<ExtendedAssessmentJobService> logger,
        IMemoryCache cache,
        ISessionStorageService sessionStorageService)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _sessionStorageService = sessionStorageService ?? throw new ArgumentNullException(nameof(sessionStorageService));
    }

    public async Task<string> CreateJobAsync(string sessionId)
    {
        try
        {
            // Validate session exists
            var sessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
            if (sessionData == null)
            {
                throw new ArgumentException($"Session not found: {sessionId}", nameof(sessionId));
            }

            var jobId = Guid.NewGuid().ToString();
            var job = new ExtendedAssessmentJob
            {
                JobId = jobId,
                SessionId = sessionId,
                Status = ExtendedAssessmentJobStatus.Pending,
                CreatedAt = DateTime.UtcNow,
                CurrentStep = "Job created, waiting to start processing..."
            };

            // Store job with 2-hour expiration (should be more than enough for any assessment)
            var cacheOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(2),
                Priority = CacheItemPriority.High
            };

            _cache.Set($"{JobKeyPrefix}{jobId}", job, cacheOptions);

            // Track jobs by session
            var sessionJobsKey = $"{SessionJobsKeyPrefix}{sessionId}";
            var sessionJobs = _cache.Get<List<string>>(sessionJobsKey) ?? new List<string>();
            sessionJobs.Add(jobId);
            _cache.Set(sessionJobsKey, sessionJobs, cacheOptions);

            _logger.LogInformation("[{ServiceName}] Created job {JobId} for session {SessionId}", 
                nameof(ExtendedAssessmentJobService), jobId, sessionId);

            return jobId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ServiceName}] Error creating job for session {SessionId}", 
                nameof(ExtendedAssessmentJobService), sessionId);
            throw;
        }
    }

    public async Task<ExtendedAssessmentJob?> GetJobAsync(string jobId)
    {
        try
        {
            var job = _cache.Get<ExtendedAssessmentJob>($"{JobKeyPrefix}{jobId}");
            return await Task.FromResult(job);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ServiceName}] Error getting job {JobId}", 
                nameof(ExtendedAssessmentJobService), jobId);
            return null;
        }
    }

    public async Task<bool> UpdateJobStatusAsync(string jobId, ExtendedAssessmentJobStatus status, int progressPercentage = 0, string? currentStep = null)
    {
        try
        {
            var job = _cache.Get<ExtendedAssessmentJob>($"{JobKeyPrefix}{jobId}");
            if (job == null)
            {
                _logger.LogWarning("[{ServiceName}] Job {JobId} not found for status update", 
                    nameof(ExtendedAssessmentJobService), jobId);
                return false;
            }

            job.Status = status;
            job.ProgressPercentage = Math.Clamp(progressPercentage, 0, 100);
            
            if (!string.IsNullOrEmpty(currentStep))
            {
                job.CurrentStep = currentStep;
            }

            if (status == ExtendedAssessmentJobStatus.Processing && !job.StartedAt.HasValue)
            {
                job.StartedAt = DateTime.UtcNow;
            }

            if (job.IsCompleted && !job.CompletedAt.HasValue)
            {
                job.CompletedAt = DateTime.UtcNow;
                if (job.StartedAt.HasValue)
                {
                    job.ProcessingTimeMs = (long)(job.CompletedAt.Value - job.StartedAt.Value).TotalMilliseconds;
                }
            }

            _cache.Set($"{JobKeyPrefix}{jobId}", job);

            _logger.LogInformation("[{ServiceName}] Updated job {JobId} status to {Status} ({Progress}%) - {Step}", 
                nameof(ExtendedAssessmentJobService), jobId, status, progressPercentage, currentStep ?? "");

            return await Task.FromResult(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ServiceName}] Error updating job {JobId} status", 
                nameof(ExtendedAssessmentJobService), jobId);
            return false;
        }
    }

    public async Task<bool> CompleteJobAsync(string jobId, ExtendedRiskAssessment result, long processingTimeMs, string? modelUsed = null)
    {
        try
        {
            var job = _cache.Get<ExtendedAssessmentJob>($"{JobKeyPrefix}{jobId}");
            if (job == null)
            {
                _logger.LogWarning("[{ServiceName}] Job {JobId} not found for completion", 
                    nameof(ExtendedAssessmentJobService), jobId);
                return false;
            }

            job.Status = ExtendedAssessmentJobStatus.Completed;
            job.ProgressPercentage = 100;
            job.CurrentStep = "Assessment completed successfully";
            job.Result = result;
            job.ProcessingTimeMs = processingTimeMs;
            job.ModelUsed = modelUsed;
            job.CompletedAt = DateTime.UtcNow;

            _cache.Set($"{JobKeyPrefix}{jobId}", job);

            _logger.LogInformation("[{ServiceName}] Completed job {JobId} in {ProcessingTime}ms using model {Model}", 
                nameof(ExtendedAssessmentJobService), jobId, processingTimeMs, modelUsed ?? "unknown");

            return await Task.FromResult(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ServiceName}] Error completing job {JobId}", 
                nameof(ExtendedAssessmentJobService), jobId);
            return false;
        }
    }

    public async Task<bool> FailJobAsync(string jobId, string errorMessage, string? errorDetails = null)
    {
        try
        {
            var job = _cache.Get<ExtendedAssessmentJob>($"{JobKeyPrefix}{jobId}");
            if (job == null)
            {
                _logger.LogWarning("[{ServiceName}] Job {JobId} not found for failure", 
                    nameof(ExtendedAssessmentJobService), jobId);
                return false;
            }

            job.Status = ExtendedAssessmentJobStatus.Failed;
            job.CurrentStep = "Assessment failed";
            job.ErrorMessage = errorMessage;
            job.ErrorDetails = errorDetails;
            job.CompletedAt = DateTime.UtcNow;

            _cache.Set($"{JobKeyPrefix}{jobId}", job);

            _logger.LogError("[{ServiceName}] Failed job {JobId}: {ErrorMessage}", 
                nameof(ExtendedAssessmentJobService), jobId, errorMessage);

            return await Task.FromResult(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ServiceName}] Error failing job {JobId}", 
                nameof(ExtendedAssessmentJobService), jobId);
            return false;
        }
    }

    public async Task<bool> CancelJobAsync(string jobId)
    {
        try
        {
            var job = _cache.Get<ExtendedAssessmentJob>($"{JobKeyPrefix}{jobId}");
            if (job == null)
            {
                return false;
            }

            if (job.IsCompleted)
            {
                _logger.LogWarning("[{ServiceName}] Cannot cancel job {JobId} - already completed", 
                    nameof(ExtendedAssessmentJobService), jobId);
                return false;
            }

            job.Status = ExtendedAssessmentJobStatus.Cancelled;
            job.CurrentStep = "Assessment cancelled";
            job.CompletedAt = DateTime.UtcNow;

            _cache.Set($"{JobKeyPrefix}{jobId}", job);

            _logger.LogInformation("[{ServiceName}] Cancelled job {JobId}", 
                nameof(ExtendedAssessmentJobService), jobId);

            return await Task.FromResult(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ServiceName}] Error cancelling job {JobId}", 
                nameof(ExtendedAssessmentJobService), jobId);
            return false;
        }
    }

    public async Task<List<ExtendedAssessmentJob>> GetJobsBySessionAsync(string sessionId)
    {
        try
        {
            var sessionJobsKey = $"{SessionJobsKeyPrefix}{sessionId}";
            var jobIds = _cache.Get<List<string>>(sessionJobsKey) ?? new List<string>();
            
            var jobs = new List<ExtendedAssessmentJob>();
            foreach (var jobId in jobIds)
            {
                var job = _cache.Get<ExtendedAssessmentJob>($"{JobKeyPrefix}{jobId}");
                if (job != null)
                {
                    jobs.Add(job);
                }
            }

            return await Task.FromResult(jobs.OrderByDescending(j => j.CreatedAt).ToList());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ServiceName}] Error getting jobs for session {SessionId}", 
                nameof(ExtendedAssessmentJobService), sessionId);
            return new List<ExtendedAssessmentJob>();
        }
    }

    public async Task<int> CleanupOldJobsAsync(int olderThanDays = 7)
    {
        try
        {
            // Note: In-memory cache auto-expires, so this is mainly for logging
            // In a persistent storage implementation, this would actually clean up old records
            _logger.LogInformation("[{ServiceName}] Cleanup called - in-memory cache auto-expires jobs after 2 hours", 
                nameof(ExtendedAssessmentJobService));
            
            return await Task.FromResult(0);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ServiceName}] Error during cleanup", 
                nameof(ExtendedAssessmentJobService));
            return 0;
        }
    }

    public async Task<bool> RetryJobAsync(string jobId)
    {
        try
        {
            var job = _cache.Get<ExtendedAssessmentJob>($"{JobKeyPrefix}{jobId}");
            if (job == null)
            {
                _logger.LogWarning("[{ServiceName}] Job {JobId} not found for retry", 
                    nameof(ExtendedAssessmentJobService), jobId);
                return false;
            }

            if (!job.CanRetry)
            {
                _logger.LogWarning("[{ServiceName}] Job {JobId} cannot be retried - status: {Status}, retry count: {RetryCount}/{MaxRetries}", 
                    nameof(ExtendedAssessmentJobService), jobId, job.Status, job.RetryCount, job.MaxRetries);
                return false;
            }

            job.RetryCount++;
            job.Status = ExtendedAssessmentJobStatus.Pending;
            job.CurrentStep = $"Retrying assessment (attempt {job.RetryCount + 1})...";
            job.ErrorMessage = null;
            job.ErrorDetails = null;
            job.StartedAt = null;
            job.CompletedAt = null;
            job.ProgressPercentage = 0;

            _cache.Set($"{JobKeyPrefix}{jobId}", job);

            _logger.LogInformation("[{ServiceName}] Job {JobId} queued for retry (attempt {Attempt})", 
                nameof(ExtendedAssessmentJobService), jobId, job.RetryCount + 1);

            return await Task.FromResult(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ServiceName}] Error retrying job {JobId}", 
                nameof(ExtendedAssessmentJobService), jobId);
            return false;
        }
    }
}