using System.Net;
using Azure.Storage.Blobs;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace BehavioralHealthSystem.Functions.Functions;

/// <summary>
/// Azure Function for downloading audio files from Azure Blob Storage.
/// Acts as a proxy so the frontend doesn't need direct blob storage credentials.
/// </summary>
public class AudioDownloadFunction
{
    private readonly ILogger<AudioDownloadFunction> _logger;
    private readonly BlobServiceClient _blobServiceClient;

    public AudioDownloadFunction(
        ILogger<AudioDownloadFunction> logger,
        BlobServiceClient blobServiceClient)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _blobServiceClient = blobServiceClient ?? throw new ArgumentNullException(nameof(blobServiceClient));
    }

    /// <summary>
    /// Downloads an audio file from Azure Blob Storage by its URL.
    /// The frontend calls this endpoint to play back audio for session details.
    /// </summary>
    [Function("DownloadAudio")]
    public async Task<HttpResponseData> DownloadAudioAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "audio/download")] HttpRequestData req)
    {
        try
        {
            var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
            var blobUrl = query["url"];

            if (string.IsNullOrWhiteSpace(blobUrl))
            {
                _logger.LogWarning("Audio download request missing 'url' query parameter");
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "url query parameter is required"
                });
                return badRequest;
            }

            _logger.LogInformation("🎵 Downloading audio from blob URL: {BlobUrl}", blobUrl);

            // Parse the blob URL to extract container and blob name
            if (!Uri.TryCreate(blobUrl, UriKind.Absolute, out var blobUri))
            {
                _logger.LogWarning("Invalid blob URL format: {BlobUrl}", blobUrl);
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Invalid blob URL format"
                });
                return badRequest;
            }

            // Validate the blob URL host matches our configured storage account
            var expectedHost = _blobServiceClient.Uri.Host;
            if (!blobUri.Host.Equals(expectedHost, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Blob URL host mismatch. Expected: {ExpectedHost}, Got: {ActualHost}",
                    expectedHost, blobUri.Host);
                var forbidden = req.CreateResponse(HttpStatusCode.Forbidden);
                await forbidden.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Blob URL does not belong to the configured storage account"
                });
                return forbidden;
            }

            // Extract container name and blob path from URL
            // URL format: https://<account>.blob.core.windows.net/<container>/<blob-path>
            var pathSegments = blobUri.AbsolutePath.TrimStart('/').Split('/', 2);
            if (pathSegments.Length < 2)
            {
                _logger.LogWarning("Could not extract container/blob from URL: {BlobUrl}", blobUrl);
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Could not parse container and blob path from URL"
                });
                return badRequest;
            }

            var containerName = pathSegments[0];
            var blobName = pathSegments[1];

            _logger.LogInformation("🎵 Downloading from container: {Container}, blob: {BlobName}",
                containerName, blobName);

            // Get blob client
            var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
            var blobClient = containerClient.GetBlobClient(blobName);

            // Check if blob exists
            var exists = await blobClient.ExistsAsync();
            if (!exists.Value)
            {
                _logger.LogWarning("Blob not found: {Container}/{BlobName}", containerName, blobName);
                var notFound = req.CreateResponse(HttpStatusCode.NotFound);
                await notFound.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Audio file not found"
                });
                return notFound;
            }

            // Download the blob
            var downloadResult = await blobClient.DownloadContentAsync();
            var blobContent = downloadResult.Value;

            // Determine content type
            var contentType = blobContent.Details.ContentType ?? "audio/wav";

            // Determine file extension for Content-Disposition
            var extension = Path.GetExtension(blobName);
            var downloadFileName = Path.GetFileName(blobName);

            _logger.LogInformation("🎵 Audio download successful - Size: {Size} bytes, ContentType: {ContentType}",
                blobContent.Content.ToMemory().Length, contentType);

            // Create response with audio content
            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", contentType);
            response.Headers.Add("Content-Disposition", $"inline; filename=\"{downloadFileName}\"");
            response.Headers.Add("Accept-Ranges", "bytes");
            response.Headers.Add("Cache-Control", "private, max-age=3600");

            await response.Body.WriteAsync(blobContent.Content.ToMemory());

            return response;
        }
        catch (Azure.RequestFailedException ex) when (ex.Status == 404)
        {
            _logger.LogWarning("Blob not found during download: {Message}", ex.Message);
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new
            {
                success = false,
                message = "Audio file not found in storage"
            });
            return notFound;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error downloading audio file: {Message}", ex.Message);
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteAsJsonAsync(new
            {
                success = false,
                error = "Failed to download audio file",
                message = ex.Message
            });
            return errorResponse;
        }
    }
}
