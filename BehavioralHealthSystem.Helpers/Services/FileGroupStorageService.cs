using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace BehavioralHealthSystem.Services;

public class FileGroupStorageService : IFileGroupStorageService
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly ILogger<FileGroupStorageService> _logger;
    private readonly ISessionStorageService _sessionStorageService;
    private readonly JsonSerializerOptions _jsonOptions;
    private const string CONTAINER_NAME = "file-groups";

    public FileGroupStorageService(
        BlobServiceClient blobServiceClient, 
        ILogger<FileGroupStorageService> logger,
        ISessionStorageService sessionStorageService)
    {
        _blobServiceClient = blobServiceClient;
        _logger = logger;
        _sessionStorageService = sessionStorageService;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };
    }

    public async Task<FileGroup?> CreateFileGroupAsync(CreateFileGroupRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Creating file group: {GroupName} for user: {UserId}", request.GroupName, request.CreatedBy);

            var fileGroup = new FileGroup
            {
                GroupId = Guid.NewGuid().ToString(),
                GroupName = request.GroupName,
                Description = request.Description,
                CreatedBy = request.CreatedBy,
                CreatedAt = DateTime.UtcNow.ToString("O"),
                UpdatedAt = DateTime.UtcNow.ToString("O"),
                Status = "active",
                SessionCount = 0
            };

            var containerClient = await GetContainerClientAsync(cancellationToken);
            var blobName = GenerateBlobName(request.CreatedBy, fileGroup.GroupId);
            var blobClient = containerClient.GetBlobClient(blobName);

            var jsonData = JsonSerializer.Serialize(fileGroup, _jsonOptions);
            var content = new BinaryData(jsonData);

            var metadata = new Dictionary<string, string>
            {
                ["userId"] = fileGroup.CreatedBy,
                ["groupId"] = fileGroup.GroupId,
                ["groupName"] = fileGroup.GroupName,
                ["status"] = fileGroup.Status,
                ["createdAt"] = fileGroup.CreatedAt,
                ["updatedAt"] = fileGroup.UpdatedAt
            };

            var response = await blobClient.UploadAsync(content, 
                new BlobUploadOptions 
                { 
                    Metadata = metadata
                }, 
                cancellationToken);

            _logger.LogInformation("Successfully created file group: {GroupId}", fileGroup.GroupId);
            return fileGroup;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating file group: {GroupName} for user: {UserId}", request.GroupName, request.CreatedBy);
            return null;
        }
    }

    public async Task<List<FileGroup>> GetUserFileGroupsAsync(string userId, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Getting all file groups for user: {UserId}", userId);

            var containerClient = await GetContainerClientAsync(cancellationToken);
            var fileGroups = new List<FileGroup>();
            var prefix = $"users/{userId}/groups/";

            await foreach (var blobItem in containerClient.GetBlobsAsync(
                traits: BlobTraits.Metadata,
                prefix: prefix,
                cancellationToken: cancellationToken))
            {
                try
                {
                    // Skip archived groups unless specifically requested
                    if (blobItem.Metadata?.TryGetValue("status", out var status) == true &&
                        status == "archived")
                    {
                        continue;
                    }

                    var blobClient = containerClient.GetBlobClient(blobItem.Name);
                    var response = await blobClient.DownloadContentAsync(cancellationToken);
                    var jsonData = response.Value.Content.ToString();
                    
                    var fileGroup = JsonSerializer.Deserialize<FileGroup>(jsonData, _jsonOptions);
                    if (fileGroup != null)
                    {
                        // Update session count dynamically
                        fileGroup.SessionCount = await GetGroupSessionCountAsync(fileGroup.GroupId, cancellationToken);
                        fileGroups.Add(fileGroup);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error deserializing file group data from blob: {BlobName}", blobItem.Name);
                }
            }

            // Sort by updated date descending (most recently updated first)
            fileGroups = fileGroups.OrderByDescending(g => DateTime.TryParse(g.UpdatedAt, out var date) ? date : DateTime.MinValue).ToList();

            _logger.LogInformation("Successfully retrieved {Count} file groups for user: {UserId}", fileGroups.Count, userId);
            return fileGroups;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting file groups for user: {UserId}", userId);
            return new List<FileGroup>();
        }
    }

    public async Task<FileGroup?> GetFileGroupAsync(string groupId, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Getting file group: {GroupId}", groupId);

            var containerClient = await GetContainerClientAsync(cancellationToken);
            
            // Search for blob by group ID across all user folders
            await foreach (var blobItem in containerClient.GetBlobsAsync(
                traits: BlobTraits.Metadata,
                prefix: null,
                cancellationToken: cancellationToken))
            {
                if (blobItem.Metadata?.TryGetValue("groupId", out var metaGroupId) == true && 
                    metaGroupId == groupId)
                {
                    var blobClient = containerClient.GetBlobClient(blobItem.Name);
                    var response = await blobClient.DownloadContentAsync(cancellationToken);
                    var jsonData = response.Value.Content.ToString();
                    
                    var fileGroup = JsonSerializer.Deserialize<FileGroup>(jsonData, _jsonOptions);
                    if (fileGroup != null)
                    {
                        // Update session count dynamically
                        fileGroup.SessionCount = await GetGroupSessionCountAsync(fileGroup.GroupId, cancellationToken);
                    }
                    
                    _logger.LogInformation("Successfully retrieved file group: {GroupId}", groupId);
                    return fileGroup;
                }
            }

            _logger.LogWarning("File group not found: {GroupId}", groupId);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting file group: {GroupId}", groupId);
            return null;
        }
    }

    public async Task<bool> UpdateFileGroupAsync(FileGroup fileGroup, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Updating file group: {GroupId}", fileGroup.GroupId);

            var containerClient = await GetContainerClientAsync(cancellationToken);
            var blobName = GenerateBlobName(fileGroup.CreatedBy, fileGroup.GroupId);
            var blobClient = containerClient.GetBlobClient(blobName);

            fileGroup.UpdatedAt = DateTime.UtcNow.ToString("O");
            var jsonData = JsonSerializer.Serialize(fileGroup, _jsonOptions);
            var content = new BinaryData(jsonData);

            var metadata = new Dictionary<string, string>
            {
                ["userId"] = fileGroup.CreatedBy,
                ["groupId"] = fileGroup.GroupId,
                ["groupName"] = fileGroup.GroupName,
                ["status"] = fileGroup.Status,
                ["createdAt"] = fileGroup.CreatedAt,
                ["updatedAt"] = fileGroup.UpdatedAt
            };

            var response = await blobClient.UploadAsync(content, 
                new BlobUploadOptions 
                { 
                    Metadata = metadata
                }, 
                cancellationToken);

            _logger.LogInformation("Successfully updated file group: {GroupId}", fileGroup.GroupId);
            return response.Value != null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating file group: {GroupId}", fileGroup.GroupId);
            return false;
        }
    }

    public async Task<bool> ArchiveFileGroupAsync(string groupId, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Archiving file group: {GroupId}", groupId);

            var fileGroup = await GetFileGroupAsync(groupId, cancellationToken);
            if (fileGroup == null)
            {
                _logger.LogWarning("File group not found for archiving: {GroupId}", groupId);
                return false;
            }

            fileGroup.Status = "archived";
            return await UpdateFileGroupAsync(fileGroup, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error archiving file group: {GroupId}", groupId);
            return false;
        }
    }

    public async Task<List<FileGroup>> SearchFileGroupsAsync(string userId, string query, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Searching file groups for user: {UserId} with query: {Query}", userId, query);

            var allGroups = await GetUserFileGroupsAsync(userId, cancellationToken);
            
            if (string.IsNullOrWhiteSpace(query))
            {
                return allGroups;
            }

            var searchQuery = query.ToLowerInvariant();
            var matchingGroups = allGroups.Where(g => 
                g.GroupName.ToLowerInvariant().Contains(searchQuery) ||
                (!string.IsNullOrEmpty(g.Description) && g.Description.ToLowerInvariant().Contains(searchQuery))
            ).ToList();

            _logger.LogInformation("Found {Count} matching file groups for query: {Query}", matchingGroups.Count, query);
            return matchingGroups;
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
            _logger.LogInformation("Getting session count for group: {GroupId}", groupId);

            // Get all sessions and count those with this groupId
            var allSessions = await _sessionStorageService.GetAllSessionsAsync(cancellationToken);
            var groupSessionCount = allSessions.Count(s => s.GroupId == groupId);

            _logger.LogInformation("Found {Count} sessions for group: {GroupId}", groupSessionCount, groupId);
            return groupSessionCount;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting session count for group: {GroupId}", groupId);
            return 0;
        }
    }

    private async Task<BlobContainerClient> GetContainerClientAsync(CancellationToken cancellationToken = default)
    {
        var containerClient = _blobServiceClient.GetBlobContainerClient(CONTAINER_NAME);
        await containerClient.CreateIfNotExistsAsync(cancellationToken: cancellationToken);
        return containerClient;
    }

    private static string GenerateBlobName(string userId, string groupId)
    {
        return $"users/{userId}/groups/{groupId}.json";
    }
}