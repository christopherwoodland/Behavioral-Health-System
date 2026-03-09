using Azure.Storage.Blobs.Models;
using BehavioralHealthSystem.Helpers.Models;
using BehavioralHealthSystem.Helpers.Services;

namespace BehavioralHealthSystem.Functions.Functions;

/// <summary>
/// Azure Function to save and update chat transcripts to blob storage
/// </summary>
public class SaveChatTranscriptFunction
{
    private readonly ILogger<SaveChatTranscriptFunction> _logger;
    private readonly BlobServiceClient _blobServiceClient;
    private readonly IChatTranscriptService? _chatTranscriptService;
    private readonly bool _usePostgres;

    /// <summary>
    /// Initializes a new instance of the SaveChatTranscriptFunction
    /// </summary>
    public SaveChatTranscriptFunction(
        ILogger<SaveChatTranscriptFunction> logger,
        BlobServiceClient blobServiceClient,
        IConfiguration config,
        IServiceProvider serviceProvider)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _blobServiceClient = blobServiceClient ?? throw new ArgumentNullException(nameof(blobServiceClient));
        _usePostgres = config["STORAGE_BACKEND"]?.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase) == true;
        _chatTranscriptService = _usePostgres ? serviceProvider.GetService(typeof(IChatTranscriptService)) as IChatTranscriptService : null;
    }

    /// <summary>
    /// Saves or updates a chat transcript to blob storage, merging with existing data if present
    /// </summary>
    /// <param name="req">HTTP request containing transcript data</param>
    /// <returns>HTTP response with save status and metadata</returns>
    /// <remarks>
    /// Expected request body format:
    /// <code>
    /// {
    ///   "transcriptData": {
    ///     "userId": "user123",
    ///     "sessionId": "session456",
    ///     "messages": [
    ///       {
    ///         "id": "msg1",
    ///         "role": "user",
    ///         "content": "Hello",
    ///         "timestamp": "2024-01-01T12:00:00Z"
    ///       }
    ///     ]
    ///   }
    /// }
    /// </code>
    /// Returns HTTP 200 on success, HTTP 400 for invalid data, HTTP 500 on error
    /// </remarks>
    [Function("SaveChatTranscript")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req)
    {
        try
        {
            _logger.LogInformation("Processing chat transcript save request");

            // Read request body
            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();

            _logger.LogDebug("Request body received: {RequestBody}", requestBody);

            var deserializeOptions = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            var requestData = JsonSerializer.Deserialize<SaveChatTranscriptRequest>(requestBody, deserializeOptions);

            if (requestData?.TranscriptData == null)
            {
                _logger.LogWarning("Invalid request: missing transcript data");
                var badResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync("Invalid request: missing transcript data");
                return badResponse;
            }

            // Validate transcript data
            var validation = ValidateTranscriptData(requestData.TranscriptData);
            if (!validation.IsValid)
            {
                _logger.LogWarning("Invalid transcript data: {ValidationError}", validation.ErrorMessage);
                var badResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync(validation.ErrorMessage!);
                return badResponse;
            }

            // PostgreSQL storage path
            if (_usePostgres && _chatTranscriptService != null)
            {
                await _chatTranscriptService.SaveTranscriptAsync(requestData.TranscriptData);
                _logger.LogInformation("Successfully saved chat transcript to PostgreSQL for user {UserId}, session {SessionId}",
                    requestData.TranscriptData.UserId, requestData.TranscriptData.SessionId);

                var pgResponse = req.CreateResponse(System.Net.HttpStatusCode.OK);
                pgResponse.Headers.Add("Content-Type", "application/json; charset=utf-8");
                await pgResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = true,
                    message = "Chat transcript saved successfully",
                    sessionId = requestData.TranscriptData.SessionId,
                    messageCount = requestData.TranscriptData.Messages?.Count ?? 0,
                    storage = "PostgreSQL"
                }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }));
                return pgResponse;
            }

            // Blob storage path (default)
            // Generate blob name with session ID and user ID
            // Structure: users/{userId}/conversations/{sessionId}.json
            var containerName = requestData.ContainerName ?? "chat-transcripts";
            var fileName = requestData.FileName ??
                $"users/{requestData.TranscriptData.UserId}/conversations/{requestData.TranscriptData.SessionId}.json";

            // Get or create container
            var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

            // Get blob client
            var blobClient = containerClient.GetBlobClient(fileName);

            // Try to get existing transcript
            ChatTranscriptData existingTranscript = null!;
            try
            {
                if (await blobClient.ExistsAsync())
                {
                    var downloadResponse = await blobClient.DownloadContentAsync();
                    var existingJson = downloadResponse.Value.Content.ToString();
                    existingTranscript = JsonSerializer.Deserialize<ChatTranscriptData>(existingJson)!;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not read existing transcript, creating new one");
            }

            // Merge or create transcript
            var finalTranscript = MergeTranscripts(existingTranscript, requestData.TranscriptData);

            // Serialize with proper formatting
            var jsonOptions = new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            var transcriptJson = JsonSerializer.Serialize(finalTranscript, jsonOptions);
            var content = new BinaryData(Encoding.UTF8.GetBytes(transcriptJson));

            // Set metadata
            var metadata = new Dictionary<string, string>
            {
                ["userId"] = finalTranscript.UserId,
                ["sessionId"] = finalTranscript.SessionId,
                ["messageCount"] = finalTranscript.Messages.Count.ToString(),
                ["lastUpdated"] = DateTime.UtcNow.ToString("O"),
                ["isActive"] = finalTranscript.IsActive.ToString().ToLower()
            };

            if (requestData.Metadata != null)
            {
                foreach (var item in requestData.Metadata)
                {
                    if (!metadata.ContainsKey(item.Key))
                    {
                        metadata[item.Key] = item.Value?.ToString() ?? "";
                    }
                }
            }

            // Upload blob (delete existing first to ensure clean overwrite)
            if (await blobClient.ExistsAsync())
            {
                await blobClient.DeleteAsync();
            }

            var uploadOptions = new BlobUploadOptions
            {
                Metadata = metadata,
                HttpHeaders = new BlobHttpHeaders
                {
                    ContentType = "application/json"
                }
            };

            await blobClient.UploadAsync(content, uploadOptions);

            _logger.LogInformation("Successfully saved chat transcript for user {UserId}, session {SessionId}, {MessageCount} messages",
                finalTranscript.UserId, finalTranscript.SessionId, finalTranscript.Messages.Count);

            // Return success response
            var response = req.CreateResponse(System.Net.HttpStatusCode.OK);
            var responseJson = JsonSerializer.Serialize(new
            {
                success = true,
                message = "Chat transcript saved successfully",
                sessionId = finalTranscript.SessionId,
                messageCount = finalTranscript.Messages.Count,
                blobName = fileName
            }, jsonOptions);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");
            await response.WriteStringAsync(responseJson);

            return response;
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex, "Invalid JSON in request body");

            var badResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
            await badResponse.WriteStringAsync("Invalid request: malformed JSON");
            return badResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving chat transcript");

            var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync("An error occurred while saving the chat transcript");
            return errorResponse;
        }
    }

    private (bool IsValid, string? ErrorMessage) ValidateTranscriptData(ChatTranscriptData transcript)
    {
        if (string.IsNullOrWhiteSpace(transcript.UserId))
            return (false, "User ID is required");

        if (string.IsNullOrWhiteSpace(transcript.SessionId))
            return (false, "Session ID is required");

        if (transcript.Messages == null)
            return (false, "Messages collection cannot be null");

        // Validate each message
        for (int i = 0; i < transcript.Messages.Count; i++)
        {
            var message = transcript.Messages[i];

            if (string.IsNullOrWhiteSpace(message.Id))
                return (false, $"Message {i}: ID is required");

            if (string.IsNullOrWhiteSpace(message.Role))
                return (false, $"Message {i}: Role is required");

            if (message.Role != "user" && message.Role != "assistant" && message.Role != "system")
                return (false, $"Message {i}: Role must be 'user', 'assistant', or 'system'");

            if (string.IsNullOrWhiteSpace(message.Content))
                return (false, $"Message {i}: Content is required");

            if (string.IsNullOrWhiteSpace(message.Timestamp))
                return (false, $"Message {i}: Timestamp is required");
        }

        return (true, null);
    }

    private ChatTranscriptData MergeTranscripts(ChatTranscriptData? existing, ChatTranscriptData newData)
    {
        if (existing == null)
        {
            // Return new transcript with updated metadata
            // Ensure createdAt is set if not provided
            if (string.IsNullOrWhiteSpace(newData.CreatedAt))
            {
                newData.CreatedAt = DateTime.UtcNow.ToString("O");
            }
            newData.LastUpdated = DateTime.UtcNow.ToString("O");
            return newData;
        }

        // Merge messages - add any new messages that don't already exist
        var existingMessageIds = new HashSet<string>(existing.Messages.Select(m => m.Id));

        foreach (var newMessage in newData.Messages)
        {
            if (!existingMessageIds.Contains(newMessage.Id))
            {
                existing.Messages.Add(newMessage);
            }
        }

        // Update metadata but preserve original creation info
        existing.LastUpdated = DateTime.UtcNow.ToString("O");
        existing.IsActive = newData.IsActive;

        // Preserve userId and sessionId from existing if new data has empty values
        if (string.IsNullOrWhiteSpace(newData.UserId) && !string.IsNullOrWhiteSpace(existing.UserId))
        {
            // Keep existing userId
        }
        else if (!string.IsNullOrWhiteSpace(newData.UserId))
        {
            existing.UserId = newData.UserId;
        }

        if (string.IsNullOrWhiteSpace(newData.SessionId) && !string.IsNullOrWhiteSpace(existing.SessionId))
        {
            // Keep existing sessionId
        }
        else if (!string.IsNullOrWhiteSpace(newData.SessionId))
        {
            existing.SessionId = newData.SessionId;
        }

        // Update session end time if session is no longer active
        if (!newData.IsActive && string.IsNullOrEmpty(existing.SessionEndedAt))
        {
            existing.SessionEndedAt = DateTime.UtcNow.ToString("O");
        }

        // Sort messages by timestamp to maintain order
        existing.Messages = existing.Messages
            .OrderBy(m => DateTime.TryParse(m.Timestamp, out var dt) ? dt : DateTime.MinValue)
            .ToList();

        return existing;
    }
}

// Models (SaveChatTranscriptRequest, ChatTranscriptData, ChatMessageData, ChatSessionMetadata)
// are defined in BehavioralHealthSystem.Helpers.Models.ChatTranscriptModels
