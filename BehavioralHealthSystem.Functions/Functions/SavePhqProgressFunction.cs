using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using System.Text;

namespace BehavioralHealthSystem.Functions.Functions;

/// <summary>
/// Azure Function to save and update PHQ assessment progress continuously to blob storage
/// </summary>
public class SavePhqProgressFunction
{
    private readonly ILogger<SavePhqProgressFunction> _logger;
    private readonly BlobServiceClient _blobServiceClient;

    public SavePhqProgressFunction(
        ILogger<SavePhqProgressFunction> logger,
        BlobServiceClient blobServiceClient)
    {
        _logger = logger;
        _blobServiceClient = blobServiceClient;
    }

    [Function("SavePhqProgress")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req)
    {
        try
        {
            _logger.LogInformation("Processing PHQ assessment progress save request");

            // Read request body
            var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            
            // Configure JSON deserialization to be case-insensitive
            var deserializeOptions = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };
            
            var requestData = JsonSerializer.Deserialize<SavePhqProgressRequest>(requestBody, deserializeOptions);

            if (requestData?.ProgressData == null)
            {
                _logger.LogWarning("Invalid request: missing progress data");
                var badResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync("Invalid request: missing progress data");
                return badResponse;
            }

            // Validate progress data
            var validation = ValidateProgressData(requestData.ProgressData);
            if (!validation.IsValid)
            {
                _logger.LogWarning("Invalid progress data: {ValidationError}", validation.ErrorMessage);
                var badResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                await badResponse.WriteStringAsync(validation.ErrorMessage!);
                return badResponse;
            }

            // Generate blob name with simplified user folder hierarchy (unified 'phq' container)
            var containerName = requestData.ContainerName ?? "phq";
            var fileName = requestData.FileName ?? 
                $"users/{requestData.ProgressData.UserId}/{requestData.ProgressData.AssessmentId}.json";

            // Get or create container
            var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

            // Get blob client
            var blobClient = containerClient.GetBlobClient(fileName);
            
            // Try to get existing progress
            PhqProgressData existingProgress = null!;
            try
            {
                if (await blobClient.ExistsAsync())
                {
                    var downloadResponse = await blobClient.DownloadContentAsync();
                    var existingJson = downloadResponse.Value.Content.ToString();
                    existingProgress = JsonSerializer.Deserialize<PhqProgressData>(existingJson)!;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not read existing progress, creating new one");
            }

            // Merge or create progress
            var finalProgress = MergeProgress(existingProgress, requestData.ProgressData);

            // Serialize with proper formatting
            var jsonOptions = new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };

            var progressJson = JsonSerializer.Serialize(finalProgress, jsonOptions);
            var content = new BinaryData(Encoding.UTF8.GetBytes(progressJson));

            // Set metadata
            var metadata = new Dictionary<string, string>
            {
                ["userId"] = finalProgress.UserId,
                ["assessmentId"] = finalProgress.AssessmentId,
                ["assessmentType"] = finalProgress.AssessmentType,
                ["questionsAnswered"] = finalProgress.AnsweredQuestions.Count.ToString(),
                ["totalQuestions"] = finalProgress.TotalQuestions.ToString(),
                ["isCompleted"] = finalProgress.IsCompleted.ToString().ToLower(),
                ["lastUpdated"] = DateTime.UtcNow.ToString("O")
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

            _logger.LogInformation("Successfully saved PHQ progress for user {UserId}, assessment {AssessmentId}, {AnsweredCount}/{TotalCount} questions", 
                finalProgress.UserId, finalProgress.AssessmentId, finalProgress.AnsweredQuestions.Count, finalProgress.TotalQuestions);

            // Return success response
            var response = req.CreateResponse(System.Net.HttpStatusCode.OK);
            await response.WriteAsJsonAsync(new
            {
                success = true,
                message = "PHQ assessment progress saved successfully",
                assessmentId = finalProgress.AssessmentId,
                questionsAnswered = finalProgress.AnsweredQuestions.Count,
                totalQuestions = finalProgress.TotalQuestions,
                isCompleted = finalProgress.IsCompleted,
                blobName = fileName
            });

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving PHQ assessment progress");
            
            var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync("An error occurred while saving the PHQ assessment progress");
            return errorResponse;
        }
    }

    private (bool IsValid, string? ErrorMessage) ValidateProgressData(PhqProgressData progress)
    {
        if (string.IsNullOrWhiteSpace(progress.UserId))
            return (false, "User ID is required");

        if (string.IsNullOrWhiteSpace(progress.AssessmentId))
            return (false, "Assessment ID is required");

        if (string.IsNullOrWhiteSpace(progress.AssessmentType))
            return (false, "Assessment type is required");

        if (progress.AssessmentType != "PHQ-2" && progress.AssessmentType != "PHQ-9")
            return (false, "Assessment type must be 'PHQ-2' or 'PHQ-9'");

        if (progress.TotalQuestions <= 0)
            return (false, "Total questions must be greater than 0");

        if (progress.AnsweredQuestions == null)
            return (false, "Answered questions collection cannot be null");

        // Validate each answered question
        for (int i = 0; i < progress.AnsweredQuestions.Count; i++)
        {
            var question = progress.AnsweredQuestions[i];
            
            if (question.QuestionNumber <= 0)
                return (false, $"Question {i}: Question number must be greater than 0");

            if (string.IsNullOrWhiteSpace(question.QuestionText))
                return (false, $"Question {i}: Question text is required");

            if (question.Answer < 0 || question.Answer > 3)
                return (false, $"Question {i}: Answer must be between 0 and 3");

            if (string.IsNullOrWhiteSpace(question.AnsweredAt))
                return (false, $"Question {i}: Answered timestamp is required");
        }

        return (true, null);
    }

    private PhqProgressData MergeProgress(PhqProgressData? existing, PhqProgressData newData)
    {
        if (existing == null)
        {
            // Return new progress with updated metadata
            newData.StartedAt = DateTime.UtcNow.ToString("O");
            newData.LastUpdated = DateTime.UtcNow.ToString("O");
            return newData;
        }

        // Preserve critical fields if empty in new data
        if (string.IsNullOrWhiteSpace(newData.UserId) && !string.IsNullOrWhiteSpace(existing.UserId))
        {
            newData.UserId = existing.UserId;
        }

        if (string.IsNullOrWhiteSpace(newData.AssessmentId) && !string.IsNullOrWhiteSpace(existing.AssessmentId))
        {
            newData.AssessmentId = existing.AssessmentId;
        }

        if (string.IsNullOrWhiteSpace(newData.AssessmentType) && !string.IsNullOrWhiteSpace(existing.AssessmentType))
        {
            newData.AssessmentType = existing.AssessmentType;
        }

        if (string.IsNullOrWhiteSpace(newData.StartedAt) && !string.IsNullOrWhiteSpace(existing.StartedAt))
        {
            newData.StartedAt = existing.StartedAt;
        }
        else if (string.IsNullOrWhiteSpace(newData.StartedAt))
        {
            newData.StartedAt = DateTime.UtcNow.ToString("O");
        }

        // Merge answered questions - add or update questions
        var existingQuestionNumbers = new HashSet<int>(existing.AnsweredQuestions.Select(q => q.QuestionNumber));
        
        foreach (var newQuestion in newData.AnsweredQuestions)
        {
            if (!existingQuestionNumbers.Contains(newQuestion.QuestionNumber))
            {
                // Add new question
                existing.AnsweredQuestions.Add(newQuestion);
            }
            else
            {
                // Update existing question (in case answer changed)
                var existingQuestion = existing.AnsweredQuestions.First(q => q.QuestionNumber == newQuestion.QuestionNumber);
                existingQuestion.Answer = newQuestion.Answer;
                existingQuestion.AnsweredAt = newQuestion.AnsweredAt;
                existingQuestion.Attempts = newQuestion.Attempts;
            }
        }

        // Update metadata
        existing.LastUpdated = DateTime.UtcNow.ToString("O");
        existing.IsCompleted = newData.IsCompleted;
        existing.TotalScore = newData.TotalScore;
        existing.Severity = newData.Severity;
        existing.Interpretation = newData.Interpretation;
        existing.Recommendations = newData.Recommendations;
        
        // Update completion time if completed
        if (newData.IsCompleted && string.IsNullOrEmpty(existing.CompletedAt))
        {
            existing.CompletedAt = DateTime.UtcNow.ToString("O");
        }

        // Sort questions by question number to maintain order
        existing.AnsweredQuestions = existing.AnsweredQuestions
            .OrderBy(q => q.QuestionNumber)
            .ToList();

        return existing;
    }
}

public class SavePhqProgressRequest
{
    public PhqProgressData ProgressData { get; set; } = null!;
    public Dictionary<string, object>? Metadata { get; set; }
    public string? ContainerName { get; set; }
    public string? FileName { get; set; }
}

public class PhqProgressData
{
    public string UserId { get; set; } = "";
    public string AssessmentId { get; set; } = "";
    public string AssessmentType { get; set; } = ""; // "PHQ-2" or "PHQ-9"
    public string StartedAt { get; set; } = "";
    public string LastUpdated { get; set; } = "";
    public string? CompletedAt { get; set; }
    public bool IsCompleted { get; set; } = false;
    public int TotalQuestions { get; set; }
    public List<PhqAnsweredQuestion> AnsweredQuestions { get; set; } = new();
    public int? TotalScore { get; set; }
    public string? Severity { get; set; }
    public string? Interpretation { get; set; }
    public List<string>? Recommendations { get; set; }
    public PhqProgressMetadata? Metadata { get; set; }
}

public class PhqAnsweredQuestion
{
    public int QuestionNumber { get; set; }
    public string QuestionText { get; set; } = "";
    public int Answer { get; set; }
    public string AnsweredAt { get; set; } = "";
    public int Attempts { get; set; } = 1;
    public bool WasSkipped { get; set; } = false;
}

public class PhqProgressMetadata
{
    public string? SessionId { get; set; }
    public string? UserAgent { get; set; }
    public string? ClientTimezone { get; set; }
    public string? IpAddress { get; set; }
    public Dictionary<string, object>? CustomData { get; set; }
}