namespace BehavioralHealthSystem.Functions;

public class SessionStorageFunctions
{
    private readonly ILogger<SessionStorageFunctions> _logger;
    private readonly ISessionStorageService _sessionStorageService;
    private readonly JsonSerializerOptions _jsonOptions;

    public SessionStorageFunctions(
        ILogger<SessionStorageFunctions> logger,
        ISessionStorageService sessionStorageService)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _sessionStorageService = sessionStorageService ?? throw new ArgumentNullException(nameof(sessionStorageService));
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };
    }

    [Function("SaveSessionData")]
    public async Task<HttpResponseData> SaveSessionData(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "sessions")] HttpRequestData req)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Saving session data", nameof(SaveSessionData));

            var requestBody = await req.ReadAsStringAsync();
            if (string.IsNullOrEmpty(requestBody))
            {
                var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequestResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = false, 
                    message = "Request body is required" 
                }, _jsonOptions));
                return badRequestResponse;
            }

            var sessionData = JsonSerializer.Deserialize<SessionData>(requestBody, _jsonOptions);
            if (sessionData == null || string.IsNullOrEmpty(sessionData.SessionId) || string.IsNullOrEmpty(sessionData.UserId))
            {
                var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequestResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = false, 
                    message = "Valid session data with SessionId and UserId is required" 
                }, _jsonOptions));
                return badRequestResponse;
            }

            var success = await _sessionStorageService.SaveSessionDataAsync(sessionData);
            
            if (success)
            {
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = true, 
                    message = "Session data saved successfully",
                    sessionId = sessionData.SessionId
                }, _jsonOptions));
                return response;
            }
            else
            {
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = false, 
                    message = "Failed to save session data" 
                }, _jsonOptions));
                return errorResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error saving session data", nameof(SaveSessionData));
            
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                success = false, 
                message = "Error saving session data",
                error = ex.Message 
            }, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("GetSessionData")]
    public async Task<HttpResponseData> GetSessionData(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "sessions/{sessionId}")] HttpRequestData req,
        string sessionId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Getting session data for session: {SessionId}", nameof(GetSessionData), sessionId);

            var sessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
            
            if (sessionData != null)
            {
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(sessionData, _jsonOptions));
                return response;
            }
            else
            {
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = false, 
                    message = $"Session not found: {sessionId}" 
                }, _jsonOptions));
                return notFoundResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting session data for session: {SessionId}", nameof(GetSessionData), sessionId);
            
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                success = false, 
                message = "Error getting session data",
                error = ex.Message 
            }, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("GetUserSessions")]
    public async Task<HttpResponseData> GetUserSessions(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "sessions/users/{userId}")] HttpRequestData req,
        string userId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Getting sessions for user: {UserId}", nameof(GetUserSessions), userId);

            var sessions = await _sessionStorageService.GetUserSessionsAsync(userId);
            
            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new {
                success = true,
                count = sessions.Count,
                sessions = sessions
            }, _jsonOptions));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting sessions for user: {UserId}", nameof(GetUserSessions), userId);
            
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                success = false, 
                message = "Error getting user sessions",
                error = ex.Message 
            }, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("UpdateSessionData")]
    public async Task<HttpResponseData> UpdateSessionData(
        [HttpTrigger(AuthorizationLevel.Function, "put", Route = "sessions/{sessionId}")] HttpRequestData req,
        string sessionId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Updating session data for session: {SessionId}", nameof(UpdateSessionData), sessionId);

            var requestBody = await req.ReadAsStringAsync();
            if (string.IsNullOrEmpty(requestBody))
            {
                var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequestResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = false, 
                    message = "Request body is required" 
                }, _jsonOptions));
                return badRequestResponse;
            }

            var sessionData = JsonSerializer.Deserialize<SessionData>(requestBody, _jsonOptions);
            if (sessionData == null || sessionData.SessionId != sessionId)
            {
                var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequestResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = false, 
                    message = "Session data SessionId must match route parameter" 
                }, _jsonOptions));
                return badRequestResponse;
            }

            var success = await _sessionStorageService.UpdateSessionDataAsync(sessionData);
            
            if (success)
            {
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = true, 
                    message = "Session data updated successfully" 
                }, _jsonOptions));
                return response;
            }
            else
            {
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = false, 
                    message = "Failed to update session data" 
                }, _jsonOptions));
                return errorResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error updating session data for session: {SessionId}", nameof(UpdateSessionData), sessionId);
            
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                success = false, 
                message = "Error updating session data",
                error = ex.Message 
            }, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("DeleteSessionData")]
    public async Task<HttpResponseData> DeleteSessionData(
        [HttpTrigger(AuthorizationLevel.Function, "delete", Route = "sessions/{sessionId}")] HttpRequestData req,
        string sessionId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Deleting session data for session: {SessionId}", nameof(DeleteSessionData), sessionId);

            var success = await _sessionStorageService.DeleteSessionDataAsync(sessionId);
            
            if (success)
            {
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = true, 
                    message = "Session data deleted successfully" 
                }, _jsonOptions));
                return response;
            }
            else
            {
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = false, 
                    message = $"Session not found: {sessionId}" 
                }, _jsonOptions));
                return notFoundResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error deleting session data for session: {SessionId}", nameof(DeleteSessionData), sessionId);
            
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                success = false, 
                message = "Error deleting session data",
                error = ex.Message 
            }, _jsonOptions));
            return errorResponse;
        }
    }
}
