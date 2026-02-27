using System.ComponentModel;
using Microsoft.SemanticKernel;

namespace BehavioralHealthSystem.Agents.Plugins;

/// <summary>
/// Semantic Kernel native function plugin for audio conversion and cleanup via ffmpeg.
/// Step 2 of the audio processing pipeline: Convert.
///
/// Replicates the frontend FFmpeg.wasm processing from audio.ts:
/// - Converts any audio format to WAV (44100Hz, mono, 1 channel)
/// - Applies highpass filter at 80Hz (removes low-frequency rumble)
/// - Applies lowpass filter at 12000Hz (removes high-frequency hiss)
/// - Removes silence segments
/// </summary>
public class AudioConversionPlugin
{
    private readonly ILogger<AudioConversionPlugin> _logger;
    private readonly AudioConversionOptions _options;

    public AudioConversionPlugin(
        ILogger<AudioConversionPlugin> logger,
        IOptions<AudioConversionOptions> options)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _options = options?.Value ?? new AudioConversionOptions();
    }

    /// <summary>
    /// Converts and cleans up an audio file using ffmpeg.
    /// Applies speech-enhancement filters matching the frontend processing pipeline.
    /// </summary>
    [KernelFunction("ConvertAndCleanAudio")]
    [Description("Converts audio to WAV format with speech-enhancement filters (highpass, lowpass, silence removal) using ffmpeg. Returns cleaned audio data.")]
    public async Task<ConvertedAudio> ConvertAndCleanAudioAsync(
        [Description("The raw audio file data as bytes")] byte[] audioData,
        [Description("The input file name including extension (e.g., 'recording.webm')")] string inputFileName,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(audioData);
        if (audioData.Length == 0)
            throw new ArgumentException("Audio data cannot be empty.", nameof(audioData));

        var sw = Stopwatch.StartNew();
        var inputExtension = Path.GetExtension(inputFileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(inputExtension))
            inputExtension = ".wav";

        var inputTempPath = Path.Combine(Path.GetTempPath(), $"sk-audio-in-{Guid.NewGuid():N}{inputExtension}");
        var outputTempPath = Path.Combine(Path.GetTempPath(), $"sk-audio-out-{Guid.NewGuid():N}.wav");

        _logger.LogInformation(
            "[{PluginName}] Starting audio conversion. InputSize={InputSize} bytes, InputFormat={InputFormat}",
            nameof(AudioConversionPlugin), audioData.Length, inputExtension);

        try
        {
            // Write input audio to temp file
            await File.WriteAllBytesAsync(inputTempPath, audioData, cancellationToken);

            // Build ffmpeg arguments matching frontend audio.ts processing
            var ffmpegArgs = BuildFfmpegArguments(inputTempPath, outputTempPath);

            _logger.LogInformation(
                "[{PluginName}] Running ffmpeg: {FfmpegPath} {Args}",
                nameof(AudioConversionPlugin), _options.FfmpegPath, ffmpegArgs);

            // Run ffmpeg process
            await RunFfmpegAsync(ffmpegArgs, cancellationToken);

            // Read converted output
            if (!File.Exists(outputTempPath))
            {
                throw new InvalidOperationException(
                    "ffmpeg conversion completed but output file was not created. " +
                    "Check that ffmpeg is installed and accessible.");
            }

            var convertedData = await File.ReadAllBytesAsync(outputTempPath, cancellationToken);
            sw.Stop();

            if (convertedData.Length == 0)
            {
                throw new InvalidOperationException(
                    "ffmpeg produced an empty output file. The input audio may be corrupt or in an unsupported format.");
            }

            var result = new ConvertedAudio
            {
                Data = convertedData,
                FileName = "audio.wav",
                SampleRate = _options.SampleRate,
                Channels = _options.Channels,
                OriginalSize = audioData.Length,
                FiltersApplied = true,
                ConversionElapsedMs = sw.Elapsed.TotalMilliseconds
            };

            _logger.LogInformation(
                "[{PluginName}] Audio conversion complete. OriginalSize={OriginalSize}, ConvertedSize={ConvertedSize}, ElapsedMs={ElapsedMs:F0}",
                nameof(AudioConversionPlugin), audioData.Length, result.ConvertedSize, result.ConversionElapsedMs);

            return result;
        }
        finally
        {
            // Clean up temp files
            TryDeleteFile(inputTempPath);
            TryDeleteFile(outputTempPath);
        }
    }

    /// <summary>
    /// Builds the ffmpeg arguments to replicate the frontend audio.ts filter chain.
    /// Produces: WAV, 44100Hz, mono, with highpass/lowpass/silence removal.
    /// </summary>
    private string BuildFfmpegArguments(string inputPath, string outputPath)
    {
        var filterParts = new List<string>();

        // Highpass filter — removes rumble/noise below threshold (matches audio.ts: highpass=f=80)
        filterParts.Add($"highpass=f={_options.HighPassFrequency}");

        // Lowpass filter — removes hiss/noise above threshold (matches audio.ts: lowpass=f=12000)
        filterParts.Add($"lowpass=f={_options.LowPassFrequency}");

        // Silence removal (matches audio.ts: silenceremove)
        if (_options.EnableSilenceRemoval)
        {
            filterParts.Add(
                $"silenceremove=start_periods=1:start_duration={_options.SilenceMinDuration}:" +
                $"start_threshold={_options.SilenceThresholdDb}dB:" +
                $"stop_periods=-1:stop_duration={_options.SilenceMinDuration}:" +
                $"stop_threshold={_options.SilenceThresholdDb}dB");
        }

        var audioFilter = string.Join(",", filterParts);

        // Build full command:
        // -y = overwrite output
        // -i = input file
        // -af = audio filter chain
        // -ar = sample rate
        // -ac = channels
        // -sample_fmt s16 = 16-bit PCM (standard WAV)
        var args = $"-y -i \"{inputPath}\" -af \"{audioFilter}\" -ar {_options.SampleRate} -ac {_options.Channels} -sample_fmt s16 \"{outputPath}\"";

        // Optionally limit duration (like DAM self-host _trim_audio_duration)
        if (_options.MaxDurationSeconds > 0)
        {
            args = $"-y -i \"{inputPath}\" -t {_options.MaxDurationSeconds} -af \"{audioFilter}\" -ar {_options.SampleRate} -ac {_options.Channels} -sample_fmt s16 \"{outputPath}\"";
        }

        return args;
    }

    /// <summary>
    /// Runs the ffmpeg process and waits for completion.
    /// </summary>
    private async Task RunFfmpegAsync(string arguments, CancellationToken cancellationToken)
    {
        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = _options.FfmpegPath,
            Arguments = arguments,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true
        };

        var stderr = new StringBuilder();
        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data != null) stderr.AppendLine(e.Data);
        };

        if (!process.Start())
        {
            throw new InvalidOperationException(
                $"Failed to start ffmpeg process at '{_options.FfmpegPath}'. " +
                "Ensure ffmpeg is installed and the FFMPEG_PATH environment variable is set correctly.");
        }

        process.BeginErrorReadLine();

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(_options.ProcessTimeoutSeconds));

        try
        {
            await process.WaitForExitAsync(timeoutCts.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            TryKillProcess(process);
            throw new TimeoutException(
                $"ffmpeg process timed out after {_options.ProcessTimeoutSeconds} seconds.");
        }

        if (process.ExitCode != 0)
        {
            var errorOutput = stderr.ToString();
            _logger.LogError(
                "[{PluginName}] ffmpeg exited with code {ExitCode}. Stderr: {Stderr}",
                nameof(AudioConversionPlugin), process.ExitCode, errorOutput);

            throw new InvalidOperationException(
                $"ffmpeg exited with code {process.ExitCode}. Error: {errorOutput}");
        }

        _logger.LogDebug(
            "[{PluginName}] ffmpeg completed successfully. Stderr (info): {Stderr}",
            nameof(AudioConversionPlugin), stderr.ToString());
    }

    private void TryDeleteFile(string path)
    {
        try
        {
            if (File.Exists(path))
                File.Delete(path);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[{PluginName}] Failed to delete temp file: {Path}",
                nameof(AudioConversionPlugin), path);
        }
    }

    private static void TryKillProcess(Process process)
    {
        try
        {
            if (!process.HasExited)
                process.Kill(entireProcessTree: true);
        }
        catch
        {
            // Best effort cleanup
        }
    }
}
