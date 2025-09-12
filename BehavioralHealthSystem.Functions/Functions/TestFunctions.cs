namespace BehavioralHealthSystem.Functions;

public class TestFunctions
{
    private readonly ILogger<TestFunctions> _logger;
    private readonly IKintsugiApiService _kintsugiApiService;
    private readonly ISessionStorageService _sessionStorageService;
    private readonly JsonSerializerOptions _jsonOptions;

    public TestFunctions(ILogger<TestFunctions> logger, IKintsugiApiService kintsugiApiService, ISessionStorageService sessionStorageService)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _kintsugiApiService = kintsugiApiService ?? throw new ArgumentNullException(nameof(kintsugiApiService));
        _sessionStorageService = sessionStorageService ?? throw new ArgumentNullException(nameof(sessionStorageService));
        
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
                    Zipcode = "12345"
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

            var predictionRequest = JsonSerializer.Deserialize<PredictionRequest>(requestBody, _jsonOptions);
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
                predictionResponse = await _kintsugiApiService.SubmitPredictionAsync(
                    predictionRequest.SessionId, 
                    predictionRequest.AudioFileUrl, 
                    predictionRequest.AudioFileName ?? "audio.wav");
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
}
