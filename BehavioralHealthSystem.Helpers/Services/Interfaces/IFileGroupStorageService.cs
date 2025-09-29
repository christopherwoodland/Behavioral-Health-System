namespace BehavioralHealthSystem.Services.Interfaces;

/// <summary>
/// Interface for file group storage operations with Azure Blob Storage
/// </summary>
public interface IFileGroupStorageService
{
    /// <summary>
    /// Create a new file group
    /// </summary>
    /// <param name="request">The file group creation request</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>The created file group if successful, null otherwise</returns>
    Task<FileGroup?> CreateFileGroupAsync(CreateFileGroupRequest request, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Retrieve all file groups for a specific user
    /// </summary>
    /// <param name="userId">The user ID to get file groups for</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of file groups for the user</returns>
    Task<List<FileGroup>> GetUserFileGroupsAsync(string userId, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Retrieve a specific file group by ID
    /// </summary>
    /// <param name="groupId">The group ID to search for</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>File group if found, null otherwise</returns>
    Task<FileGroup?> GetFileGroupAsync(string groupId, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Update an existing file group
    /// </summary>
    /// <param name="fileGroup">The file group to update</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if updated successfully, false otherwise</returns>
    Task<bool> UpdateFileGroupAsync(FileGroup fileGroup, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Archive (soft delete) a file group
    /// </summary>
    /// <param name="groupId">The group ID to archive</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if archived successfully, false otherwise</returns>
    Task<bool> ArchiveFileGroupAsync(string groupId, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Search file groups by name or description
    /// </summary>
    /// <param name="userId">The user ID to search within</param>
    /// <param name="query">The search query</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>List of matching file groups</returns>
    Task<List<FileGroup>> SearchFileGroupsAsync(string userId, string query, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Get session count for a specific file group
    /// </summary>
    /// <param name="groupId">The group ID to count sessions for</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Number of sessions associated with the group</returns>
    Task<int> GetGroupSessionCountAsync(string groupId, CancellationToken cancellationToken = default);
}