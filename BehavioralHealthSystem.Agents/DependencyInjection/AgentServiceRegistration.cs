using System.Net.Http.Headers;
using BehavioralHealthSystem.Agents.Plugins;
using BehavioralHealthSystem.Agents.Services;
using Microsoft.Extensions.DependencyInjection;

namespace BehavioralHealthSystem.Agents.DependencyInjection;

/// <summary>
/// Extension methods for registering Semantic Kernel agent services.
/// </summary>
public static class AgentServiceRegistration
{
    /// <summary>
    /// Registers the Semantic Kernel audio processing pipeline:
    /// - AudioRetrievalPlugin (blob storage access)
    /// - AudioConversionPlugin (ffmpeg conversion)
    /// - DamPredictionPlugin (DAM model prediction)
    /// - AudioProcessingOrchestrator (sequential pipeline)
    /// - Kernel with all plugins imported
    /// </summary>
    public static IServiceCollection AddAgentServices(
        this IServiceCollection services,
        Action<AudioConversionOptions>? configureConversion = null,
        Action<DamPredictionPluginOptions>? configureDam = null)
    {
        // ── Configuration ────────────────────────────────────────────────

        // Audio conversion options (ffmpeg settings)
        services.AddOptions<AudioConversionOptions>()
            .Configure<IConfiguration>((options, config) =>
            {
                options.FfmpegPath = config["FFMPEG_PATH"] ?? "ffmpeg";
                if (int.TryParse(config["FFMPEG_SAMPLE_RATE"], out var sampleRate))
                    options.SampleRate = sampleRate;
                if (int.TryParse(config["FFMPEG_MAX_DURATION_SECONDS"], out var maxDuration))
                    options.MaxDurationSeconds = maxDuration;
                if (int.TryParse(config["FFMPEG_PROCESS_TIMEOUT_SECONDS"], out var timeout))
                    options.ProcessTimeoutSeconds = timeout;
                if (bool.TryParse(config["FFMPEG_SKIP_CLEAN_WAV"], out var skipClean))
                    options.SkipFiltersIfCleanWav = skipClean;
                if (bool.TryParse(config["FFMPEG_USE_TMPFS"], out var useTmpfs))
                    options.UseTmpfs = useTmpfs;
                if (bool.TryParse(config["FFMPEG_USE_PIPE_MODE"], out var usePipe))
                    options.UsePipeMode = usePipe;
            });

        if (configureConversion != null)
        {
            services.PostConfigure(configureConversion);
        }

        // DAM prediction options
        services.AddOptions<DamPredictionPluginOptions>()
            .Configure<IConfiguration>((options, config) =>
            {
                options.BaseUrl = config["LOCAL_DAM_BASE_URL"] ?? "http://localhost:8000";
                options.InitiatePath = config["LOCAL_DAM_INITIATE_PATH"] ?? "initiate";
                options.PredictionPath = config["LOCAL_DAM_PREDICTION_PATH"] ?? "predict";
                options.ApiKey = config["LOCAL_DAM_API_KEY"];
                options.ModelId = config["LOCAL_DAM_MODEL_ID"] ?? "KintsugiHealth/dam";
                if (int.TryParse(config["LOCAL_DAM_TIMEOUT_SECONDS"], out var timeout))
                    options.TimeoutSeconds = timeout;
                if (bool.TryParse(config["LOCAL_DAM_USE_GPU"], out var useGpu))
                    options.UseGpu = useGpu;
                if (int.TryParse(config["LOCAL_DAM_GPU_DEVICE_ID"], out var gpuDeviceId))
                    options.GpuDeviceId = gpuDeviceId;
                if (bool.TryParse(config["LOCAL_DAM_USE_FP16"], out var useFp16))
                    options.UseFp16 = useFp16;
            });

        if (configureDam != null)
        {
            services.PostConfigure(configureDam);
        }

        // Local file retrieval options
        services.AddOptions<LocalFileRetrievalOptions>()
            .Configure<IConfiguration>((options, config) =>
            {
                options.RecordingsDirectory = config["LOCAL_RECORDINGS_DIRECTORY"] ?? "./recordings";
                if (bool.TryParse(config["LOCAL_RECORDINGS_SEARCH_SUBDIRS"], out var searchSubdirs))
                    options.SearchSubdirectories = searchSubdirs;
            });

        // ── Plugins ──────────────────────────────────────────────────────

        // AudioRetrievalPlugin — depends on BlobServiceClient (already registered in Functions Program.cs)
        services.AddSingleton<AudioRetrievalPlugin>();

        // LocalFileRetrievalPlugin — reads from local filesystem
        services.AddSingleton<LocalFileRetrievalPlugin>();

        // AudioConversionPlugin — depends on AudioConversionOptions
        services.AddSingleton<AudioConversionPlugin>();

        // DamPredictionPlugin — needs its own HttpClient
        services.AddHttpClient<DamPredictionPlugin>()
            .ConfigureHttpClient((sp, client) =>
            {
                var options = sp.GetService<IOptions<DamPredictionPluginOptions>>()?.Value
                              ?? new DamPredictionPluginOptions();
                client.BaseAddress = new Uri(options.BaseUrl.TrimEnd('/') + "/");
                client.Timeout = TimeSpan.FromSeconds(Math.Max(30, options.TimeoutSeconds));
                client.DefaultRequestHeaders.Accept.Clear();
                client.DefaultRequestHeaders.Accept.Add(
                    new MediaTypeWithQualityHeaderValue("application/json"));
                if (!string.IsNullOrWhiteSpace(options.ApiKey))
                {
                    client.DefaultRequestHeaders.Add("X-API-Key", options.ApiKey);
                }
            });

        // ── Semantic Kernel ──────────────────────────────────────────────

        services.AddSingleton<Kernel>(sp =>
        {
            var builder = Kernel.CreateBuilder();

            // Import the native plugins
            var retrievalPlugin = sp.GetRequiredService<AudioRetrievalPlugin>();
            var localRetrievalPlugin = sp.GetRequiredService<LocalFileRetrievalPlugin>();
            var conversionPlugin = sp.GetRequiredService<AudioConversionPlugin>();
            var predictionPlugin = sp.GetRequiredService<DamPredictionPlugin>();

            builder.Plugins.AddFromObject(retrievalPlugin, "AudioRetrieval");
            builder.Plugins.AddFromObject(localRetrievalPlugin, "LocalFileRetrieval");
            builder.Plugins.AddFromObject(conversionPlugin, "AudioConversion");
            builder.Plugins.AddFromObject(predictionPlugin, "DamPrediction");

            return builder.Build();
        });

        // ── Orchestrator ─────────────────────────────────────────────────

        services.AddScoped<IAudioProcessingOrchestrator, AudioProcessingOrchestrator>();

        return services;
    }
}
