using Microsoft.DurableTask.Client;
using Azure.AI.DocumentIntelligence;
using Azure.Identity;
using Azure.Storage.Blobs;

namespace BehavioralHealthSystem.Functions;

/// <summary>
/// Azure Functions for DSM-5 data administration and management
/// Provides endpoints for extracting diagnostic criteria from DSM-5 PDF using Azure Document Intelligence
/// and managing the extracted data in Azure Blob Storage
/// </summary>
public class DSM5AdministrationFunctions
{
    private readonly ILogger<DSM5AdministrationFunctions> _logger;
    private readonly IDSM5DataService _dsm5DataService;
    private readonly JsonSerializerOptions _jsonOptions;

    public DSM5AdministrationFunctions(
        ILogger<DSM5AdministrationFunctions> logger,
        IDSM5DataService dsm5DataService)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _dsm5DataService = dsm5DataService ?? throw new ArgumentNullException(nameof(dsm5DataService));
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };
    }

    /// <summary>
    /// Validates and extracts diagnostic criteria from DSM-5 PDF
    /// POST /api/dsm5-admin/validate-extraction
    /// Body: { "pdfUrl": "string", "pageRanges": "123-124,200-205", "autoUpload": false }
    /// </summary>
    /// <remarks>
    /// This endpoint extracts structured data from specific pages of the DSM-5 PDF
    /// and optionally uploads the results to blob storage for use in assessments
    /// </remarks>
    [Function("ValidateAndExtractDSM5Data")]
    public async Task<HttpResponseData> ValidateAndExtractDSM5Data(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "dsm5-admin/validate-extraction")] HttpRequestData req)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Starting DSM-5 PDF validation and extraction", 
                nameof(ValidateAndExtractDSM5Data));

            // Parse request body
            var requestBody = await req.ReadAsStringAsync();
            var request = JsonSerializer.Deserialize<DSM5ExtractionRequest>(requestBody!, _jsonOptions);

            if (request == null || string.IsNullOrEmpty(request.PdfUrl))
            {
                var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequestResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = "Invalid request. 'pdfUrl' is required."
                }, _jsonOptions));
                return badRequestResponse;
            }

            _logger.LogInformation("[{FunctionName}] Extracting from PDF: {PdfUrl}, Pages: {PageRanges}", 
                nameof(ValidateAndExtractDSM5Data), request.PdfUrl, request.PageRanges ?? "all");

            // Extract data using Document Intelligence
            var extractionResult = await _dsm5DataService.ExtractDiagnosticCriteriaAsync(
                request.PdfUrl, 
                request.PageRanges, 
                request.AutoUpload);

            if (extractionResult.Success)
            {
                _logger.LogInformation("[{FunctionName}] Successfully extracted {ConditionCount} conditions from DSM-5 PDF", 
                    nameof(ValidateAndExtractDSM5Data), extractionResult.ExtractedConditions?.Count ?? 0);

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = true,
                    message = "DSM-5 data extraction completed successfully",
                    extractionResult = new
                    {
                        conditionsFound = extractionResult.ExtractedConditions?.Count ?? 0,
                        conditions = extractionResult.ExtractedConditions?.Take(5).Select(c => new
                        {
                            name = c.Name,
                            code = c.Code,
                            criteriaCount = c.DiagnosticCriteria?.Count ?? 0,
                            pageNumbers = c.PageNumbers
                        }),
                        totalPagesProcessed = extractionResult.PagesProcessed,
                        processingTimeSeconds = extractionResult.ProcessingTimeMs / 1000.0,
                        uploadedToStorage = extractionResult.UploadedToStorage,
                        blobPath = extractionResult.BlobPath
                    }
                }, _jsonOptions));
                return response;
            }
            else
            {
                _logger.LogError("[{FunctionName}] DSM-5 extraction failed: {ErrorMessage}", 
                    nameof(ValidateAndExtractDSM5Data), extractionResult.ErrorMessage);

                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = "DSM-5 data extraction failed",
                    error = extractionResult.ErrorMessage,
                    processingTimeSeconds = extractionResult.ProcessingTimeMs / 1000.0
                }, _jsonOptions));
                return errorResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error during DSM-5 validation and extraction", 
                nameof(ValidateAndExtractDSM5Data));

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = false,
                message = "Error during DSM-5 validation and extraction",
                error = ex.Message
            }, _jsonOptions));
            return errorResponse;
        }
    }

    /// <summary>
    /// Gets a list of all available DSM-5 mental health conditions from blob storage
    /// GET /api/dsm5-admin/conditions
    /// Query params: ?category=mood&searchTerm=depression&includeDetails=false
    /// </summary>
    [Function("GetAvailableDSM5Conditions")]
    public async Task<HttpResponseData> GetAvailableDSM5Conditions(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "dsm5-admin/conditions")] HttpRequestData req)
    {
        try
        {
            var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
            var category = query["category"];
            var searchTerm = query["searchTerm"];
            var includeDetails = bool.Parse(query["includeDetails"] ?? "false");

            _logger.LogInformation("[{FunctionName}] Getting DSM-5 conditions. Category: {Category}, Search: {SearchTerm}, Details: {IncludeDetails}", 
                nameof(GetAvailableDSM5Conditions), category, searchTerm, includeDetails);

            var conditions = await _dsm5DataService.GetAvailableConditionsAsync(category, searchTerm, includeDetails);

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = true,
                totalConditions = conditions.Count,
                conditions = conditions.Select(c => new
                {
                    id = c.Id,
                    name = c.Name,
                    code = c.Code,
                    category = c.Category,
                    description = c.Description,
                    criteriaCount = c.DiagnosticCriteria?.Count ?? 0,
                    pageNumbers = c.PageNumbers,
                    isAvailableForAssessment = c.IsAvailableForAssessment,
                    lastUpdated = c.LastUpdated,
                    criteria = includeDetails ? c.DiagnosticCriteria : null
                })
            }, _jsonOptions));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting DSM-5 conditions", 
                nameof(GetAvailableDSM5Conditions));

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = false,
                message = "Error getting DSM-5 conditions",
                error = ex.Message
            }, _jsonOptions));
            return errorResponse;
        }
    }

    /// <summary>
    /// Gets detailed diagnostic criteria for a specific DSM-5 condition
    /// GET /api/dsm5-admin/conditions/{conditionId}
    /// </summary>
    [Function("GetDSM5ConditionDetails")]
    public async Task<HttpResponseData> GetDSM5ConditionDetails(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "dsm5-admin/conditions/{conditionId}")] HttpRequestData req,
        string conditionId)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Getting DSM-5 condition details for: {ConditionId}", 
                nameof(GetDSM5ConditionDetails), conditionId);

            var condition = await _dsm5DataService.GetConditionDetailsAsync(conditionId);

            if (condition == null)
            {
                var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                await notFoundResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = $"DSM-5 condition not found: {conditionId}"
                }, _jsonOptions));
                return notFoundResponse;
            }

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = true,
                condition = new
                {
                    id = condition.Id,
                    name = condition.Name,
                    code = condition.Code,
                    category = condition.Category,
                    description = condition.Description,
                    diagnosticCriteria = condition.DiagnosticCriteria,
                    differentialDiagnosis = condition.DifferentialDiagnosis,
                    prevalence = condition.Prevalence,
                    development = condition.Development,
                    riskFactors = condition.RiskFactors,
                    pageNumbers = condition.PageNumbers,
                    isAvailableForAssessment = condition.IsAvailableForAssessment,
                    lastUpdated = condition.LastUpdated,
                    extractionMetadata = condition.ExtractionMetadata
                }
            }, _jsonOptions));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting DSM-5 condition details for: {ConditionId}", 
                nameof(GetDSM5ConditionDetails), conditionId);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = false,
                message = "Error getting DSM-5 condition details",
                error = ex.Message
            }, _jsonOptions));
            return errorResponse;
        }
    }

    /// <summary>
    /// Uploads extracted DSM-5 data to blob storage
    /// POST /api/dsm5-admin/upload-data
    /// Body: { "data": DSM5ConditionData[], "overwriteExisting": false }
    /// </summary>
    [Function("UploadDSM5DataToStorage")]
    public async Task<HttpResponseData> UploadDSM5DataToStorage(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = "dsm5-admin/upload-data")] HttpRequestData req)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Starting DSM-5 data upload to blob storage", 
                nameof(UploadDSM5DataToStorage));

            var requestBody = await req.ReadAsStringAsync();
            var request = JsonSerializer.Deserialize<DSM5DataUploadRequest>(requestBody!, _jsonOptions);

            if (request?.Data == null || !request.Data.Any())
            {
                var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await badRequestResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = "Invalid request. 'data' array is required and cannot be empty."
                }, _jsonOptions));
                return badRequestResponse;
            }

            var uploadResult = await _dsm5DataService.UploadConditionsToStorageAsync(request.Data, request.OverwriteExisting);

            if (uploadResult.Success)
            {
                _logger.LogInformation("[{FunctionName}] Successfully uploaded {ConditionCount} DSM-5 conditions to storage", 
                    nameof(UploadDSM5DataToStorage), uploadResult.UploadedCount);

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = true,
                    message = "DSM-5 data uploaded successfully",
                    uploadedCount = uploadResult.UploadedCount,
                    skippedCount = uploadResult.SkippedCount,
                    updatedCount = uploadResult.UpdatedCount,
                    blobPaths = uploadResult.BlobPaths,
                    processingTimeSeconds = uploadResult.ProcessingTimeMs / 1000.0
                }, _jsonOptions));
                return response;
            }
            else
            {
                _logger.LogError("[{FunctionName}] DSM-5 data upload failed: {ErrorMessage}", 
                    nameof(UploadDSM5DataToStorage), uploadResult.ErrorMessage);

                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = false,
                    message = "DSM-5 data upload failed",
                    error = uploadResult.ErrorMessage,
                    processingTimeSeconds = uploadResult.ProcessingTimeMs / 1000.0
                }, _jsonOptions));
                return errorResponse;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error during DSM-5 data upload", 
                nameof(UploadDSM5DataToStorage));

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = false,
                message = "Error during DSM-5 data upload",
                error = ex.Message
            }, _jsonOptions));
            return errorResponse;
        }
    }

    /// <summary>
    /// Gets the status of DSM-5 data in blob storage
    /// GET /api/dsm5-admin/data-status
    /// </summary>
    [Function("GetDSM5DataStatus")]
    public async Task<HttpResponseData> GetDSM5DataStatus(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "dsm5-admin/data-status")] HttpRequestData req)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Getting DSM-5 data status from storage", 
                nameof(GetDSM5DataStatus));

            var status = await _dsm5DataService.GetDataStatusAsync();

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = true,
                dataStatus = new
                {
                    isInitialized = status.IsInitialized,
                    totalConditions = status.TotalConditions,
                    availableConditions = status.AvailableConditions,
                    categories = status.Categories,
                    lastUpdated = status.LastUpdated,
                    dataVersion = status.DataVersion,
                    storageInfo = new
                    {
                        containerExists = status.ContainerExists,
                        totalBlobSize = status.TotalBlobSizeBytes,
                        blobCount = status.BlobCount
                    }
                }
            }, _jsonOptions));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error getting DSM-5 data status", 
                nameof(GetDSM5DataStatus));

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(new
            {
                success = false,
                message = "Error getting DSM-5 data status",
                error = ex.Message
            }, _jsonOptions));
            return errorResponse;
        }
    }
}

// Request/Response DTOs
public class DSM5ExtractionRequest
{
    public string PdfUrl { get; set; } = string.Empty;
    public string? PageRanges { get; set; } // "123-124,200-205" or null for all pages
    public bool AutoUpload { get; set; } = false;
}

public class DSM5DataUploadRequest
{
    public List<DSM5ConditionData> Data { get; set; } = new();
    public bool OverwriteExisting { get; set; } = false;
}