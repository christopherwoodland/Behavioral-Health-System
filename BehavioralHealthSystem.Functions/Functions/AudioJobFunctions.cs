using System.Security.Cryptography;
using System.IO;
using System.Globalization;
using System.Threading;
using Azure;
using Azure.Storage.Blobs.Models;
using BehavioralHealthSystem.Agents.Models;
using BehavioralHealthSystem.Functions.Services;
using Microsoft.DurableTask;
using Microsoft.DurableTask.Client;
using Microsoft.Extensions.Configuration;

namespace BehavioralHealthSystem.Functions.Functions;

public sealed class AudioJobFunctions
{
    private const string ContainerName = "audio-uploads";
    private const long DefaultMaxUploadBytes = 25 * 1024 * 1024;
    private const int MaxIdentifierLength = 128;
    private const int MaxFileNameLength = 255;
    private const string AgeHeaderName = "X-User-Age";
    private const string WeightKgHeaderName = "X-User-Weight-Kg";

    private static readonly HashSet<string> SupportedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".wav", ".mp3", ".mp4", ".m4a", ".aac", ".flac",
        ".ogg", ".webm", ".mkv", ".avi", ".mov"
    };

    private readonly BlobServiceClient _blobServiceClient;
    private readonly IApiKeyValidationService _apiKeyValidation;
    private readonly ILogger<AudioJobFunctions> _logger;
    private readonly long _maxUploadBytes;

    public AudioJobFunctions(
        BlobServiceClient blobServiceClient,
        IApiKeyValidationService apiKeyValidation,
        ILogger<AudioJobFunctions> logger,
        IConfiguration configuration)
    {
        _blobServiceClient = blobServiceClient ?? throw new ArgumentNullException(nameof(blobServiceClient));
        _apiKeyValidation = apiKeyValidation ?? throw new ArgumentNullException(nameof(apiKeyValidation));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        ArgumentNullException.ThrowIfNull(configuration);

        var configuredLimit = configuration.GetValue<long?>("AUDIO_JOB_MAX_UPLOAD_BYTES");
        _maxUploadBytes = configuredLimit is > 0 ? configuredLimit.Value : DefaultMaxUploadBytes;
    }

    [Function("StartAudioProcessingJob")]
    public async Task<HttpResponseData> StartAudioProcessingJob(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "audio-jobs")] HttpRequestData request,
        [DurableClient] DurableTaskClient durableClient)
    {
        var validation = await _apiKeyValidation.ValidateRequestAsync(request);
        if (!validation.IsValid)
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.Unauthorized,
                "unauthorized",
                "Valid credentials are required.");
        }

        if (!TryCreateOwnerIdHash(validation, out var ownerIdHash))
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.Forbidden,
                "caller_identity_unavailable",
                "The authenticated credential must contain a stable subject identifier.");
        }

        var query = System.Web.HttpUtility.ParseQueryString(request.Url.Query);
        var userId = query["userId"];
        var sessionId = query["sessionId"];
        var originalFileName = query["fileName"];

        if (!IsValidIdentifier(userId))
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.BadRequest,
                "invalid_user_id",
                $"userId must be 1-{MaxIdentifierLength} ASCII letters, numbers, hyphens, or underscores.");
        }

        if (!IsValidIdentifier(sessionId))
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.BadRequest,
                "invalid_session_id",
                $"sessionId must be 1-{MaxIdentifierLength} ASCII letters, numbers, hyphens, or underscores.");
        }

        if (!IsValidFileName(originalFileName, out var extension))
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.BadRequest,
                "unsupported_audio_file",
                $"fileName must be a simple name up to {MaxFileNameLength} characters with one of these extensions: {string.Join(", ", SupportedExtensions.Order())}.");
        }

        if (!TryReadOptionalDemographics(request, out var age, out var weightKg, out var demographicsError))
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.BadRequest,
                "invalid_demographics",
                demographicsError!);
        }

        if (TryGetContentLength(request, out var contentLength) && contentLength == 0)
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.BadRequest,
                "empty_audio",
                "Request body cannot be empty.");
        }

        if (contentLength > _maxUploadBytes)
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.RequestEntityTooLarge,
                "audio_too_large",
                $"Audio uploads cannot exceed {_maxUploadBytes} bytes.");
        }

        var idempotencyKey = GetHeaderValue(request, "Idempotency-Key");
        if (!IsValidIdempotencyKey(idempotencyKey))
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.BadRequest,
                "invalid_idempotency_key",
                "Idempotency-Key cannot exceed 128 characters or contain control characters.");
        }

        var jobId = CreateJobId(
            userId!,
            sessionId!,
            originalFileName!,
            ownerIdHash,
            idempotencyKey);
        var cancellationToken = request.FunctionContext.CancellationToken;

        if (idempotencyKey is not null)
        {
            var existing = await TryGetOwnedAudioJobAsync(
                durableClient,
                jobId,
                ownerIdHash,
                cancellationToken);
            if (existing is not null)
            {
                return await CreateAcceptedResponseAsync(
                    request,
                    jobId,
                    MapStatus(existing, Deserialize<AudioProcessingResult>(existing.SerializedOutput)),
                    replayed: true);
            }
        }

        var storedFileName = $"session-{sessionId}-{jobId}{extension}";
        var blobName = $"users/{userId}/{storedFileName}";
        var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
        var blobClient = containerClient.GetBlobClient(blobName);
        var blobCommitted = false;
        var blobReused = false;

        try
        {
            var firstByte = new byte[1];
            var firstByteCount = await request.Body.ReadAsync(firstByte, cancellationToken);
            if (firstByteCount == 0)
            {
                return await CreateErrorResponseAsync(
                    request,
                    HttpStatusCode.BadRequest,
                    "empty_audio",
                    "Request body cannot be empty.");
            }

            await containerClient.CreateIfNotExistsAsync(
                PublicAccessType.None,
                cancellationToken: cancellationToken);

            var uploadOptions = new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders { ContentType = GetContentType(extension) },
                Metadata = new Dictionary<string, string>
                {
                    ["jobId"] = jobId,
                    ["userId"] = userId!,
                    ["sessionId"] = sessionId!,
                    ["ownerIdHash"] = ownerIdHash,
                    ["originalFileNameBase64"] = Convert.ToBase64String(Encoding.UTF8.GetBytes(originalFileName!)),
                    ["uploadedAt"] = DateTimeOffset.UtcNow.ToString("O"),
                    ["source"] = "audio-job-api"
                },
                Conditions = new BlobRequestConditions { IfNoneMatch = ETag.All }
            };

            using var prefixedBody = new PrefixReadStream(firstByte[0], request.Body);
            using var limitedBody = new SizeLimitedReadStream(prefixedBody, _maxUploadBytes);
            try
            {
                await blobClient.UploadAsync(limitedBody, uploadOptions, cancellationToken);
                blobCommitted = true;
            }
            catch (RequestFailedException exception)
                when (idempotencyKey is not null && IsBlobAlreadyPresent(exception))
            {
                blobReused = true;
                _logger.LogInformation(
                    "Reusing the committed input blob for idempotent audio job {JobId}",
                    jobId);
            }

            var input = new AudioProcessingJobInput
            {
                JobId = jobId,
                UserId = userId!,
                SessionId = sessionId!,
                FileName = storedFileName,
                OwnerIdHash = ownerIdHash,
                Age = age,
                WeightKg = weightKg
            };

            await durableClient.ScheduleNewOrchestrationInstanceAsync(
                nameof(AudioProcessingJobOrchestrator),
                input,
                new StartOrchestrationOptions { InstanceId = jobId },
                cancellationToken);

            _logger.LogInformation(
                "Started audio processing job {JobId} for user {UserId}, session {SessionId}, blob {BlobName}",
                jobId,
                userId,
                sessionId,
                blobName);

            return await CreateAcceptedResponseAsync(
                request,
                jobId,
                "queued",
                replayed: blobReused);
        }
        catch (AudioUploadTooLargeException)
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.RequestEntityTooLarge,
                "audio_too_large",
                $"Audio uploads cannot exceed {_maxUploadBytes} bytes.");
        }
        catch (Exception exception)
        {
            try
            {
                var existing = await TryGetOwnedAudioJobAsync(
                    durableClient,
                    jobId,
                    ownerIdHash,
                    cancellationToken);
                if (existing is not null)
                {
                    return await CreateAcceptedResponseAsync(
                        request,
                        jobId,
                        MapStatus(existing, Deserialize<AudioProcessingResult>(existing.SerializedOutput)),
                        replayed: true);
                }
            }
            catch (Exception lookupException)
            {
                _logger.LogWarning(
                    lookupException,
                    "Could not confirm whether audio job {JobId} was scheduled",
                    jobId);
            }

            if (blobCommitted || blobReused)
            {
                _logger.LogWarning(
                    "Preserving the committed input blob for failed audio job submission {JobId} so an idempotent retry can recover it",
                    jobId);
            }

            _logger.LogError(exception, "Failed to start audio processing job {JobId}", jobId);
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.InternalServerError,
                "audio_job_start_failed",
                "The audio processing job could not be started.");
        }
    }

    private static bool TryReadOptionalDemographics(
        HttpRequestData request,
        out int? age,
        out double? weightKg,
        out string? error)
    {
        age = null;
        weightKg = null;
        error = null;

        var ageText = GetHeaderValue(request, AgeHeaderName);
        if (ageText is not null)
        {
            if (!int.TryParse(ageText, NumberStyles.None, CultureInfo.InvariantCulture, out var parsedAge)
                || parsedAge is < 1 or > 120)
            {
                error = $"{AgeHeaderName} must be a whole number from 1 through 120.";
                return false;
            }

            age = parsedAge;
        }

        var weightText = GetHeaderValue(request, WeightKgHeaderName);
        if (weightText is not null)
        {
            if (!double.TryParse(weightText, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsedWeight)
                || !double.IsFinite(parsedWeight)
                || parsedWeight is < 10 or > 500)
            {
                error = $"{WeightKgHeaderName} must be a number from 10 through 500.";
                return false;
            }

            weightKg = parsedWeight;
        }

        return true;
    }

    [Function("GetAudioProcessingJobStatus")]
    public async Task<HttpResponseData> GetAudioProcessingJobStatus(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "audio-jobs/{jobId}")] HttpRequestData request,
        [DurableClient] DurableTaskClient durableClient,
        string jobId)
    {
        var validation = await _apiKeyValidation.ValidateRequestAsync(request);
        if (!validation.IsValid)
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.Unauthorized,
                "unauthorized",
                "Valid credentials are required.");
        }

        if (!TryCreateOwnerIdHash(validation, out var ownerIdHash))
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.Forbidden,
                "caller_identity_unavailable",
                "The authenticated credential must contain a stable subject identifier.");
        }

        var metadata = await TryGetOwnedAudioJobAsync(
            durableClient,
            jobId,
            ownerIdHash,
            request.FunctionContext.CancellationToken);
        if (metadata is null)
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.NotFound,
                "audio_job_not_found",
                "Audio processing job not found.");
        }

        var input = Deserialize<AudioProcessingJobInput>(metadata.SerializedInput);
        var result = metadata.RuntimeStatus == OrchestrationRuntimeStatus.Completed
            ? Deserialize<AudioProcessingResult>(metadata.SerializedOutput)
            : null;
        var status = MapStatus(metadata, result);

        return await CreateJsonResponseAsync(request, HttpStatusCode.OK, new
        {
            jobId,
            status,
            createdAt = metadata.CreatedAt,
            updatedAt = metadata.LastUpdatedAt,
            userId = input?.UserId,
            sessionId = input?.SessionId,
            fileName = input?.FileName,
            failedStep = result is { Success: false } ? result.FailedStep : null,
            statusUrl = BuildJobUrl(request, jobId),
            resultUrl = BuildJobUrl(request, jobId, "result")
        });
    }

    [Function("GetAudioProcessingJobResult")]
    public async Task<HttpResponseData> GetAudioProcessingJobResult(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "audio-jobs/{jobId}/result")] HttpRequestData request,
        [DurableClient] DurableTaskClient durableClient,
        string jobId)
    {
        var validation = await _apiKeyValidation.ValidateRequestAsync(request);
        if (!validation.IsValid)
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.Unauthorized,
                "unauthorized",
                "Valid credentials are required.");
        }

        if (!TryCreateOwnerIdHash(validation, out var ownerIdHash))
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.Forbidden,
                "caller_identity_unavailable",
                "The authenticated credential must contain a stable subject identifier.");
        }

        var metadata = await TryGetOwnedAudioJobAsync(
            durableClient,
            jobId,
            ownerIdHash,
            request.FunctionContext.CancellationToken);
        if (metadata is null)
        {
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.NotFound,
                "audio_job_not_found",
                "Audio processing job not found.");
        }

        if (metadata.RuntimeStatus != OrchestrationRuntimeStatus.Completed)
        {
            var status = MapStatus(metadata, null);
            if (metadata.IsRunning || metadata.RuntimeStatus == OrchestrationRuntimeStatus.Suspended)
            {
                var pending = await CreateJsonResponseAsync(request, HttpStatusCode.Accepted, new
                {
                    jobId,
                    status,
                    statusUrl = BuildJobUrl(request, jobId),
                    resultUrl = BuildJobUrl(request, jobId, "result")
                });
                pending.Headers.Add("Retry-After", "3");
                return pending;
            }

            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.Conflict,
                "audio_job_has_no_result",
                $"Audio processing job ended with status '{status}' and has no result.");
        }

        var result = Deserialize<AudioProcessingResult>(metadata.SerializedOutput);
        if (result is null)
        {
            _logger.LogError("Audio processing job {JobId} completed without a readable result", jobId);
            return await CreateErrorResponseAsync(
                request,
                HttpStatusCode.InternalServerError,
                "audio_job_result_unavailable",
                "The audio processing result is unavailable.");
        }

        if (!result.Success)
        {
            return await CreateJsonResponseAsync(request, HttpStatusCode.UnprocessableEntity, new
            {
                success = false,
                jobId,
                status = "failed",
                failedStep = result.FailedStep,
                message = $"Audio processing failed during the '{result.FailedStep ?? "unknown"}' step."
            });
        }

        return await CreateJsonResponseAsync(request, HttpStatusCode.OK, new
        {
            success = true,
            jobId,
            status = "succeeded",
            result
        });
    }

    private static bool IsValidIdentifier(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > MaxIdentifierLength)
        {
            return false;
        }

        return value.All(character =>
            character is >= 'a' and <= 'z'
            or >= 'A' and <= 'Z'
            or >= '0' and <= '9'
            or '-' or '_');
    }

    private static bool IsValidFileName(string? fileName, out string extension)
    {
        extension = string.Empty;
        if (string.IsNullOrWhiteSpace(fileName)
            || fileName.Length > MaxFileNameLength
            || !string.Equals(fileName, Path.GetFileName(fileName), StringComparison.Ordinal))
        {
            return false;
        }

        extension = Path.GetExtension(fileName).ToLowerInvariant();
        return SupportedExtensions.Contains(extension);
    }

    private static bool IsValidIdempotencyKey(string? key)
    {
        return key is null || (key.Length is > 0 and <= 128 && key.All(character => !char.IsControl(character)));
    }

    private static string CreateJobId(
        string userId,
        string sessionId,
        string originalFileName,
        string ownerIdHash,
        string? idempotencyKey)
    {
        if (idempotencyKey is null)
        {
            return $"audio-{Guid.NewGuid():N}";
        }

        var keyBytes = Encoding.UTF8.GetBytes(
            $"{ownerIdHash}\n{userId}\n{sessionId}\n{originalFileName}\n{idempotencyKey}");
        var hash = SHA256.HashData(keyBytes);
        return $"audio-{Convert.ToHexString(hash.AsSpan(0, 16)).ToLowerInvariant()}";
    }

    private static bool TryCreateOwnerIdHash(TokenValidationResult validation, out string ownerIdHash)
    {
        ownerIdHash = string.Empty;
        if (string.IsNullOrWhiteSpace(validation.UserId))
        {
            return false;
        }

        var subjectBytes = Encoding.UTF8.GetBytes(validation.UserId.Trim());
        ownerIdHash = Convert.ToHexString(SHA256.HashData(subjectBytes)).ToLowerInvariant();
        return true;
    }

    private static bool IsBlobAlreadyPresent(RequestFailedException exception)
    {
        return exception.Status is (int)HttpStatusCode.Conflict
            or (int)HttpStatusCode.PreconditionFailed;
    }

    private static bool TryGetContentLength(HttpRequestData request, out long contentLength)
    {
        var value = GetHeaderValue(request, "Content-Length");
        return long.TryParse(value, out contentLength) && contentLength >= 0;
    }

    private static string? GetHeaderValue(HttpRequestData request, string name)
    {
        return request.Headers.TryGetValues(name, out var values)
            ? values.FirstOrDefault()
            : null;
    }

    private static string GetContentType(string extension)
    {
        return extension switch
        {
            ".wav" => "audio/wav",
            ".mp3" => "audio/mpeg",
            ".mp4" or ".m4a" => "audio/mp4",
            ".aac" => "audio/aac",
            ".flac" => "audio/flac",
            ".ogg" => "audio/ogg",
            ".webm" => "audio/webm",
            ".mkv" => "video/x-matroska",
            ".avi" => "video/x-msvideo",
            ".mov" => "video/quicktime",
            _ => "application/octet-stream"
        };
    }

    private static bool IsAudioJob(OrchestrationMetadata? metadata)
    {
        return metadata is not null
            && string.Equals(metadata.Name, nameof(AudioProcessingJobOrchestrator), StringComparison.Ordinal);
    }

    private static async Task<OrchestrationMetadata?> TryGetOwnedAudioJobAsync(
        DurableTaskClient durableClient,
        string jobId,
        string ownerIdHash,
        CancellationToken cancellationToken)
    {
        var metadata = await durableClient.GetInstanceAsync(jobId, true, cancellationToken);
        if (!IsAudioJob(metadata))
        {
            return null;
        }

        var input = Deserialize<AudioProcessingJobInput>(metadata!.SerializedInput);
        return string.Equals(input?.OwnerIdHash, ownerIdHash, StringComparison.Ordinal)
            ? metadata
            : null;
    }

    private static T? Deserialize<T>(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return default;
        }

        try
        {
            return JsonSerializer.Deserialize<T>(json, JsonSerializerOptionsFactory.Default);
        }
        catch (JsonException)
        {
            return default;
        }
    }

    private static string MapStatus(OrchestrationMetadata metadata, AudioProcessingResult? result)
    {
        return metadata.RuntimeStatus switch
        {
            OrchestrationRuntimeStatus.Pending => "queued",
            OrchestrationRuntimeStatus.Running => "processing",
            OrchestrationRuntimeStatus.Completed when result is { Success: true } => "succeeded",
            OrchestrationRuntimeStatus.Completed => "failed",
            OrchestrationRuntimeStatus.Terminated => "terminated",
            OrchestrationRuntimeStatus.Suspended => "suspended",
            OrchestrationRuntimeStatus.Failed => "failed",
            _ => "unknown"
        };
    }

    private static async Task<HttpResponseData> CreateAcceptedResponseAsync(
        HttpRequestData request,
        string jobId,
        string status,
        bool replayed)
    {
        var response = await CreateJsonResponseAsync(request, HttpStatusCode.Accepted, new
        {
            success = true,
            jobId,
            status,
            replayed,
            statusUrl = BuildJobUrl(request, jobId),
            resultUrl = BuildJobUrl(request, jobId, "result")
        });
        response.Headers.Add("Location", BuildJobUrl(request, jobId));
        response.Headers.Add("Retry-After", "3");
        return response;
    }

    private static string BuildJobUrl(HttpRequestData request, string jobId, string? suffix = null)
    {
        var path = $"/api/audio-jobs/{Uri.EscapeDataString(jobId)}";
        if (suffix is not null)
        {
            path += $"/{suffix}";
        }

        return new Uri(request.Url, path).ToString();
    }

    private static Task<HttpResponseData> CreateErrorResponseAsync(
        HttpRequestData request,
        HttpStatusCode statusCode,
        string code,
        string message)
    {
        return CreateJsonResponseAsync(request, statusCode, new
        {
            success = false,
            error = new { code, message }
        });
    }

    private static async Task<HttpResponseData> CreateJsonResponseAsync(
        HttpRequestData request,
        HttpStatusCode statusCode,
        object body)
    {
        var response = request.CreateResponse(statusCode);
        response.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await response.WriteStringAsync(JsonSerializer.Serialize(body, JsonSerializerOptionsFactory.Default));
        return response;
    }

    private sealed class AudioUploadTooLargeException : Exception
    {
    }

    private sealed class SizeLimitedReadStream : Stream
    {
        private readonly Stream _inner;
        private readonly long _maximumBytes;

        public SizeLimitedReadStream(Stream inner, long maximumBytes)
        {
            _inner = inner;
            _maximumBytes = maximumBytes;
        }

        public long BytesRead { get; private set; }

        public override bool CanRead => _inner.CanRead;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position
        {
            get => BytesRead;
            set => throw new NotSupportedException();
        }

        public override void Flush() => _inner.Flush();

        public override int Read(byte[] buffer, int offset, int count)
        {
            var bytesRead = _inner.Read(buffer, offset, GetAllowedReadSize(count));
            TrackRead(bytesRead);
            return bytesRead;
        }

        public override async Task<int> ReadAsync(
            byte[] buffer,
            int offset,
            int count,
            CancellationToken cancellationToken)
        {
            var bytesRead = await _inner.ReadAsync(
                buffer.AsMemory(offset, GetAllowedReadSize(count)),
                cancellationToken);
            TrackRead(bytesRead);
            return bytesRead;
        }

        public override async ValueTask<int> ReadAsync(
            Memory<byte> buffer,
            CancellationToken cancellationToken = default)
        {
            var bytesRead = await _inner.ReadAsync(
                buffer[..GetAllowedReadSize(buffer.Length)],
                cancellationToken);
            TrackRead(bytesRead);
            return bytesRead;
        }

        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        private int GetAllowedReadSize(int requestedBytes)
        {
            if (requestedBytes == 0)
            {
                return 0;
            }

            var remainingWithOverflowProbe = Math.Max(1, _maximumBytes - BytesRead + 1);
            return (int)Math.Min(requestedBytes, remainingWithOverflowProbe);
        }

        private void TrackRead(int bytesRead)
        {
            BytesRead += bytesRead;
            if (BytesRead > _maximumBytes)
            {
                throw new AudioUploadTooLargeException();
            }
        }
    }

    private sealed class PrefixReadStream : Stream
    {
        private readonly byte _prefix;
        private readonly Stream _inner;
        private bool _prefixRead;

        public PrefixReadStream(byte prefix, Stream inner)
        {
            _prefix = prefix;
            _inner = inner;
        }

        public override bool CanRead => _inner.CanRead;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position
        {
            get => throw new NotSupportedException();
            set => throw new NotSupportedException();
        }

        public override void Flush() => throw new NotSupportedException();

        public override int Read(byte[] buffer, int offset, int count)
        {
            if (!_prefixRead && count > 0)
            {
                buffer[offset] = _prefix;
                _prefixRead = true;
                return 1;
            }

            return _inner.Read(buffer, offset, count);
        }

        public override Task<int> ReadAsync(
            byte[] buffer,
            int offset,
            int count,
            CancellationToken cancellationToken)
        {
            if (!_prefixRead && count > 0)
            {
                buffer[offset] = _prefix;
                _prefixRead = true;
                return Task.FromResult(1);
            }

            return _inner.ReadAsync(buffer, offset, count, cancellationToken);
        }

        public override ValueTask<int> ReadAsync(
            Memory<byte> buffer,
            CancellationToken cancellationToken = default)
        {
            if (!_prefixRead && buffer.Length > 0)
            {
                buffer.Span[0] = _prefix;
                _prefixRead = true;
                return ValueTask.FromResult(1);
            }

            return _inner.ReadAsync(buffer, cancellationToken);
        }

        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
