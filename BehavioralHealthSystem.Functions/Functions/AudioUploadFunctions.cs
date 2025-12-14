using System.Net;
using Azure.Storage.Blobs;
using BehavioralHealthSystem.Functions.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace BehavioralHealthSystem.Functions.Functions;

/// <summary>
/// Azure Functions for handling audio file uploads for Vocalist agent
/// </summary>
public class AudioUploadFunctions
{
    private readonly ILogger<AudioUploadFunctions> _logger;
    private readonly BlobServiceClient _blobServiceClient;
    private readonly IApiKeyValidationService _apiKeyValidation;

    public AudioUploadFunctions(
        ILogger<AudioUploadFunctions> logger,
        BlobServiceClient blobServiceClient,
        IApiKeyValidationService apiKeyValidation)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _blobServiceClient = blobServiceClient ?? throw new ArgumentNullException(nameof(blobServiceClient));
        _apiKeyValidation = apiKeyValidation ?? throw new ArgumentNullException(nameof(apiKeyValidation));
    }

    /// <summary>
    /// Uploads audio file to Azure Blob Storage.
    /// Requires API key validation in production environments.
    /// </summary>
    [Function("UploadAudioFile")]
    public async Task<HttpResponseData> UploadAudioFileAsync(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "upload-audio")] HttpRequestData req)
    {
        _logger.LogInformation("🎤 Processing audio file upload request");

        // Validate API key (skipped in development mode)
        if (!_apiKeyValidation.ValidateApiKey(req))
        {
            _logger.LogWarning("API key validation failed for upload-audio request");
            var unauthorizedResponse = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauthorizedResponse.WriteAsJsonAsync(new
            {
                success = false,
                message = "Unauthorized - valid API key required"
            });
            return unauthorizedResponse;
        }

        try
        {
            // Parse query parameters
            var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
            var userId = query["userId"];
            var sessionId = query["sessionId"];
            var fileName = query["fileName"] ?? $"audio-{DateTime.UtcNow:yyyyMMdd-HHmmss}.wav";

            // Validate required parameters
            if (string.IsNullOrWhiteSpace(userId))
            {
                _logger.LogWarning("UserId is missing from query parameters");
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "userId query parameter is required"
                });
                return badRequest;
            }

            if (string.IsNullOrWhiteSpace(sessionId))
            {
                _logger.LogWarning("SessionId is missing from query parameters");
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "sessionId query parameter is required"
                });
                return badRequest;
            }

            _logger.LogInformation("Uploading audio for User: {UserId}, Session: {SessionId}, File: {FileName}",
                userId, sessionId, fileName);

            // Read file from request body
            using var memoryStream = new MemoryStream();
            await req.Body.CopyToAsync(memoryStream);
            memoryStream.Position = 0;

            if (memoryStream.Length == 0)
            {
                _logger.LogWarning("Request body is empty");
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteAsJsonAsync(new
                {
                    success = false,
                    message = "Request body cannot be empty"
                });
                return badRequest;
            }

            _logger.LogInformation("File size: {FileSize} bytes", memoryStream.Length);

            // Create blob path: audio-uploads/users/{userId}/session-{sessionId}/{fileName}
            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
            var fileExtension = Path.GetExtension(fileName);
            var sanitizedFileName = $"session-{sessionId}-{timestamp}{fileExtension}";
            var blobName = $"users/{userId}/{sanitizedFileName}";

            _logger.LogInformation("Saving to blob: audio-uploads/{BlobName}", blobName);

            // Get blob container client
            var containerClient = _blobServiceClient.GetBlobContainerClient("audio-uploads");

            // Ensure container exists
            await containerClient.CreateIfNotExistsAsync(Azure.Storage.Blobs.Models.PublicAccessType.None);

            // Get blob client for the specific file
            var blobClient = containerClient.GetBlobClient(blobName);

            // Add metadata
            var metadata = new Dictionary<string, string>
            {
                { "userId", userId },
                { "sessionId", sessionId },
                { "originalFileName", fileName },
                { "uploadedAt", DateTime.UtcNow.ToString("O") },
                { "source", "jekyll-voice-recording" }
            };

            // Determine content type based on file extension
            var contentType = fileExtension.ToLowerInvariant() switch
            {
                ".wav" => "audio/wav",
                ".mp3" => "audio/mpeg",
                ".webm" => "audio/webm",
                ".ogg" => "audio/ogg",
                ".m4a" => "audio/mp4",
                _ => "application/octet-stream"
            };

            // Upload to blob storage
            var uploadOptions = new Azure.Storage.Blobs.Models.BlobUploadOptions
            {
                Metadata = metadata,
                HttpHeaders = new Azure.Storage.Blobs.Models.BlobHttpHeaders
                {
                    ContentType = contentType
                }
            };

            await blobClient.UploadAsync(memoryStream, uploadOptions);

            var blobUrl = blobClient.Uri.ToString();
            _logger.LogInformation("✅ Audio file uploaded successfully to: {BlobUrl}", blobUrl);

            // Return success response
            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteAsJsonAsync(new
            {
                success = true,
                message = "Audio file uploaded successfully",
                userId,
                sessionId,
                fileName = sanitizedFileName,
                blobUrl,
                blobPath = $"audio-uploads/{blobName}",
                fileSize = memoryStream.Length,
                contentType,
                uploadedAt = DateTime.UtcNow
            });

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error uploading audio file: {Message}", ex.Message);
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteAsJsonAsync(new
            {
                success = false,
                error = "Failed to upload audio file",
                message = ex.Message
            });
            return errorResponse;
        }
    }
}
