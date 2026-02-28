using BehavioralHealthSystem.Agents.Plugins;

namespace BehavioralHealthSystem.Agents.Services;

/// <summary>
/// Deterministic sequential orchestrator for the audio processing pipeline.
/// Uses Semantic Kernel to execute three native function plugins in order:
///   1. AudioRetrievalPlugin   — Fetch audio from blob storage
///   2. AudioConversionPlugin  — Convert and clean via ffmpeg
///   3. DamPredictionPlugin    — Run DAM model prediction
///
/// This orchestrator is designed to be invoked by an agent as a single tool.
/// No LLM routing is involved — the execution order is fixed and deterministic.
/// </summary>
public class AudioProcessingOrchestrator : IAudioProcessingOrchestrator
{
    private readonly Kernel _kernel;
    private readonly ILogger<AudioProcessingOrchestrator> _logger;

    public AudioProcessingOrchestrator(
        Kernel kernel,
        ILogger<AudioProcessingOrchestrator> logger)
    {
        _kernel = kernel ?? throw new ArgumentNullException(nameof(kernel));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc />
    public async Task<AudioProcessingResult> ProcessAudioAsync(
        string userId,
        string sessionId,
        string? fileName = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userId, nameof(userId));
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionId, nameof(sessionId));

        var result = new AudioProcessingResult
        {
            UserId = userId,
            SessionId = sessionId,
            StartedAtUtc = DateTime.UtcNow
        };

        var pipelineSw = Stopwatch.StartNew();

        _logger.LogInformation(
            "[Orchestrator] Starting audio processing pipeline. UserId={UserId}, SessionId={SessionId}, FileName={FileName}",
            userId, sessionId, fileName ?? "(latest)");

        try
        {
            // ─── Step 1: Fetch audio from blob storage ─────────────────────
            _logger.LogInformation("[Orchestrator] Step 1/3: Fetching audio from blob storage...");

            var fetchResult = await InvokePluginAsync<AudioFile>(
                "AudioRetrieval", "GetAudioFromBlob",
                new KernelArguments
                {
                    ["userId"] = userId,
                    ["sessionId"] = sessionId,
                    ["fileName"] = fileName
                },
                cancellationToken);

            result.SourceBlobPath = fetchResult.BlobPath;
            result.OriginalFileName = fetchResult.FileName;
            result.OriginalFileSize = fetchResult.FileSize;

            _logger.LogInformation(
                "[Orchestrator] Step 1/3 complete. Retrieved {FileName} ({FileSize} bytes) from {BlobPath}",
                fetchResult.FileName, fetchResult.FileSize, fetchResult.BlobPath);

            // ─── Step 2: Convert and clean audio via ffmpeg ────────────────
            _logger.LogInformation("[Orchestrator] Step 2/3: Converting audio via ffmpeg...");

            var convertResult = await InvokePluginAsync<ConvertedAudio>(
                "AudioConversion", "ConvertAndCleanAudio",
                new KernelArguments
                {
                    ["audioData"] = fetchResult.Data,
                    ["inputFileName"] = fetchResult.FileName
                },
                cancellationToken);

            result.ConvertedFileSize = convertResult.ConvertedSize;
            result.ConvertedSampleRate = convertResult.SampleRate;
            result.FiltersApplied = convertResult.FiltersApplied;
            result.ConversionElapsedMs = convertResult.ConversionElapsedMs;

            _logger.LogInformation(
                "[Orchestrator] Step 2/3 complete. Converted {OriginalSize} → {ConvertedSize} bytes in {ElapsedMs:F0}ms",
                fetchResult.FileSize, convertResult.ConvertedSize, convertResult.ConversionElapsedMs);

            // ─── Step 3: Initiate session & run DAM prediction ─────────────
            _logger.LogInformation("[Orchestrator] Step 3/3: Running DAM model prediction...");

            // 3a. Initiate a DAM session
            var damSessionId = await InvokePluginAsync<string>(
                "DamPrediction", "InitiateDamSession",
                new KernelArguments
                {
                    ["userId"] = userId
                },
                cancellationToken);

            _logger.LogInformation(
                "[Orchestrator] DAM session initiated: {DamSessionId}", damSessionId);

            // 3b. Submit prediction
            var predictionResponse = await InvokePluginAsync<PredictionResponse>(
                "DamPrediction", "RunPrediction",
                new KernelArguments
                {
                    ["audioData"] = convertResult.Data,
                    ["audioFileName"] = convertResult.FileName,
                    ["sessionId"] = damSessionId
                },
                cancellationToken);

            result.PredictionResponse = predictionResponse;
            result.Provider = predictionResponse.Provider;

            _logger.LogInformation(
                "[Orchestrator] Step 3/3 complete. Score={Score}, Depression={Depression}, Anxiety={Anxiety}",
                predictionResponse.PredictedScore,
                predictionResponse.PredictedScoreDepression,
                predictionResponse.PredictedScoreAnxiety);

            // ─── Pipeline complete ─────────────────────────────────────────
            pipelineSw.Stop();
            result.Success = true;
            result.Message = "Audio processing pipeline completed successfully.";
            result.TotalElapsedMs = pipelineSw.Elapsed.TotalMilliseconds;
            result.CompletedAtUtc = DateTime.UtcNow;

            _logger.LogInformation(
                "[Orchestrator] Pipeline complete. TotalElapsedMs={TotalElapsedMs:F0}, UserId={UserId}, SessionId={SessionId}",
                result.TotalElapsedMs, userId, sessionId);

            return result;
        }
        catch (Exception ex)
        {
            pipelineSw.Stop();
            result.Success = false;
            result.Error = ex.Message;
            result.TotalElapsedMs = pipelineSw.Elapsed.TotalMilliseconds;
            result.CompletedAtUtc = DateTime.UtcNow;
            result.FailedStep = DetermineFailedStep(result);
            result.Message = $"Pipeline failed at step '{result.FailedStep}': {ex.Message}";

            _logger.LogError(
                ex,
                "[Orchestrator] Pipeline failed at step '{FailedStep}'. UserId={UserId}, SessionId={SessionId}, ElapsedMs={ElapsedMs:F0}",
                result.FailedStep, userId, sessionId, result.TotalElapsedMs);

            return result;
        }
    }

    /// <inheritdoc />
    public async Task<AudioProcessingResult> ProcessAudioFromLocalAsync(
        string userId,
        string sessionId,
        string? filePath = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userId, nameof(userId));
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionId, nameof(sessionId));

        var result = new AudioProcessingResult
        {
            UserId = userId,
            SessionId = sessionId,
            AudioSource = "local",
            StartedAtUtc = DateTime.UtcNow
        };

        var pipelineSw = Stopwatch.StartNew();

        _logger.LogInformation(
            "[Orchestrator] Starting LOCAL audio processing pipeline. UserId={UserId}, SessionId={SessionId}, FilePath={FilePath}",
            userId, sessionId, filePath ?? "(latest)");

        try
        {
            // ─── Step 1: Fetch audio from local directory ───────────────────
            _logger.LogInformation("[Orchestrator] Step 1/3: Fetching audio from local directory...");

            var fetchResult = await InvokePluginAsync<AudioFile>(
                "LocalFileRetrieval", "GetAudioFromLocalDirectory",
                new KernelArguments
                {
                    ["userId"] = userId,
                    ["sessionId"] = sessionId,
                    ["filePath"] = filePath
                },
                cancellationToken);

            result.SourceLocalPath = fetchResult.SourcePath;
            result.OriginalFileName = fetchResult.FileName;
            result.OriginalFileSize = fetchResult.FileSize;

            _logger.LogInformation(
                "[Orchestrator] Step 1/3 complete. Retrieved {FileName} ({FileSize} bytes) from {SourcePath}",
                fetchResult.FileName, fetchResult.FileSize, fetchResult.SourcePath);

            // ─── Step 2: Convert and clean audio via ffmpeg ────────────────
            _logger.LogInformation("[Orchestrator] Step 2/3: Converting audio via ffmpeg...");

            var convertResult = await InvokePluginAsync<ConvertedAudio>(
                "AudioConversion", "ConvertAndCleanAudio",
                new KernelArguments
                {
                    ["audioData"] = fetchResult.Data,
                    ["inputFileName"] = fetchResult.FileName
                },
                cancellationToken);

            result.ConvertedFileSize = convertResult.ConvertedSize;
            result.ConvertedSampleRate = convertResult.SampleRate;
            result.FiltersApplied = convertResult.FiltersApplied;
            result.ConversionElapsedMs = convertResult.ConversionElapsedMs;

            _logger.LogInformation(
                "[Orchestrator] Step 2/3 complete. Converted {OriginalSize} → {ConvertedSize} bytes in {ElapsedMs:F0}ms",
                fetchResult.FileSize, convertResult.ConvertedSize, convertResult.ConversionElapsedMs);

            // ─── Step 3: Initiate session & run DAM prediction ─────────────
            _logger.LogInformation("[Orchestrator] Step 3/3: Running DAM model prediction...");

            var damSessionId = await InvokePluginAsync<string>(
                "DamPrediction", "InitiateDamSession",
                new KernelArguments
                {
                    ["userId"] = userId
                },
                cancellationToken);

            _logger.LogInformation(
                "[Orchestrator] DAM session initiated: {DamSessionId}", damSessionId);

            var predictionResponse = await InvokePluginAsync<PredictionResponse>(
                "DamPrediction", "RunPrediction",
                new KernelArguments
                {
                    ["audioData"] = convertResult.Data,
                    ["audioFileName"] = convertResult.FileName,
                    ["sessionId"] = damSessionId
                },
                cancellationToken);

            result.PredictionResponse = predictionResponse;
            result.Provider = predictionResponse.Provider;

            _logger.LogInformation(
                "[Orchestrator] Step 3/3 complete. Score={Score}, Depression={Depression}, Anxiety={Anxiety}",
                predictionResponse.PredictedScore,
                predictionResponse.PredictedScoreDepression,
                predictionResponse.PredictedScoreAnxiety);

            // ─── Pipeline complete ─────────────────────────────────────────
            pipelineSw.Stop();
            result.Success = true;
            result.Message = "Audio processing pipeline (local source) completed successfully.";
            result.TotalElapsedMs = pipelineSw.Elapsed.TotalMilliseconds;
            result.CompletedAtUtc = DateTime.UtcNow;

            _logger.LogInformation(
                "[Orchestrator] Pipeline complete (local). TotalElapsedMs={TotalElapsedMs:F0}, UserId={UserId}, SessionId={SessionId}",
                result.TotalElapsedMs, userId, sessionId);

            return result;
        }
        catch (Exception ex)
        {
            pipelineSw.Stop();
            result.Success = false;
            result.Error = ex.Message;
            result.TotalElapsedMs = pipelineSw.Elapsed.TotalMilliseconds;
            result.CompletedAtUtc = DateTime.UtcNow;
            result.FailedStep = DetermineFailedStep(result);
            result.Message = $"Pipeline failed at step '{result.FailedStep}': {ex.Message}";

            _logger.LogError(
                ex,
                "[Orchestrator] Pipeline failed (local) at step '{FailedStep}'. UserId={UserId}, SessionId={SessionId}, ElapsedMs={ElapsedMs:F0}",
                result.FailedStep, userId, sessionId, result.TotalElapsedMs);

            return result;
        }
    }

    /// <inheritdoc />
    public async Task<AudioConversionOnlyResult> ConvertAudioOnlyAsync(
        byte[] audioData,
        string inputFileName,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(audioData);
        if (audioData.Length == 0)
            throw new ArgumentException("Audio data cannot be empty.", nameof(audioData));

        var sw = Stopwatch.StartNew();

        _logger.LogInformation(
            "[Orchestrator] Starting convert-only pipeline. FileName={FileName}, Size={Size} bytes",
            inputFileName, audioData.Length);

        try
        {
            var convertResult = await InvokePluginAsync<ConvertedAudio>(
                "AudioConversion", "ConvertAndCleanAudio",
                new KernelArguments
                {
                    ["audioData"] = audioData,
                    ["inputFileName"] = inputFileName
                },
                cancellationToken);

            sw.Stop();

            _logger.LogInformation(
                "[Orchestrator] Convert-only pipeline complete. {OriginalSize} → {ConvertedSize} bytes in {ElapsedMs:F0}ms",
                audioData.Length, convertResult.ConvertedSize, sw.Elapsed.TotalMilliseconds);

            return new AudioConversionOnlyResult
            {
                Success = true,
                Message = "Audio conversion completed successfully.",
                OriginalFileName = inputFileName,
                OriginalFileSize = audioData.Length,
                ConvertedData = convertResult.Data,
                ConvertedFileSize = convertResult.ConvertedSize,
                ConvertedSampleRate = convertResult.SampleRate,
                FiltersApplied = convertResult.FiltersApplied,
                ConversionElapsedMs = convertResult.ConversionElapsedMs
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex,
                "[Orchestrator] Convert-only pipeline failed. FileName={FileName}, ElapsedMs={ElapsedMs:F0}",
                inputFileName, sw.Elapsed.TotalMilliseconds);

            return new AudioConversionOnlyResult
            {
                Success = false,
                Message = $"Audio conversion failed: {ex.Message}",
                OriginalFileName = inputFileName,
                OriginalFileSize = audioData.Length,
                ConversionElapsedMs = sw.Elapsed.TotalMilliseconds,
                Error = ex.Message
            };
        }
    }

    /// <summary>
    /// Invokes a Semantic Kernel plugin function and returns a strongly-typed result.
    /// </summary>
    private async Task<T> InvokePluginAsync<T>(
        string pluginName,
        string functionName,
        KernelArguments arguments,
        CancellationToken cancellationToken)
    {
        var function = _kernel.Plugins.GetFunction(pluginName, functionName);
        var functionResult = await _kernel.InvokeAsync(function, arguments, cancellationToken);
        var result = functionResult.GetValue<T>();

        if (result == null)
        {
            throw new InvalidOperationException(
                $"Plugin '{pluginName}.{functionName}' returned null. Expected a {typeof(T).Name} result.");
        }

        return result;
    }

    /// <summary>
    /// Determines which pipeline step failed based on what was populated in the result.
    /// </summary>
    private static string DetermineFailedStep(AudioProcessingResult result)
    {
        if (result.OriginalFileSize == 0)
            return "fetch";
        if (result.ConvertedFileSize == 0)
            return "convert";
        return "predict";
    }
}
