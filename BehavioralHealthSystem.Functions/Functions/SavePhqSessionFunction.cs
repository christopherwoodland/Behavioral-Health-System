using Azure.Storage.Blobs.Models;

namespace BehavioralHealthSystem.Functions.Functions;

/// <summary>
/// Azure Function to progressively save PHQ session data to blob storage
/// Similar to chat transcript saving - continuously updates session file
/// </summary>
public class SavePhqSessionFunction
{
    private readonly ILogger<SavePhqSessionFunction> _logger;
    private readonly BlobServiceClient _blobServiceClient;

    public SavePhqSessionFunction(
        ILogger<SavePhqSessionFunction> logger,
        BlobServiceClient blobServiceClient)
    {
        _logger = logger;
        _blobServiceClient = blobServiceClient;
    }

    [Function("SavePhqSession")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req)
    {
        try
        {
            _logger.LogInformation("Processing PHQ session save request");

            // Read request body
            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();

            // Configure JSON deserialization to be case-insensitive
            var deserializeOptions = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            var requestData = JsonSerializer.Deserialize<SaveSessionRequest>(requestBody, deserializeOptions);

            if (requestData?.SessionData == null)
            {
                _logger.LogWarning("Invalid request: missing session data");
                var badResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync("Invalid request: missing session data");
                return badResponse;
            }

            // Validate session data
            var validation = ValidateSessionData(requestData.SessionData);
            if (!validation.IsValid)
            {
                _logger.LogWarning("Invalid session data: {ValidationError}", validation.ErrorMessage);
                var badResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync($"Invalid session data: {validation.ErrorMessage}");
                return badResponse;
            }

            // Save to blob storage
            var saved = await SaveSessionToBlobAsync(requestData);
            if (!saved)
            {
                _logger.LogError("Failed to save PHQ session to blob storage");
                var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync("Failed to save PHQ session");
                return errorResponse;
            }

            _logger.LogInformation("Successfully saved PHQ session: {SessionId}", requestData.SessionData.SessionId);

            var response = req.CreateResponse(System.Net.HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = true,
                sessionId = requestData.SessionData.SessionId,
                assessmentId = requestData.SessionData.AssessmentId,
                isCompleted = requestData.SessionData.IsCompleted
            }));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PHQ session save request");
            var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync("Internal server error");
            return errorResponse;
        }
    }

    private async Task<bool> SaveSessionToBlobAsync(SaveSessionRequest request)
    {
        try
        {
            // Get or create container
            var containerName = request.ContainerName ?? "phq-sessions";
            var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

            // Generate filename if not provided
            var fileName = request.FileName ??
                $"users/{request.SessionData.UserId}/{request.SessionData.AssessmentType.ToLower().Replace("-", "")}-{request.SessionData.AssessmentId}.json";

            // Ensure filename ends with .json
            if (!fileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
            {
                fileName += ".json";
            }

            // Create blob client
            var blobClient = containerClient.GetBlobClient(fileName);

            // Serialize to JSON (entire session data - progressive save pattern)
            var jsonData = JsonSerializer.Serialize(request.SessionData, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            // Prepare blob metadata
            var blobMetadata = new Dictionary<string, string>
            {
                ["assessment_type"] = request.SessionData.AssessmentType,
                ["user_id"] = request.SessionData.UserId,
                ["session_id"] = request.SessionData.SessionId,
                ["assessment_id"] = request.SessionData.AssessmentId,
                ["is_completed"] = request.SessionData.IsCompleted.ToString(),
                ["created_at"] = request.SessionData.CreatedAt,
                ["last_updated"] = request.SessionData.LastUpdated,
                ["saved_at"] = DateTime.UtcNow.ToString("O")
            };

            // Add completion data if available
            if (!string.IsNullOrEmpty(request.SessionData.CompletedAt))
            {
                blobMetadata["completed_at"] = request.SessionData.CompletedAt;
            }
            if (request.SessionData.TotalScore.HasValue)
            {
                blobMetadata["total_score"] = request.SessionData.TotalScore.Value.ToString();
            }
            if (!string.IsNullOrEmpty(request.SessionData.Severity))
            {
                blobMetadata["severity"] = request.SessionData.Severity;
            }

            // Add custom metadata from request
            if (request.Metadata != null)
            {
                foreach (var kvp in request.Metadata)
                {
                    var key = kvp.Key.ToLower().Replace(" ", "_");
                    if (!blobMetadata.ContainsKey(key))
                    {
                        blobMetadata[key] = kvp.Value?.ToString() ?? "";
                    }
                }
            }

            // Upload blob with metadata - overwrite mode for progressive saves
            using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(jsonData));
            var blobUploadOptions = new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders
                {
                    ContentType = "application/json"
                },
                Metadata = blobMetadata
            };

            await blobClient.UploadAsync(stream, blobUploadOptions, cancellationToken: default);

            _logger.LogInformation("Successfully saved PHQ session {SessionId}/{AssessmentId} to blob {BlobName} in container {ContainerName}",
                request.SessionData.SessionId, request.SessionData.AssessmentId, fileName, containerName);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving PHQ session to blob storage");
            return false;
        }
    }

    private (bool IsValid, string? ErrorMessage) ValidateSessionData(PhqSessionData session)
    {
        if (string.IsNullOrEmpty(session.SessionId))
            return (false, "Session ID is required");

        if (string.IsNullOrEmpty(session.UserId))
            return (false, "User ID is required");

        if (string.IsNullOrEmpty(session.AssessmentId))
            return (false, "Assessment ID is required");

        if (string.IsNullOrEmpty(session.AssessmentType))
            return (false, "Assessment type is required");

        if (session.AssessmentType != "PHQ-2" && session.AssessmentType != "PHQ-9")
            return (false, "Assessment type must be PHQ-2 or PHQ-9");

        if (string.IsNullOrEmpty(session.CreatedAt))
            return (false, "Created at timestamp is required");

        if (session.Questions == null)
            return (false, "Questions array is required");

        var expectedQuestionCount = session.AssessmentType == "PHQ-2" ? 2 : 9;
        if (session.Questions.Count != expectedQuestionCount)
            return (false, $"{session.AssessmentType} requires {expectedQuestionCount} questions");

        // Validate question numbers
        var expectedQuestions = Enumerable.Range(1, expectedQuestionCount).ToList();
        var actualQuestions = session.Questions.Select(q => q.QuestionNumber).OrderBy(x => x).ToList();
        if (!expectedQuestions.SequenceEqual(actualQuestions))
            return (false, $"Invalid question numbers for {session.AssessmentType}");

        // Validate answered questions (if any)
        var answeredQuestions = session.Questions.Where(q => q.Answer.HasValue).ToList();
        if (answeredQuestions.Any())
        {
            if (answeredQuestions.Any(q => q.Answer < 0 || q.Answer > 3))
                return (false, "All answers must be between 0 and 3");
        }

        // Validate completion
        if (session.IsCompleted)
        {
            if (string.IsNullOrEmpty(session.CompletedAt))
                return (false, "Completed session must have completion timestamp");

            // Allow skipped questions - don't require all answers
            var validAnswers = session.Questions.Where(q => q.Answer.HasValue && !q.Skipped).ToList();
            if (validAnswers.Count == 0)
                return (false, "Completed session must have at least one valid answer");

            if (!session.TotalScore.HasValue)
                return (false, "Completed session must have total score");
        }

        return (true, null);
    }

    public class SaveSessionRequest
    {
        public PhqSessionData SessionData { get; set; } = null!;
        public Dictionary<string, object>? Metadata { get; set; }
        public string? ContainerName { get; set; }
        public string? FileName { get; set; }
    }

    public class PhqSessionData
    {
        public string UserId { get; set; } = "";
        public string SessionId { get; set; } = "";
        public string AssessmentId { get; set; } = "";
        public string AssessmentType { get; set; } = "";
        public string CreatedAt { get; set; } = "";
        public string LastUpdated { get; set; } = "";
        public string? CompletedAt { get; set; }
        public bool IsCompleted { get; set; }
        public List<PhqQuestionResponse> Questions { get; set; } = new();
        public int? TotalScore { get; set; }
        public string? Severity { get; set; }
        public PhqSessionMetadata? Metadata { get; set; }
    }

    public class PhqQuestionResponse
    {
        public int QuestionNumber { get; set; }
        public string QuestionText { get; set; } = "";
        public int? Answer { get; set; }
        public int Attempts { get; set; }
        public bool Skipped { get; set; }
        public string? AnsweredAt { get; set; }
    }

    public class PhqSessionMetadata
    {
        public string ConversationSessionId { get; set; } = "";
        public string? UserAgent { get; set; }
        public string? ClientTimezone { get; set; }
        public string Version { get; set; } = "1.0.0";
    }
}
