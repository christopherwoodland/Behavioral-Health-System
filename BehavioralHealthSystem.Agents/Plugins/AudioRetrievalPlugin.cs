using System.ComponentModel;
using Azure.Storage.Blobs.Models;
using Microsoft.SemanticKernel;

namespace BehavioralHealthSystem.Agents.Plugins;

/// <summary>
/// Semantic Kernel native function plugin for retrieving audio files from Azure Blob Storage.
/// Step 1 of the audio processing pipeline: Fetch.
/// </summary>
public class AudioRetrievalPlugin
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly ILogger<AudioRetrievalPlugin> _logger;
    private const string ContainerName = "audio-uploads";

    public AudioRetrievalPlugin(
        BlobServiceClient blobServiceClient,
        ILogger<AudioRetrievalPlugin> logger)
    {
        _blobServiceClient = blobServiceClient ?? throw new ArgumentNullException(nameof(blobServiceClient));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <summary>
    /// Retrieves an audio file from the recordings blob container.
    /// If fileName is not specified, retrieves the most recent recording for the session.
    /// </summary>
    [KernelFunction("GetAudioFromBlob")]
    [Description("Retrieves an audio file from Azure Blob Storage for a given user and session. Returns the audio data, file name, and metadata.")]
    public async Task<AudioFile> GetAudioFromBlobAsync(
        [Description("The user ID who owns the recording")] string userId,
        [Description("The session ID associated with the recording")] string sessionId,
        [Description("Optional specific file name. If null, retrieves the most recent recording for the session.")] string? fileName = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userId, nameof(userId));
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionId, nameof(sessionId));

        _logger.LogInformation(
            "[{PluginName}] Fetching audio for UserId={UserId}, SessionId={SessionId}, FileName={FileName}",
            nameof(AudioRetrievalPlugin), userId, sessionId, fileName ?? "(latest)");

        var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);

        // If a specific file name is provided, download it directly
        if (!string.IsNullOrWhiteSpace(fileName))
        {
            return await DownloadSpecificBlobAsync(containerClient, userId, sessionId, fileName, cancellationToken);
        }

        // Otherwise, find the most recent blob for this user/session
        return await DownloadLatestBlobAsync(containerClient, userId, sessionId, cancellationToken);
    }

    private async Task<AudioFile> DownloadSpecificBlobAsync(
        BlobContainerClient containerClient,
        string userId,
        string sessionId,
        string fileName,
        CancellationToken cancellationToken)
    {
        // Try common blob path patterns used by AudioUploadFunctions
        var candidatePaths = new[]
        {
            $"users/{userId}/{fileName}",
            $"users/{userId}/session-{sessionId}/{fileName}",
            fileName // Direct path fallback
        };

        foreach (var blobPath in candidatePaths)
        {
            var blobClient = containerClient.GetBlobClient(blobPath);
            if (await blobClient.ExistsAsync(cancellationToken))
            {
                return await DownloadBlobAsync(blobClient, userId, sessionId, cancellationToken);
            }
        }

        throw new FileNotFoundException(
            $"Audio file '{fileName}' not found for user '{userId}', session '{sessionId}'. " +
            $"Searched paths: {string.Join(", ", candidatePaths)}");
    }

    private async Task<AudioFile> DownloadLatestBlobAsync(
        BlobContainerClient containerClient,
        string userId,
        string sessionId,
        CancellationToken cancellationToken)
    {
        var prefix = $"users/{userId}/";
        BlobItem? latestBlob = null;
        DateTimeOffset latestDate = DateTimeOffset.MinValue;

        _logger.LogInformation(
            "[{PluginName}] Searching for latest blob with prefix '{Prefix}' matching session '{SessionId}'",
            nameof(AudioRetrievalPlugin), prefix, sessionId);

        await foreach (var blobItem in containerClient.GetBlobsAsync(
            traits: BlobTraits.Metadata,
            prefix: prefix,
            cancellationToken: cancellationToken))
        {
            // Match blobs that contain the session ID in their name
            if (blobItem.Name.Contains(sessionId, StringComparison.OrdinalIgnoreCase))
            {
                var lastModified = blobItem.Properties.LastModified ?? DateTimeOffset.MinValue;
                if (lastModified > latestDate)
                {
                    latestDate = lastModified;
                    latestBlob = blobItem;
                }
            }
        }

        if (latestBlob == null)
        {
            throw new FileNotFoundException(
                $"No audio recordings found for user '{userId}', session '{sessionId}' in container '{ContainerName}'.");
        }

        _logger.LogInformation(
            "[{PluginName}] Found latest blob: {BlobName}, LastModified={LastModified}",
            nameof(AudioRetrievalPlugin), latestBlob.Name, latestDate);

        var blobClient = containerClient.GetBlobClient(latestBlob.Name);
        return await DownloadBlobAsync(blobClient, userId, sessionId, cancellationToken);
    }

    private async Task<AudioFile> DownloadBlobAsync(
        BlobClient blobClient,
        string userId,
        string sessionId,
        CancellationToken cancellationToken)
    {
        using var memoryStream = new MemoryStream();
        var downloadResult = await blobClient.DownloadToAsync(memoryStream, cancellationToken);

        var properties = await blobClient.GetPropertiesAsync(cancellationToken: cancellationToken);
        var contentType = properties.Value.ContentType ?? InferContentType(blobClient.Name);

        var audioFile = new AudioFile
        {
            Data = memoryStream.ToArray(),
            FileName = Path.GetFileName(blobClient.Name),
            ContentType = contentType,
            BlobPath = blobClient.Name,
            SourcePath = string.Empty,
            Source = AudioFileSource.BlobStorage,
            UserId = userId,
            SessionId = sessionId
        };

        _logger.LogInformation(
            "[{PluginName}] Downloaded audio: {BlobPath}, Size={Size} bytes, ContentType={ContentType}",
            nameof(AudioRetrievalPlugin), audioFile.BlobPath, audioFile.FileSize, audioFile.ContentType);

        return audioFile;
    }

    private static string InferContentType(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension switch
        {
            ".wav" => "audio/wav",
            ".mp3" => "audio/mpeg",
            ".mp4" or ".m4a" => "audio/mp4",
            ".ogg" => "audio/ogg",
            ".webm" => "audio/webm",
            ".flac" => "audio/flac",
            ".aac" => "audio/aac",
            _ => "application/octet-stream"
        };
    }
}
