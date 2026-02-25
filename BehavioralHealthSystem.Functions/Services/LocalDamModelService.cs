using System.Net.Http.Json;

namespace BehavioralHealthSystem.Functions.Services;

public class LocalDamModelService : ILocalDamModelService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<LocalDamModelService> _logger;
    private readonly LocalDamModelOptions _options;

    public LocalDamModelService(
        HttpClient httpClient,
        ILogger<LocalDamModelService> logger,
        IOptions<LocalDamModelOptions> options)
    {
        _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _options = options?.Value ?? throw new ArgumentNullException(nameof(options));
    }

    public async Task<InitiateResponse?> InitiateSessionAsync(InitiateRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var payload = new
        {
            userId = request.UserId,
            isInitiated = request.IsInitiated,
            metadata = request.Metadata,
            modelId = _options.ModelId
        };

        using var response = await _httpClient.PostAsJsonAsync(_options.InitiatePath, payload, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("[{MethodName}] Local DAM initiate failed with status {StatusCode}: {Error}",
                nameof(InitiateSessionAsync), response.StatusCode, error);
            throw new HttpRequestException($"Local DAM initiate failed with status {(int)response.StatusCode}: {error}");
        }

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(content))
        {
            return new InitiateResponse { SessionId = Guid.NewGuid().ToString("N") };
        }

        var fromTyped = JsonSerializer.Deserialize<InitiateResponse>(content, JsonSerializerOptionsFactory.Default);
        if (fromTyped != null && !string.IsNullOrWhiteSpace(fromTyped.SessionId))
        {
            return fromTyped;
        }

        using var json = JsonDocument.Parse(content);
        var root = json.RootElement;
        var sessionId =
            TryReadString(root, "sessionId") ??
            TryReadString(root, "session_id") ??
            TryReadString(root, "id") ??
            Guid.NewGuid().ToString("N");

        return new InitiateResponse { SessionId = sessionId };
    }

    public async Task<PredictionResponse?> SubmitPredictionAsync(PredictionRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);

        var correlationId = Guid.NewGuid().ToString("N")[..8];
        var startedAtUtc = DateTime.UtcNow;
        var normalizedAudioFileUrl = NormalizeAudioFileUrlForContainer(request.AudioFileUrl);

        var audioBase64 = request.AudioData is { Length: > 0 }
            ? Convert.ToBase64String(request.AudioData)
            : null;

        _logger.LogInformation(
            "[{MethodName}] [{CorrelationId}] Sending local DAM prediction. SessionId={SessionId}, AudioBytes={AudioBytes}, HasAudioData={HasAudioData}, HasAudioFileUrl={HasAudioFileUrl}, Quantized={Quantized}, PredictionPath={PredictionPath}",
            nameof(SubmitPredictionAsync),
            correlationId,
            request.SessionId,
            request.AudioData?.Length ?? 0,
            audioBase64 is not null,
            !string.IsNullOrWhiteSpace(normalizedAudioFileUrl),
            true,
            _options.PredictionPath);

        var payload = new
        {
            sessionId = request.SessionId,
            audioData = audioBase64,
            audioFileUrl = audioBase64 is null && !string.IsNullOrWhiteSpace(normalizedAudioFileUrl) ? normalizedAudioFileUrl : null,
            audioFileName = string.IsNullOrWhiteSpace(request.AudioFileName) ? "audio.wav" : request.AudioFileName,
            modelId = _options.ModelId,
            quantized = true
        };

        using var response = await _httpClient.PostAsJsonAsync(_options.PredictionPath, payload, cancellationToken);
        _logger.LogInformation(
            "[{MethodName}] [{CorrelationId}] Local DAM HTTP response received. StatusCode={StatusCode}, ElapsedMs={ElapsedMs}",
            nameof(SubmitPredictionAsync),
            correlationId,
            (int)response.StatusCode,
            (DateTime.UtcNow - startedAtUtc).TotalMilliseconds);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("[{MethodName}] Local DAM prediction failed with status {StatusCode}: {Error}",
                nameof(SubmitPredictionAsync), response.StatusCode, error);
            throw new HttpRequestException($"Local DAM prediction failed with status {(int)response.StatusCode}: {error}");
        }

        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(content))
        {
            return new PredictionResponse
            {
                SessionId = request.SessionId,
                Status = "submitted"
            };
        }

        using var json = JsonDocument.Parse(content);
        var root = json.RootElement;
        var resultNode = TryGetObject(root, "result") ?? root;

        var fromTyped = JsonSerializer.Deserialize<PredictionResponse>(content, JsonSerializerOptionsFactory.Default);
        var prediction = fromTyped ?? new PredictionResponse();

        prediction.SessionId =
            FirstNonEmpty(
                prediction.SessionId,
                TryReadString(root, "sessionId"),
                TryReadString(root, "session_id"),
                request.SessionId);

        prediction.Status =
            FirstNonEmpty(
                prediction.Status,
                TryReadString(root, "status"),
                "submitted");

        prediction.PredictedScoreDepression =
            FirstNonEmpty(
                prediction.PredictedScoreDepression,
                TryReadString(resultNode, "predicted_score_depression"),
                TryReadString(resultNode, "predictedScoreDepression"),
                TryReadString(resultNode, "depression_score"),
                TryReadString(resultNode, "depressionScore"),
                TryReadString(resultNode, "depression"));

        prediction.PredictedScoreAnxiety =
            FirstNonEmpty(
                prediction.PredictedScoreAnxiety,
                TryReadString(resultNode, "predicted_score_anxiety"),
                TryReadString(resultNode, "predictedScoreAnxiety"),
                TryReadString(resultNode, "anxiety_score"),
                TryReadString(resultNode, "anxietyScore"),
                TryReadString(resultNode, "anxiety"));

        prediction.PredictedScore =
            FirstNonEmpty(
                prediction.PredictedScore,
                TryReadString(resultNode, "predicted_score"),
                TryReadString(resultNode, "predictedScore"),
                prediction.PredictedScoreDepression,
                prediction.PredictedScoreAnxiety);

        prediction.CreatedAt =
            FirstNonEmpty(
                prediction.CreatedAt,
                TryReadString(root, "created_at"),
                TryReadString(root, "createdAt"),
                TryReadString(resultNode, "created_at"),
                TryReadString(resultNode, "createdAt"),
                DateTime.UtcNow.ToString("O"));

        prediction.UpdatedAt =
            FirstNonEmpty(
                prediction.UpdatedAt,
                TryReadString(root, "updated_at"),
                TryReadString(root, "updatedAt"),
                TryReadString(resultNode, "updated_at"),
                TryReadString(resultNode, "updatedAt"),
                DateTime.UtcNow.ToString("O"));

        prediction.ModelCategory =
            FirstNonEmpty(
                prediction.ModelCategory,
                TryReadString(resultNode, "model_category"),
                TryReadString(resultNode, "modelCategory"),
                TryReadString(resultNode, "category"));

        prediction.ModelGranularity =
            FirstNonEmpty(
                prediction.ModelGranularity,
                TryReadString(resultNode, "model_granularity"),
                TryReadString(resultNode, "modelGranularity"),
                TryReadString(resultNode, "granularity"));

        prediction.Provider =
            FirstNonEmpty(
                prediction.Provider,
                TryReadString(root, "provider"),
                TryReadString(resultNode, "provider"),
                "local-dam");

        prediction.Model =
            FirstNonEmpty(
                prediction.Model,
                TryReadString(root, "model"),
                TryReadString(resultNode, "model"),
                _options.ModelId);

        if (TryReadBool(resultNode, "is_calibrated", out var isCalibrated) ||
            TryReadBool(resultNode, "isCalibrated", out isCalibrated))
        {
            prediction.IsCalibrated = isCalibrated;
        }

        prediction.ActualScore ??= TryReadObjectAs<ActualScore>(resultNode, "actual_score");
        prediction.PredictError ??=
            TryReadObjectAs<PredictError>(resultNode, "predict_error") ??
            TryReadObjectAs<PredictError>(root, "predict_error");

        return prediction;
    }

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return string.Empty;
    }

    private static string? TryReadString(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var value))
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.GetDouble().ToString(System.Globalization.CultureInfo.InvariantCulture),
            JsonValueKind.True => bool.TrueString.ToLowerInvariant(),
            JsonValueKind.False => bool.FalseString.ToLowerInvariant(),
            _ => value.ToString()
        };
    }

    private static bool TryReadBool(JsonElement root, string propertyName, out bool value)
    {
        value = false;
        if (!root.TryGetProperty(propertyName, out var element))
        {
            return false;
        }

        if (element.ValueKind == JsonValueKind.True || element.ValueKind == JsonValueKind.False)
        {
            value = element.GetBoolean();
            return true;
        }

        if (element.ValueKind == JsonValueKind.String && bool.TryParse(element.GetString(), out var parsed))
        {
            value = parsed;
            return true;
        }

        return false;
    }

    private static JsonElement? TryGetObject(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var value) || value.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return value;
    }

    private static T? TryReadObjectAs<T>(JsonElement root, string propertyName) where T : class
    {
        if (!root.TryGetProperty(propertyName, out var value) || value.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return JsonSerializer.Deserialize<T>(value.GetRawText(), JsonSerializerOptionsFactory.Default);
    }

    private static string? NormalizeAudioFileUrlForContainer(string? audioFileUrl)
    {
        if (string.IsNullOrWhiteSpace(audioFileUrl))
        {
            return audioFileUrl;
        }

        if (!Uri.TryCreate(audioFileUrl, UriKind.Absolute, out var uri))
        {
            return audioFileUrl;
        }

        if (!string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(uri.Host, "127.0.0.1", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(uri.Host, "::1", StringComparison.OrdinalIgnoreCase))
        {
            return audioFileUrl;
        }

        var builder = new UriBuilder(uri)
        {
            Host = "host.docker.internal"
        };

        return builder.Uri.ToString();
    }
}
