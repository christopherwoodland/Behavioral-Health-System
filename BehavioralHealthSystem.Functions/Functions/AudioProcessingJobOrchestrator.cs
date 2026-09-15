using BehavioralHealthSystem.Agents.Interfaces;
using BehavioralHealthSystem.Agents.Models;
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

        return await context.CallActivityAsync<AudioProcessingResult>(
            nameof(ProcessAudioJobActivity),
            input);
    }
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

    public required string OwnerIdHash { get; init; }

    public int? Age { get; init; }

    public double? WeightKg { get; init; }
}
