namespace BehavioralHealthSystem.Functions;

public class LocalDamFunctions
{
    private readonly ILogger<LocalDamFunctions> _logger;
    private readonly ILocalDamModelService _localDamModelService;
    private readonly IValidator<InitiateRequest> _initiateRequestValidator;
    private readonly BlobServiceClient _blobServiceClient;
    private readonly JsonSerializerOptions _jsonOptions;

    public LocalDamFunctions(
        ILogger<LocalDamFunctions> logger,
        ILocalDamModelService localDamModelService,
        IValidator<InitiateRequest> initiateRequestValidator,
        BlobServiceClient blobServiceClient)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _localDamModelService = localDamModelService ?? throw new ArgumentNullException(nameof(localDamModelService));
        _initiateRequestValidator = initiateRequestValidator ?? throw new ArgumentNullException(nameof(initiateRequestValidator));
        _blobServiceClient = blobServiceClient ?? throw new ArgumentNullException(nameof(blobServiceClient));
        _jsonOptions = JsonSerializerOptionsFactory.Default;
    }

    [Function("InitiateSessionLocal")]
    public Task<HttpResponseData> InitiateSessionLocal(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "sessions/initiate-local")] HttpRequestData req)
    {
        return InitiateSessionInternalAsync(req);
    }

    [Function("InitiateSessionSelected")]
    public Task<HttpResponseData> InitiateSessionSelected(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "sessions/initiate-selected")] HttpRequestData req)
    {
        return InitiateSessionInternalAsync(req);
    }

    [Function("SubmitPredictionLocal")]
    public Task<HttpResponseData> SubmitPredictionLocal(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "predictions/submit-local")] HttpRequestData req)
    {
        return SubmitPredictionInternalAsync(req);
    }

    [Function("SubmitPredictionSelected")]
    public Task<HttpResponseData> SubmitPredictionSelected(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "predictions/submit-selected")] HttpRequestData req)
    {
        return SubmitPredictionInternalAsync(req);
    }

    private async Task<HttpResponseData> InitiateSessionInternalAsync(HttpRequestData req)
    {
        try
        {
            var requestBody = await req.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(requestBody))
            {
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    Success = false,
                    Message = "Request body is required"
                }, _jsonOptions));
                return badRequest;
            }

            var initiateRequest = JsonSerializer.Deserialize<InitiateRequest>(requestBody, _jsonOptions);
            if (initiateRequest == null)
            {
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    Success = false,
                    Message = "Invalid JSON format"
                }, _jsonOptions));
                return badRequest;
            }

            var validationResult = await _initiateRequestValidator.ValidateAsync(initiateRequest);
            if (!validationResult.IsValid)
            {
                var validationResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                var validationErrors = validationResult.Errors.Select(e => new
                {
                    field = e.PropertyName.ToLowerInvariant().Replace("metadata.", ""),
                    error = e.ErrorMessage
                }).ToArray();

                await validationResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = "Error initiating session",
                    errors = validationErrors
                }, _jsonOptions));

                return validationResponse;
            }

            var initiateResponse = await _localDamModelService.InitiateSessionAsync(initiateRequest);

            if (initiateResponse == null || string.IsNullOrWhiteSpace(initiateResponse.SessionId))
            {
                var failResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await failResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    Success = false,
                    Message = "Failed to initiate session"
                }, _jsonOptions));

                return failResponse;
            }

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                Success = true,
                Message = "Session initiated successfully",
                SessionId = initiateResponse.SessionId,
                UserId = initiateRequest.UserId,
                Provider = "local-dam"
            }, _jsonOptions));

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error initiating session", nameof(InitiateSessionInternalAsync));

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                Success = false,
                Message = "Error initiating session",
                Error = ex.Message,
                Provider = "local-dam"
            }, _jsonOptions));

            return errorResponse;
        }
    }

    private async Task<HttpResponseData> SubmitPredictionInternalAsync(HttpRequestData req)
    {
        var correlationId = Guid.NewGuid().ToString("N")[..8];
        var startedAtUtc = DateTime.UtcNow;

        try
        {
            var requestBody = await req.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(requestBody))
            {
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    Success = false,
                    Message = "Request body is required"
                }, _jsonOptions));
                return badRequest;
            }

            var predictionRequest = JsonSerializer.Deserialize<PredictionRequest>(requestBody, _jsonOptions);
            if (predictionRequest == null)
            {
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    Success = false,
                    Message = "Invalid JSON format"
                }, _jsonOptions));
                return badRequest;
            }

            if (string.IsNullOrWhiteSpace(predictionRequest.SessionId))
            {
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    Success = false,
                    Message = "SessionId is required"
                }, _jsonOptions));
                return badRequest;
            }

            if ((predictionRequest.AudioData == null || predictionRequest.AudioData.Length == 0) &&
                string.IsNullOrWhiteSpace(predictionRequest.AudioFileUrl))
            {
                var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequest.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    Success = false,
                    Message = "Either AudioData (byte array) or AudioFileUrl must be provided"
                }, _jsonOptions));
                return badRequest;
            }

            _logger.LogInformation(
                "[{FunctionName}] [{CorrelationId}] Prediction request accepted. Provider=local-dam, SessionId={SessionId}, HasAudioData={HasAudioData}, AudioDataLength={AudioDataLength}, HasAudioFileUrl={HasAudioFileUrl}, AudioFileName={AudioFileName}",
                nameof(SubmitPredictionInternalAsync),
                correlationId,
                predictionRequest.SessionId,
                predictionRequest.AudioData is { Length: > 0 },
                predictionRequest.AudioData?.Length ?? 0,
                !string.IsNullOrWhiteSpace(predictionRequest.AudioFileUrl),
                predictionRequest.AudioFileName);

            if ((predictionRequest.AudioData == null || predictionRequest.AudioData.Length == 0) &&
                !string.IsNullOrWhiteSpace(predictionRequest.AudioFileUrl))
            {
                _logger.LogInformation(
                    "[{FunctionName}] [{CorrelationId}] Downloading blob audio for local DAM from {AudioFileUrl}",
                    nameof(SubmitPredictionInternalAsync),
                    correlationId,
                    predictionRequest.AudioFileUrl);

                predictionRequest.AudioData = await DownloadAudioFromBlobAsync(predictionRequest.AudioFileUrl);

                _logger.LogInformation(
                    "[{FunctionName}] [{CorrelationId}] Downloaded {DataSize} bytes from blob for local DAM",
                    nameof(SubmitPredictionInternalAsync),
                    correlationId,
                    predictionRequest.AudioData.Length);

                predictionRequest.AudioFileName = ResolveDamAudioFileName(
                    predictionRequest.AudioFileUrl,
                    predictionRequest.AudioFileName,
                    predictionRequest.AudioData);

                _logger.LogInformation(
                    "[{FunctionName}] [{CorrelationId}] Normalized local DAM audio filename to {AudioFileName}",
                    nameof(SubmitPredictionInternalAsync),
                    correlationId,
                    predictionRequest.AudioFileName);
            }
            else if (predictionRequest.AudioData is { Length: > 0 })
            {
                predictionRequest.AudioFileName = ResolveDamAudioFileName(
                    predictionRequest.AudioFileUrl,
                    predictionRequest.AudioFileName,
                    predictionRequest.AudioData);
            }

            _logger.LogInformation(
                "[{FunctionName}] [{CorrelationId}] Forwarding request to local DAM service. SessionId={SessionId}, AudioBytes={AudioBytes}",
                nameof(SubmitPredictionInternalAsync),
                correlationId,
                predictionRequest.SessionId,
                predictionRequest.AudioData?.Length ?? 0);

            var predictionResponse = await _localDamModelService.SubmitPredictionAsync(predictionRequest);

            if (predictionResponse == null)
            {
                var failResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await failResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    Success = false,
                    Message = "Failed to submit prediction"
                }, _jsonOptions));

                return failResponse;
            }

            var elapsedMs = (DateTime.UtcNow - startedAtUtc).TotalMilliseconds;
            _logger.LogInformation(
                "[{FunctionName}] [{CorrelationId}] Prediction submitted successfully. Provider=local-dam, SessionId={SessionId}, Status={Status}, ElapsedMs={ElapsedMs}",
                nameof(SubmitPredictionInternalAsync),
                correlationId,
                predictionResponse.SessionId,
                predictionResponse.Status,
                elapsedMs);

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                Success = true,
                Message = "Prediction submitted successfully",
                SessionId = predictionResponse.SessionId,
                Status = predictionResponse.Status,
                Provider = "local-dam",
                PredictedScore = predictionResponse.PredictedScore,
                PredictedScoreDepression = predictionResponse.PredictedScoreDepression,
                PredictedScoreAnxiety = predictionResponse.PredictedScoreAnxiety,
                CreatedAt = predictionResponse.CreatedAt,
                UpdatedAt = predictionResponse.UpdatedAt,
                ModelCategory = predictionResponse.ModelCategory,
                ModelGranularity = predictionResponse.ModelGranularity,
                IsCalibrated = predictionResponse.IsCalibrated,
                Model = predictionResponse.Model,
                ActualScore = predictionResponse.ActualScore,
                PredictError = predictionResponse.PredictError,
                predicted_score = predictionResponse.PredictedScore,
                predicted_score_depression = predictionResponse.PredictedScoreDepression,
                predicted_score_anxiety = predictionResponse.PredictedScoreAnxiety,
                created_at = predictionResponse.CreatedAt,
                updated_at = predictionResponse.UpdatedAt,
                model_category = predictionResponse.ModelCategory,
                model_granularity = predictionResponse.ModelGranularity,
                is_calibrated = predictionResponse.IsCalibrated,
                actual_score = predictionResponse.ActualScore,
                predict_error = predictionResponse.PredictError
            }, _jsonOptions));

            return response;
        }
        catch (Exception ex)
        {
            var elapsedMs = (DateTime.UtcNow - startedAtUtc).TotalMilliseconds;
            _logger.LogError(
                ex,
                "[{FunctionName}] [{CorrelationId}] Error submitting prediction. ElapsedMs={ElapsedMs}",
                nameof(SubmitPredictionInternalAsync),
                correlationId,
                elapsedMs);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                Success = false,
                Message = "Error submitting prediction",
                Error = ex.Message,
                Provider = "local-dam"
            }, _jsonOptions));

            return errorResponse;
        }
    }

    private async Task<byte[]> DownloadAudioFromBlobAsync(string blobUrl)
    {
        _logger.LogInformation("[{MethodName}] Downloading audio from blob URL: {BlobUrl}", nameof(DownloadAudioFromBlobAsync), blobUrl);

        var uri = new Uri(blobUrl);
        var pathSegments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);

        if (pathSegments.Length < 2)
        {
            throw new InvalidOperationException($"Invalid blob URL path: {blobUrl}");
        }

        string containerName;
        string blobPath;

        containerName = pathSegments[0];
        blobPath = string.Join("/", pathSegments.Skip(1));

        var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
        var blobClient = containerClient.GetBlobClient(blobPath);

        using var memoryStream = new MemoryStream();
        await blobClient.DownloadToAsync(memoryStream);
        return memoryStream.ToArray();
    }

    private static string ResolveDamAudioFileName(string? audioFileUrl, string? originalAudioFileName, byte[]? audioData)
    {
        var extension =
            InferAudioExtension(audioData) ??
            GetExtensionFromUrl(audioFileUrl) ??
            GetExtensionFromFileName(originalAudioFileName) ??
            ".wav";

        if (!extension.StartsWith('.'))
        {
            extension = $".{extension}";
        }

        return $"audio{extension.ToLowerInvariant()}";
    }

    private static string? GetExtensionFromUrl(string? audioFileUrl)
    {
        if (string.IsNullOrWhiteSpace(audioFileUrl) || !Uri.TryCreate(audioFileUrl, UriKind.Absolute, out var uri))
        {
            return null;
        }

        return Path.GetExtension(uri.AbsolutePath);
    }

    private static string? GetExtensionFromFileName(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return null;
        }

        return Path.GetExtension(fileName);
    }

    private static string? InferAudioExtension(byte[]? audioData)
    {
        if (audioData == null || audioData.Length < 4)
        {
            return null;
        }

        if (audioData.Length >= 12 &&
            audioData[0] == 0x52 && audioData[1] == 0x49 && audioData[2] == 0x46 && audioData[3] == 0x46 &&
            audioData[8] == 0x57 && audioData[9] == 0x41 && audioData[10] == 0x56 && audioData[11] == 0x45)
        {
            return ".wav";
        }

        if (audioData[0] == 0x49 && audioData[1] == 0x44 && audioData[2] == 0x33)
        {
            return ".mp3";
        }

        if (audioData[0] == 0xFF && (audioData[1] & 0xE0) == 0xE0)
        {
            return ".mp3";
        }

        if (audioData[0] == 0x4F && audioData[1] == 0x67 && audioData[2] == 0x67 && audioData[3] == 0x53)
        {
            return ".ogg";
        }

        if (audioData[0] == 0x1A && audioData[1] == 0x45 && audioData[2] == 0xDF && audioData[3] == 0xA3)
        {
            return ".webm";
        }

        if (audioData[0] == 0x66 && audioData[1] == 0x4C && audioData[2] == 0x61 && audioData[3] == 0x43)
        {
            return ".flac";
        }

        return null;
    }
}
