using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace BehavioralHealthSystem.Functions.Functions;

/// <summary>
/// Azure Function to save PHQ assessment results to blob storage
/// </summary>
public class SavePhqAssessmentFunction
{
    private readonly ILogger<SavePhqAssessmentFunction> _logger;
    private readonly BlobServiceClient _blobServiceClient;

    public SavePhqAssessmentFunction(
        ILogger<SavePhqAssessmentFunction> logger,
        BlobServiceClient blobServiceClient)
    {
        _logger = logger;
        _blobServiceClient = blobServiceClient;
    }

    [Function("SavePhqAssessment")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req)
    {
        try
        {
            _logger.LogInformation("Processing PHQ assessment save request");

            // Read request body
            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var requestData = JsonSerializer.Deserialize<SaveAssessmentRequest>(requestBody);

            if (requestData?.AssessmentData == null)
            {
                _logger.LogWarning("Invalid request: missing assessment data");
                var badResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync("Invalid request: missing assessment data");
                return badResponse;
            }

            // Validate assessment data
            var validation = ValidateAssessmentData(requestData.AssessmentData);
            if (!validation.IsValid)
            {
                _logger.LogWarning("Invalid assessment data: {ValidationError}", validation.ErrorMessage);
                var badResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync($"Invalid assessment data: {validation.ErrorMessage}");
                return badResponse;
            }

            // Save to blob storage
            var saved = await SaveAssessmentToBlobAsync(requestData);
            if (!saved)
            {
                _logger.LogError("Failed to save assessment to blob storage");
                var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync("Failed to save assessment");
                return errorResponse;
            }

            _logger.LogInformation("Successfully saved PHQ assessment: {AssessmentId}", requestData.AssessmentData.AssessmentId);

            var response = req.CreateResponse(System.Net.HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new { success = true, assessmentId = requestData.AssessmentData.AssessmentId }));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing PHQ assessment save request");
            var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync("Internal server error");
            return errorResponse;
        }
    }

    private async Task<bool> SaveAssessmentToBlobAsync(SaveAssessmentRequest request)
    {
        try
        {
            // Get or create container
            var containerName = request.ContainerName ?? "phq-assessments";
            var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

            // Generate filename if not provided
            var fileName = request.FileName ?? 
                $"{request.AssessmentData.AssessmentType.ToLower().Replace("-", "")}-{request.AssessmentData.AssessmentId}.json";

            // Ensure filename ends with .json
            if (!fileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase))
            {
                fileName += ".json";
            }

            // Create blob client
            var blobClient = containerClient.GetBlobClient(fileName);

            // Prepare assessment data with additional metadata
            var assessmentWithMetadata = new
            {
                Assessment = request.AssessmentData,
                StorageMetadata = new
                {
                    SavedAt = DateTime.UtcNow,
                    SavedBy = "PHQ-Assessment-Service",
                    Version = "1.0.0",
                    IpAddress = request.Metadata?.ContainsKey("ipAddress") == true ? request.Metadata["ipAddress"] : null,
                    UserAgent = request.Metadata?.ContainsKey("userAgent") == true ? request.Metadata["userAgent"] : null
                }
            };

            // Serialize to JSON
            var jsonData = JsonSerializer.Serialize(assessmentWithMetadata, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            // Prepare blob metadata
            var blobMetadata = new Dictionary<string, string>
            {
                ["assessment_type"] = request.AssessmentData.AssessmentType,
                ["user_id"] = request.AssessmentData.UserId,
                ["assessment_id"] = request.AssessmentData.AssessmentId,
                ["is_completed"] = request.AssessmentData.IsCompleted.ToString(),
                ["start_time"] = request.AssessmentData.StartTime,
                ["saved_at"] = DateTime.UtcNow.ToString("O")
            };

            // Add optional metadata
            if (request.AssessmentData.CompletedTime != null)
            {
                blobMetadata["completed_time"] = request.AssessmentData.CompletedTime;
            }
            if (request.AssessmentData.TotalScore.HasValue)
            {
                blobMetadata["total_score"] = request.AssessmentData.TotalScore.Value.ToString();
            }
            if (!string.IsNullOrEmpty(request.AssessmentData.Severity))
            {
                blobMetadata["severity"] = request.AssessmentData.Severity;
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

            // Upload blob with metadata
            using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(jsonData));
            var blobUploadOptions = new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders
                {
                    ContentType = "application/json"
                },
                Metadata = blobMetadata,
                Tags = new Dictionary<string, string>
                {
                    ["assessment_type"] = request.AssessmentData.AssessmentType,
                    ["completed"] = request.AssessmentData.IsCompleted.ToString()
                }
            };

            await blobClient.UploadAsync(stream, blobUploadOptions);

            _logger.LogInformation("Successfully saved assessment {AssessmentId} to blob {BlobName} in container {ContainerName}",
                request.AssessmentData.AssessmentId, fileName, containerName);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving assessment to blob storage");
            return false;
        }
    }

    private (bool IsValid, string? ErrorMessage) ValidateAssessmentData(PhqAssessmentData assessment)
    {
        if (string.IsNullOrEmpty(assessment.AssessmentId))
            return (false, "Assessment ID is required");

        if (string.IsNullOrEmpty(assessment.UserId))
            return (false, "User ID is required");

        if (string.IsNullOrEmpty(assessment.AssessmentType))
            return (false, "Assessment type is required");

        if (assessment.AssessmentType != "PHQ-2" && assessment.AssessmentType != "PHQ-9")
            return (false, "Assessment type must be PHQ-2 or PHQ-9");

        if (string.IsNullOrEmpty(assessment.StartTime))
            return (false, "Start time is required");

        if (assessment.Questions == null || !assessment.Questions.Any())
            return (false, "Questions are required");

        var expectedQuestionCount = assessment.AssessmentType == "PHQ-2" ? 2 : 9;
        if (assessment.Questions.Count != expectedQuestionCount)
            return (false, $"{assessment.AssessmentType} requires {expectedQuestionCount} questions");

        // Validate question numbers
        var expectedQuestions = Enumerable.Range(1, expectedQuestionCount).ToList();
        var actualQuestions = assessment.Questions.Select(q => q.QuestionNumber).OrderBy(x => x).ToList();
        if (!expectedQuestions.SequenceEqual(actualQuestions))
            return (false, $"Invalid question numbers for {assessment.AssessmentType}");

        // Validate scores if assessment is completed
        if (assessment.IsCompleted)
        {
            if (assessment.Questions.Any(q => !q.Answer.HasValue))
                return (false, "Completed assessment must have all questions answered");

            if (assessment.Questions.Any(q => q.Answer < 0 || q.Answer > 3))
                return (false, "All answers must be between 0 and 3");

            if (!assessment.TotalScore.HasValue)
                return (false, "Completed assessment must have total score");

            var calculatedScore = assessment.Questions.Sum(q => q.Answer ?? 0);
            if (assessment.TotalScore != calculatedScore)
                return (false, "Total score does not match sum of answers");
        }

        return (true, null);
    }

    public class SaveAssessmentRequest
    {
        public PhqAssessmentData AssessmentData { get; set; } = null!;
        public Dictionary<string, object>? Metadata { get; set; }
        public string? ContainerName { get; set; }
        public string? FileName { get; set; }
    }

    public class PhqAssessmentData
    {
        public string AssessmentId { get; set; } = "";
        public string UserId { get; set; } = "";
        public string AssessmentType { get; set; } = "";
        public string StartTime { get; set; } = "";
        public string? CompletedTime { get; set; }
        public bool IsCompleted { get; set; }
        public List<PhqQuestionData> Questions { get; set; } = new();
        public int? TotalScore { get; set; }
        public string? Severity { get; set; }
        public string? Interpretation { get; set; }
        public List<string>? Recommendations { get; set; }
        public PhqMetadata? Metadata { get; set; }
    }

    public class PhqQuestionData
    {
        public int QuestionNumber { get; set; }
        public string QuestionText { get; set; } = "";
        public int? Answer { get; set; }
        public int Attempts { get; set; }
        public bool Skipped { get; set; }
        public string? Timestamp { get; set; }
    }

    public class PhqMetadata
    {
        public string? UserAgent { get; set; }
        public string? IpAddress { get; set; }
        public string? SessionId { get; set; }
        public string Version { get; set; } = "1.0.0";
    }
}