using BehavioralHealthSystem.Helpers.Data;
using BehavioralHealthSystem.Services.Interfaces;

namespace BehavioralHealthSystem.Helpers.Services.PostgreSQL;

/// <summary>
/// PostgreSQL implementation of ISessionStorageService
/// </summary>
public class PgSessionStorageService : ISessionStorageService
{
    private readonly BhsDbContext _db;
    private readonly ILogger<PgSessionStorageService> _logger;

    public PgSessionStorageService(BhsDbContext db, ILogger<PgSessionStorageService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<bool> SaveSessionDataAsync(SessionData sessionData, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Saving session data for session: {SessionId}, user: {UserId}", sessionData.SessionId, sessionData.UserId);
            sessionData.UpdatedAt = DateTime.UtcNow.ToString("O");

            var existing = await _db.Sessions.FindAsync(new object[] { sessionData.SessionId }, cancellationToken);
            if (existing != null)
            {
                _db.Entry(existing).CurrentValues.SetValues(sessionData);
            }
            else
            {
                _db.Sessions.Add(sessionData);
            }

            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving session data for session: {SessionId}", sessionData.SessionId);
            return false;
        }
    }

    public async Task<SessionData?> GetSessionDataAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _db.Sessions.FindAsync(new object[] { sessionId }, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting session data for session: {SessionId}", sessionId);
            return null;
        }
    }

    public async Task<List<SessionData>> GetUserSessionsAsync(string userId, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _db.Sessions
                .Where(s => s.UserId == userId)
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting sessions for user: {UserId}", userId);
            return new List<SessionData>();
        }
    }

    public async Task<List<SessionData>> GetAllSessionsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            return await _db.Sessions
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all sessions");
            return new List<SessionData>();
        }
    }

    public async Task<bool> UpdateSessionDataAsync(SessionData sessionData, CancellationToken cancellationToken = default)
    {
        return await SaveSessionDataAsync(sessionData, cancellationToken);
    }

    public async Task<bool> DeleteSessionDataAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        try
        {
            var session = await _db.Sessions.FindAsync(new object[] { sessionId }, cancellationToken);
            if (session == null) return false;

            _db.Sessions.Remove(session);
            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting session data for session: {SessionId}", sessionId);
            return false;
        }
    }
}
