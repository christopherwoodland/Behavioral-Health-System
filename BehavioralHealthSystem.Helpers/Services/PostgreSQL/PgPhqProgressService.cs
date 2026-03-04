using BehavioralHealthSystem.Helpers.Data;

namespace BehavioralHealthSystem.Helpers.Services.PostgreSQL;

/// <summary>
/// PostgreSQL implementation of IPhqProgressService
/// </summary>
public class PgPhqProgressService : IPhqProgressService
{
    private readonly BhsDbContext _db;
    private readonly ILogger<PgPhqProgressService> _logger;

    public PgPhqProgressService(BhsDbContext db, ILogger<PgPhqProgressService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<PhqProgressData> SaveProgressAsync(PhqProgressData progress, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Saving PHQ progress for user {UserId}, assessment {AssessmentId}", progress.UserId, progress.AssessmentId);

        var existing = await _db.PhqProgress
            .Include(p => p.AnsweredQuestions)
            .Include(p => p.Metadata)
            .FirstOrDefaultAsync(p => p.UserId == progress.UserId && p.AssessmentId == progress.AssessmentId, cancellationToken);

        if (existing == null)
        {
            if (string.IsNullOrWhiteSpace(progress.StartedAt))
                progress.StartedAt = DateTime.UtcNow.ToString("O");
            progress.LastUpdated = DateTime.UtcNow.ToString("O");

            _db.PhqProgress.Add(progress);
            await _db.SaveChangesAsync(cancellationToken);
            return progress;
        }

        // Merge answered questions
        var existingQuestionNumbers = new HashSet<int>(existing.AnsweredQuestions.Select(q => q.QuestionNumber));
        foreach (var newQuestion in progress.AnsweredQuestions)
        {
            if (!existingQuestionNumbers.Contains(newQuestion.QuestionNumber))
            {
                newQuestion.PhqProgressDataId = existing.Id;
                existing.AnsweredQuestions.Add(newQuestion);
            }
            else
            {
                var existingQuestion = existing.AnsweredQuestions.First(q => q.QuestionNumber == newQuestion.QuestionNumber);
                existingQuestion.Answer = newQuestion.Answer;
                existingQuestion.AnsweredAt = newQuestion.AnsweredAt;
                existingQuestion.Attempts = newQuestion.Attempts;
            }
        }

        existing.LastUpdated = DateTime.UtcNow.ToString("O");
        existing.IsCompleted = progress.IsCompleted;
        existing.TotalScore = progress.TotalScore;
        existing.Severity = progress.Severity;
        existing.Interpretation = progress.Interpretation;
        existing.Recommendations = progress.Recommendations;

        if (progress.IsCompleted && string.IsNullOrEmpty(existing.CompletedAt))
            existing.CompletedAt = DateTime.UtcNow.ToString("O");

        await _db.SaveChangesAsync(cancellationToken);
        return existing;
    }

    public async Task<PhqProgressData?> GetProgressAsync(string userId, string assessmentId, CancellationToken cancellationToken = default)
    {
        return await _db.PhqProgress
            .Include(p => p.AnsweredQuestions)
            .Include(p => p.Metadata)
            .FirstOrDefaultAsync(p => p.UserId == userId && p.AssessmentId == assessmentId, cancellationToken);
    }

    public async Task<List<PhqProgressData>> GetUserProgressAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _db.PhqProgress
            .Include(p => p.AnsweredQuestions)
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.LastUpdated)
            .ToListAsync(cancellationToken);
    }
}
