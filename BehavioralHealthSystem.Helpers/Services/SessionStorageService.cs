using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace BehavioralHealthSystem.Services;

public class SessionStorageService : ISessionStorageService
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly ILogger<SessionStorageService> _logger;
    private readonly JsonSerializerOptions _jsonOptions;
    private const string CONTAINER_NAME = "session-data";

    public SessionStorageService(BlobServiceClient blobServiceClient, ILogger<SessionStorageService> logger)
    {
        _blobServiceClient = blobServiceClient;
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };
    }

    public async Task<bool> SaveSessionDataAsync(SessionData sessionData, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Saving session data for session: {SessionId}, user: {UserId}",
                sessionData.SessionId, sessionData.UserId);

            var containerClient = await GetContainerClientAsync(cancellationToken);
            var blobName = GenerateBlobName(sessionData.UserId, sessionData.SessionId);
            var blobClient = containerClient.GetBlobClient(blobName);

            sessionData.UpdatedAt = DateTime.UtcNow.ToString("O");
            var jsonData = JsonSerializer.Serialize(sessionData, _jsonOptions);
            var content = new BinaryData(jsonData);

            var metadata = new Dictionary<string, string>
            {
                ["userId"] = sessionData.UserId,
                ["sessionId"] = sessionData.SessionId,
                ["status"] = sessionData.Status,
                ["createdAt"] = sessionData.CreatedAt,
                ["updatedAt"] = sessionData.UpdatedAt
            };

            var response = await blobClient.UploadAsync(content,
                new BlobUploadOptions
                {
                    Metadata = metadata
                },
                cancellationToken);

            _logger.LogInformation("Successfully saved session data for session: {SessionId}", sessionData.SessionId);
            return response.Value != null;
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
            _logger.LogInformation("Getting session data for session: {SessionId}", sessionId);

            var containerClient = await GetContainerClientAsync(cancellationToken);

            // Search for blob by session ID across all user folders
            await foreach (var blobItem in containerClient.GetBlobsAsync(
                traits: BlobTraits.Metadata,
                prefix: null,
                cancellationToken: cancellationToken))
            {
                if (blobItem.Metadata?.TryGetValue("sessionId", out var metaSessionId) == true &&
                    metaSessionId == sessionId)
                {
                    var blobClient = containerClient.GetBlobClient(blobItem.Name);
                    var response = await blobClient.DownloadContentAsync(cancellationToken);
                    var jsonData = response.Value.Content.ToString();

                    var sessionData = JsonSerializer.Deserialize<SessionData>(jsonData, _jsonOptions);
                    _logger.LogInformation("Successfully retrieved session data for session: {SessionId}", sessionId);
                    return sessionData;
                }
            }

            _logger.LogWarning("Session data not found for session: {SessionId}", sessionId);
            return null;
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
            _logger.LogInformation("Getting all sessions for user: {UserId}", userId);

            var containerClient = await GetContainerClientAsync(cancellationToken);
            var sessions = new List<SessionData>();
            var prefix = $"users/{userId}/sessions/";

            await foreach (var blobItem in containerClient.GetBlobsAsync(
                traits: BlobTraits.Metadata,
                prefix: prefix,
                cancellationToken: cancellationToken))
            {
                try
                {
                    var blobClient = containerClient.GetBlobClient(blobItem.Name);
                    var response = await blobClient.DownloadContentAsync(cancellationToken);
                    var jsonData = response.Value.Content.ToString();

                    var sessionData = JsonSerializer.Deserialize<SessionData>(jsonData, _jsonOptions);
                    if (sessionData != null)
                    {
                        sessions.Add(sessionData);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error deserializing session data from blob: {BlobName}", blobItem.Name);
                }
            }

            // Sort by created date descending (newest first)
            sessions = sessions.OrderByDescending(s => DateTime.TryParse(s.CreatedAt, out var date) ? date : DateTime.MinValue).ToList();

            _logger.LogInformation("Successfully retrieved {Count} sessions for user: {UserId}", sessions.Count, userId);
            return sessions;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting sessions for user: {UserId}", userId);
            return [];
        }
    }

    public async Task<List<SessionData>> GetAllSessionsAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Getting all sessions for all users");

            var containerClient = await GetContainerClientAsync(cancellationToken);
            var sessions = new List<SessionData>();

            // Get all sessions across all users by scanning all blobs with session metadata
            await foreach (var blobItem in containerClient.GetBlobsAsync(
                traits: BlobTraits.Metadata,
                prefix: "users/",
                cancellationToken: cancellationToken))
            {
                try
                {
                    // Only process blobs that are session files (end with .json and contain sessionId metadata)
                    if (blobItem.Name.EndsWith(".json") &&
                        blobItem.Metadata?.ContainsKey("sessionId") == true)
                    {
                        var blobClient = containerClient.GetBlobClient(blobItem.Name);
                        var response = await blobClient.DownloadContentAsync(cancellationToken);
                        var jsonData = response.Value.Content.ToString();

                        var sessionData = JsonSerializer.Deserialize<SessionData>(jsonData, _jsonOptions);
                        if (sessionData != null)
                        {
                            sessions.Add(sessionData);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error deserializing session data from blob: {BlobName}", blobItem.Name);
                }
            }

            // Sort by created date descending (newest first)
            sessions = sessions.OrderByDescending(s => DateTime.TryParse(s.CreatedAt, out var date) ? date : DateTime.MinValue).ToList();

            _logger.LogInformation("Successfully retrieved {Count} sessions across all users", sessions.Count);
            return sessions;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all sessions across all users");
            return [];
        }
    }

    public async Task<bool> UpdateSessionDataAsync(SessionData sessionData, CancellationToken cancellationToken = default)
    {
        // Update is the same as save for blob storage
        return await SaveSessionDataAsync(sessionData, cancellationToken);
    }

    public async Task<bool> DeleteSessionDataAsync(string sessionId, CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Deleting session data for session: {SessionId}", sessionId);

            var containerClient = await GetContainerClientAsync(cancellationToken);

            // Find and delete the blob
            await foreach (var blobItem in containerClient.GetBlobsAsync(
                traits: BlobTraits.Metadata,
                prefix: null,
                cancellationToken: cancellationToken))
            {
                if (blobItem.Metadata?.TryGetValue("sessionId", out var metaSessionId) == true &&
                    metaSessionId == sessionId)
                {
                    var blobClient = containerClient.GetBlobClient(blobItem.Name);
                    var response = await blobClient.DeleteIfExistsAsync(cancellationToken: cancellationToken);

                    _logger.LogInformation("Successfully deleted session data for session: {SessionId}", sessionId);
                    return response.Value;
                }
            }

            _logger.LogWarning("Session data not found for deletion: {SessionId}", sessionId);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting session data for session: {SessionId}", sessionId);
            return false;
        }
    }

    private async Task<BlobContainerClient> GetContainerClientAsync(CancellationToken cancellationToken = default)
    {
        var containerClient = _blobServiceClient.GetBlobContainerClient(CONTAINER_NAME);
        await containerClient.CreateIfNotExistsAsync(cancellationToken: cancellationToken);
        return containerClient;
    }

    private static string GenerateBlobName(string userId, string sessionId)
    {
        return $"users/{userId}/sessions/{sessionId}.json";
    }
}
