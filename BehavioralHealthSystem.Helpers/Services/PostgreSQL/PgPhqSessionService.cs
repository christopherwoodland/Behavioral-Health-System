using BehavioralHealthSystem.Helpers.Data;

namespace BehavioralHealthSystem.Helpers.Services.PostgreSQL;

/// <summary>
/// PostgreSQL implementation of IPhqSessionService
/// </summary>
public class PgPhqSessionService : IPhqSessionService
{
    private readonly BhsDbContext _db;
    private readonly ILogger<PgPhqSessionService> _logger;

    public PgPhqSessionService(BhsDbContext db, ILogger<PgPhqSessionService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<bool> SaveSessionAsync(PhqSessionData session, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Saving PHQ session {SessionId} for user {UserId}", session.SessionId, session.UserId);

            var existing = await _db.PhqSessions
                .Include(s => s.Questions)
                .Include(s => s.Metadata)
                .FirstOrDefaultAsync(s => s.UserId == session.UserId && s.AssessmentId == session.AssessmentId, cancellationToken);

            if (existing != null)
            {
                // Overwrite with full session data (progressive save pattern)
                existing.LastUpdated = session.LastUpdated;
                existing.CompletedAt = session.CompletedAt;
                existing.IsCompleted = session.IsCompleted;
                existing.TotalScore = session.TotalScore;
                existing.Severity = session.Severity;

                // Replace questions
                _db.PhqQuestionResponses.RemoveRange(existing.Questions);
                foreach (var q in session.Questions)
                {
                    q.PhqSessionDataId = existing.Id;
                    _db.PhqQuestionResponses.Add(q);
                }
            }
            else
            {
                _db.PhqSessions.Add(session);
            }

            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving PHQ session {SessionId}", session.SessionId);
            return false;
        }
    }

    public async Task<PhqSessionData?> GetSessionAsync(string userId, string assessmentId, CancellationToken cancellationToken = default)
    {
        return await _db.PhqSessions
            .Include(s => s.Questions)
            .Include(s => s.Metadata)
            .FirstOrDefaultAsync(s => s.UserId == userId && s.AssessmentId == assessmentId, cancellationToken);
    }

    public async Task<List<PhqSessionData>> GetUserSessionsAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _db.PhqSessions
            .Include(s => s.Questions)
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);
    }
}
