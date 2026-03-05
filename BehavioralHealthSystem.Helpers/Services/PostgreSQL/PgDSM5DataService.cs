using Azure;
using Azure.AI.DocumentIntelligence;
using Azure.Identity;
using BehavioralHealthSystem.Helpers.Data;
using BehavioralHealthSystem.Helpers.Services;

namespace BehavioralHealthSystem.Services;

/// <summary>
/// PostgreSQL implementation of IDSM5DataService.
/// Extraction still uses Azure Document Intelligence / Content Understanding.
/// Storage reads/writes use PostgreSQL instead of Blob Storage.
/// </summary>
public class PgDSM5DataService : IDSM5DataService
{
    private readonly BhsDbContext _db;
    private readonly ILogger<PgDSM5DataService> _logger;
    private readonly IConfiguration _configuration;
    private readonly DocumentIntelligenceClient? _documentClient;
    private readonly IAzureContentUnderstandingService? _contentUnderstandingService;

    public PgDSM5DataService(
        BhsDbContext db,
        ILogger<PgDSM5DataService> logger,
        IConfiguration configuration,
        IAzureContentUnderstandingService? contentUnderstandingService = null)
    {
        _db = db;
        _logger = logger;
        _configuration = configuration;
        _contentUnderstandingService = contentUnderstandingService;

        // Initialize Azure Document Intelligence client (only if endpoint is provided; optional when using Content Understanding)
        var documentEndpoint = _configuration["DSM5_DOCUMENT_INTELLIGENCE_ENDPOINT"];

        if (!string.IsNullOrWhiteSpace(documentEndpoint))
        {
            var documentApiKey = _configuration["DSM5_DOCUMENT_INTELLIGENCE_KEY"];

            if (string.IsNullOrWhiteSpace(documentApiKey))
            {
                _documentClient = new DocumentIntelligenceClient(new Uri(documentEndpoint), new DefaultAzureCredential());
                _logger.LogInformation("[{MethodName}] Initialized Document Intelligence client with Managed Identity", nameof(PgDSM5DataService));
            }
            else
            {
                _documentClient = new DocumentIntelligenceClient(new Uri(documentEndpoint), new AzureKeyCredential(documentApiKey));
                _logger.LogInformation("[{MethodName}] Initialized Document Intelligence client with API key (local development)", nameof(PgDSM5DataService));
            }
        }
        else
        {
            _logger.LogInformation("[{MethodName}] Document Intelligence endpoint not configured - will use Content Understanding if available", nameof(PgDSM5DataService));
        }
    }

    public async Task<DSM5ExtractionResult> ExtractDiagnosticCriteriaAsync(
        string? pdfUrl = null, string? pdfBase64 = null, string? pageRanges = null, bool autoUpload = false)
    {
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            var sourceType = !string.IsNullOrEmpty(pdfUrl) ? "URL" : "Base64";
            _logger.LogInformation("[{MethodName}] Starting DSM-5 extraction from PDF ({SourceType}), Pages: {PageRanges}",
                nameof(ExtractDiagnosticCriteriaAsync), sourceType, pageRanges ?? "all");

            byte[] pdfBytes;
            if (!string.IsNullOrEmpty(pdfUrl))
            {
                using var httpClient = new HttpClient();
                pdfBytes = await httpClient.GetByteArrayAsync(pdfUrl);
            }
            else if (!string.IsNullOrEmpty(pdfBase64))
            {
                pdfBytes = Convert.FromBase64String(pdfBase64);
            }
            else
            {
                throw new ArgumentException("Either pdfUrl or pdfBase64 must be provided");
            }

            _logger.LogInformation("[{MethodName}] PDF size: {Size} bytes", nameof(ExtractDiagnosticCriteriaAsync), pdfBytes.Length);

            var extractionMethod = _configuration["DSM5_EXTRACTION_METHOD"];
            var useContentUnderstanding = extractionMethod?.Equals("CONTENT_UNDERSTANDING", StringComparison.OrdinalIgnoreCase) == true;

            List<DSM5ConditionData> extractedConditions;

            if (useContentUnderstanding && _contentUnderstandingService != null)
            {
                _logger.LogInformation("[{MethodName}] Using Azure Content Understanding for extraction", nameof(ExtractDiagnosticCriteriaAsync));

                int startPage = 1;
                int? endPage = null;
                if (!string.IsNullOrEmpty(pageRanges))
                {
                    var parts = pageRanges.Split('-');
                    if (parts.Length == 2)
                    {
                        int.TryParse(parts[0], out startPage);
                        if (int.TryParse(parts[1], out var end))
                            endPage = end;
                    }
                }

                extractedConditions = await _contentUnderstandingService.ExtractDSM5ConditionsAsync(pdfBytes, startPage, endPage);
            }
            else
            {
                if (_documentClient == null)
                {
                    throw new InvalidOperationException(
                        "Document Intelligence client is not configured. " +
                        "Either set DSM5_DOCUMENT_INTELLIGENCE_ENDPOINT or use DSM5_EXTRACTION_METHOD=CONTENT_UNDERSTANDING");
                }

                _logger.LogInformation("[{MethodName}] Using Document Intelligence for extraction", nameof(ExtractDiagnosticCriteriaAsync));

                var analyzeRequest = new AnalyzeDocumentContent
                {
                    Base64Source = BinaryData.FromBytes(pdfBytes)
                };

                var operation = await _documentClient.AnalyzeDocumentAsync(
                    WaitUntil.Completed,
                    "prebuilt-layout",
                    analyzeRequest);

                if (!operation.HasCompleted || operation.Value == null)
                    throw new InvalidOperationException("Document analysis did not complete successfully");

                // Delegate to same parsing logic — reuse via Content Understanding or inline
                // For PG we rely on Content Understanding extraction primarily
                extractedConditions = new List<DSM5ConditionData>();
                _logger.LogWarning("[{MethodName}] Document Intelligence parsing not re-implemented in PG service. Use CONTENT_UNDERSTANDING method.", nameof(ExtractDiagnosticCriteriaAsync));
            }

            _logger.LogInformation("[{MethodName}] Extracted {ConditionCount} conditions from DSM-5",
                nameof(ExtractDiagnosticCriteriaAsync), extractedConditions.Count);

            // Auto-upload to PostgreSQL
            string? storagePath = null;
            if (autoUpload && extractedConditions.Any())
            {
                var uploadResult = await UploadConditionsToStorageAsync(extractedConditions, overwriteExisting: false);
                if (uploadResult.Success)
                    storagePath = $"pg://dsm5_conditions ({uploadResult.UploadedCount} records)";
            }

            stopwatch.Stop();

            int pagesProcessed = extractedConditions.Sum(c => c.PageNumbers?.Count ?? 1);

            return new DSM5ExtractionResult
            {
                Success = true,
                ExtractedConditions = extractedConditions,
                PagesProcessed = pagesProcessed,
                ProcessingTimeMs = stopwatch.ElapsedMilliseconds,
                UploadedToStorage = autoUpload && !string.IsNullOrEmpty(storagePath),
                BlobPath = storagePath
            };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "[{MethodName}] Error extracting DSM-5 data from PDF", nameof(ExtractDiagnosticCriteriaAsync));

            return new DSM5ExtractionResult
            {
                Success = false,
                ErrorMessage = ex.Message,
                ProcessingTimeMs = stopwatch.ElapsedMilliseconds
            };
        }
    }

    public async Task<List<DSM5ConditionData>> GetAvailableConditionsAsync(
        string? category = null, string? searchTerm = null, bool includeDetails = false)
    {
        try
        {
            _logger.LogInformation("[{MethodName}] Getting available DSM-5 conditions. Category: {Category}, Search: {SearchTerm}",
                nameof(GetAvailableConditionsAsync), category, searchTerm);

            IQueryable<DSM5ConditionData> query = _db.Dsm5Conditions;

            if (!string.IsNullOrEmpty(category))
                query = query.Where(c => c.Category.Contains(category));

            if (!string.IsNullOrEmpty(searchTerm))
                query = query.Where(c => c.Name.Contains(searchTerm) || c.Description.Contains(searchTerm));

            var conditions = await query.OrderBy(c => c.Name).ToListAsync();

            // Strip detailed criteria if not requested
            if (!includeDetails)
            {
                foreach (var c in conditions)
                    c.DiagnosticCriteria = new List<DSM5DiagnosticCriterion>();
            }

            _logger.LogInformation("[{MethodName}] Retrieved {ConditionCount} DSM-5 conditions",
                nameof(GetAvailableConditionsAsync), conditions.Count);

            return conditions;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error getting available DSM-5 conditions", nameof(GetAvailableConditionsAsync));
            return new List<DSM5ConditionData>();
        }
    }

    public async Task<DSM5ConditionData?> GetConditionDetailsAsync(string conditionId)
    {
        try
        {
            _logger.LogInformation("[{MethodName}] Getting condition details for: {ConditionId}",
                nameof(GetConditionDetailsAsync), conditionId);

            return await _db.Dsm5Conditions.FindAsync(conditionId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error getting condition details for: {ConditionId}",
                nameof(GetConditionDetailsAsync), conditionId);
            return null;
        }
    }

    public async Task<DSM5UploadResult> UploadConditionsToStorageAsync(List<DSM5ConditionData> conditions, bool overwriteExisting = false)
    {
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            _logger.LogInformation("[{MethodName}] Saving {ConditionCount} conditions to PostgreSQL",
                nameof(UploadConditionsToStorageAsync), conditions.Count);

            var uploadedCount = 0;
            var skippedCount = 0;
            var updatedCount = 0;
            var storagePaths = new List<string>();

            foreach (var condition in conditions)
            {
                var existing = await _db.Dsm5Conditions.FindAsync(condition.Id);

                if (existing != null && !overwriteExisting)
                {
                    skippedCount++;
                    continue;
                }

                if (existing != null)
                {
                    // Update existing
                    _db.Entry(existing).CurrentValues.SetValues(condition);
                    existing.LastUpdated = DateTime.UtcNow;
                    updatedCount++;
                }
                else
                {
                    // Insert new
                    condition.LastUpdated = DateTime.UtcNow;
                    _db.Dsm5Conditions.Add(condition);
                    uploadedCount++;
                }

                storagePaths.Add($"dsm5_conditions/{condition.Id}");
            }

            await _db.SaveChangesAsync();
            stopwatch.Stop();

            _logger.LogInformation("[{MethodName}] Save completed. Uploaded: {UploadedCount}, Updated: {UpdatedCount}, Skipped: {SkippedCount}",
                nameof(UploadConditionsToStorageAsync), uploadedCount, updatedCount, skippedCount);

            return new DSM5UploadResult
            {
                Success = true,
                UploadedCount = uploadedCount,
                UpdatedCount = updatedCount,
                SkippedCount = skippedCount,
                BlobPaths = storagePaths,
                ProcessingTimeMs = stopwatch.ElapsedMilliseconds
            };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "[{MethodName}] Error saving conditions to PostgreSQL", nameof(UploadConditionsToStorageAsync));

            return new DSM5UploadResult
            {
                Success = false,
                ErrorMessage = ex.Message,
                ProcessingTimeMs = stopwatch.ElapsedMilliseconds
            };
        }
    }

    public async Task<DSM5DataStatus> GetDataStatusAsync()
    {
        try
        {
            _logger.LogInformation("[{MethodName}] Getting DSM-5 data status from PostgreSQL", nameof(GetDataStatusAsync));

            var totalConditions = await _db.Dsm5Conditions.CountAsync();
            var availableConditions = await _db.Dsm5Conditions.CountAsync(c => c.IsAvailableForAssessment);
            var categories = await _db.Dsm5Conditions.Select(c => c.Category).Distinct().ToListAsync();
            var lastUpdated = await _db.Dsm5Conditions.MaxAsync(c => (DateTime?)c.LastUpdated);

            return new DSM5DataStatus
            {
                IsInitialized = totalConditions > 0,
                TotalConditions = totalConditions,
                AvailableConditions = availableConditions,
                Categories = categories,
                LastUpdated = lastUpdated,
                DataVersion = "1.0",
                ContainerExists = true // PG table always "exists"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error getting DSM-5 data status", nameof(GetDataStatusAsync));

            return new DSM5DataStatus
            {
                IsInitialized = false,
                ContainerExists = false
            };
        }
    }

    public async Task<Dictionary<string, DSM5ConditionData>> GetConditionsForAssessmentAsync(List<string> conditionIds)
    {
        try
        {
            _logger.LogInformation("[{MethodName}] Getting {ConditionCount} conditions for assessment",
                nameof(GetConditionsForAssessmentAsync), conditionIds.Count);

            var conditions = await _db.Dsm5Conditions
                .Where(c => conditionIds.Contains(c.Id))
                .ToListAsync();

            var result = conditions.ToDictionary(c => c.Id, c => c);

            _logger.LogInformation("[{MethodName}] Retrieved {FoundCount}/{RequestedCount} conditions for assessment",
                nameof(GetConditionsForAssessmentAsync), result.Count, conditionIds.Count);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error getting conditions for assessment", nameof(GetConditionsForAssessmentAsync));
            return new Dictionary<string, DSM5ConditionData>();
        }
    }
}
