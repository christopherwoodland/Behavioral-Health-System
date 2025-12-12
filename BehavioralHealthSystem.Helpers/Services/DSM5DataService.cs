using Azure;
using Azure.AI.DocumentIntelligence;
using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using System.Text.RegularExpressions;
using BehavioralHealthSystem.Helpers.Services;

namespace BehavioralHealthSystem.Services;

/// <summary>
/// Implementation of DSM-5 data service using Azure Document Intelligence and Blob Storage
/// Follows Azure best practices for security, error handling, and performance
/// </summary>
public class DSM5DataService : IDSM5DataService
{
    private readonly ILogger<DSM5DataService> _logger;
    private readonly IConfiguration _configuration;
    private readonly DocumentIntelligenceClient? _documentClient;
    private readonly BlobServiceClient _blobServiceClient;
    private readonly IAzureContentUnderstandingService? _contentUnderstandingService;
    private readonly string _containerName;
    private readonly JsonSerializerOptions _jsonOptions;

    private const string DSM5_CONTAINER_NAME = "dsm5-data";
    private const string CONDITIONS_FOLDER = "conditions";
    private const string METADATA_FOLDER = "metadata";

    public DSM5DataService(
        ILogger<DSM5DataService> logger,
        IConfiguration configuration,
        IAzureContentUnderstandingService? contentUnderstandingService = null)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        _contentUnderstandingService = contentUnderstandingService;

        // Initialize Azure Document Intelligence client (only if endpoint is provided)
        // This is optional when using Content Understanding exclusively
        var documentEndpoint = _configuration["DSM5_DOCUMENT_INTELLIGENCE_ENDPOINT"];

        if (!string.IsNullOrWhiteSpace(documentEndpoint))
        {
            // Prefer Managed Identity (production), fall back to API key (local development only)
            var documentApiKey = _configuration["DSM5_DOCUMENT_INTELLIGENCE_KEY"];

            // Use managed identity if running in Azure (no API key needed)
            // Only use API key for local development when managed identity is not available
            if (string.IsNullOrWhiteSpace(documentApiKey))
            {
                _documentClient = new DocumentIntelligenceClient(new Uri(documentEndpoint), new DefaultAzureCredential());
                _logger.LogInformation("[{MethodName}] Initialized Document Intelligence client with Managed Identity", nameof(DSM5DataService));
            }
            else
            {
                _documentClient = new DocumentIntelligenceClient(new Uri(documentEndpoint), new AzureKeyCredential(documentApiKey));
                _logger.LogInformation("[{MethodName}] Initialized Document Intelligence client with API key (local development)", nameof(DSM5DataService));
            }
        }
        else
        {
            _logger.LogInformation("[{MethodName}] Document Intelligence endpoint not configured - will use Content Understanding if available", nameof(DSM5DataService));
        }

        // Initialize Blob Storage client
        var storageAccountName = _configuration["DSM5_STORAGE_ACCOUNT_NAME"]
            ?? throw new InvalidOperationException("DSM5_STORAGE_ACCOUNT_NAME configuration missing");

        // Use Managed Identity (production) or local emulator for development
        var blobServiceUri = $"https://{storageAccountName}.blob.core.windows.net";
        _blobServiceClient = new BlobServiceClient(new Uri(blobServiceUri), new DefaultAzureCredential());
        _logger.LogInformation("[{MethodName}] Initialized Blob Storage client with Managed Identity", nameof(DSM5DataService));

        _containerName = _configuration["DSM5_CONTAINER_NAME"] ?? DSM5_CONTAINER_NAME;

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        // Initialize container if it doesn't exist
        _ = EnsureContainerExistsAsync();
    }

    public async Task<DSM5ExtractionResult> ExtractDiagnosticCriteriaAsync(string? pdfUrl = null, string? pdfBase64 = null, string? pageRanges = null, bool autoUpload = false)
    {
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            var sourceType = !string.IsNullOrEmpty(pdfUrl) ? "URL" : "Base64";
            _logger.LogInformation("[{MethodName}] Starting DSM-5 extraction from PDF ({SourceType}), Pages: {PageRanges}",
                nameof(ExtractDiagnosticCriteriaAsync), sourceType, pageRanges ?? "all");

            // Get PDF bytes from either URL or base64
            byte[] pdfBytes;
            if (!string.IsNullOrEmpty(pdfUrl))
            {
                _logger.LogInformation("[{MethodName}] Downloading PDF from URL", nameof(ExtractDiagnosticCriteriaAsync));
                pdfBytes = await DownloadPdfAsBytesAsync(pdfUrl);
            }
            else if (!string.IsNullOrEmpty(pdfBase64))
            {
                _logger.LogInformation("[{MethodName}] Decoding PDF from base64", nameof(ExtractDiagnosticCriteriaAsync));
                pdfBytes = Convert.FromBase64String(pdfBase64);
            }
            else
            {
                throw new ArgumentException("Either pdfUrl or pdfBase64 must be provided");
            }

            _logger.LogInformation("[{MethodName}] PDF size: {Size} bytes", nameof(ExtractDiagnosticCriteriaAsync), pdfBytes.Length);

            // Check if Content Understanding should be used
            var extractionMethod = _configuration["DSM5_EXTRACTION_METHOD"];
            var useContentUnderstanding = extractionMethod?.Equals("CONTENT_UNDERSTANDING", StringComparison.OrdinalIgnoreCase) == true;

            List<DSM5ConditionData> extractedConditions;

            if (useContentUnderstanding && _contentUnderstandingService != null)
            {
                _logger.LogInformation("[{MethodName}] Using Azure Content Understanding for extraction", nameof(ExtractDiagnosticCriteriaAsync));

                // Parse page ranges
                int startPage = 1;
                int? endPage = null;
                if (!string.IsNullOrEmpty(pageRanges))
                {
                    var parts = pageRanges.Split('-');
                    if (parts.Length == 2)
                    {
                        int.TryParse(parts[0], out startPage);
                        if (int.TryParse(parts[1], out var end))
                        {
                            endPage = end;
                        }
                    }
                }

                // Use Content Understanding for extraction
                extractedConditions = await _contentUnderstandingService.ExtractDSM5ConditionsAsync(
                    pdfBytes,
                    startPage,
                    endPage);

                _logger.LogInformation("[{MethodName}] Content Understanding extracted {ConditionCount} conditions",
                    nameof(ExtractDiagnosticCriteriaAsync), extractedConditions.Count);
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

                // Step 1: Analyze the PDF with Document Intelligence
                var analyzeRequest = new AnalyzeDocumentContent
                {
                    Base64Source = BinaryData.FromBytes(pdfBytes)
                };

                var operation = await _documentClient.AnalyzeDocumentAsync(
                    WaitUntil.Completed,
                    "prebuilt-layout", // Use layout model for structured text extraction
                    analyzeRequest);

                if (!operation.HasCompleted || operation.Value == null)
                {
                    throw new InvalidOperationException("Document analysis did not complete successfully");
                }

                var result = operation.Value;
                _logger.LogInformation("[{MethodName}] Document analysis completed. Pages: {PageCount}",
                    nameof(ExtractDiagnosticCriteriaAsync), result.Pages?.Count ?? 0);

                // Step 2: Parse the document structure to extract DSM-5 conditions
                extractedConditions = await ParseDSM5ConditionsFromDocumentAsync(result, pageRanges);
            }

            _logger.LogInformation("[{MethodName}] Extracted {ConditionCount} conditions from DSM-5",
                nameof(ExtractDiagnosticCriteriaAsync), extractedConditions.Count);

            // Step 3: Optionally upload to blob storage
            string? blobPath = null;
            if (autoUpload && extractedConditions.Any())
            {
                var uploadResult = await UploadConditionsToStorageAsync(extractedConditions, overwriteExisting: false);
                if (uploadResult.Success)
                {
                    blobPath = uploadResult.BlobPaths.FirstOrDefault();
                }
            }

            stopwatch.Stop();

            // Calculate total pages processed (estimate from conditions if Content Understanding was used)
            int pagesProcessed = extractedConditions.Sum(c => c.PageNumbers?.Count ?? 1);

            return new DSM5ExtractionResult
            {
                Success = true,
                ExtractedConditions = extractedConditions,
                PagesProcessed = pagesProcessed,
                ProcessingTimeMs = stopwatch.ElapsedMilliseconds,
                UploadedToStorage = autoUpload && !string.IsNullOrEmpty(blobPath),
                BlobPath = blobPath
            };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "[{MethodName}] Error extracting DSM-5 data from PDF: {PdfUrl}",
                nameof(ExtractDiagnosticCriteriaAsync), pdfUrl);

            return new DSM5ExtractionResult
            {
                Success = false,
                ErrorMessage = ex.Message,
                ProcessingTimeMs = stopwatch.ElapsedMilliseconds
            };
        }
    }

    public async Task<List<DSM5ConditionData>> GetAvailableConditionsAsync(string? category = null, string? searchTerm = null, bool includeDetails = false)
    {
        try
        {
            _logger.LogInformation("[{MethodName}] Getting available DSM-5 conditions. Category: {Category}, Search: {SearchTerm}",
                nameof(GetAvailableConditionsAsync), category, searchTerm);

            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            var conditions = new List<DSM5ConditionData>();

            // Get all condition blobs
            await foreach (var blobItem in containerClient.GetBlobsAsync(prefix: $"{CONDITIONS_FOLDER}/"))
            {
                try
                {
                    var blobClient = containerClient.GetBlobClient(blobItem.Name);
                    var content = await blobClient.DownloadContentAsync();
                    var conditionData = JsonSerializer.Deserialize<DSM5ConditionData>(content.Value.Content.ToString(), _jsonOptions);

                    if (conditionData != null)
                    {
                        // Apply filters
                        if (!string.IsNullOrEmpty(category) && !conditionData.Category.Contains(category, StringComparison.OrdinalIgnoreCase))
                            continue;

                        if (!string.IsNullOrEmpty(searchTerm) &&
                            !conditionData.Name.Contains(searchTerm, StringComparison.OrdinalIgnoreCase) &&
                            !conditionData.Description.Contains(searchTerm, StringComparison.OrdinalIgnoreCase))
                            continue;

                        // Remove detailed criteria if not requested
                        if (!includeDetails)
                        {
                            conditionData.DiagnosticCriteria = new List<DSM5DiagnosticCriterion>();
                        }

                        conditions.Add(conditionData);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[{MethodName}] Error reading condition blob: {BlobName}",
                        nameof(GetAvailableConditionsAsync), blobItem.Name);
                }
            }

            _logger.LogInformation("[{MethodName}] Retrieved {ConditionCount} DSM-5 conditions",
                nameof(GetAvailableConditionsAsync), conditions.Count);

            return conditions.OrderBy(c => c.Name).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error getting available DSM-5 conditions",
                nameof(GetAvailableConditionsAsync));
            return new List<DSM5ConditionData>();
        }
    }

    public async Task<DSM5ConditionData?> GetConditionDetailsAsync(string conditionId)
    {
        try
        {
            _logger.LogInformation("[{MethodName}] Getting condition details for: {ConditionId}",
                nameof(GetConditionDetailsAsync), conditionId);

            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            var blobName = $"{CONDITIONS_FOLDER}/{conditionId}.json";
            var blobClient = containerClient.GetBlobClient(blobName);

            if (await blobClient.ExistsAsync())
            {
                var content = await blobClient.DownloadContentAsync();
                var conditionData = JsonSerializer.Deserialize<DSM5ConditionData>(content.Value.Content.ToString(), _jsonOptions);

                _logger.LogInformation("[{MethodName}] Found condition details for: {ConditionId}",
                    nameof(GetConditionDetailsAsync), conditionId);

                return conditionData;
            }

            _logger.LogInformation("[{MethodName}] Condition not found: {ConditionId}",
                nameof(GetConditionDetailsAsync), conditionId);

            return null;
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
            _logger.LogInformation("[{MethodName}] Uploading {ConditionCount} conditions to blob storage",
                nameof(UploadConditionsToStorageAsync), conditions.Count);

            await EnsureContainerExistsAsync();
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);

            var uploadedCount = 0;
            var skippedCount = 0;
            var updatedCount = 0;
            var blobPaths = new List<string>();

            foreach (var condition in conditions)
            {
                try
                {
                    var blobName = $"{CONDITIONS_FOLDER}/{condition.Id}.json";
                    var blobClient = containerClient.GetBlobClient(blobName);

                    // Check if blob exists
                    var exists = await blobClient.ExistsAsync();

                    if (exists && !overwriteExisting)
                    {
                        skippedCount++;
                        continue;
                    }

                    // Upload the condition data
                    var jsonContent = JsonSerializer.Serialize(condition, _jsonOptions);
                    var binaryData = BinaryData.FromString(jsonContent);

                    await blobClient.UploadAsync(binaryData, overwrite: overwriteExisting);

                    // Set metadata
                    var metadata = new Dictionary<string, string>
                    {
                        ["condition_name"] = condition.Name,
                        ["condition_code"] = condition.Code,
                        ["category"] = condition.Category,
                        ["uploaded_at"] = DateTime.UtcNow.ToString("O")
                    };
                    await blobClient.SetMetadataAsync(metadata);

                    blobPaths.Add(blobName);

                    if (exists)
                        updatedCount++;
                    else
                        uploadedCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[{MethodName}] Error uploading condition: {ConditionId}",
                        nameof(UploadConditionsToStorageAsync), condition.Id);
                }
            }

            stopwatch.Stop();

            _logger.LogInformation("[{MethodName}] Upload completed. Uploaded: {UploadedCount}, Updated: {UpdatedCount}, Skipped: {SkippedCount}",
                nameof(UploadConditionsToStorageAsync), uploadedCount, updatedCount, skippedCount);

            return new DSM5UploadResult
            {
                Success = true,
                UploadedCount = uploadedCount,
                UpdatedCount = updatedCount,
                SkippedCount = skippedCount,
                BlobPaths = blobPaths,
                ProcessingTimeMs = stopwatch.ElapsedMilliseconds
            };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "[{MethodName}] Error uploading conditions to storage",
                nameof(UploadConditionsToStorageAsync));

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
            _logger.LogInformation("[{MethodName}] Getting DSM-5 data status", nameof(GetDataStatusAsync));

            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            var containerExists = await containerClient.ExistsAsync();

            if (!containerExists)
            {
                return new DSM5DataStatus
                {
                    IsInitialized = false,
                    ContainerExists = false
                };
            }

            var totalConditions = 0;
            var availableConditions = 0;
            var categories = new HashSet<string>();
            var totalSize = 0L;
            var blobCount = 0;
            DateTime? lastUpdated = null;

            await foreach (var blobItem in containerClient.GetBlobsAsync(prefix: $"{CONDITIONS_FOLDER}/"))
            {
                blobCount++;
                totalSize += blobItem.Properties.ContentLength ?? 0;

                if (blobItem.Properties.LastModified.HasValue)
                {
                    var modified = blobItem.Properties.LastModified.Value.DateTime;
                    if (!lastUpdated.HasValue || modified > lastUpdated.Value)
                    {
                        lastUpdated = modified;
                    }
                }

                try
                {
                    var blobClient = containerClient.GetBlobClient(blobItem.Name);
                    var properties = await blobClient.GetPropertiesAsync();

                    if (properties.Value.Metadata.TryGetValue("category", out var category))
                    {
                        categories.Add(category);
                    }

                    totalConditions++;

                    // Assume all are available for now - could add more sophisticated logic
                    availableConditions++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[{MethodName}] Error reading blob metadata: {BlobName}",
                        nameof(GetDataStatusAsync), blobItem.Name);
                }
            }

            return new DSM5DataStatus
            {
                IsInitialized = totalConditions > 0,
                TotalConditions = totalConditions,
                AvailableConditions = availableConditions,
                Categories = categories.ToList(),
                LastUpdated = lastUpdated,
                DataVersion = "1.0",
                ContainerExists = true,
                TotalBlobSizeBytes = totalSize,
                BlobCount = blobCount
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

            var result = new Dictionary<string, DSM5ConditionData>();
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);

            foreach (var conditionId in conditionIds)
            {
                var condition = await GetConditionDetailsAsync(conditionId);
                if (condition != null)
                {
                    result[conditionId] = condition;
                }
            }

            _logger.LogInformation("[{MethodName}] Retrieved {FoundCount}/{RequestedCount} conditions for assessment",
                nameof(GetConditionsForAssessmentAsync), result.Count, conditionIds.Count);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error getting conditions for assessment",
                nameof(GetConditionsForAssessmentAsync));
            return new Dictionary<string, DSM5ConditionData>();
        }
    }

    #region Private Helper Methods

    private async Task EnsureContainerExistsAsync()
    {
        try
        {
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error ensuring container exists: {ContainerName}",
                nameof(EnsureContainerExistsAsync), _containerName);
        }
    }

    private async Task<byte[]> DownloadPdfAsBytesAsync(string pdfUrl)
    {
        using var httpClient = new HttpClient();
        return await httpClient.GetByteArrayAsync(pdfUrl);
    }

    private async Task<List<DSM5ConditionData>> ParseDSM5ConditionsFromDocumentAsync(AnalyzeResult documentResult, string? pageRanges = null)
    {
        var conditions = new List<DSM5ConditionData>();

        try
        {
            _logger.LogInformation("[{MethodName}] Parsing DSM-5 conditions from document with {PageCount} pages",
                nameof(ParseDSM5ConditionsFromDocumentAsync), documentResult.Pages?.Count ?? 0);

            // Parse page ranges if specified
            var pagesToProcess = ParsePageRanges(pageRanges, documentResult.Pages?.Count ?? 0);

            foreach (var page in documentResult.Pages ?? new List<DocumentPage>())
            {
                // Skip pages not in specified ranges
                if (pagesToProcess.Any() && !pagesToProcess.Contains(page.PageNumber))
                    continue;

                var pageConditions = await ParseConditionsFromPageAsync(page);
                conditions.AddRange(pageConditions);
            }

            // Remove duplicates and merge related conditions
            conditions = DeduplicateAndMergeConditions(conditions);

            _logger.LogInformation("[{MethodName}] Parsed {ConditionCount} unique conditions from document",
                nameof(ParseDSM5ConditionsFromDocumentAsync), conditions.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error parsing DSM-5 conditions from document",
                nameof(ParseDSM5ConditionsFromDocumentAsync));
        }

        return conditions;
    }

    private async Task<List<DSM5ConditionData>> ParseConditionsFromPageAsync(DocumentPage page)
    {
        var conditions = new List<DSM5ConditionData>();

        try
        {
            // This is a simplified parsing logic - in a real implementation,
            // you would need sophisticated pattern matching to extract DSM-5 structure

            var pageText = ExtractTextFromPage(page);

            // Look for DSM-5 diagnostic code patterns (e.g., "295.90 (F20.9)")
            var codePattern = @"(\d{3}\.\d{2})\s*\(([F-Z]\d{2}\.\d+)\)";
            var codeMatches = Regex.Matches(pageText, codePattern);

            foreach (Match match in codeMatches)
            {
                var condition = await ExtractConditionFromTextAsync(pageText, match, page.PageNumber);
                if (condition != null)
                {
                    conditions.Add(condition);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[{MethodName}] Error parsing conditions from page {PageNumber}",
                nameof(ParseConditionsFromPageAsync), page.PageNumber);
        }

        return conditions;
    }

    private string ExtractTextFromPage(DocumentPage page)
    {
        // Extract text from lines in the page
        var textLines = new List<string>();

        foreach (var line in page.Lines ?? new List<DocumentLine>())
        {
            textLines.Add(line.Content ?? string.Empty);
        }

        return string.Join("\n", textLines);
    }

    private async Task<DSM5ConditionData?> ExtractConditionFromTextAsync(string pageText, Match codeMatch, int pageNumber)
    {
        try
        {
            // This is a simplified extraction - real implementation would need
            // sophisticated NLP and pattern matching

            var dsmCode = codeMatch.Groups[1].Value;
            var icdCode = codeMatch.Groups[2].Value;
            var fullCode = $"{dsmCode} ({icdCode})";

            // Extract condition name (usually appears before the code)
            var beforeCode = pageText.Substring(0, codeMatch.Index);
            var lines = beforeCode.Split('\n');
            var conditionName = lines.LastOrDefault(l => !string.IsNullOrWhiteSpace(l))?.Trim() ?? "Unknown Condition";

            // Create condition with basic information
            var condition = new DSM5ConditionData
            {
                Id = conditionName.ToLowerInvariant().Replace(" ", "-").Replace("'", ""),
                Name = conditionName,
                Code = fullCode,
                Description = $"Mental health condition extracted from DSM-5 (page {pageNumber})",
                PageNumbers = new List<int> { pageNumber },
                LastUpdated = DateTime.UtcNow,
                ExtractionMetadata = new DSM5ExtractionMetadata
                {
                    ExtractedAt = DateTime.UtcNow,
                    PageRanges = pageNumber.ToString(),
                    ConfidenceScore = 0.8, // Placeholder - would be calculated in real implementation
                    ExtractionVersion = "1.0",
                    Notes = new List<string> { "Extracted using basic pattern matching" }
                }
            };

            // TODO: Extract diagnostic criteria, category, etc. using more sophisticated parsing

            return condition;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[{MethodName}] Error extracting condition from code match on page {PageNumber}",
                nameof(ExtractConditionFromTextAsync), pageNumber);
            return null;
        }
    }

    private List<int> ParsePageRanges(string? pageRanges, int totalPages)
    {
        var pages = new List<int>();

        if (string.IsNullOrEmpty(pageRanges))
        {
            return pages; // Return empty to process all pages
        }

        var ranges = pageRanges.Split(',', StringSplitOptions.RemoveEmptyEntries);

        foreach (var range in ranges)
        {
            if (range.Contains('-'))
            {
                var parts = range.Split('-');
                if (parts.Length == 2 &&
                    int.TryParse(parts[0].Trim(), out var start) &&
                    int.TryParse(parts[1].Trim(), out var end))
                {
                    for (int i = start; i <= end; i++)
                    {
                        if (i > 0 && i <= totalPages)
                        {
                            pages.Add(i);
                        }
                    }
                }
            }
            else if (int.TryParse(range.Trim(), out var page))
            {
                if (page > 0 && page <= totalPages)
                {
                    pages.Add(page);
                }
            }
        }

        return pages.Distinct().OrderBy(p => p).ToList();
    }

    private List<DSM5ConditionData> DeduplicateAndMergeConditions(List<DSM5ConditionData> conditions)
    {
        // Group by name and merge duplicates
        var grouped = conditions.GroupBy(c => c.Name);
        var merged = new List<DSM5ConditionData>();

        foreach (var group in grouped)
        {
            if (group.Count() == 1)
            {
                merged.Add(group.First());
            }
            else
            {
                // Merge multiple instances of the same condition
                var primary = group.First();
                foreach (var duplicate in group.Skip(1))
                {
                    primary.PageNumbers.AddRange(duplicate.PageNumbers);
                    // Merge other properties as needed
                }
                primary.PageNumbers = primary.PageNumbers.Distinct().OrderBy(p => p).ToList();
                merged.Add(primary);
            }
        }

        return merged;
    }

    #endregion
}
