using BehavioralHealthSystem.Helpers.Data;
using BehavioralHealthSystem.Helpers.Services.Interfaces;

namespace BehavioralHealthSystem.Helpers.Services.PostgreSQL;

/// <summary>
/// PostgreSQL implementation of IChatTranscriptService
/// </summary>
public class PgChatTranscriptService : IChatTranscriptService
{
    private readonly BhsDbContext _db;
    private readonly ILogger<PgChatTranscriptService> _logger;

    public PgChatTranscriptService(BhsDbContext db, ILogger<PgChatTranscriptService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<ChatTranscriptData> SaveTranscriptAsync(ChatTranscriptData transcript, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Saving chat transcript for user {UserId}, session {SessionId}", transcript.UserId, transcript.SessionId);

        var existing = await _db.ChatTranscripts
            .Include(t => t.Messages)
            .Include(t => t.Metadata)
            .FirstOrDefaultAsync(t => t.UserId == transcript.UserId && t.SessionId == transcript.SessionId, cancellationToken);

        if (existing == null)
        {
            if (string.IsNullOrWhiteSpace(transcript.CreatedAt))
                transcript.CreatedAt = DateTime.UtcNow.ToString("O");
            transcript.LastUpdated = DateTime.UtcNow.ToString("O");

            _db.ChatTranscripts.Add(transcript);
            await _db.SaveChangesAsync(cancellationToken);
            return transcript;
        }

        // Merge messages — add new ones that don't already exist
        var existingMessageIds = new HashSet<string>(existing.Messages.Select(m => m.Id));
        foreach (var newMessage in transcript.Messages)
        {
            if (!existingMessageIds.Contains(newMessage.Id))
            {
                newMessage.ChatTranscriptDataId = existing.Id;
                existing.Messages.Add(newMessage);
            }
        }

        existing.LastUpdated = DateTime.UtcNow.ToString("O");
        existing.IsActive = transcript.IsActive;

        if (!transcript.IsActive && string.IsNullOrEmpty(existing.SessionEndedAt))
            existing.SessionEndedAt = DateTime.UtcNow.ToString("O");

        await _db.SaveChangesAsync(cancellationToken);
        return existing;
    }

    public async Task<ChatTranscriptData?> GetTranscriptAsync(string userId, string sessionId, CancellationToken cancellationToken = default)
    {
        return await _db.ChatTranscripts
            .Include(t => t.Messages)
            .Include(t => t.Metadata)
            .FirstOrDefaultAsync(t => t.UserId == userId && t.SessionId == sessionId, cancellationToken);
    }

    public async Task<List<ChatTranscriptData>> GetUserTranscriptsAsync(string userId, int? limit = null, CancellationToken cancellationToken = default)
    {
        var query = _db.ChatTranscripts
            .Include(t => t.Messages)
            .Where(t => t.UserId == userId)
            .OrderByDescending(t => t.LastUpdated);

        if (limit.HasValue)
            return await query.Take(limit.Value).ToListAsync(cancellationToken);

        return await query.ToListAsync(cancellationToken);
    }

    public async Task<bool> DeleteTranscriptAsync(string userId, string sessionId, CancellationToken cancellationToken = default)
    {
        var transcript = await _db.ChatTranscripts
            .FirstOrDefaultAsync(t => t.UserId == userId && t.SessionId == sessionId, cancellationToken);

        if (transcript == null) return false;

        _db.ChatTranscripts.Remove(transcript);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
