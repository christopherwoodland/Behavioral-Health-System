using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using System.Text;

namespace BehavioralHealthSystem.Functions.Functions;

/// <summary>
/// Azure Function to save and update chat transcripts to blob storage
/// </summary>
public class SaveChatTranscriptFunction
{
    private readonly ILogger<SaveChatTranscriptFunction> _logger;
    private readonly BlobServiceClient _blobServiceClient;

    public SaveChatTranscriptFunction(
        ILogger<SaveChatTranscriptFunction> logger,
        BlobServiceClient blobServiceClient)
    {
        _logger = logger;
        _blobServiceClient = blobServiceClient;
    }

    [Function("SaveChatTranscript")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req)
    {
        try
        {
            _logger.LogInformation("Processing chat transcript save request");

            // Read request body
            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            
            if (string.IsNullOrWhiteSpace(requestBody))
            {
                _logger.LogWarning("Invalid request: request body is empty");
                var badResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync("Invalid request: request body is empty");
                return badResponse;
            }

            _logger.LogDebug("Request body length: {Length}", requestBody.Length);
            
            var requestData = JsonSerializer.Deserialize<SaveChatTranscriptRequest>(requestBody, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

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

            // Generate blob name with session ID and user ID
            var containerName = requestData.ContainerName ?? "chat-transcripts";
            var fileName = requestData.FileName ?? 
                $"{requestData.TranscriptData.UserId}/session-{requestData.TranscriptData.SessionId}.json";

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
            await response.WriteAsJsonAsync(new
            {
                success = true,
                message = "Chat transcript saved successfully",
                sessionId = finalTranscript.SessionId,
                messageCount = finalTranscript.Messages.Count,
                blobName = fileName
            });

            return response;
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
            newData.CreatedAt = DateTime.UtcNow.ToString("O");
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

        // Update metadata
        existing.LastUpdated = DateTime.UtcNow.ToString("O");
        existing.IsActive = newData.IsActive;
        
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

public class SaveChatTranscriptRequest
{
    public ChatTranscriptData TranscriptData { get; set; } = null!;
    public Dictionary<string, object>? Metadata { get; set; }
    public string? ContainerName { get; set; }
    public string? FileName { get; set; }
}

public class ChatTranscriptData
{
    public string UserId { get; set; } = "";
    public string SessionId { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public string LastUpdated { get; set; } = "";
    public string? SessionEndedAt { get; set; }
    public bool IsActive { get; set; } = true;
    public List<ChatMessageData> Messages { get; set; } = new();
    public ChatSessionMetadata? Metadata { get; set; }
}

public class ChatMessageData
{
    public string Id { get; set; } = "";
    public string Role { get; set; } = ""; // "user", "assistant", "system"
    public string Content { get; set; } = "";
    public string Timestamp { get; set; } = "";
    public string? MessageType { get; set; } // Optional: "phq-assessment", "general-chat", etc.
    public Dictionary<string, object>? AdditionalData { get; set; }
}

public class ChatSessionMetadata
{
    public string? UserAgent { get; set; }
    public string? ClientTimezone { get; set; }
    public string? IpAddress { get; set; }
    public string? Platform { get; set; }
    public Dictionary<string, object>? CustomData { get; set; }
}