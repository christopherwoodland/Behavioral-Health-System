using BehavioralHealthSystem.Helpers.Data;

namespace BehavioralHealthSystem.Helpers.Services.PostgreSQL;

/// <summary>
/// PostgreSQL implementation of IBiometricDataService
/// </summary>
public class PgBiometricDataService : IBiometricDataService
{
    private readonly BhsDbContext _db;
    private readonly ILogger<PgBiometricDataService> _logger;

    public PgBiometricDataService(BhsDbContext db, ILogger<PgBiometricDataService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<bool> UserBiometricDataExistsAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _db.UserBiometricData.AnyAsync(b => b.UserId == userId, cancellationToken);
    }

    public async Task<UserBiometricData?> GetUserBiometricDataAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _db.UserBiometricData.FindAsync(new object[] { userId }, cancellationToken);
    }

    public async Task SaveUserBiometricDataAsync(UserBiometricData biometricData, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Saving biometric data for user {UserId}", biometricData.UserId);

        var existing = await _db.UserBiometricData.FindAsync(new object[] { biometricData.UserId }, cancellationToken);
        if (existing != null)
        {
            _db.Entry(existing).CurrentValues.SetValues(biometricData);
            existing.LastUpdated = DateTime.UtcNow;
        }
        else
        {
            _db.UserBiometricData.Add(biometricData);
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<bool> DeleteUserBiometricDataAsync(string userId, CancellationToken cancellationToken = default)
    {
        var data = await _db.UserBiometricData.FindAsync(new object[] { userId }, cancellationToken);
        if (data == null) return false;

        _db.UserBiometricData.Remove(data);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
