using BehavioralHealthSystem.Helpers.Data;

namespace BehavioralHealthSystem.Helpers.Services.PostgreSQL;

/// <summary>
/// PostgreSQL implementation of IPhqAssessmentService
/// </summary>
public class PgPhqAssessmentService : IPhqAssessmentService
{
    private readonly BhsDbContext _db;
    private readonly ILogger<PgPhqAssessmentService> _logger;

    public PgPhqAssessmentService(BhsDbContext db, ILogger<PgPhqAssessmentService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<bool> SaveAssessmentAsync(PhqAssessmentData assessment, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Saving PHQ assessment {AssessmentId} for user {UserId}", assessment.AssessmentId, assessment.UserId);

            var existing = await _db.PhqAssessments
                .Include(a => a.Questions)
                .Include(a => a.Metadata)
                .FirstOrDefaultAsync(a => a.AssessmentId == assessment.AssessmentId, cancellationToken);

            if (existing != null)
            {
                // Update existing
                existing.IsCompleted = assessment.IsCompleted;
                existing.CompletedTime = assessment.CompletedTime;
                existing.TotalScore = assessment.TotalScore;
                existing.Severity = assessment.Severity;
                existing.Interpretation = assessment.Interpretation;
                existing.Recommendations = assessment.Recommendations;

                // Replace questions
                _db.PhqQuestions.RemoveRange(existing.Questions);
                foreach (var q in assessment.Questions)
                {
                    q.PhqAssessmentDataId = existing.Id;
                    _db.PhqQuestions.Add(q);
                }
            }
            else
            {
                _db.PhqAssessments.Add(assessment);
            }

            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving PHQ assessment {AssessmentId}", assessment.AssessmentId);
            return false;
        }
    }

    public async Task<PhqAssessmentData?> GetAssessmentAsync(string userId, string assessmentId, CancellationToken cancellationToken = default)
    {
        return await _db.PhqAssessments
            .Include(a => a.Questions)
            .Include(a => a.Metadata)
            .FirstOrDefaultAsync(a => a.UserId == userId && a.AssessmentId == assessmentId, cancellationToken);
    }

    public async Task<List<PhqAssessmentData>> GetUserAssessmentsAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _db.PhqAssessments
            .Include(a => a.Questions)
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.StartTime)
            .ToListAsync(cancellationToken);
    }
}
