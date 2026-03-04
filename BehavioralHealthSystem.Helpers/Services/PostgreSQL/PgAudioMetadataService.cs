using BehavioralHealthSystem.Helpers.Data;

namespace BehavioralHealthSystem.Helpers.Services.PostgreSQL;

/// <summary>
/// PostgreSQL implementation of IAudioMetadataService
/// </summary>
public class PgAudioMetadataService : IAudioMetadataService
{
    private readonly BhsDbContext _db;
    private readonly ILogger<PgAudioMetadataService> _logger;

    public PgAudioMetadataService(BhsDbContext db, ILogger<PgAudioMetadataService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<bool> SaveMetadataAsync(AudioMetadata metadata, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Saving audio metadata for user {UserId}, session {SessionId}", metadata.UserId, metadata.SessionId);
            metadata.UploadedAt = DateTime.UtcNow;
            _db.AudioMetadata.Add(metadata);
            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving audio metadata for user {UserId}", metadata.UserId);
            return false;
        }
    }

    public async Task<List<AudioMetadata>> GetUserAudioMetadataAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _db.AudioMetadata
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.UploadedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<AudioMetadata>> GetSessionAudioMetadataAsync(string userId, string sessionId, CancellationToken cancellationToken = default)
    {
        return await _db.AudioMetadata
            .Where(a => a.UserId == userId && a.SessionId == sessionId)
            .OrderByDescending(a => a.UploadedAt)
            .ToListAsync(cancellationToken);
    }
}
