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
    ///
    /// Optimizations:
    /// - Skip filters if input is already a clean WAV at target spec (SkipFiltersIfCleanWav)
    /// - Pipe stdin/stdout to avoid disk I/O entirely (UsePipeMode)
    /// - Use RAM-backed /dev/shm for temp files on Linux (UseTmpfs)
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

        // ── Fast path: skip conversion if input is already at target spec ──
        if (_options.SkipFiltersIfCleanWav && IsCleanWav(audioData, inputExtension))
        {
            sw.Stop();
            _logger.LogInformation(
                "[{PluginName}] Input is already clean WAV at target spec — passthrough (no ffmpeg). Size={Size} bytes",
                nameof(AudioConversionPlugin), audioData.Length);

            return new ConvertedAudio
            {
                Data = audioData,
                FileName = "audio.wav",
                SampleRate = _options.SampleRate,
                Channels = _options.Channels,
                OriginalSize = audioData.Length,
                FiltersApplied = false,
                ConversionElapsedMs = sw.Elapsed.TotalMilliseconds
            };
        }

        _logger.LogInformation(
            "[{PluginName}] Starting audio conversion. InputSize={InputSize} bytes, InputFormat={InputFormat}, Mode={Mode}",
            nameof(AudioConversionPlugin), audioData.Length, inputExtension,
            _options.UsePipeMode ? "pipe" : _options.UseTmpfs ? "tmpfs" : "disk");

        // ── Choose conversion strategy ──
        byte[] convertedData;
        if (_options.UsePipeMode)
        {
            convertedData = await ConvertViaPipeAsync(audioData, inputExtension, cancellationToken);
        }
        else
        {
            convertedData = await ConvertViaTempFilesAsync(audioData, inputExtension, cancellationToken);
        }

        sw.Stop();

        if (convertedData.Length == 0)
        {
            throw new InvalidOperationException(
                "ffmpeg produced empty output. The input audio may be corrupt or in an unsupported format.");
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

    // ── Clean WAV Detection ──────────────────────────────────────────────

    /// <summary>
    /// Checks if the input audio is already a WAV file at the target sample rate, mono, 16-bit PCM.
    /// Reads the RIFF/WAV header (44 bytes minimum) to inspect format parameters.
    /// </summary>
    private bool IsCleanWav(byte[] data, string extension)
    {
        if (extension != ".wav" || data.Length < 44) return false;

        try
        {
            // RIFF header check
            if (data[0] != 'R' || data[1] != 'I' || data[2] != 'F' || data[3] != 'F') return false;
            if (data[8] != 'W' || data[9] != 'A' || data[10] != 'V' || data[11] != 'E') return false;

            // fmt chunk — starts at byte 12
            if (data[12] != 'f' || data[13] != 'm' || data[14] != 't' || data[15] != ' ') return false;

            // Audio format: 1 = PCM
            var audioFormat = BitConverter.ToUInt16(data, 20);
            if (audioFormat != 1) return false;

            // Channels
            var channels = BitConverter.ToUInt16(data, 22);
            if (channels != _options.Channels) return false;

            // Sample rate
            var sampleRate = BitConverter.ToInt32(data, 24);
            if (sampleRate != _options.SampleRate) return false;

            // Bits per sample: 16
            var bitsPerSample = BitConverter.ToUInt16(data, 34);
            if (bitsPerSample != 16) return false;

            _logger.LogDebug(
                "[{PluginName}] WAV header matches target: {SampleRate}Hz, {Channels}ch, {Bits}-bit PCM",
                nameof(AudioConversionPlugin), sampleRate, channels, bitsPerSample);
            return true;
        }
        catch
        {
            return false;
        }
    }

    // ── Pipe Mode (stdin → ffmpeg → stdout, no temp files) ───────────────

    /// <summary>
    /// Runs ffmpeg with audio data piped via stdin and output read from stdout.
    /// Avoids all disk I/O.
    /// </summary>
    private async Task<byte[]> ConvertViaPipeAsync(byte[] audioData, string inputExtension, CancellationToken cancellationToken)
    {
        var filterChain = BuildFilterChain();

        // -f <format> tells ffmpeg the input container format for stdin
        var inputFormat = GetFfmpegFormat(inputExtension);
        var formatArg = !string.IsNullOrEmpty(inputFormat) ? $"-f {inputFormat} " : "";

        // Build args: read from stdin (pipe:0), write WAV to stdout (pipe:1)
        var args = $"-y {formatArg}-i pipe:0 -af \"{filterChain}\" -ar {_options.SampleRate} -ac {_options.Channels} -sample_fmt s16 -f wav pipe:1";

        if (_options.MaxDurationSeconds > 0)
        {
            args = $"-y {formatArg}-i pipe:0 -t {_options.MaxDurationSeconds} -af \"{filterChain}\" -ar {_options.SampleRate} -ac {_options.Channels} -sample_fmt s16 -f wav pipe:1";
        }

        _logger.LogInformation(
            "[{PluginName}] Running ffmpeg (pipe mode): {Args}",
            nameof(AudioConversionPlugin), args);

        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = _options.FfmpegPath,
            Arguments = args,
            UseShellExecute = false,
            RedirectStandardInput = true,
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
                $"Failed to start ffmpeg at '{_options.FfmpegPath}'. Ensure ffmpeg is installed.");
        }

        process.BeginErrorReadLine();

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(_options.ProcessTimeoutSeconds));

        // Write input to stdin and read output from stdout concurrently
        var writeTask = Task.Run(async () =>
        {
            try
            {
                await process.StandardInput.BaseStream.WriteAsync(audioData, timeoutCts.Token);
                await process.StandardInput.BaseStream.FlushAsync(timeoutCts.Token);
            }
            finally
            {
                process.StandardInput.Close();
            }
        }, timeoutCts.Token);

        using var outputStream = new MemoryStream();
        var readTask = process.StandardOutput.BaseStream.CopyToAsync(outputStream, timeoutCts.Token);

        try
        {
            await Task.WhenAll(writeTask, readTask);
            await process.WaitForExitAsync(timeoutCts.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            TryKillProcess(process);
            throw new TimeoutException(
                $"ffmpeg pipe process timed out after {_options.ProcessTimeoutSeconds} seconds.");
        }

        if (process.ExitCode != 0)
        {
            _logger.LogError(
                "[{PluginName}] ffmpeg (pipe) exited with code {ExitCode}. Stderr: {Stderr}",
                nameof(AudioConversionPlugin), process.ExitCode, stderr.ToString());
            throw new InvalidOperationException(
                $"ffmpeg exited with code {process.ExitCode}. Error: {stderr}");
        }

        _logger.LogDebug(
            "[{PluginName}] ffmpeg (pipe) completed successfully. Output={OutputBytes} bytes",
            nameof(AudioConversionPlugin), outputStream.Length);

        return outputStream.ToArray();
    }

    // ── Temp File Mode (original approach, now with tmpfs option) ─────────

    /// <summary>
    /// Runs ffmpeg with temp files. Uses /dev/shm (RAM-backed tmpfs) on Linux when enabled.
    /// </summary>
    private async Task<byte[]> ConvertViaTempFilesAsync(byte[] audioData, string inputExtension, CancellationToken cancellationToken)
    {
        var tempDir = GetTempDirectory();
        var inputTempPath = Path.Combine(tempDir, $"sk-audio-in-{Guid.NewGuid():N}{inputExtension}");
        var outputTempPath = Path.Combine(tempDir, $"sk-audio-out-{Guid.NewGuid():N}.wav");

        try
        {
            await File.WriteAllBytesAsync(inputTempPath, audioData, cancellationToken);

            var ffmpegArgs = BuildFfmpegArguments(inputTempPath, outputTempPath);

            _logger.LogInformation(
                "[{PluginName}] Running ffmpeg (file mode, dir={TempDir}): {Args}",
                nameof(AudioConversionPlugin), tempDir, ffmpegArgs);

            await RunFfmpegAsync(ffmpegArgs, cancellationToken);

            if (!File.Exists(outputTempPath))
            {
                throw new InvalidOperationException(
                    "ffmpeg conversion completed but output file was not created.");
            }

            return await File.ReadAllBytesAsync(outputTempPath, cancellationToken);
        }
        finally
        {
            TryDeleteFile(inputTempPath);
            TryDeleteFile(outputTempPath);
        }
    }

    /// <summary>
    /// Returns the temp directory to use. Prefers /dev/shm (Linux tmpfs) when UseTmpfs is enabled.
    /// Falls back to system temp if /dev/shm doesn't exist or isn't writable.
    /// </summary>
    private string GetTempDirectory()
    {
        if (!_options.UseTmpfs) return Path.GetTempPath();

        const string shmPath = "/dev/shm";
        if (Directory.Exists(shmPath))
        {
            _logger.LogDebug("[{PluginName}] Using tmpfs at {Path}", nameof(AudioConversionPlugin), shmPath);
            return shmPath;
        }

        _logger.LogDebug(
            "[{PluginName}] /dev/shm not available, falling back to system temp",
            nameof(AudioConversionPlugin));
        return Path.GetTempPath();
    }

    /// <summary>
    /// Returns the ffmpeg input format flag for a given file extension, used in pipe mode
    /// where ffmpeg can't infer the format from the file name.
    /// </summary>
    private static string? GetFfmpegFormat(string extension) => extension switch
    {
        ".wav" => "wav",
        ".mp3" => "mp3",
        ".mp4" => "mp4",
        ".m4a" => "mp4",
        ".aac" => "aac",
        ".flac" => "flac",
        ".ogg" => "ogg",
        ".webm" => "webm",
        ".mkv" => "matroska",
        ".avi" => "avi",
        ".mov" => "mov",
        _ => null
    };

    /// <summary>
    /// Builds the full ffmpeg argument string for temp-file mode.
    /// Delegates filter construction to the shared BuildFilterChain() helper.
    /// </summary>
    private string BuildFfmpegArguments(string inputPath, string outputPath)
    {
        var filterChain = BuildFilterChain();
        var durationArg = _options.MaxDurationSeconds > 0
            ? $"-t {_options.MaxDurationSeconds} "
            : "";

        return $"-y -i \"{inputPath}\" {durationArg}-af \"{filterChain}\" " +
               $"-ar {_options.SampleRate} -ac {_options.Channels} -sample_fmt s16 \"{outputPath}\"";
    }

    /// <summary>
    /// Builds the audio filter chain string (shared by pipe and file modes).
    /// </summary>
    private string BuildFilterChain()
    {
        var filterParts = new List<string>();

        filterParts.Add($"highpass=f={_options.HighPassFrequency}");
        filterParts.Add($"lowpass=f={_options.LowPassFrequency}");

        if (_options.EnableSilenceRemoval)
        {
            filterParts.Add(
                $"silenceremove=start_periods=1:start_duration={_options.SilenceMinDuration}:" +
                $"start_threshold={_options.SilenceThresholdDb}dB:" +
                $"stop_periods=-1:stop_duration={_options.SilenceMinDuration}:" +
                $"stop_threshold={_options.SilenceThresholdDb}dB");
        }

        return string.Join(",", filterParts);
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
