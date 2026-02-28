using System.ComponentModel;
using Microsoft.SemanticKernel;

namespace BehavioralHealthSystem.Agents.Plugins;

/// <summary>
/// Semantic Kernel native function plugin for running DAM model predictions.
/// Step 3 of the audio processing pipeline: Predict.
///
/// Wraps the existing ILocalDamModelService to submit audio for depression/anxiety scoring.
/// </summary>
public class DamPredictionPlugin
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<DamPredictionPlugin> _logger;
    private readonly DamPredictionPluginOptions _options;

    public DamPredictionPlugin(
        HttpClient httpClient,
        ILogger<DamPredictionPlugin> logger,
        IOptions<DamPredictionPluginOptions> options)
    {
        _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _options = options?.Value ?? new DamPredictionPluginOptions();
    }

    /// <summary>
    /// Initiates a new prediction session with the DAM model and returns a session ID.
    /// </summary>
    [KernelFunction("InitiateDamSession")]
    [Description("Creates a new prediction session with the local DAM model and returns a session ID.")]
    public async Task<string> InitiateDamSessionAsync(
        [Description("The user ID initiating the session")] string userId,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userId, nameof(userId));

        _logger.LogInformation(
            "[{PluginName}] Initiating DAM session for UserId={UserId}",
            nameof(DamPredictionPlugin), userId);

        var payload = new
        {
            userId,
            isInitiated = true,
            modelId = _options.ModelId
        };

        using var response = await _httpClient.PostAsJsonAsync(
            _options.InitiatePath, payload, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError(
                "[{PluginName}] DAM initiate failed: {StatusCode} - {Error}",
                nameof(DamPredictionPlugin), response.StatusCode, error);
            throw new HttpRequestException(
                $"DAM session initiation failed with status {(int)response.StatusCode}: {error}");
        }

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(content))
        {
            var generatedId = Guid.NewGuid().ToString("N");
            _logger.LogInformation(
                "[{PluginName}] DAM returned empty response, generated SessionId={SessionId}",
                nameof(DamPredictionPlugin), generatedId);
            return generatedId;
        }

        // Try multiple JSON property naming conventions
        using var json = JsonDocument.Parse(content);
        var root = json.RootElement;
        var sessionId =
            TryReadString(root, "sessionId") ??
            TryReadString(root, "session_id") ??
            TryReadString(root, "id") ??
            Guid.NewGuid().ToString("N");

        _logger.LogInformation(
            "[{PluginName}] DAM session initiated. SessionId={SessionId}",
            nameof(DamPredictionPlugin), sessionId);

        return sessionId;
    }

    /// <summary>
    /// Submits converted audio data to the DAM model for prediction.
    /// Returns the full prediction response with depression/anxiety scores.
    /// </summary>
    [KernelFunction("RunPrediction")]
    [Description("Submits audio data to the local DAM model for depression/anxiety prediction. Returns prediction scores.")]
    public async Task<PredictionResponse> RunPredictionAsync(
        [Description("The converted audio data as bytes")] byte[] audioData,
        [Description("The audio file name (e.g., 'audio.wav')")] string audioFileName,
        [Description("The DAM session ID from InitiateDamSession")] string sessionId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(audioData);
        if (audioData.Length == 0)
            throw new ArgumentException("Audio data cannot be empty.", nameof(audioData));
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionId, nameof(sessionId));

        var correlationId = Guid.NewGuid().ToString("N")[..8];
        var sw = Stopwatch.StartNew();

        _logger.LogInformation(
            "[{PluginName}] [{CorrelationId}] Submitting prediction. SessionId={SessionId}, AudioBytes={AudioBytes}, FileName={FileName}",
            nameof(DamPredictionPlugin), correlationId, sessionId, audioData.Length, audioFileName);

        var payload = new
        {
            sessionId,
            audioData = Convert.ToBase64String(audioData),
            audioFileName = string.IsNullOrWhiteSpace(audioFileName) ? "audio.wav" : audioFileName,
            modelId = _options.ModelId,
            quantized = true,
            useGpu = _options.UseGpu,
            gpuDeviceId = _options.GpuDeviceId,
            useFp16 = _options.UseFp16
        };

        if (_options.UseGpu)
        {
            _logger.LogInformation(
                "[{PluginName}] [{CorrelationId}] GPU inference requested. Device={DeviceId}, FP16={UseFp16}",
                nameof(DamPredictionPlugin), correlationId, _options.GpuDeviceId, _options.UseFp16);
        }

        using var response = await _httpClient.PostAsJsonAsync(
            _options.PredictionPath, payload, cancellationToken);

        var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
        sw.Stop();

        _logger.LogInformation(
            "[{PluginName}] [{CorrelationId}] DAM response: StatusCode={StatusCode}, ElapsedMs={ElapsedMs:F0}",
            nameof(DamPredictionPlugin), correlationId, response.StatusCode, sw.Elapsed.TotalMilliseconds);

        _logger.LogInformation(
            "[{PluginName}] [{CorrelationId}] Raw DAM response body: {ResponseBody}",
            nameof(DamPredictionPlugin), correlationId, responseContent);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError(
                "[{PluginName}] [{CorrelationId}] DAM prediction failed: {StatusCode} - {Error}",
                nameof(DamPredictionPlugin), correlationId, response.StatusCode, responseContent);
            throw new HttpRequestException(
                $"DAM prediction failed with status {(int)response.StatusCode}: {responseContent}");
        }

        var predictionResponse = JsonSerializer.Deserialize<PredictionResponse>(
            responseContent, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (predictionResponse == null)
        {
            throw new InvalidOperationException(
                $"Failed to deserialize DAM prediction response: {responseContent}");
        }

        // DAM self-host wraps scores inside a "result" object — extract them if present.
        // The DAM API returns: {"result": {"depression": 0.42, "anxiety": 0.31}}
        // Map these to the PredictionResponse fields used by the rest of the system.
        try
        {
            using var json = JsonDocument.Parse(responseContent);
            if (json.RootElement.TryGetProperty("result", out var resultObj)
                && resultObj.ValueKind == JsonValueKind.Object)
            {
                // DAM uses short names: "depression", "anxiety", "score"
                // Also check the longer predicted_score_* names for forward compat
                predictionResponse.PredictedScoreDepression =
                    TryReadScoreValue(resultObj, "depression")
                    ?? TryReadScoreValue(resultObj, "predicted_score_depression")
                    ?? predictionResponse.PredictedScoreDepression;

                predictionResponse.PredictedScoreAnxiety =
                    TryReadScoreValue(resultObj, "anxiety")
                    ?? TryReadScoreValue(resultObj, "predicted_score_anxiety")
                    ?? predictionResponse.PredictedScoreAnxiety;

                predictionResponse.PredictedScore =
                    TryReadScoreValue(resultObj, "score")
                    ?? TryReadScoreValue(resultObj, "predicted_score")
                    ?? predictionResponse.PredictedScore;

                // If no overall score but we have depression, use depression as overall
                if (string.IsNullOrEmpty(predictionResponse.PredictedScore)
                    && !string.IsNullOrEmpty(predictionResponse.PredictedScoreDepression))
                {
                    predictionResponse.PredictedScore = predictionResponse.PredictedScoreDepression;
                }

                predictionResponse.Status =
                    TryReadString(resultObj, "status") ?? predictionResponse.Status;
                predictionResponse.CreatedAt =
                    TryReadString(resultObj, "created_at") ?? predictionResponse.CreatedAt;
                predictionResponse.UpdatedAt =
                    TryReadString(resultObj, "updated_at") ?? predictionResponse.UpdatedAt;
                predictionResponse.IsCalibrated =
                    resultObj.TryGetProperty("is_calibrated", out var cal) && cal.ValueKind == JsonValueKind.True;
                predictionResponse.ModelCategory =
                    TryReadString(resultObj, "model_category") ?? predictionResponse.ModelCategory;
                predictionResponse.ModelGranularity =
                    TryReadString(resultObj, "model_granularity") ?? predictionResponse.ModelGranularity;

                _logger.LogInformation(
                    "[{PluginName}] [{CorrelationId}] Extracted scores from nested 'result' object",
                    nameof(DamPredictionPlugin), correlationId);
            }
        }
        catch (JsonException ex)
        {
            _logger.LogWarning(ex,
                "[{PluginName}] [{CorrelationId}] Failed to extract nested result object, using top-level fields",
                nameof(DamPredictionPlugin), correlationId);
        }

        predictionResponse.Provider = "local-dam";

        _logger.LogInformation(
            "[{PluginName}] [{CorrelationId}] Prediction complete. Score={Score}, Depression={Depression}, Anxiety={Anxiety}",
            nameof(DamPredictionPlugin), correlationId,
            predictionResponse.PredictedScore,
            predictionResponse.PredictedScoreDepression,
            predictionResponse.PredictedScoreAnxiety);

        return predictionResponse;
    }

    private static string? TryReadString(JsonElement element, string propertyName)
    {
        if (element.TryGetProperty(propertyName, out var prop) && prop.ValueKind == JsonValueKind.String)
        {
            return prop.GetString();
        }
        return null;
    }

    /// <summary>
    /// Reads a score value that may be a string or a number in the JSON.
    /// DAM self-host returns numeric floats; the Kintsugi cloud API returns strings.
    /// </summary>
    private static string? TryReadScoreValue(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var prop))
            return null;

        return prop.ValueKind switch
        {
            JsonValueKind.String => prop.GetString(),
            JsonValueKind.Number => prop.GetDouble().ToString("G"),
            _ => null
        };
    }
}

/// <summary>
/// Configuration options for the DAM prediction plugin.
/// </summary>
public class DamPredictionPluginOptions
{
    /// <summary>Base URL of the local DAM service.</summary>
    public string BaseUrl { get; set; } = "http://localhost:8000";

    /// <summary>Path for session initiation endpoint.</summary>
    public string InitiatePath { get; set; } = "initiate";

    /// <summary>Path for prediction endpoint.</summary>
    public string PredictionPath { get; set; } = "predict";

    /// <summary>Optional API key for the DAM service.</summary>
    public string? ApiKey { get; set; }

    /// <summary>Model identifier.</summary>
    public string ModelId { get; set; } = "KintsugiHealth/dam";

    /// <summary>Timeout in seconds for prediction requests.</summary>
    public int TimeoutSeconds { get; set; } = 300;

    /// <summary>
    /// Whether to request GPU-accelerated inference from the DAM service.
    /// Set via LOCAL_DAM_USE_GPU environment variable.
    /// Requires the DAM service to be running with CUDA/GPU support.
    /// </summary>
    public bool UseGpu { get; set; } = false;

    /// <summary>
    /// GPU device index to use when UseGpu is true (e.g., 0 for first GPU).
    /// Set via LOCAL_DAM_GPU_DEVICE_ID environment variable.
    /// </summary>
    public int GpuDeviceId { get; set; } = 0;

    /// <summary>
    /// Whether to request FP16 (half-precision) inference for faster GPU processing.
    /// Only effective when UseGpu is true.
    /// Set via LOCAL_DAM_USE_FP16 environment variable.
    /// </summary>
    public bool UseFp16 { get; set; } = false;
}
