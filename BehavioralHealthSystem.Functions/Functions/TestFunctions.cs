using Azure.Storage.Blobs;

namespace BehavioralHealthSystem.Functions;

public class TestFunctions
{
    private readonly ILogger<TestFunctions> _logger;
    private readonly IKintsugiApiService _kintsugiApiService;
    private readonly ISessionStorageService _sessionStorageService;
    private readonly IValidator<InitiateRequest> _initiateRequestValidator;
    private readonly BlobServiceClient _blobServiceClient;
    private readonly JsonSerializerOptions _jsonOptions;

    public TestFunctions(
        ILogger<TestFunctions> logger,
        IKintsugiApiService kintsugiApiService,
        ISessionStorageService sessionStorageService,
        IValidator<InitiateRequest> initiateRequestValidator,
        BlobServiceClient blobServiceClient)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _kintsugiApiService = kintsugiApiService ?? throw new ArgumentNullException(nameof(kintsugiApiService));
        _sessionStorageService = sessionStorageService ?? throw new ArgumentNullException(nameof(sessionStorageService));
        _initiateRequestValidator = initiateRequestValidator ?? throw new ArgumentNullException(nameof(initiateRequestValidator));
        _blobServiceClient = blobServiceClient ?? throw new ArgumentNullException(nameof(blobServiceClient));

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };
    }

    [Function("TestKintsugiConnection")]
    public async Task<HttpResponseData> TestKintsugiConnection(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Testing Kintsugi API connection", nameof(TestKintsugiConnection));

            // Create a test initiate request
            var testRequest = new InitiateRequest
            {
                IsInitiated = true,
                Metadata = new UserMetadata
                {
                    Age = 25,
                    Ethnicity = "Hispanic, Latino, or Spanish Origin",
                    Gender = "male",
                    Language = true,
                    Race = "white",
                    Weight = 170,
                    Zipcode = ApplicationConstants.TestData.DefaultZipCode
                },
                UserId = "test-user-" + Guid.NewGuid().ToString()[..8]
            };

            var response = await _kintsugiApiService.InitiateSessionAsync(testRequest);

            var result = req.CreateResponse(System.Net.HttpStatusCode.OK);

            if (response != null)
            {
                var successResult = new
                {
                    Success = true,
                    Message = "Successfully connected to Kintsugi API",
                    SessionId = response.SessionId,
                    TestUserId = testRequest.UserId
                };

                await result.WriteStringAsync(JsonSerializer.Serialize(successResult, _jsonOptions));
            }
            else
            {
                var failResult = new
                {
                    Success = false,
                    Message = "Failed to connect to Kintsugi API"
                };

                await result.WriteStringAsync(JsonSerializer.Serialize(failResult, _jsonOptions));
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error testing Kintsugi API connection", nameof(TestKintsugiConnection));

            var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
            var errorResult = new
            {
                Success = false,
                Message = "Error testing connection",
                Error = ex.Message
            };

            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(errorResult, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("InitiateSession")]
    public async Task<HttpResponseData> InitiateSession(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "sessions/initiate")] HttpRequestData req)
    {
        try
        {
            var requestBody = await req.ReadAsStringAsync();
            if (string.IsNullOrEmpty(requestBody))
            {
                _logger.LogWarning("[{FunctionName}] Empty request body received", nameof(InitiateSession));
                var badRequestResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                var badRequestResult = new
                {
                    Success = false,
                    Message = "Request body is required"
                };
                await badRequestResponse.WriteStringAsync(JsonSerializer.Serialize(badRequestResult, _jsonOptions));
                return badRequestResponse;
            }

            var initiateRequest = JsonSerializer.Deserialize<InitiateRequest>(requestBody, _jsonOptions);
            if (initiateRequest == null)
            {
                _logger.LogWarning("[{FunctionName}] Failed to deserialize request body", nameof(InitiateSession));
                var badRequestResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                var badRequestResult = new
                {
                    Success = false,
                    Message = "Invalid JSON format"
                };
                await badRequestResponse.WriteStringAsync(JsonSerializer.Serialize(badRequestResult, _jsonOptions));
                return badRequestResponse;
            }

            _logger.LogInformation("[{FunctionName}] Initiating session for user: {UserId}", nameof(InitiateSession), initiateRequest.UserId);

            // Validate the request before sending to Kintsugi API
            var validationResult = await _initiateRequestValidator.ValidateAsync(initiateRequest);
            if (!validationResult.IsValid)
            {
                _logger.LogWarning("[{FunctionName}] Validation failed for user: {UserId}, Errors: {ValidationErrors}",
                    nameof(InitiateSession), initiateRequest.UserId,
                    string.Join("; ", validationResult.Errors.Select(e => $"{e.PropertyName}: {e.ErrorMessage}")));

                var validationResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                var validationErrors = validationResult.Errors.Select(e => new
                {
                    field = e.PropertyName.ToLowerInvariant().Replace("metadata.", ""),
                    error = e.ErrorMessage
                }).ToArray();

                var validationResult_Response = new
                {
                    success = false,
                    message = "Error initiating session",
                    error = $"Validation error: {{\"message\":[{string.Join(",", validationErrors.Select(e => JsonSerializer.Serialize(e, _jsonOptions)))}]}}"
                };

                await validationResponse.WriteStringAsync(JsonSerializer.Serialize(validationResult_Response, _jsonOptions));
                return validationResponse;
            }

            var sessionResponse = await _kintsugiApiService.InitiateSessionAsync(initiateRequest);

            var response = req.CreateResponse(System.Net.HttpStatusCode.OK);

            if (sessionResponse != null && !string.IsNullOrEmpty(sessionResponse.SessionId))
            {
                var successResult = new
                {
                    Success = true,
                    Message = "Session initiated successfully",
                    SessionId = sessionResponse.SessionId,
                    UserId = initiateRequest.UserId
                };

                await response.WriteStringAsync(JsonSerializer.Serialize(successResult, _jsonOptions));
            }
            else
            {
                response = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
                var failResult = new
                {
                    Success = false,
                    Message = "Failed to initiate session"
                };

                await response.WriteStringAsync(JsonSerializer.Serialize(failResult, _jsonOptions));
            }

            return response;
        }
        catch (HttpRequestException httpEx) when (httpEx.Data.Contains("StatusCode"))
        {
            _logger.LogError(httpEx, "[{FunctionName}] HTTP error initiating session", nameof(InitiateSession));

            var statusCode = (System.Net.HttpStatusCode)(httpEx.Data["StatusCode"] ?? System.Net.HttpStatusCode.InternalServerError);
            var errorResponse = req.CreateResponse(statusCode);

            var errorResult = new
            {
                Success = false,
                Message = "Error initiating session",
                Error = httpEx.Message,
                StatusCode = (int)statusCode,
                Details = httpEx.Data.Contains("RawErrorResponse") ? httpEx.Data["RawErrorResponse"] : null
            };

            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(errorResult, _jsonOptions));
            return errorResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error initiating session", nameof(InitiateSession));

            var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
            var errorResult = new
            {
                Success = false,
                Message = "Error initiating session",
                Error = ex.Message
            };

            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(errorResult, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("GetUserPredictions")]
    public async Task<HttpResponseData> GetUserPredictions(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "predictions/{userId}")] HttpRequestData req,
        string userId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Getting predictions for user: {UserId}", nameof(GetUserPredictions), userId);

            var results = await _kintsugiApiService.GetPredictionResultsAsync(userId);

            var response = req.CreateResponse(System.Net.HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(results, _jsonOptions));

            return response;
        }
        catch (HttpRequestException httpEx) when (httpEx.Data.Contains("StatusCode"))
        {
            _logger.LogError(httpEx, "[{FunctionName}] HTTP error getting predictions for user: {UserId}", nameof(GetUserPredictions), userId);

            var statusCode = (System.Net.HttpStatusCode)(httpEx.Data["StatusCode"] ?? System.Net.HttpStatusCode.InternalServerError);
            var errorResponse = req.CreateResponse(statusCode);

            var errorResult = new
            {
                Success = false,
                Message = "Error getting predictions",
                Error = httpEx.Message,
                StatusCode = (int)statusCode,
                Details = httpEx.Data.Contains("RawErrorResponse") ? httpEx.Data["RawErrorResponse"] : null
            };

            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(errorResult, _jsonOptions));
            return errorResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting predictions for user: {UserId}", nameof(GetUserPredictions), userId);

            var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
            var errorResult = new
            {
                Success = false,
                Message = "Error getting predictions",
                Error = ex.Message
            };

            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(errorResult, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("GetPredictionBySessionId")]
    public async Task<HttpResponseData> GetPredictionBySessionId(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "predictions/sessions/{sessionId}")] HttpRequestData req,
        string sessionId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Getting prediction result for session: {SessionId}", nameof(GetPredictionBySessionId), sessionId);

            var result = await _kintsugiApiService.GetPredictionResultBySessionIdAsync(sessionId);

            if (result != null)
            {
                // Update session data in blob storage with latest prediction result
                try
                {
                    var existingSessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
                    if (existingSessionData != null)
                    {
                        // Convert SessionPredictionResult to PredictionResult for storage
                        var predictionResult = new PredictionResult
                        {
                            SessionId = sessionId,
                            Status = result.Status,
                            PredictedScore = result.PredictedScore,
                            PredictedScoreDepression = result.PredictedScoreDepression,
                            PredictedScoreAnxiety = result.PredictedScoreAnxiety,
                            CreatedAt = result.CreatedAt,
                            UpdatedAt = result.UpdatedAt,
                            ActualScore = new ActualScore
                            {
                                // Map from SessionActualScore properties to ActualScore properties
                                // Since ActualScore doesn't have AnxietyBinary/DepressionBinary, we'll use available properties
                                TotalScore = string.Empty, // These would need to be calculated or mapped differently
                                AverageTotalScore = string.Empty,
                                MaxScore = string.Empty,
                                MinScore = string.Empty,
                                RangeScore = string.Empty,
                                StdScore = string.Empty,
                                IsScoreProcessed = false
                            },
                            PredictError = result.PredictError != null ? new PredictError
                            {
                                Detail = result.PredictError.Message,
                                Title = result.PredictError.Error,
                                Status = 0, // Default status
                                Type = "PredictionError"
                            } : null
                        };

                        existingSessionData.Prediction = predictionResult;
                        existingSessionData.Status = result.Status;
                        existingSessionData.UpdatedAt = DateTime.UtcNow.ToString("O");

                        // Update analysis results if prediction is complete
                        if (result.Status == "success" || result.Status == "succeeded")
                        {
                            existingSessionData.AnalysisResults = new AnalysisResults
                            {
                                DepressionScore = double.TryParse(result.PredictedScoreDepression, out var depScore) ? depScore : null,
                                AnxietyScore = double.TryParse(result.PredictedScoreAnxiety, out var anxScore) ? anxScore : null,
                                RiskLevel = DetermineRiskLevel(result.PredictedScoreDepression),
                                Confidence = 0.85, // Default confidence
                                Insights = GenerateInsights(result),
                                CompletedAt = DateTime.UtcNow.ToString("O")
                            };
                        }

                        var updateSuccess = await _sessionStorageService.UpdateSessionDataAsync(existingSessionData);
                        if (updateSuccess)
                        {
                            _logger.LogInformation("[{FunctionName}] Updated session data in blob storage for session: {SessionId}", nameof(GetPredictionBySessionId), sessionId);
                        }
                        else
                        {
                            _logger.LogWarning("[{FunctionName}] Failed to update session data in blob storage for session: {SessionId}", nameof(GetPredictionBySessionId), sessionId);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[{FunctionName}] Error updating session data in blob storage for session: {SessionId}", nameof(GetPredictionBySessionId), sessionId);
                    // Don't fail the entire request if blob storage update fails
                }

                var response = req.CreateResponse(System.Net.HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(result, _jsonOptions));
                return response;
            }
            else
            {
                var response = req.CreateResponse(System.Net.HttpStatusCode.NotFound);
                var notFoundResult = new
                {
                    Success = false,
                    Message = $"No prediction found for session: {sessionId}"
                };
                await response.WriteStringAsync(JsonSerializer.Serialize(notFoundResult, _jsonOptions));
                return response;
            }
        }
        catch (HttpRequestException httpEx) when (httpEx.Data.Contains("StatusCode"))
        {
            _logger.LogError(httpEx, "[{FunctionName}] HTTP error getting prediction for session: {SessionId}", nameof(GetPredictionBySessionId), sessionId);

            var statusCode = (System.Net.HttpStatusCode)(httpEx.Data["StatusCode"] ?? System.Net.HttpStatusCode.InternalServerError);
            var errorResponse = req.CreateResponse(statusCode);

            var errorResult = new
            {
                Success = false,
                Message = "Error getting prediction",
                Error = httpEx.Message,
                StatusCode = (int)statusCode,
                Details = httpEx.Data.Contains("RawErrorResponse") ? httpEx.Data["RawErrorResponse"] : null
            };

            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(errorResult, _jsonOptions));
            return errorResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting prediction for session: {SessionId}", nameof(GetPredictionBySessionId), sessionId);

            var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
            var errorResult = new
            {
                Success = false,
                Message = "Error getting prediction",
                Error = ex.Message
            };

            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(errorResult, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("SubmitPrediction")]
    public async Task<HttpResponseData> SubmitPrediction(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "predictions/submit")] HttpRequestData req)
    {
        PredictionRequest? predictionRequest = null;

        try
        {
            var requestBody = await req.ReadAsStringAsync();
            if (string.IsNullOrEmpty(requestBody))
            {
                _logger.LogWarning("[{FunctionName}] Empty request body received for prediction submission", nameof(SubmitPrediction));
                var badRequestResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                var badRequestResult = new
                {
                    Success = false,
                    Message = "Request body is required"
                };
                await badRequestResponse.WriteStringAsync(JsonSerializer.Serialize(badRequestResult, _jsonOptions));
                return badRequestResponse;
            }

            predictionRequest = JsonSerializer.Deserialize<PredictionRequest>(requestBody, _jsonOptions);
            if (predictionRequest == null)
            {
                _logger.LogWarning("[{FunctionName}] Failed to deserialize prediction request body", nameof(SubmitPrediction));
                var badRequestResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                var badRequestResult = new
                {
                    Success = false,
                    Message = "Invalid JSON format"
                };
                await badRequestResponse.WriteStringAsync(JsonSerializer.Serialize(badRequestResult, _jsonOptions));
                return badRequestResponse;
            }

            if (string.IsNullOrEmpty(predictionRequest.SessionId))
            {
                _logger.LogWarning("[{FunctionName}] SessionId is required for prediction submission", nameof(SubmitPrediction));
                var badRequestResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                var badRequestResult = new
                {
                    Success = false,
                    Message = "SessionId is required"
                };
                await badRequestResponse.WriteStringAsync(JsonSerializer.Serialize(badRequestResult, _jsonOptions));
                return badRequestResponse;
            }

            _logger.LogInformation("[{FunctionName}] Submitting prediction for session: {SessionId}", nameof(SubmitPrediction), predictionRequest.SessionId);

            PredictionResponse? predictionResponse = null;

            // Check if we have audio data (byte array) or file URL
            if (predictionRequest.AudioData != null && predictionRequest.AudioData.Length > 0)
            {
                _logger.LogInformation("[{FunctionName}] Submitting prediction with audio data ({DataSize} bytes)", nameof(SubmitPrediction), predictionRequest.AudioData.Length);
                predictionResponse = await _kintsugiApiService.SubmitPredictionAsync(
                    predictionRequest.SessionId,
                    predictionRequest.AudioData);
            }
            else if (!string.IsNullOrEmpty(predictionRequest.AudioFileUrl))
            {
                _logger.LogInformation("[{FunctionName}] Submitting prediction with audio file URL: {AudioFileUrl}", nameof(SubmitPrediction), predictionRequest.AudioFileUrl);

                // Download audio from Azure Blob Storage using BlobServiceClient (handles auth correctly)
                byte[] audioData = await DownloadAudioFromBlobAsync(predictionRequest.AudioFileUrl);
                _logger.LogInformation("[{FunctionName}] Downloaded {DataSize} bytes from blob storage", nameof(SubmitPrediction), audioData.Length);

                // Submit with downloaded audio data
                predictionResponse = await _kintsugiApiService.SubmitPredictionAsync(
                    predictionRequest.SessionId,
                    audioData);
            }
            else
            {
                _logger.LogWarning("[{FunctionName}] Either AudioData or AudioFileUrl must be provided", nameof(SubmitPrediction));
                var badRequestResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                var badRequestResult = new
                {
                    Success = false,
                    Message = "Either AudioData (byte array) or AudioFileUrl must be provided"
                };
                await badRequestResponse.WriteStringAsync(JsonSerializer.Serialize(badRequestResult, _jsonOptions));
                return badRequestResponse;
            }

            var response = req.CreateResponse(System.Net.HttpStatusCode.OK);

            if (predictionResponse != null)
            {
                var successResult = new
                {
                    Success = true,
                    Message = "Prediction submitted successfully",
                    SessionId = predictionResponse.SessionId,
                    Status = predictionResponse.Status
                };

                await response.WriteStringAsync(JsonSerializer.Serialize(successResult, _jsonOptions));
            }
            else
            {
                response = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
                var failResult = new
                {
                    Success = false,
                    Message = "Failed to submit prediction"
                };

                await response.WriteStringAsync(JsonSerializer.Serialize(failResult, _jsonOptions));
            }

            return response;
        }
        catch (HttpRequestException httpEx) when (httpEx.Data.Contains("StatusCode"))
        {
            _logger.LogError(httpEx, "[{FunctionName}] HTTP error submitting prediction", nameof(SubmitPrediction));

            // Update session status to failed if we have a sessionId
            if (!string.IsNullOrEmpty(predictionRequest?.SessionId))
            {
                await UpdateSessionStatusToFailedAsync(predictionRequest.SessionId, httpEx);
            }

            var statusCode = (System.Net.HttpStatusCode)(httpEx.Data["StatusCode"] ?? System.Net.HttpStatusCode.InternalServerError);
            var errorResponse = req.CreateResponse(statusCode);

            var errorResult = new
            {
                Success = false,
                Message = "Error submitting prediction",
                Error = httpEx.Message,
                StatusCode = (int)statusCode,
                Details = httpEx.Data.Contains("RawErrorResponse") ? httpEx.Data["RawErrorResponse"] : null
            };

            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(errorResult, _jsonOptions));
            return errorResponse;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error submitting prediction", nameof(SubmitPrediction));

            // Update session status to failed if we have a sessionId
            if (!string.IsNullOrEmpty(predictionRequest?.SessionId))
            {
                await UpdateSessionStatusToFailedAsync(predictionRequest.SessionId, ex);
            }

            var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
            var errorResult = new
            {
                Success = false,
                Message = "Error submitting prediction",
                Error = ex.Message
            };

            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(errorResult, _jsonOptions));
            return errorResponse;
        }
    }

    private static string DetermineRiskLevel(string? depressionScore)
    {
        if (string.IsNullOrEmpty(depressionScore))
        {
            return "unknown";
        }

        // Handle categorical depression scores: no_to_mild, mild_to_moderate, moderate_to_severe
        return depressionScore.ToLowerInvariant() switch
        {
            "no_to_mild" => "low",
            "mild_to_moderate" => "medium",
            "moderate_to_severe" => "high",
            _ => "unknown"
        };
    }

    private static List<string> GenerateInsights(SessionPredictionResult result)
    {
        var insights = new List<string>
        {
            "Analysis completed using Kintsugi Health API"
        };

        if (!string.IsNullOrEmpty(result.PredictedScoreDepression))
        {
            insights.Add($"Depression score: {result.PredictedScoreDepression}");
        }

        if (!string.IsNullOrEmpty(result.PredictedScoreAnxiety))
        {
            insights.Add($"Anxiety score: {result.PredictedScoreAnxiety}");
        }

        insights.Add("Results should be reviewed by a qualified healthcare professional");

        return insights;
    }

    private async Task UpdateSessionStatusToFailedAsync(string sessionId, Exception exception)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Updating session status to failed for session: {SessionId}", nameof(UpdateSessionStatusToFailedAsync), sessionId);

            var existingSessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
            if (existingSessionData != null)
            {
                existingSessionData.Status = "failed";
                existingSessionData.UpdatedAt = DateTime.UtcNow.ToString("O");

                var updateSuccess = await _sessionStorageService.UpdateSessionDataAsync(existingSessionData);
                if (updateSuccess)
                {
                    _logger.LogInformation("[{FunctionName}] Successfully updated session status to failed for session: {SessionId}", nameof(UpdateSessionStatusToFailedAsync), sessionId);
                }
                else
                {
                    _logger.LogWarning("[{FunctionName}] Failed to update session status to failed for session: {SessionId}", nameof(UpdateSessionStatusToFailedAsync), sessionId);
                }
            }
            else
            {
                _logger.LogWarning("[{FunctionName}] Session data not found in blob storage for session: {SessionId}", nameof(UpdateSessionStatusToFailedAsync), sessionId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error updating session status to failed for session: {SessionId}. Original error: {OriginalError}", nameof(UpdateSessionStatusToFailedAsync), sessionId, exception.Message);
            // Don't throw - this is a cleanup operation that shouldn't fail the main request
        }
    }

    /// <summary>
    /// Downloads audio from blob storage and returns it to the client.
    /// This endpoint handles authentication with blob storage so the frontend doesn't need direct access.
    /// </summary>
    [Function("DownloadAudio")]
    public async Task<HttpResponseData> DownloadAudio(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "audio/download")] HttpRequestData req)
    {
        try
        {
            // Get the blob URL from query parameter
            var blobUrl = req.Query["url"];

            if (string.IsNullOrEmpty(blobUrl))
            {
                _logger.LogWarning("[{FunctionName}] Missing 'url' query parameter", nameof(DownloadAudio));
                var badRequestResponse = req.CreateResponse(System.Net.HttpStatusCode.BadRequest);
                await badRequestResponse.WriteStringAsync("Missing 'url' query parameter");
                return badRequestResponse;
            }

            // URL decode the blob URL
            blobUrl = System.Web.HttpUtility.UrlDecode(blobUrl);
            _logger.LogInformation("[{FunctionName}] Downloading audio from: {BlobUrl}", nameof(DownloadAudio), blobUrl);

            // Download the audio data using the existing helper method
            var audioData = await DownloadAudioFromBlobAsync(blobUrl);

            // Determine content type based on file extension
            var contentType = "audio/wav";
            if (blobUrl.EndsWith(".mp3", StringComparison.OrdinalIgnoreCase))
                contentType = "audio/mpeg";
            else if (blobUrl.EndsWith(".m4a", StringComparison.OrdinalIgnoreCase))
                contentType = "audio/mp4";
            else if (blobUrl.EndsWith(".ogg", StringComparison.OrdinalIgnoreCase))
                contentType = "audio/ogg";
            else if (blobUrl.EndsWith(".webm", StringComparison.OrdinalIgnoreCase))
                contentType = "audio/webm";

            // Return the audio data
            var response = req.CreateResponse(System.Net.HttpStatusCode.OK);
            response.Headers.Add("Content-Type", contentType);
            response.Headers.Add("Content-Disposition", $"inline; filename=\"{Path.GetFileName(new Uri(blobUrl).LocalPath)}\"");
            await response.Body.WriteAsync(audioData, 0, audioData.Length);

            _logger.LogInformation("[{FunctionName}] Successfully returned {Size} bytes of audio data", nameof(DownloadAudio), audioData.Length);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error downloading audio", nameof(DownloadAudio));

            var errorResponse = req.CreateResponse(System.Net.HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync($"Error downloading audio: {ex.Message}");
            return errorResponse;
        }
    }

    /// <summary>
    /// Downloads audio data from Azure Blob Storage using the BlobServiceClient (with managed identity/connection string auth)
    /// This method properly handles authentication for both local Azurite and Azure Blob Storage
    /// </summary>
    private async Task<byte[]> DownloadAudioFromBlobAsync(string blobUrl)
    {
        _logger.LogInformation("[{MethodName}] Downloading audio from blob URL: {BlobUrl}", nameof(DownloadAudioFromBlobAsync), blobUrl);

        // Parse the blob URL to extract container and blob path
        // URLs can be:
        // - Azurite: http://127.0.0.1:10000/devstoreaccount1/audio-uploads/users/xxx/file.wav
        // - Azure: https://account.blob.core.windows.net/audio-uploads/users/xxx/file.wav
        var uri = new Uri(blobUrl);
        var pathSegments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);

        string containerName;
        string blobPath;

        // Check if this is Azurite (has devstoreaccount1 in path)
        if (pathSegments.Length > 0 && pathSegments[0] == "devstoreaccount1")
        {
            // Azurite format: /devstoreaccount1/container/blob/path
            containerName = pathSegments[1];
            blobPath = string.Join("/", pathSegments.Skip(2));
            _logger.LogInformation("[{MethodName}] Detected Azurite URL. Container: {Container}, BlobPath: {BlobPath}",
                nameof(DownloadAudioFromBlobAsync), containerName, blobPath);
        }
        else
        {
            // Azure format: /container/blob/path
            containerName = pathSegments[0];
            blobPath = string.Join("/", pathSegments.Skip(1));
            _logger.LogInformation("[{MethodName}] Detected Azure Blob URL. Container: {Container}, BlobPath: {BlobPath}",
                nameof(DownloadAudioFromBlobAsync), containerName, blobPath);
        }

        var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
        var blobClient = containerClient.GetBlobClient(blobPath);

        using var memoryStream = new MemoryStream();
        await blobClient.DownloadToAsync(memoryStream);
        var data = memoryStream.ToArray();

        _logger.LogInformation("[{MethodName}] Successfully downloaded {Size} bytes from blob storage",
            nameof(DownloadAudioFromBlobAsync), data.Length);

        return data;
    }
}
