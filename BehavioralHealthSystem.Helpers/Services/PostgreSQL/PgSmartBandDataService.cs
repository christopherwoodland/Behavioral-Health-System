using BehavioralHealthSystem.Helpers.Data;

namespace BehavioralHealthSystem.Helpers.Services.PostgreSQL;

/// <summary>
/// PostgreSQL implementation of ISmartBandDataService
/// </summary>
public class PgSmartBandDataService : ISmartBandDataService
{
    private readonly BhsDbContext _db;
    private readonly ILogger<PgSmartBandDataService> _logger;

    public PgSmartBandDataService(BhsDbContext db, ILogger<PgSmartBandDataService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<bool> SaveSnapshotAsync(SmartBandDataSnapshot snapshot, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Saving Smart Band snapshot for user {UserId}", snapshot.UserId);
            snapshot.SavedAt = DateTime.UtcNow;
            _db.SmartBandSnapshots.Add(snapshot);
            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving Smart Band snapshot for user {UserId}", snapshot.UserId);
            return false;
        }
    }

    public async Task<List<SmartBandDataSnapshot>> GetUserSnapshotsAsync(string userId, int? limit = null, CancellationToken cancellationToken = default)
    {
        var query = _db.SmartBandSnapshots
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.SavedAt);

        if (limit.HasValue)
            return await query.Take(limit.Value).ToListAsync(cancellationToken);

        return await query.ToListAsync(cancellationToken);
    }

    public async Task<SmartBandDataSnapshot?> GetSnapshotAsync(int id, CancellationToken cancellationToken = default)
    {
        return await _db.SmartBandSnapshots.FindAsync(new object[] { id }, cancellationToken);
    }
}
