using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace BehavioralHealthSystem.Functions.Functions;

/// <summary>
/// Azure Function to retrieve and summarize PHQ assessment data from chat transcripts
/// All PHQ assessment data is stored in chat-transcripts container with PHQ-related metadata
/// </summary>
public class GetPhqAssessmentSummaryFunction
{
    private readonly ILogger<GetPhqAssessmentSummaryFunction> _logger;
    private readonly BlobServiceClient _blobServiceClient;

    public GetPhqAssessmentSummaryFunction(
        ILogger<GetPhqAssessmentSummaryFunction> logger,
        BlobServiceClient blobServiceClient)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _blobServiceClient = blobServiceClient ?? throw new ArgumentNullException(nameof(blobServiceClient));
    }

    [Function("GetPhqAssessmentSummary")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Function, "get", "post")] HttpRequestData req)
    {
        try
        {
            _logger.LogInformation("Processing PHQ assessment summary request");

            // Parse query parameters for GET, or body for POST
            string? userId = null;
            string? sessionId = null;
            int? limit = null;

            if (req.Method == "GET")
            {
                var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
                userId = query["userId"];
                sessionId = query["sessionId"];
                if (int.TryParse(query["limit"], out var limitValue))
                {
                    limit = limitValue;
                }
            }
            else // POST
            {
                var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var deserializeOptions = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                };
                var requestData = JsonSerializer.Deserialize<GetAssessmentSummaryRequest>(requestBody, deserializeOptions);
                userId = requestData?.UserId;
                sessionId = requestData?.SessionId;
                limit = requestData?.Limit;
            }

            // Validate required parameter
            if (string.IsNullOrEmpty(userId))
            {
                _logger.LogWarning("Invalid request: userId is required");
                var badResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync("userId is required");
                return badResponse;
            }

            _logger.LogInformation("Fetching PHQ assessment summary for userId: {UserId}, sessionId: {SessionId}",
                userId, sessionId);

            // Build comprehensive summary from chat transcripts only
            var summary = await BuildAssessmentSummaryFromTranscriptsAsync(userId, sessionId, limit ?? 10);

            var response = req.CreateResponse(System.Net.HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json");
            await response.WriteStringAsync(JsonSerializer.Serialize(summary, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            }));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PHQ assessment summary request");
            var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync("Internal server error");
            return errorResponse;
        }
    }

    private async Task<PhqAssessmentSummary> BuildAssessmentSummaryFromTranscriptsAsync(
        string userId,
        string? sessionId,
        int limit)
    {
        var summary = new PhqAssessmentSummary
        {
            UserId = userId,
            SessionId = sessionId,
            RetrievedAt = DateTime.UtcNow.ToString("O"),
            PhqMessages = []
        };

        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient("chat-transcripts");

            if (!await containerClient.ExistsAsync())
            {
                _logger.LogWarning("Chat transcripts container does not exist");
                return summary;
            }

            var prefix = $"users/{userId}/conversations/";
            var blobsList = new List<BlobItem>();

            await foreach (var blobItem in containerClient.GetBlobsAsync(prefix: prefix))
            {
                // Filter by sessionId if specified
                if (!string.IsNullOrEmpty(sessionId) && !blobItem.Name.Contains(sessionId))
                {
                    continue;
                }
                blobsList.Add(blobItem);
            }

            var sortedBlobs = blobsList
                .OrderByDescending(b => b.Properties.LastModified)
                .Take(limit);

            foreach (var blobItem in sortedBlobs)
            {
                var blobClient = containerClient.GetBlobClient(blobItem.Name);
                var content = await blobClient.DownloadContentAsync();
                var jsonText = content.Value.Content.ToString();

                var deserializeOptions = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                };

                var transcriptData = JsonSerializer.Deserialize<ChatTranscriptData>(jsonText, deserializeOptions);

                if (transcriptData?.Messages != null)
                {
                    // Extract PHQ-related messages
                    foreach (var message in transcriptData.Messages)
                    {
                        if (message.Metadata != null &&
                            (message.Metadata.ContainsKey("phq_question_number") ||
                             message.Metadata.ContainsKey("phq_score") ||
                             message.Metadata.ContainsKey("phq_assessment_type") ||
                             message.MessageType?.Contains("phq", StringComparison.OrdinalIgnoreCase) == true ||
                             message.MessageType?.Contains("jekyll", StringComparison.OrdinalIgnoreCase) == true))
                        {
                            summary.PhqMessages.Add(new PhqMessageItem
                            {
                                SessionId = transcriptData.SessionId,
                                MessageId = message.Id,
                                Role = message.Role,
                                Content = message.Content,
                                Timestamp = message.Timestamp,
                                MessageType = message.MessageType,
                                PhqQuestionNumber = message.Metadata.ContainsKey("phq_question_number")
                                    ? int.Parse(message.Metadata["phq_question_number"]?.ToString() ?? "0")
                                    : null,
                                PhqScore = message.Metadata.ContainsKey("phq_score")
                                    ? int.Parse(message.Metadata["phq_score"]?.ToString() ?? "0")
                                    : null,
                                AssessmentType = message.Metadata.ContainsKey("phq_assessment_type")
                                    ? message.Metadata["phq_assessment_type"]?.ToString()
                                    : null,
                                Severity = message.Metadata.ContainsKey("severity")
                                    ? message.Metadata["severity"]?.ToString()
                                    : null,
                                IsRiskAlert = message.Metadata.ContainsKey("isRiskAlert")
                                    ? bool.Parse(message.Metadata["isRiskAlert"]?.ToString() ?? "false")
                                    : false
                            });
                        }
                    }
                }
            }

            // Generate insights from PHQ messages
            summary.SummaryInsights = GenerateSummaryInsights(summary.PhqMessages);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching PHQ data from chat transcripts for userId: {UserId}", userId);
        }

        return summary;
    }

    private SummaryInsights GenerateSummaryInsights(List<PhqMessageItem> messages)
    {
        var insights = new SummaryInsights
        {
            TotalPhqMessages = messages.Count,
            TotalSessions = messages.Select(m => m.SessionId).Distinct().Count(),
            RiskAlertsCount = messages.Count(m => m.IsRiskAlert)
        };

        // Find completed assessments (messages with total scores)
        var completedAssessments = messages
            .Where(m => m.PhqScore.HasValue && !string.IsNullOrEmpty(m.Severity))
            .OrderBy(m => m.Timestamp)
            .ToList();

        insights.CompletedAssessmentsCount = completedAssessments.Count;

        if (completedAssessments.Any())
        {
            var latest = completedAssessments.Last();
            insights.LatestAssessment = new LatestAssessmentInfo
            {
                SessionId = latest.SessionId,
                AssessmentType = latest.AssessmentType ?? "Unknown",
                CompletedTime = latest.Timestamp,
                TotalScore = latest.PhqScore,
                Severity = latest.Severity
            };

            // Calculate score trend if multiple assessments
            if (completedAssessments.Count > 1)
            {
                var first = completedAssessments.First();
                var scoreDiff = (latest.PhqScore ?? 0) - (first.PhqScore ?? 0);

                insights.ScoreTrend = scoreDiff > 0 ? "Increasing" :
                                      scoreDiff < 0 ? "Decreasing" :
                                      "Stable";
                insights.ScoreChange = scoreDiff;
            }
        }

        return insights;
    }

    // Request/Response Models
    public class GetAssessmentSummaryRequest
    {
        public string UserId { get; set; } = "";
        public string? SessionId { get; set; }
        public int? Limit { get; set; }
    }

    public class PhqAssessmentSummary
    {
        public string UserId { get; set; } = "";
        public string? SessionId { get; set; }
        public string RetrievedAt { get; set; } = "";
        public List<PhqMessageItem> PhqMessages { get; set; } = [];
        public SummaryInsights? SummaryInsights { get; set; }
    }

    public class PhqMessageItem
    {
        public string SessionId { get; set; } = "";
        public string MessageId { get; set; } = "";
        public string Role { get; set; } = "";
        public string? Content { get; set; }
        public string? Timestamp { get; set; }
        public string? MessageType { get; set; }
        public int? PhqQuestionNumber { get; set; }
        public int? PhqScore { get; set; }
        public string? AssessmentType { get; set; }
        public string? Severity { get; set; }
        public bool IsRiskAlert { get; set; }
    }

    public class SummaryInsights
    {
        public int TotalPhqMessages { get; set; }
        public int TotalSessions { get; set; }
        public int CompletedAssessmentsCount { get; set; }
        public int RiskAlertsCount { get; set; }
        public LatestAssessmentInfo? LatestAssessment { get; set; }
        public string? ScoreTrend { get; set; }
        public int? ScoreChange { get; set; }
    }

    public class LatestAssessmentInfo
    {
        public string SessionId { get; set; } = "";
        public string AssessmentType { get; set; } = "";
        public string? CompletedTime { get; set; }
        public int? TotalScore { get; set; }
        public string? Severity { get; set; }
    }

    // Helper models for deserialization
    public class ChatTranscriptData
    {
        public string UserId { get; set; } = "";
        public string SessionId { get; set; } = "";
        public string? StartTime { get; set; }
        public string? LastMessageTime { get; set; }
        public List<MessageData>? Messages { get; set; }
    }

    public class MessageData
    {
        public string Id { get; set; } = "";
        public string Role { get; set; } = "";
        public string? Content { get; set; }
        public string? Timestamp { get; set; }
        public string? MessageType { get; set; }
        public Dictionary<string, object>? Metadata { get; set; }
    }
}
