using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using BehavioralHealthSystem.Helpers.Services.Interfaces;

namespace BehavioralHealthSystem.Helpers.Services;

/// <summary>
/// Service for managing user biometric data in Azure Blob Storage.
/// </summary>
public class BiometricDataService : IBiometricDataService
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly ILogger<BiometricDataService> _logger;
    private const string ContainerName = "bio";

    /// <summary>
    /// Initializes a new instance of the <see cref="BiometricDataService"/> class.
    /// </summary>
    /// <param name="blobServiceClient">The Azure Blob Service client.</param>
    /// <param name="logger">The logger instance.</param>
    /// <exception cref="ArgumentNullException">Thrown when required dependencies are null.</exception>
    public BiometricDataService(
        BlobServiceClient blobServiceClient,
        ILogger<BiometricDataService> logger)
    {
        _blobServiceClient = blobServiceClient ?? throw new ArgumentNullException(nameof(blobServiceClient));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc/>
    public async Task<bool> UserBiometricDataExistsAsync(string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            throw new ArgumentNullException(nameof(userId));

        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
            var blobPath = GetBlobPath(userId);
            var blobClient = containerClient.GetBlobClient(blobPath);

            bool exists = await blobClient.ExistsAsync(cancellationToken);

            _logger.LogInformation(
                "Biometric data existence check for user {UserId}: {Exists}",
                userId, exists);

            return exists;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error checking biometric data existence for user {UserId}",
                userId);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task<UserBiometricData?> GetUserBiometricDataAsync(string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            throw new ArgumentNullException(nameof(userId));

        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
            var blobPath = GetBlobPath(userId);
            var blobClient = containerClient.GetBlobClient(blobPath);

            if (!await blobClient.ExistsAsync(cancellationToken))
            {
                _logger.LogInformation(
                    "No biometric data found for user {UserId}",
                    userId);
                return null;
            }

            var response = await blobClient.DownloadContentAsync(cancellationToken);
            var jsonContent = response.Value.Content.ToString();

            var biometricData = JsonSerializer.Deserialize<UserBiometricData>(jsonContent, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            _logger.LogInformation(
                "Successfully retrieved biometric data for user {UserId}",
                userId);

            return biometricData;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error retrieving biometric data for user {UserId}",
                userId);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task SaveUserBiometricDataAsync(UserBiometricData biometricData, CancellationToken cancellationToken = default)
    {
        if (biometricData == null)
            throw new ArgumentNullException(nameof(biometricData));

        if (string.IsNullOrWhiteSpace(biometricData.UserId))
            throw new ArgumentException("User ID cannot be null or empty", nameof(biometricData));

        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);

            // Ensure container exists
            await containerClient.CreateIfNotExistsAsync(
                PublicAccessType.None,
                cancellationToken: cancellationToken);

            var blobPath = biometricData.GetBlobPath();
            var blobClient = containerClient.GetBlobClient(blobPath);

            // Check if updating existing data
            bool isUpdate = await blobClient.ExistsAsync(cancellationToken);
            if (isUpdate)
            {
                biometricData.MarkAsUpdated();
            }

            // Serialize to JSON
            var jsonContent = JsonSerializer.Serialize(biometricData, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            // Upload to blob storage
            using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(jsonContent));
            await blobClient.UploadAsync(
                stream,
                overwrite: true,
                cancellationToken: cancellationToken);

            _logger.LogInformation(
                "{Action} biometric data for user {UserId} at {BlobPath}",
                isUpdate ? "Updated" : "Created",
                biometricData.UserId,
                blobPath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error saving biometric data for user {UserId}",
                biometricData.UserId);
            throw;
        }
    }

    /// <inheritdoc/>
    public async Task<bool> DeleteUserBiometricDataAsync(string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            throw new ArgumentNullException(nameof(userId));

        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
            var blobPath = GetBlobPath(userId);
            var blobClient = containerClient.GetBlobClient(blobPath);

            var response = await blobClient.DeleteIfExistsAsync(
                DeleteSnapshotsOption.IncludeSnapshots,
                cancellationToken: cancellationToken);

            if (response.Value)
            {
                _logger.LogInformation(
                    "Successfully deleted biometric data for user {UserId}",
                    userId);
            }
            else
            {
                _logger.LogInformation(
                    "No biometric data found to delete for user {UserId}",
                    userId);
            }

            return response.Value;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error deleting biometric data for user {UserId}",
                userId);
            throw;
        }
    }

    /// <summary>
    /// Gets the blob storage path for a user's biometric data.
    /// </summary>
    /// <param name="userId">The user identifier.</param>
    /// <returns>The blob path in format "users/{userId}/biometric.json".</returns>
    private static string GetBlobPath(string userId)
    {
        return $"users/{userId}/biometric.json";
    }
}
