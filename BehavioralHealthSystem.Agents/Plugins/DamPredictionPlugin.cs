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
            quantized = true
        };

        using var response = await _httpClient.PostAsJsonAsync(
            _options.PredictionPath, payload, cancellationToken);

        var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
        sw.Stop();

        _logger.LogInformation(
            "[{PluginName}] [{CorrelationId}] DAM response: StatusCode={StatusCode}, ElapsedMs={ElapsedMs:F0}",
            nameof(DamPredictionPlugin), correlationId, response.StatusCode, sw.Elapsed.TotalMilliseconds);

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
}
