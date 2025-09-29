namespace BehavioralHealthSystem.Functions;

public class FileGroupFunctions
{
    private readonly ILogger<FileGroupFunctions> _logger;
    private readonly IFileGroupStorageService _fileGroupStorageService;
    private readonly JsonSerializerOptions _jsonOptions;

    public FileGroupFunctions(
        ILogger<FileGroupFunctions> logger,
        IFileGroupStorageService fileGroupStorageService)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _fileGroupStorageService = fileGroupStorageService ?? throw new ArgumentNullException(nameof(fileGroupStorageService));
        _jsonOptions = JsonSerializerOptionsFactory.PrettyPrint;
    }

    [Function("CreateFileGroup")]
    public async Task<HttpResponseData> CreateFileGroup(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "filegroups")] HttpRequestData req)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Creating file group", nameof(CreateFileGroup));

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

            var createRequest = JsonSerializer.Deserialize<CreateFileGroupRequest>(requestBody, _jsonOptions);
            if (createRequest == null || string.IsNullOrEmpty(createRequest.GroupName) || string.IsNullOrEmpty(createRequest.CreatedBy))
            {
                var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequestResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = false, 
                    message = "Valid group name and created by user ID are required" 
                }, _jsonOptions));
                return badRequestResponse;
            }

            var fileGroup = await _fileGroupStorageService.CreateFileGroupAsync(createRequest);
            
            if (fileGroup != null)
            {
                var response = req.CreateResponse(HttpStatusCode.Created);
                await response.WriteStringAsync(JsonSerializer.Serialize(new FileGroupResponse
                {
                    Success = true,
                    Message = "File group created successfully",
                    FileGroup = fileGroup
                }, _jsonOptions));
                return response;
            }
            else
            {
                // Check if it was a duplicate name by trying to find existing group with same name
                var existingGroups = await _fileGroupStorageService.GetUserFileGroupsAsync(createRequest.CreatedBy);
                var duplicateExists = existingGroups.Any(g => string.Equals(g.GroupName, createRequest.GroupName, StringComparison.OrdinalIgnoreCase));
                
                if (duplicateExists)
                {
                    var conflictResponse = req.CreateResponse(HttpStatusCode.Conflict);
                    await conflictResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                        success = false, 
                        message = $"A group with the name '{createRequest.GroupName}' already exists. Please choose a different name." 
                    }, _jsonOptions));
                    return conflictResponse;
                }
                else
                {
                    var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                    await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                        success = false, 
                        message = "Failed to create file group" 
                    }, _jsonOptions));
                    return errorResponse;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error creating file group", nameof(CreateFileGroup));
            
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                success = false, 
                message = "Error creating file group",
                error = ex.Message 
            }, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("GetUserFileGroups")]
    public async Task<HttpResponseData> GetUserFileGroups(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "filegroups/users/{userId}")] HttpRequestData req,
        string userId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Getting file groups for user: {UserId}", nameof(GetUserFileGroups), userId);

            var fileGroups = await _fileGroupStorageService.GetUserFileGroupsAsync(userId);
            
            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new FileGroupListResponse
            {
                Success = true,
                Count = fileGroups.Count,
                FileGroups = fileGroups
            }, _jsonOptions));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting file groups for user: {UserId}", nameof(GetUserFileGroups), userId);
            
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                success = false, 
                message = "Error getting user file groups",
                error = ex.Message 
            }, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("GetFileGroup")]
    public async Task<HttpResponseData> GetFileGroup(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "filegroups/{groupId}")] HttpRequestData req,
        string groupId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Getting file group: {GroupId}", nameof(GetFileGroup), groupId);

            var fileGroup = await _fileGroupStorageService.GetFileGroupAsync(groupId);
            
            if (fileGroup != null)
            {
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(new FileGroupResponse
                {
                    Success = true,
                    Message = "File group retrieved successfully",
                    FileGroup = fileGroup
                }, _jsonOptions));
                return response;
            }
            else
            {
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = false, 
                    message = $"File group not found: {groupId}" 
                }, _jsonOptions));
                return notFoundResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting file group: {GroupId}", nameof(GetFileGroup), groupId);
            
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                success = false, 
                message = "Error getting file group",
                error = ex.Message 
            }, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("UpdateFileGroup")]
    public async Task<HttpResponseData> UpdateFileGroup(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "filegroups/{groupId}")] HttpRequestData req,
        string groupId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Updating file group: {GroupId}", nameof(UpdateFileGroup), groupId);

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

            var fileGroup = JsonSerializer.Deserialize<FileGroup>(requestBody, _jsonOptions);
            if (fileGroup == null || fileGroup.GroupId != groupId)
            {
                var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequestResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = false, 
                    message = "File group GroupId must match route parameter" 
                }, _jsonOptions));
                return badRequestResponse;
            }

            var success = await _fileGroupStorageService.UpdateFileGroupAsync(fileGroup);
            
            if (success)
            {
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = true, 
                    message = "File group updated successfully" 
                }, _jsonOptions));
                return response;
            }
            else
            {
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = false, 
                    message = "Failed to update file group" 
                }, _jsonOptions));
                return errorResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error updating file group: {GroupId}", nameof(UpdateFileGroup), groupId);
            
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                success = false, 
                message = "Error updating file group",
                error = ex.Message 
            }, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("ArchiveFileGroup")]
    public async Task<HttpResponseData> ArchiveFileGroup(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "filegroups/{groupId}")] HttpRequestData req,
        string groupId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Archiving file group: {GroupId}", nameof(ArchiveFileGroup), groupId);

            var success = await _fileGroupStorageService.ArchiveFileGroupAsync(groupId);
            
            if (success)
            {
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = true, 
                    message = "File group archived successfully" 
                }, _jsonOptions));
                return response;
            }
            else
            {
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = false, 
                    message = $"File group not found: {groupId}" 
                }, _jsonOptions));
                return notFoundResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error archiving file group: {GroupId}", nameof(ArchiveFileGroup), groupId);
            
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                success = false, 
                message = "Error archiving file group",
                error = ex.Message 
            }, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("DeleteFileGroup")]
    public async Task<HttpResponseData> DeleteFileGroup(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "filegroups/{groupId}/delete")] HttpRequestData req,
        string groupId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Deleting file group: {GroupId}", nameof(DeleteFileGroup), groupId);

            var success = await _fileGroupStorageService.DeleteFileGroupAsync(groupId);
            
            if (success)
            {
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = true, 
                    message = "File group and associated sessions deleted successfully" 
                }, _jsonOptions));
                return response;
            }
            else
            {
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                    success = false, 
                    message = $"File group not found: {groupId}" 
                }, _jsonOptions));
                return notFoundResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error deleting file group: {GroupId}", nameof(DeleteFileGroup), groupId);
            
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                success = false, 
                message = "Error deleting file group",
                error = ex.Message 
            }, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("SearchFileGroups")]
    public async Task<HttpResponseData> SearchFileGroups(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "filegroups/users/{userId}/search")] HttpRequestData req,
        string userId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Searching file groups for user: {UserId}", nameof(SearchFileGroups), userId);

            var query = req.Query["q"] ?? "";
            var fileGroups = await _fileGroupStorageService.SearchFileGroupsAsync(userId, query);
            
            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new FileGroupListResponse
            {
                Success = true,
                Count = fileGroups.Count,
                FileGroups = fileGroups
            }, _jsonOptions));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error searching file groups for user: {UserId}", nameof(SearchFileGroups), userId);
            
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                success = false, 
                message = "Error searching file groups",
                error = ex.Message 
            }, _jsonOptions));
            return errorResponse;
        }
    }

    [Function("GetGroupSessionCount")]
    public async Task<HttpResponseData> GetGroupSessionCount(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "filegroups/{groupId}/sessions/count")] HttpRequestData req,
        string groupId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Getting session count for group: {GroupId}", nameof(GetGroupSessionCount), groupId);

            var count = await _fileGroupStorageService.GetGroupSessionCountAsync(groupId);
            
            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new { 
                success = true,
                groupId = groupId,
                sessionCount = count
            }, _jsonOptions));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting session count for group: {GroupId}", nameof(GetGroupSessionCount), groupId);
            
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new { 
                success = false, 
                message = "Error getting group session count",
                error = ex.Message 
            }, _jsonOptions));
            return errorResponse;
        }
    }
}