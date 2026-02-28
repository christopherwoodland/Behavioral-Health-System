using BehavioralHealthSystem.Agents.Interfaces;
using BehavioralHealthSystem.Agents.Models;

namespace BehavioralHealthSystem.Functions;

/// <summary>
/// Azure Function endpoint for the Semantic Kernel audio processing pipeline.
/// Provides a single HTTP trigger that invokes the deterministic 3-step orchestration:
///   1. Fetch audio from blob storage
///   2. Convert and clean via ffmpeg
///   3. Run DAM model prediction
///
/// This endpoint can be called by an agent as a single tool.
/// </summary>
public class AudioProcessingFunction
{
    private readonly IAudioProcessingOrchestrator _orchestrator;
    private readonly ILogger<AudioProcessingFunction> _logger;
    private readonly JsonSerializerOptions _jsonOptions;

    public AudioProcessingFunction(
        IAudioProcessingOrchestrator orchestrator,
        ILogger<AudioProcessingFunction> logger)
    {
        _orchestrator = orchestrator ?? throw new ArgumentNullException(nameof(orchestrator));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _jsonOptions = JsonSerializerOptionsFactory.Default;
    }

    /// <summary>
    /// Processes an audio file through the complete pipeline: fetch → convert → predict.
    ///
    /// Request body:
    /// {
    ///   "userId": "user123",          // Required
    ///   "sessionId": "session456",    // Required
    ///   "fileName": "recording.wav"   // Optional — if omitted, uses most recent for session
    /// }
    /// </summary>
    [Function("ProcessAudio")]
    public async Task<HttpResponseData> ProcessAudio(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "process-audio")] HttpRequestData req)
    {
        try
        {
            var requestBody = await req.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(requestBody))
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "Request body is required.");
            }

            var request = JsonSerializer.Deserialize<AudioProcessingRequest>(requestBody, _jsonOptions);
            if (request == null)
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "Invalid JSON format.");
            }

            if (string.IsNullOrWhiteSpace(request.UserId))
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "userId is required.");
            }

            if (string.IsNullOrWhiteSpace(request.SessionId))
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "sessionId is required.");
            }

            _logger.LogInformation(
                "[{FunctionName}] Processing audio. UserId={UserId}, SessionId={SessionId}, FileName={FileName}",
                nameof(ProcessAudio), request.UserId, request.SessionId, request.FileName ?? "(latest)");

            var result = await _orchestrator.ProcessAudioAsync(
                request.UserId,
                request.SessionId,
                request.FileName);

            var statusCode = result.Success ? HttpStatusCode.OK : HttpStatusCode.InternalServerError;
            var response = req.CreateResponse(statusCode);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");
            await response.WriteStringAsync(JsonSerializer.Serialize(result, _jsonOptions));
            return response;
        }
        catch (FileNotFoundException ex)
        {
            _logger.LogWarning(ex, "[{FunctionName}] Audio file not found.", nameof(ProcessAudio));
            return await CreateErrorResponse(req, HttpStatusCode.NotFound, ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Unexpected error processing audio.", nameof(ProcessAudio));
            return await CreateErrorResponse(req, HttpStatusCode.InternalServerError,
                $"Unexpected error: {ex.Message}");
        }
    }

    /// <summary>
    /// Processes an audio file from a local directory through the pipeline: fetch local → convert → predict.
    ///
    /// Request body:
    /// {
    ///   "userId": "user123",          // Required
    ///   "sessionId": "session456",    // Required
    ///   "filePath": "C:/recordings/audio.wav"  // Optional — absolute path, relative name, or null for most recent
    /// }
    /// </summary>
    [Function("ProcessAudioLocal")]
    public async Task<HttpResponseData> ProcessAudioLocal(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "process-audio-local")] HttpRequestData req)
    {
        try
        {
            var requestBody = await req.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(requestBody))
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "Request body is required.");
            }

            var request = JsonSerializer.Deserialize<AudioProcessingLocalRequest>(requestBody, _jsonOptions);
            if (request == null)
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "Invalid JSON format.");
            }

            if (string.IsNullOrWhiteSpace(request.UserId))
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "userId is required.");
            }

            if (string.IsNullOrWhiteSpace(request.SessionId))
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "sessionId is required.");
            }

            _logger.LogInformation(
                "[{FunctionName}] Processing audio from local directory. UserId={UserId}, SessionId={SessionId}, FilePath={FilePath}",
                nameof(ProcessAudioLocal), request.UserId, request.SessionId, request.FilePath ?? "(latest)");

            var result = await _orchestrator.ProcessAudioFromLocalAsync(
                request.UserId,
                request.SessionId,
                request.FilePath);

            var statusCode = result.Success ? HttpStatusCode.OK : HttpStatusCode.InternalServerError;
            var response = req.CreateResponse(statusCode);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");
            await response.WriteStringAsync(JsonSerializer.Serialize(result, _jsonOptions));
            return response;
        }
        catch (FileNotFoundException ex)
        {
            _logger.LogWarning(ex, "[{FunctionName}] Audio file not found.", nameof(ProcessAudioLocal));
            return await CreateErrorResponse(req, HttpStatusCode.NotFound, ex.Message);
        }
        catch (DirectoryNotFoundException ex)
        {
            _logger.LogWarning(ex, "[{FunctionName}] Recordings directory not found.", nameof(ProcessAudioLocal));
            return await CreateErrorResponse(req, HttpStatusCode.NotFound, ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Unexpected error processing local audio.", nameof(ProcessAudioLocal));
            return await CreateErrorResponse(req, HttpStatusCode.InternalServerError,
                $"Unexpected error: {ex.Message}");
        }
    }

    /// <summary>
    /// Processes an uploaded audio file through the pipeline: save temp file → convert → predict.
    /// Accepts multipart/form-data with fields: userId, sessionId, and a file part.
    /// </summary>
    [Function("ProcessAudioUpload")]
    public async Task<HttpResponseData> ProcessAudioUpload(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "process-audio-upload")] HttpRequestData req)
    {
        string? tempFilePath = null;

        try
        {
            // Parse the multipart form data
            var contentType = req.Headers.GetValues("Content-Type").FirstOrDefault() ?? "";
            if (!contentType.Contains("multipart/form-data", StringComparison.OrdinalIgnoreCase))
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest,
                    "Content-Type must be multipart/form-data.");
            }

            var boundary = GetBoundary(contentType);
            if (string.IsNullOrEmpty(boundary))
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest,
                    "Missing multipart boundary in Content-Type header.");
            }

            var body = req.Body;
            var reader = new Microsoft.AspNetCore.WebUtilities.MultipartReader(boundary, body);

            string? userId = null;
            string? sessionId = null;
            string? originalFileName = null;
            byte[]? fileData = null;

            Microsoft.AspNetCore.WebUtilities.MultipartSection? section;
            while ((section = await reader.ReadNextSectionAsync()) != null)
            {
                var disposition = section.ContentDisposition ?? "";
                var fieldName = GetFormFieldName(disposition);

                if (string.Equals(fieldName, "userId", StringComparison.OrdinalIgnoreCase))
                {
                    using var sr = new StreamReader(section.Body);
                    userId = (await sr.ReadToEndAsync()).Trim();
                }
                else if (string.Equals(fieldName, "sessionId", StringComparison.OrdinalIgnoreCase))
                {
                    using var sr = new StreamReader(section.Body);
                    sessionId = (await sr.ReadToEndAsync()).Trim();
                }
                else if (string.Equals(fieldName, "file", StringComparison.OrdinalIgnoreCase))
                {
                    originalFileName = GetFileName(disposition) ?? "upload.wav";
                    using var ms = new MemoryStream();
                    await section.Body.CopyToAsync(ms);
                    fileData = ms.ToArray();
                }
            }

            if (string.IsNullOrWhiteSpace(userId))
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "userId is required.");

            if (string.IsNullOrWhiteSpace(sessionId))
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "sessionId is required.");

            if (fileData == null || fileData.Length == 0)
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest, "A file must be uploaded.");

            // Save uploaded file to temp directory
            var extension = Path.GetExtension(originalFileName);
            if (string.IsNullOrEmpty(extension)) extension = ".wav";
            tempFilePath = Path.Combine(Path.GetTempPath(), $"dam-upload-{Guid.NewGuid():N}{extension}");
            await File.WriteAllBytesAsync(tempFilePath, fileData);

            _logger.LogInformation(
                "[{FunctionName}] Processing uploaded audio. UserId={UserId}, SessionId={SessionId}, FileName={FileName}, Size={Size} bytes",
                nameof(ProcessAudioUpload), userId, sessionId, originalFileName, fileData.Length);

            var result = await _orchestrator.ProcessAudioFromLocalAsync(
                userId, sessionId, tempFilePath);

            var statusCode = result.Success ? HttpStatusCode.OK : HttpStatusCode.InternalServerError;
            var response = req.CreateResponse(statusCode);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");
            await response.WriteStringAsync(JsonSerializer.Serialize(result, _jsonOptions));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Unexpected error processing uploaded audio.", nameof(ProcessAudioUpload));
            return await CreateErrorResponse(req, HttpStatusCode.InternalServerError,
                $"Unexpected error: {ex.Message}");
        }
        finally
        {
            // Clean up the temp file
            if (tempFilePath != null && File.Exists(tempFilePath))
            {
                try { File.Delete(tempFilePath); }
                catch { /* best effort cleanup */ }
            }
        }
    }

    /// <summary>
    /// Converts/cleans an uploaded audio file via ffmpeg WITHOUT running DAM prediction.
    /// Returns the cleaned WAV file as a downloadable binary response.
    ///
    /// Accepts multipart/form-data with a single "file" field.
    /// Response headers include conversion metadata (X-Original-FileSize, X-Converted-FileSize, etc.).
    /// </summary>
    [Function("ConvertAudioUpload")]
    public async Task<HttpResponseData> ConvertAudioUpload(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "convert-audio")] HttpRequestData req)
    {
        try
        {
            var contentType = req.Headers.GetValues("Content-Type").FirstOrDefault();
            if (string.IsNullOrEmpty(contentType) || !contentType.Contains("multipart/form-data"))
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest,
                    "Content-Type must be multipart/form-data.");
            }

            var boundary = GetBoundary(contentType);
            if (string.IsNullOrEmpty(boundary))
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest,
                    "Missing multipart boundary.");
            }

            byte[]? fileData = null;
            string? originalFileName = null;

            var reader = new Microsoft.AspNetCore.WebUtilities.MultipartReader(boundary, req.Body);
            while (await reader.ReadNextSectionAsync() is { } section)
            {
                var disposition = section.Headers?.ContainsKey("Content-Disposition") == true
                    ? section.Headers["Content-Disposition"].ToString()
                    : null;
                if (string.IsNullOrEmpty(disposition)) continue;

                var fieldName = GetFormFieldName(disposition);
                var fileName = GetFileName(disposition);

                if (fieldName == "file" && !string.IsNullOrEmpty(fileName))
                {
                    originalFileName = fileName;
                    using var ms = new MemoryStream();
                    await section.Body.CopyToAsync(ms);
                    fileData = ms.ToArray();
                }
            }

            if (fileData == null || fileData.Length == 0)
            {
                return await CreateErrorResponse(req, HttpStatusCode.BadRequest,
                    "No audio file found in request. Include a 'file' field.");
            }

            originalFileName ??= "audio.webm";

            _logger.LogInformation(
                "[{FunctionName}] Converting audio (no prediction). FileName={FileName}, Size={Size} bytes",
                nameof(ConvertAudioUpload), originalFileName, fileData.Length);

            var result = await _orchestrator.ConvertAudioOnlyAsync(
                fileData, originalFileName);

            if (!result.Success)
            {
                return await CreateErrorResponse(req, HttpStatusCode.InternalServerError,
                    result.Message);
            }

            // Return the WAV file as a downloadable binary
            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "audio/wav");
            response.Headers.Add("Content-Disposition", $"attachment; filename=\"converted.wav\"");
            response.Headers.Add("X-Original-FileName", originalFileName);
            response.Headers.Add("X-Original-FileSize", result.OriginalFileSize.ToString());
            response.Headers.Add("X-Converted-FileSize", result.ConvertedFileSize.ToString());
            response.Headers.Add("X-Converted-SampleRate", result.ConvertedSampleRate.ToString());
            response.Headers.Add("X-Filters-Applied", result.FiltersApplied.ToString());
            response.Headers.Add("X-Conversion-ElapsedMs", result.ConversionElapsedMs.ToString("F1"));
            // Expose custom headers to the browser (CORS)
            response.Headers.Add("Access-Control-Expose-Headers",
                "X-Original-FileName, X-Original-FileSize, X-Converted-FileSize, X-Converted-SampleRate, X-Filters-Applied, X-Conversion-ElapsedMs");
            await response.Body.WriteAsync(result.ConvertedData);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Unexpected error.", nameof(ConvertAudioUpload));
            return await CreateErrorResponse(req, HttpStatusCode.InternalServerError,
                $"Unexpected error: {ex.Message}");
        }
    }

    /// <summary>
    /// Extracts the boundary string from a multipart Content-Type header.
    /// </summary>
    private static string? GetBoundary(string contentType)
    {
        var parts = contentType.Split(';');
        foreach (var part in parts)
        {
            var trimmed = part.Trim();
            if (trimmed.StartsWith("boundary=", StringComparison.OrdinalIgnoreCase))
            {
                var boundary = trimmed["boundary=".Length..].Trim('"');
                return boundary;
            }
        }
        return null;
    }

    /// <summary>
    /// Extracts the field name from a Content-Disposition header value.
    /// </summary>
    private static string? GetFormFieldName(string contentDisposition)
    {
        var match = System.Text.RegularExpressions.Regex.Match(
            contentDisposition, @"name=""?([^"";\s]+)""?", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value : null;
    }

    /// <summary>
    /// Extracts the filename from a Content-Disposition header value.
    /// </summary>
    private static string? GetFileName(string contentDisposition)
    {
        var match = System.Text.RegularExpressions.Regex.Match(
            contentDisposition, @"filename=""?([^"";\s]+)""?", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value : null;
    }

    private async Task<HttpResponseData> CreateErrorResponse(
        HttpRequestData req, HttpStatusCode statusCode, string message)
    {
        var response = req.CreateResponse(statusCode);
        response.Headers.Add("Content-Type", "application/json; charset=utf-8");
        await response.WriteStringAsync(JsonSerializer.Serialize(new
        {
            success = false,
            message
        }, _jsonOptions));
        return response;
    }
}

/// <summary>
/// Request model for the audio processing endpoint (blob source).
/// </summary>
public class AudioProcessingRequest
{
    [JsonPropertyName("userId")]
    public string UserId { get; set; } = string.Empty;

    [JsonPropertyName("sessionId")]
    public string SessionId { get; set; } = string.Empty;

    [JsonPropertyName("fileName")]
    public string? FileName { get; set; }
}

/// <summary>
/// Request model for the local audio processing endpoint.
/// </summary>
public class AudioProcessingLocalRequest
{
    [JsonPropertyName("userId")]
    public string UserId { get; set; } = string.Empty;

    [JsonPropertyName("sessionId")]
    public string SessionId { get; set; } = string.Empty;

    /// <summary>
    /// File path or file name. Absolute paths read directly.
    /// Relative names search the configured recordings directory.
    /// Null picks the most recent audio file.
    /// </summary>
    [JsonPropertyName("filePath")]
    public string? FilePath { get; set; }
}
