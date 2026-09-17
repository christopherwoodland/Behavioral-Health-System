using System.Globalization;
using BehavioralHealthSystem.Agents.Interfaces;
using BehavioralHealthSystem.Agents.Models;
using BehavioralHealthSystem.Models;
using BehavioralHealthSystem.Services.Interfaces;
using Microsoft.DurableTask;

namespace BehavioralHealthSystem.Functions.Functions;

public sealed class AudioProcessingJobOrchestrator
{
    [Function(nameof(AudioProcessingJobOrchestrator))]
    public async Task<AudioProcessingResult> Run(
        [OrchestrationTrigger] TaskOrchestrationContext context)
    {
        var input = context.GetInput<AudioProcessingJobInput>()
            ?? throw new InvalidOperationException("Audio processing job input is required.");

        var result = await context.CallActivityAsync<AudioProcessingResult>(
            nameof(ProcessAudioJobActivity),
            input);

        await context.CallActivityAsync(
            nameof(PersistAudioJobResultActivity),
            new PersistAudioJobResultInput
            {
                Job = input,
                Result = result
            });

        return result;
    }
}

public sealed class PersistAudioJobResultActivity
{
    private readonly ISessionStorageService _sessionStorageService;
    private readonly ILogger<PersistAudioJobResultActivity> _logger;

    public PersistAudioJobResultActivity(
        ISessionStorageService sessionStorageService,
        ILogger<PersistAudioJobResultActivity> logger)
    {
        _sessionStorageService = sessionStorageService;
        _logger = logger;
    }

    [Function(nameof(PersistAudioJobResultActivity))]
    public async Task Run([ActivityTrigger] PersistAudioJobResultInput input)
    {
        var job = input.Job;
        var result = input.Result;
        var session = await _sessionStorageService.GetSessionDataAsync(job.SessionId)
            ?? new SessionData
            {
                SessionId = job.SessionId,
                UserId = job.UserId,
                CreatedAt = ToTimestamp(result.StartedAtUtc)
            };

        session.UserId = job.UserId;
        session.MetadataUserId ??= job.UserId;
        session.AudioUrl = job.BlobUrl;
        session.AudioFileName = result.OriginalFileName.Length > 0
            ? result.OriginalFileName
            : job.FileName;
        session.Status = result.Success ? "succeeded" : "failed";
        session.UpdatedAt = ToTimestamp(result.CompletedAtUtc);
        session.UserMetadata = MergeDemographics(session.UserMetadata, job.Age, job.WeightKg);
        session.Prediction = MapPrediction(result.PredictionResponse, job.SessionId, result);
        session.AnalysisResults = MergeAnalysisResults(
            session.AnalysisResults,
            job.JobId,
            job.ClientSource,
            result);

        if (!await _sessionStorageService.SaveSessionDataAsync(session))
        {
            throw new InvalidOperationException($"Could not persist audio job {job.JobId} for session {job.SessionId}.");
        }

        _logger.LogInformation(
            "Persisted audio job {JobId} as session {SessionId} with status {Status}",
            job.JobId,
            job.SessionId,
            session.Status);
    }

    private static PredictionResult? MapPrediction(
        PredictionResponse? prediction,
        string sessionId,
        AudioProcessingResult result)
    {
        if (prediction is null)
        {
            return null;
        }

        return new PredictionResult
        {
            ActualScore = prediction.ActualScore ?? new ActualScore(),
            CreatedAt = prediction.CreatedAt,
            IsCalibrated = prediction.IsCalibrated,
            ModelCategory = prediction.ModelCategory,
            ModelGranularity = prediction.ModelGranularity,
            PredictError = prediction.PredictError,
            PredictedScore = prediction.PredictedScore,
            PredictedScoreDepression = prediction.PredictedScoreDepression,
            PredictedScoreAnxiety = prediction.PredictedScoreAnxiety,
            SessionId = sessionId,
            Status = result.Success ? "succeeded" : "failed",
            UpdatedAt = prediction.UpdatedAt
        };
    }

    private static AnalysisResults MergeAnalysisResults(
        AnalysisResults? existing,
        string jobId,
        string clientSource,
        AudioProcessingResult result)
    {
        var analysis = existing ?? new AnalysisResults();
        analysis.JobId = jobId;
        analysis.Source = clientSource;
        analysis.Provider = result.Provider;
        analysis.SourceBlobPath = result.SourceBlobPath;
        analysis.Error = result.Error;
        analysis.FailedStep = result.FailedStep;
        analysis.ProcessingElapsedMs = result.TotalElapsedMs;
        analysis.DepressionScore = ParseScore(result.PredictionResponse?.PredictedScoreDepression);
        analysis.AnxietyScore = ParseScore(result.PredictionResponse?.PredictedScoreAnxiety);
        analysis.CompletedAt = ToTimestamp(result.CompletedAtUtc);
        return analysis;
    }

    private static UserMetadata? MergeDemographics(UserMetadata? existing, int? age, double? weightKg)
    {
        if (existing is null && age is null && weightKg is null)
        {
            return null;
        }

        var metadata = existing ?? new UserMetadata();
        if (age.HasValue)
        {
            metadata.Age = age.Value;
        }

        if (weightKg.HasValue)
        {
            metadata.Weight = (int)Math.Round(weightKg.Value * 2.2046226218, MidpointRounding.AwayFromZero);
        }

        return metadata;
    }

    private static double? ParseScore(string? score) =>
        double.TryParse(score, NumberStyles.Float, CultureInfo.InvariantCulture, out var value)
            ? value
            : null;

    private static string ToTimestamp(DateTime timestamp) =>
        (timestamp == default ? DateTime.UtcNow : timestamp).ToUniversalTime().ToString("O");
}

public sealed class ProcessAudioJobActivity
{
    private readonly IAudioProcessingOrchestrator _audioProcessingOrchestrator;
    private readonly ILogger<ProcessAudioJobActivity> _logger;

    public ProcessAudioJobActivity(
        IAudioProcessingOrchestrator audioProcessingOrchestrator,
        ILogger<ProcessAudioJobActivity> logger)
    {
        _audioProcessingOrchestrator = audioProcessingOrchestrator;
        _logger = logger;
    }

    [Function(nameof(ProcessAudioJobActivity))]
    public async Task<AudioProcessingResult> Run([ActivityTrigger] AudioProcessingJobInput input)
    {
        _logger.LogInformation(
            "Processing audio job {JobId} for user {UserId}, session {SessionId}",
            input.JobId,
            input.UserId,
            input.SessionId);

        return await _audioProcessingOrchestrator.ProcessAudioAsync(
            input.UserId,
            input.SessionId,
            input.FileName,
            input.Age,
            input.WeightKg);
    }
}

public sealed class AudioProcessingJobInput
{
    public required string JobId { get; init; }

    public required string UserId { get; init; }

    public required string SessionId { get; init; }

    public required string FileName { get; init; }

    public string BlobUrl { get; init; } = string.Empty;

    public string ClientSource { get; init; } = "audio-job-api";

    public required string OwnerIdHash { get; init; }

    public int? Age { get; init; }

    public double? WeightKg { get; init; }
}

public sealed class PersistAudioJobResultInput
{
    public required AudioProcessingJobInput Job { get; init; }

    public required AudioProcessingResult Result { get; init; }
}
