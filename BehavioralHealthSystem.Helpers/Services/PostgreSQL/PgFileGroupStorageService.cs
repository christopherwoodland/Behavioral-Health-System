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
        try
        {
            _logger.LogInformation("Getting file groups for user: {UserId}", userId);
            var groups = await _db.FileGroups
                .Where(g => g.CreatedBy == userId && g.Status != "deleted")
                .OrderByDescending(g => g.UpdatedAt)
                .ToListAsync(cancellationToken);
            _logger.LogInformation("Found {Count} file groups for user: {UserId}", groups.Count, userId);
            return groups;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting file groups for user: {UserId}. Exception: {Message}", userId, ex.Message);
            throw; // Re-throw so the function layer can return a descriptive 500
        }
    }

    public async Task<FileGroup?> GetFileGroupAsync(string groupId, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _db.FileGroups.FindAsync(new object[] { groupId }, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting file group: {GroupId}. Exception: {Message}", groupId, ex.Message);
            return null;
        }
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
        try
        {
            _logger.LogInformation("Deleting file group: {GroupId}", groupId);
            var group = await _db.FileGroups.FindAsync(new object[] { groupId }, cancellationToken);
            if (group == null)
            {
                _logger.LogWarning("File group not found for deletion: {GroupId}", groupId);
                return false;
            }

            _db.FileGroups.Remove(group);
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Successfully deleted file group: {GroupId}", groupId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting file group: {GroupId}. Exception: {Message}", groupId, ex.Message);
            throw; // Re-throw so the function layer can return a descriptive 500
        }
    }

    public async Task<List<FileGroup>> SearchFileGroupsAsync(string userId, string query, CancellationToken cancellationToken = default)
    {
        try
        {
            var lowerQuery = query.ToLower();
            return await _db.FileGroups
                .Where(g => g.CreatedBy == userId && g.Status != "deleted" &&
                            (g.GroupName.ToLower().Contains(lowerQuery) ||
                             (g.Description != null && g.Description.ToLower().Contains(lowerQuery))))
                .OrderByDescending(g => g.UpdatedAt)
                .ToListAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching file groups for user: {UserId} with query: {Query}", userId, query);
            return new List<FileGroup>();
        }
    }

    public async Task<int> GetGroupSessionCountAsync(string groupId, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _db.Sessions
                .CountAsync(s => s.GroupId == groupId, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting session count for group: {GroupId}", groupId);
            return 0;
        }
    }

    public async Task<bool> DoesGroupNameExistAsync(string userId, string groupName, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _db.FileGroups
                .AnyAsync(g => g.CreatedBy == userId && g.GroupName == groupName && g.Status != "deleted", cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking group name existence for user: {UserId}, name: {GroupName}", userId, groupName);
            return false;
        }
    }
}
