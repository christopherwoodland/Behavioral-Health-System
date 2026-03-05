using BehavioralHealthSystem.Helpers.Data;

namespace BehavioralHealthSystem.Helpers.Services.PostgreSQL;

/// <summary>
/// PostgreSQL implementation of IExtendedAssessmentJobService.
/// Replaces IMemoryCache-based storage with persistent PostgreSQL storage.
/// </summary>
public class PgExtendedAssessmentJobService : IExtendedAssessmentJobService
{
    private readonly BhsDbContext _db;
    private readonly ILogger<PgExtendedAssessmentJobService> _logger;

    public PgExtendedAssessmentJobService(BhsDbContext db, ILogger<PgExtendedAssessmentJobService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<string> CreateJobAsync(string sessionId)
    {
        var job = new ExtendedAssessmentJob
        {
            JobId = Guid.NewGuid().ToString(),
            SessionId = sessionId,
            Status = ExtendedAssessmentJobStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _db.ExtendedAssessmentJobs.Add(job);
        await _db.SaveChangesAsync();
        return job.JobId;
    }

    public async Task<ExtendedAssessmentJob?> GetJobAsync(string jobId)
    {
        return await _db.ExtendedAssessmentJobs.FindAsync(jobId);
    }

    public async Task<bool> UpdateJobStatusAsync(string jobId, ExtendedAssessmentJobStatus status, int progressPercentage = 0, string? currentStep = null)
    {
        var job = await _db.ExtendedAssessmentJobs.FindAsync(jobId);
        if (job == null) return false;

        job.Status = status;
        job.ProgressPercentage = progressPercentage;
        job.CurrentStep = currentStep;

        if (status == ExtendedAssessmentJobStatus.Processing && !job.StartedAt.HasValue)
            job.StartedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> CompleteJobAsync(string jobId, ExtendedRiskAssessment result, long processingTimeMs, string? modelUsed = null)
    {
        var job = await _db.ExtendedAssessmentJobs.FindAsync(jobId);
        if (job == null) return false;

        job.Status = ExtendedAssessmentJobStatus.Completed;
        job.CompletedAt = DateTime.UtcNow;
        job.Result = result;
        job.ProcessingTimeMs = processingTimeMs;
        job.ModelUsed = modelUsed;
        job.ProgressPercentage = 100;
        job.CurrentStep = "Completed";

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> FailJobAsync(string jobId, string errorMessage, string? errorDetails = null)
    {
        var job = await _db.ExtendedAssessmentJobs.FindAsync(jobId);
        if (job == null) return false;

        job.Status = ExtendedAssessmentJobStatus.Failed;
        job.CompletedAt = DateTime.UtcNow;
        job.ErrorMessage = errorMessage;
        job.ErrorDetails = errorDetails;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> CancelJobAsync(string jobId)
    {
        var job = await _db.ExtendedAssessmentJobs.FindAsync(jobId);
        if (job == null) return false;

        if (job.Status != ExtendedAssessmentJobStatus.Pending && job.Status != ExtendedAssessmentJobStatus.Processing)
            return false;

        job.Status = ExtendedAssessmentJobStatus.Cancelled;
        job.CompletedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<ExtendedAssessmentJob>> GetJobsBySessionAsync(string sessionId)
    {
        return await _db.ExtendedAssessmentJobs
            .Where(j => j.SessionId == sessionId)
            .OrderByDescending(j => j.CreatedAt)
            .ToListAsync();
    }

    public async Task<int> CleanupOldJobsAsync(int olderThanDays = 7)
    {
        var cutoff = DateTime.UtcNow.AddDays(-olderThanDays);
        var oldJobs = await _db.ExtendedAssessmentJobs
            .Where(j => j.CreatedAt < cutoff &&
                        (j.Status == ExtendedAssessmentJobStatus.Completed ||
                         j.Status == ExtendedAssessmentJobStatus.Failed ||
                         j.Status == ExtendedAssessmentJobStatus.Cancelled))
            .ToListAsync();

        _db.ExtendedAssessmentJobs.RemoveRange(oldJobs);
        await _db.SaveChangesAsync();
        return oldJobs.Count;
    }

    public async Task<bool> RetryJobAsync(string jobId)
    {
        var job = await _db.ExtendedAssessmentJobs.FindAsync(jobId);
        if (job == null) return false;

        if (job.Status != ExtendedAssessmentJobStatus.Failed || job.RetryCount >= job.MaxRetries)
            return false;

        job.Status = ExtendedAssessmentJobStatus.Pending;
        job.RetryCount++;
        job.ErrorMessage = null;
        job.ErrorDetails = null;
        job.StartedAt = null;
        job.CompletedAt = null;
        job.ProgressPercentage = 0;
        job.CurrentStep = null;

        await _db.SaveChangesAsync();
        return true;
    }
}
