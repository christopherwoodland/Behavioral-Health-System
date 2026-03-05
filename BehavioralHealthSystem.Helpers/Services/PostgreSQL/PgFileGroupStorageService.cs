using BehavioralHealthSystem.Helpers.Data;
using BehavioralHealthSystem.Services.Interfaces;

namespace BehavioralHealthSystem.Helpers.Services.PostgreSQL;

/// <summary>
/// PostgreSQL implementation of IFileGroupStorageService
/// </summary>
public class PgFileGroupStorageService : IFileGroupStorageService
{
    private readonly BhsDbContext _db;
    private readonly ILogger<PgFileGroupStorageService> _logger;

    public PgFileGroupStorageService(BhsDbContext db, ILogger<PgFileGroupStorageService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<FileGroup?> CreateFileGroupAsync(CreateFileGroupRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var fileGroup = new FileGroup
            {
                GroupId = Guid.NewGuid().ToString(),
                GroupName = request.GroupName,
                Description = request.Description,
                CreatedBy = request.CreatedBy,
                CreatedAt = DateTime.UtcNow.ToString("O"),
                UpdatedAt = DateTime.UtcNow.ToString("O"),
                Status = "active"
            };

            _db.FileGroups.Add(fileGroup);
            await _db.SaveChangesAsync(cancellationToken);
            return fileGroup;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating file group");
            return null;
        }
    }

    public async Task<List<FileGroup>> GetUserFileGroupsAsync(string userId, CancellationToken cancellationToken = default)
    {
        return await _db.FileGroups
            .Where(g => g.CreatedBy == userId && g.Status != "deleted")
            .OrderByDescending(g => g.UpdatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<FileGroup?> GetFileGroupAsync(string groupId, CancellationToken cancellationToken = default)
    {
        return await _db.FileGroups.FindAsync(new object[] { groupId }, cancellationToken);
    }

    public async Task<bool> UpdateFileGroupAsync(FileGroup fileGroup, CancellationToken cancellationToken = default)
    {
        try
        {
            fileGroup.UpdatedAt = DateTime.UtcNow.ToString("O");
            _db.FileGroups.Update(fileGroup);
            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating file group {GroupId}", fileGroup.GroupId);
            return false;
        }
    }

    public async Task<bool> ArchiveFileGroupAsync(string groupId, CancellationToken cancellationToken = default)
    {
        var group = await _db.FileGroups.FindAsync(new object[] { groupId }, cancellationToken);
        if (group == null) return false;

        group.Status = "archived";
        group.UpdatedAt = DateTime.UtcNow.ToString("O");
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<bool> DeleteFileGroupAsync(string groupId, CancellationToken cancellationToken = default)
    {
        var group = await _db.FileGroups.FindAsync(new object[] { groupId }, cancellationToken);
        if (group == null) return false;

        _db.FileGroups.Remove(group);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<List<FileGroup>> SearchFileGroupsAsync(string userId, string query, CancellationToken cancellationToken = default)
    {
        var lowerQuery = query.ToLower();
        return await _db.FileGroups
            .Where(g => g.CreatedBy == userId && g.Status != "deleted" &&
                        (g.GroupName.ToLower().Contains(lowerQuery) ||
                         (g.Description != null && g.Description.ToLower().Contains(lowerQuery))))
            .OrderByDescending(g => g.UpdatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> GetGroupSessionCountAsync(string groupId, CancellationToken cancellationToken = default)
    {
        return await _db.Sessions
            .CountAsync(s => s.GroupId == groupId, cancellationToken);
    }

    public async Task<bool> DoesGroupNameExistAsync(string userId, string groupName, CancellationToken cancellationToken = default)
    {
        return await _db.FileGroups
            .AnyAsync(g => g.CreatedBy == userId && g.GroupName == groupName && g.Status != "deleted", cancellationToken);
    }
}
