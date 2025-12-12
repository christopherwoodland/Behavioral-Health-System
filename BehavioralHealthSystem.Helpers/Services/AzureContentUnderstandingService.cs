using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Azure.Core;
using Azure.Identity;
using Azure.Storage.Blobs;
using Azure.Storage.Sas;
using Microsoft.Extensions.Logging;

namespace BehavioralHealthSystem.Helpers.Services;

/// <summary>
/// Azure Content Understanding service for structured document extraction
/// Specifically configured for DSM-5 mental health disorder extraction
/// </summary>
public class AzureContentUnderstandingService : IAzureContentUnderstandingService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<AzureContentUnderstandingService> _logger;
    private readonly string _endpoint;
    private readonly string? _apiKey;
    private readonly TokenCredential? _credential;
    private readonly BlobServiceClient? _blobServiceClient;
    private const string TempContainerName = "dsm5-temp-uploads";

    // DSM-5 section names for validation
    private static readonly string[] DSM5Sections = new[]
    {
        "diagnosticCriteria",
        "diagnosticFeatures",
        "associatedFeatures",
        "prevalence",
        "developmentAndCourse",
        "riskAndPrognosticFactors",
        "cultureRelatedIssues",
        "genderRelatedIssues",
        "suicideRisk",
        "functionalConsequences",
        "differentialDiagnosis",
        "comorbidity",
        "specifiers"
    };

    public AzureContentUnderstandingService(
        ILogger<AzureContentUnderstandingService> logger,
        IConfiguration configuration)
    {
        _logger = logger;
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromMinutes(10) // Long timeout for large documents
        };

        // Get configuration
        _endpoint = configuration["AZURE_CONTENT_UNDERSTANDING_ENDPOINT"]
            ?? throw new InvalidOperationException("AZURE_CONTENT_UNDERSTANDING_ENDPOINT not configured");

        // Support both API key (local) and Managed Identity (production)
        _apiKey = configuration["AZURE_CONTENT_UNDERSTANDING_KEY"];

        if (string.IsNullOrEmpty(_apiKey))
        {
            _logger.LogInformation("Using Managed Identity for Content Understanding authentication");
            _credential = new DefaultAzureCredential();
        }
        else
        {
            _logger.LogInformation("Using API key for Content Understanding authentication");
        }

        // Initialize blob storage client for temporary PDF uploads
        var storageAccountName = configuration["AZURE_STORAGE_ACCOUNT_NAME"] ?? configuration["DSM5_STORAGE_ACCOUNT_NAME"];

        if (!string.IsNullOrEmpty(storageAccountName))
        {
            var blobServiceUri = $"https://{storageAccountName}.blob.core.windows.net";
            _blobServiceClient = new BlobServiceClient(new Uri(blobServiceUri), new DefaultAzureCredential());
            _logger.LogInformation("Using Managed Identity for Blob Storage");
        }
        else
        {
            _logger.LogWarning("No blob storage configured - will not be able to upload PDFs");
        }
    }

    public async Task<List<DSM5ConditionData>> ExtractDSM5ConditionsAsync(
        byte[] pdfData,
        int startPage = 1,
        int? endPage = null)
    {
        try
        {
            _logger.LogInformation(
                "[{MethodName}] Starting DSM-5 extraction from pages {StartPage} to {EndPage}",
                nameof(ExtractDSM5ConditionsAsync), startPage, endPage?.ToString() ?? "end");

            // Note: schema parameter is not used in Content Understanding (prebuilt-documentAnalyzer doesn't need schema)
            var result = await AnalyzeDocumentAsync(pdfData, null, startPage, endPage);

            var conditions = ParseExtractionResult(result);

            _logger.LogInformation(
                "[{MethodName}] Extracted {ConditionCount} conditions",
                nameof(ExtractDSM5ConditionsAsync), conditions.Count);

            return conditions;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error extracting DSM-5 conditions",
                nameof(ExtractDSM5ConditionsAsync));
            throw;
        }
    }

    public async Task<DSM5ConditionData?> ExtractSingleConditionAsync(
        byte[] pdfData,
        string conditionName,
        List<int> pageNumbers)
    {
        try
        {
            _logger.LogInformation(
                "[{MethodName}] Extracting condition '{Condition}' from {PageCount} pages",
                nameof(ExtractSingleConditionAsync), conditionName, pageNumbers.Count);

            // Note: schema parameter is not used in Content Understanding (prebuilt-documentAnalyzer doesn't need schema)
            // Extract only specified pages
            var startPage = pageNumbers.Min();
            var endPage = pageNumbers.Max();

            var result = await AnalyzeDocumentAsync(pdfData, null, startPage, endPage);
            var conditions = ParseExtractionResult(result);

            var condition = conditions.FirstOrDefault(c =>
                c.Name.Equals(conditionName, StringComparison.OrdinalIgnoreCase));

            if (condition == null)
            {
                _logger.LogWarning(
                    "[{MethodName}] Condition '{Condition}' not found in extraction result",
                    nameof(ExtractSingleConditionAsync), conditionName);
            }

            return condition;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "[{MethodName}] Error extracting single condition '{Condition}'",
                nameof(ExtractSingleConditionAsync), conditionName);
            throw;
        }
    }

    public Task<DSM5ValidationResult> ValidateExtractionAsync(DSM5ConditionData condition)
    {
        var result = new DSM5ValidationResult
        {
            IsValid = true,
            QualityScore = 1.0
        };

        try
        {
            // Check required fields
            if (string.IsNullOrWhiteSpace(condition.Name))
            {
                result.Issues.Add("Missing condition name");
                result.IsValid = false;
                result.QualityScore -= 0.3;
            }

            if (string.IsNullOrWhiteSpace(condition.Code))
            {
                result.Issues.Add("Missing DSM-5 code");
                result.IsValid = false;
                result.QualityScore -= 0.2;
            }

            if (!condition.DiagnosticCriteria.Any())
            {
                result.Issues.Add("Missing diagnostic criteria (Section 1)");
                result.IsValid = false;
                result.QualityScore -= 0.3;
            }
            else
            {
                result.CompleteSections.Add("diagnosticCriteria");
            }

            // Check optional sections
            if (!string.IsNullOrWhiteSpace(condition.DiagnosticFeatures))
                result.CompleteSections.Add("diagnosticFeatures");
            else
                result.IncompleteSections.Add("diagnosticFeatures");

            if (!string.IsNullOrWhiteSpace(condition.AssociatedFeatures))
                result.CompleteSections.Add("associatedFeatures");
            else
                result.IncompleteSections.Add("associatedFeatures");

            if (!string.IsNullOrWhiteSpace(condition.Prevalence))
                result.CompleteSections.Add("prevalence");
            else
                result.IncompleteSections.Add("prevalence");

            if (!string.IsNullOrWhiteSpace(condition.DevelopmentAndCourse))
                result.CompleteSections.Add("developmentAndCourse");
            else
                result.IncompleteSections.Add("developmentAndCourse");

            if (condition.RiskAndPrognosticFactors != null)
                result.CompleteSections.Add("riskAndPrognosticFactors");
            else
                result.IncompleteSections.Add("riskAndPrognosticFactors");

            if (!string.IsNullOrWhiteSpace(condition.CultureRelatedIssues))
                result.CompleteSections.Add("cultureRelatedIssues");
            else
                result.IncompleteSections.Add("cultureRelatedIssues");

            if (!string.IsNullOrWhiteSpace(condition.GenderRelatedIssues))
                result.CompleteSections.Add("genderRelatedIssues");
            else
                result.IncompleteSections.Add("genderRelatedIssues");

            if (!string.IsNullOrWhiteSpace(condition.SuicideRisk))
                result.CompleteSections.Add("suicideRisk");
            else
                result.Warnings.Add("Suicide Risk section not present (may be expected for some disorders)");

            if (!string.IsNullOrWhiteSpace(condition.FunctionalConsequences))
                result.CompleteSections.Add("functionalConsequences");
            else
                result.IncompleteSections.Add("functionalConsequences");

            if (condition.DifferentialDiagnosis.Any())
                result.CompleteSections.Add("differentialDiagnosis");
            else
                result.IncompleteSections.Add("differentialDiagnosis");

            if (!string.IsNullOrWhiteSpace(condition.Comorbidity))
                result.CompleteSections.Add("comorbidity");
            else
                result.IncompleteSections.Add("comorbidity");

            if (condition.Specifiers.Any())
                result.CompleteSections.Add("specifiers");
            else
                result.IncompleteSections.Add("specifiers");

            // Calculate quality score based on completeness
            var expectedSections = DSM5Sections.Length;
            var completeSections = result.CompleteSections.Count;
            var completionRatio = (double)completeSections / expectedSections;

            // Adjust quality score
            result.QualityScore = Math.Max(0, Math.Min(1.0, completionRatio));

            // Add warnings for missing common sections
            if (result.IncompleteSections.Count > 7)
            {
                result.Warnings.Add($"Many sections missing ({result.IncompleteSections.Count}/13) - extraction may be incomplete");
            }

            _logger.LogInformation(
                "[{MethodName}] Validation complete for '{Condition}': Valid={IsValid}, Score={Score:F2}, Complete={Complete}/13",
                nameof(ValidateExtractionAsync), condition.Name, result.IsValid, result.QualityScore, completeSections);

            return Task.FromResult(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error validating extraction for '{Condition}'",
                nameof(ValidateExtractionAsync), condition.Name);
            throw;
        }
    }

    #region Private Helper Methods

    private async Task<string> UploadPdfToBlobAsync(byte[] pdfData)
    {
        if (_blobServiceClient == null)
        {
            throw new InvalidOperationException("Blob storage is not configured. Set AZURE_STORAGE_ACCOUNT_NAME.");
        }

        try
        {
            // Get or create the temporary container
            var containerClient = _blobServiceClient.GetBlobContainerClient(TempContainerName);
            await containerClient.CreateIfNotExistsAsync();

            // Generate a unique blob name with timestamp
            var blobName = $"dsm5-extract-{Guid.NewGuid()}-{DateTime.UtcNow:yyyyMMddHHmmss}.pdf";
            var blobClient = containerClient.GetBlobClient(blobName);

            // Upload the PDF
            using var stream = new MemoryStream(pdfData);
            await blobClient.UploadAsync(stream, overwrite: true);

            _logger.LogInformation("[{MethodName}] Uploaded PDF to blob: {BlobName} ({Size} bytes)",
                nameof(UploadPdfToBlobAsync), blobName, pdfData.Length);

            // Generate a SAS URL valid for 2 hours
            var sasBuilder = new BlobSasBuilder
            {
                BlobContainerName = TempContainerName,
                BlobName = blobName,
                Resource = "b",
                StartsOn = DateTimeOffset.UtcNow.AddMinutes(-5),
                ExpiresOn = DateTimeOffset.UtcNow.AddHours(2)
            };
            sasBuilder.SetPermissions(BlobSasPermissions.Read);

            // Get the SAS token and build the full URL
            var sasToken = blobClient.GenerateSasUri(sasBuilder).Query;
            var blobUrl = $"{blobClient.Uri}{sasToken}";

            _logger.LogInformation("[{MethodName}] Generated SAS URL (expires in 2 hours)",
                nameof(UploadPdfToBlobAsync));

            return blobUrl;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Failed to upload PDF to blob storage",
                nameof(UploadPdfToBlobAsync));
            throw;
        }
    }

    private async Task<JsonElement> AnalyzeDocumentAsync(
        byte[] pdfData,
        object schema,
        int startPage,
        int? endPage)
    {
        try
        {
            // Azure AI Content Understanding API
            // Using prebuilt-documentAnalyzer to extract document content

            var pageRange = endPage.HasValue ? $"{startPage}-{endPage.Value}" : $"{startPage}-";

            // Azure Content Understanding API requires a URL, not base64 data
            // Upload the PDF to blob storage and get a SAS URL
            var blobUrl = await UploadPdfToBlobAsync(pdfData);

            // Build the analyze request according to Azure Content Understanding API spec
            // Request body format: { "url": "https://..." }
            var request = new
            {
                url = blobUrl
            };

            var jsonContent = JsonSerializer.Serialize(request, new JsonSerializerOptions
            {
                WriteIndented = false,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            var httpContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            // Clear and set authentication headers
            _httpClient.DefaultRequestHeaders.Remove("Ocp-Apim-Subscription-Key");
            _httpClient.DefaultRequestHeaders.Authorization = null;

            if (!string.IsNullOrEmpty(_apiKey))
            {
                _httpClient.DefaultRequestHeaders.Add("Ocp-Apim-Subscription-Key", _apiKey);
                _logger.LogInformation("[{MethodName}] Using API key authentication", nameof(AnalyzeDocumentAsync));
            }
            else if (_credential != null)
            {
                // Get fresh token each time to avoid expiration issues during long operations
                var token = await _credential.GetTokenAsync(
                    new TokenRequestContext(new[] { "https://cognitiveservices.azure.com/.default" }),
                    CancellationToken.None);
                _httpClient.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", token.Token);
                _logger.LogInformation("[{MethodName}] Using Managed Identity authentication (token refreshed)", nameof(AnalyzeDocumentAsync));
            }

            // Call Azure Content Understanding API with prebuilt-documentAnalyzer
            var baseEndpoint = _endpoint.TrimEnd('/');
            var analyzerId = "prebuilt-documentAnalyzer";
            var url = $"{baseEndpoint}/contentunderstanding/analyzers/{analyzerId}:analyze?api-version=2025-05-01-preview";

            _logger.LogInformation("[{MethodName}] Calling Azure Content Understanding API", nameof(AnalyzeDocumentAsync));
            _logger.LogInformation("[{MethodName}] URL: {Url}", nameof(AnalyzeDocumentAsync), url);
            _logger.LogInformation("[{MethodName}] Pages: {Pages}", nameof(AnalyzeDocumentAsync), pageRange);
            _logger.LogInformation("[{MethodName}] Analyzer: {Analyzer}", nameof(AnalyzeDocumentAsync), analyzerId);

            var response = await CallWithRetryAsync(async () => await _httpClient.PostAsync(url, httpContent));

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogError("[{MethodName}] API returned {StatusCode}: {Error}",
                    nameof(AnalyzeDocumentAsync), response.StatusCode, errorContent);
                throw new HttpRequestException(
                    $"Azure Content Understanding API returned {response.StatusCode}: {errorContent}");
            }

            // Azure Content Understanding returns 202 Accepted with Operation-Location header
            if (response.StatusCode == System.Net.HttpStatusCode.Accepted &&
                response.Headers.Contains("Operation-Location"))
            {
                var operationLocation = response.Headers.GetValues("Operation-Location").FirstOrDefault();
                _logger.LogInformation("[{MethodName}] Long-running operation started: {Location}",
                    nameof(AnalyzeDocumentAsync), operationLocation);

                // Poll the operation until complete
                return await PollOperationAsync(operationLocation!);
            }

            // If not a long-running operation, parse the response directly
            var responseContent = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<JsonElement>(responseContent);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error calling Azure Content Understanding API",
                nameof(AnalyzeDocumentAsync));
            throw;
        }
    }

    private async Task<JsonElement> PollOperationAsync(string operationUrl)
    {
        var maxAttempts = 120; // 10 minutes max (5 second intervals)
        var attempt = 0;

        while (attempt < maxAttempts)
        {
            await Task.Delay(5000); // Wait 5 seconds between polls
            attempt++;

            _logger.LogInformation("[{MethodName}] Polling operation status (attempt {Attempt}/{Max})",
                nameof(PollOperationAsync), attempt, maxAttempts);

            var response = await CallWithRetryAsync(async () => await _httpClient.GetAsync(operationUrl));

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                throw new HttpRequestException($"Operation polling failed: {response.StatusCode} - {errorContent}");
            }

            var content = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<JsonElement>(content);

            // Azure Content Understanding response format: { "id": "...", "status": "Succeeded|Running|Failed", "result": {...} }
            if (result.TryGetProperty("status", out var status))
            {
                var statusValue = status.GetString();
                _logger.LogInformation("[{MethodName}] Operation status: {Status}",
                    nameof(PollOperationAsync), statusValue);

                // Content Understanding uses "Succeeded" (capital S), not "succeeded"
                if (statusValue == "Succeeded")
                {
                    _logger.LogInformation("[{MethodName}] Operation completed successfully",
                        nameof(PollOperationAsync));
                    return result;
                }
                else if (statusValue == "Failed")
                {
                    var error = result.TryGetProperty("error", out var err)
                        ? err.ToString()
                        : "Unknown error";
                    throw new InvalidOperationException($"Content Understanding analysis failed: {error}");
                }
                // Status is "Running" or "NotStarted", continue polling
            }
        }

        throw new TimeoutException("Content Understanding operation timed out after 10 minutes");
    }

    /// <summary>
    /// Calls HTTP request with retry logic for network failures
    /// </summary>
    private async Task<HttpResponseMessage> CallWithRetryAsync(Func<Task<HttpResponseMessage>> httpCall)
    {
        var maxRetries = 3;
        var baseDelay = TimeSpan.FromSeconds(2);

        for (int attempt = 1; attempt <= maxRetries; attempt++)
        {
            try
            {
                _logger.LogInformation("[{MethodName}] HTTP call attempt {Attempt}/{MaxRetries}",
                    nameof(CallWithRetryAsync), attempt, maxRetries);

                return await httpCall();
            }
            catch (HttpRequestException ex) when (attempt < maxRetries)
            {
                var delay = TimeSpan.FromMilliseconds(baseDelay.TotalMilliseconds * Math.Pow(2, attempt - 1));

                _logger.LogWarning("[{MethodName}] HTTP call failed on attempt {Attempt}/{MaxRetries}: {Error}. Retrying in {Delay}ms",
                    nameof(CallWithRetryAsync), attempt, maxRetries, ex.Message, delay.TotalMilliseconds);

                await Task.Delay(delay);
            }
            catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException && attempt < maxRetries)
            {
                var delay = TimeSpan.FromMilliseconds(baseDelay.TotalMilliseconds * Math.Pow(2, attempt - 1));

                _logger.LogWarning("[{MethodName}] HTTP call timed out on attempt {Attempt}/{MaxRetries}. Retrying in {Delay}ms",
                    nameof(CallWithRetryAsync), attempt, maxRetries, delay.TotalMilliseconds);

                await Task.Delay(delay);
            }
        }

        // Final attempt without catching exceptions
        _logger.LogInformation("[{MethodName}] Final HTTP call attempt {Attempt}/{MaxRetries}",
            nameof(CallWithRetryAsync), maxRetries, maxRetries);
        return await httpCall();
    }

    // ==================== CONTENT UNDERSTANDING MARKDOWN PARSING ====================
    // The following methods parse DSM-5 conditions from Azure Content Understanding markdown output

    private List<DSM5ConditionData> ParseExtractionResult(JsonElement result)
    {
        var conditions = new List<DSM5ConditionData>();

        try
        {
            // Azure Content Understanding response structure:
            // { "id": "...", "status": "Succeeded", "result": { "analyzerId": "...", "contents": [...] } }

            if (!result.TryGetProperty("result", out var resultData))
            {
                _logger.LogWarning("[{MethodName}] No result property in response", nameof(ParseExtractionResult));
                return conditions;
            }

            if (!resultData.TryGetProperty("contents", out var contents))
            {
                _logger.LogWarning("[{MethodName}] No contents array in result", nameof(ParseExtractionResult));
                return conditions;
            }

            if (contents.GetArrayLength() == 0)
            {
                _logger.LogWarning("[{MethodName}] Contents array is empty", nameof(ParseExtractionResult));
                return conditions;
            }

            // Get the first content item (document content)
            var content = contents[0];

            // Extract markdown text for parsing
            string? markdownText = null;
            if (content.TryGetProperty("markdown", out var markdown))
            {
                markdownText = markdown.GetString();
                _logger.LogInformation("[{MethodName}] Extracted markdown text: {Length} characters",
                    nameof(ParseExtractionResult), markdownText?.Length ?? 0);
            }

            if (string.IsNullOrWhiteSpace(markdownText))
            {
                _logger.LogWarning("[{MethodName}] Markdown content is empty or missing", nameof(ParseExtractionResult));
                return conditions;
            }

            // DEBUG: Save markdown to file for inspection
            try
            {
                var debugPath = Path.Combine(Path.GetTempPath(), $"dsm5-markdown-{DateTime.Now:yyyyMMddHHmmss}.md");
                File.WriteAllText(debugPath, markdownText);
                _logger.LogInformation("[{MethodName}] Saved markdown to: {Path}", nameof(ParseExtractionResult), debugPath);
            }
            catch { /* Ignore debug errors */ }

            // Parse DSM-5 conditions from the markdown text
            // Look for condition headers and their associated sections
            conditions = ParseDSM5ConditionsFromMarkdown(markdownText);

            _logger.LogInformation(
                "[{MethodName}] Parsed {ConditionCount} conditions from Content Understanding result",
                nameof(ParseExtractionResult), conditions.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error parsing Content Understanding extraction result",
                nameof(ParseExtractionResult));
        }

        return conditions;
    }

    private List<DSM5ConditionData> ParseDSM5ConditionsFromMarkdown(string markdownText)
    {
        var conditions = new List<DSM5ConditionData>();

        try
        {
            // DSM-5 PDF structure: Each condition typically starts with its name and code
            // Example patterns to look for:
            // - "Major Depressive Disorder 296.23 (F32.1)"
            // - "Schizophrenia 295.90 (F20.9)"

            // Split markdown into sections by looking for condition headers
            // A condition header typically contains both name and a diagnostic code

            // Regex to find condition headers with codes
            // Format: "# Condition Name Code: 292.89 (F16.983)"
            var conditionHeaderPattern = @"(?m)^#{1,3}\s+(.+?)\s+Code:\s*(\d{3}\.\d{1,2})\s+\(([A-Z]\d{2}\.\d+)\)";
            var matches = Regex.Matches(markdownText, conditionHeaderPattern);

            _logger.LogInformation("[{MethodName}] Found {Count} potential condition headers",
                nameof(ParseDSM5ConditionsFromMarkdown), matches.Count);

            for (int i = 0; i < matches.Count; i++)
            {
                var match = matches[i];
                var conditionName = match.Groups[1].Value.Trim();
                var icdCode = match.Groups[2].Value;
                var dsmCode = match.Groups[3].Value;
                var fullCode = $"{icdCode} ({dsmCode})";

                // Extract the text for this condition (from this match to the next match or end)
                int startIndex = match.Index;
                int endIndex = (i < matches.Count - 1) ? matches[i + 1].Index : markdownText.Length;
                string conditionText = markdownText.Substring(startIndex, endIndex - startIndex);

                var condition = ParseSingleConditionFromMarkdown(conditionName, fullCode, conditionText);
                if (condition != null)
                {
                    conditions.Add(condition);
                    _logger.LogInformation("[{MethodName}] Successfully parsed condition: {Name} ({Code})",
                        nameof(ParseDSM5ConditionsFromMarkdown), condition.Name, condition.Code);
                }
            }

            _logger.LogInformation("[{MethodName}] Total conditions parsed: {Count}",
                nameof(ParseDSM5ConditionsFromMarkdown), conditions.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error parsing DSM-5 conditions from markdown",
                nameof(ParseDSM5ConditionsFromMarkdown));
        }

        return conditions;
    }

    private DSM5ConditionData? ParseSingleConditionFromMarkdown(string name, string code, string conditionText)
    {
        try
        {
            var condition = new DSM5ConditionData
            {
                Id = Guid.NewGuid().ToString(),
                LastUpdated = DateTime.UtcNow,
                Name = name,
                Code = code,
                DiagnosticCriteria = new List<DSM5DiagnosticCriterion>(),
                DifferentialDiagnosis = new List<string>(),
                Specifiers = new List<DSM5Specifier>(),
                PresentSections = new List<string>(),
                MissingSections = new List<string>()
            };

            // Extract category from the text if present (usually at the beginning)
            // DSM-5 chapters like "Depressive Disorders", "Anxiety Disorders", etc.
            var categoryPattern = @"(?m)^#{1,2}\s+([A-Z][^#\n]+(?:Disorders?|Conditions?))";
            var categoryMatch = Regex.Match(conditionText, categoryPattern);
            if (categoryMatch.Success)
            {
                condition.Category = categoryMatch.Groups[1].Value.Trim();
            }

            // Section extraction patterns - Updated for Content Understanding OCR output
            // The OCR produces plain text without markdown headers, so we look for section names as plain text
            ExtractSection(conditionText, @"(?i)\bDiagnostic Criteria\b([\s\S]{20,3000}?)(?=\b(?:Diagnostic Features|Prevalence|Development and Course|Risk|Culture|Gender|Suicide|Functional|Differential|Comorbidity|Specifiers)|\z)",
                "Diagnostic Criteria", condition);
            ExtractSection(conditionText, @"(?i)\bDiagnostic Features?\b([\s\S]{20,3000}?)(?=\b(?:Associated Features|Prevalence|Development and Course|Risk|Culture|Gender|Suicide|Functional|Differential|Comorbidity)|\z)",
                "Diagnostic Features", condition);
            ExtractSection(conditionText, @"(?i)\bAssociated Features?[^\n]{0,50}\b([\s\S]{20,3000}?)(?=\b(?:Prevalence|Development and Course|Risk|Culture|Gender|Suicide|Functional|Differential|Comorbidity)|\z)",
                "Associated Features", condition);
            ExtractSection(conditionText, @"(?i)\bPrevalence\b([\s\S]{20,3000}?)(?=\b(?:Development and Course|Risk|Culture|Gender|Suicide|Functional|Differential|Comorbidity)|\z)",
                "Prevalence", condition);
            ExtractSection(conditionText, @"(?i)\b(?:Development and Course|Dirvelopment and Course)\b([\s\S]{20,3000}?)(?=\b(?:Risk|Culture|Gender|Suicide|Functional|Differential|Comorbidity)|\z)",
                "Development and Course", condition);
            ExtractSection(conditionText, @"(?i)\b(?:Risk and Prognostic Factors|Risk and Prognossite Factors)\b([\s\S]{20,3000}?)(?=\b(?:Culture|Gender|Suicide|Functional|Differential|Comorbidity)|\z)",
                "Risk and Prognostic Factors", condition);
            ExtractSection(conditionText, @"(?i)\bCulture[- ]?Related[^\n]{0,30}Issues?\b([\s\S]{20,3000}?)(?=\b(?:Gender|Suicide|Functional|Differential|Comorbidity)|\z)",
                "Culture-Related Diagnostic Issues", condition);
            ExtractSection(conditionText, @"(?i)\b(?:Gender|Sex)[- ]?Related[^\n]{0,30}Issues?\b([\s\S]{20,3000}?)(?=\b(?:Suicide|Functional|Differential|Comorbidity)|\z)",
                "Gender-Related Diagnostic Issues", condition);
            ExtractSection(conditionText, @"(?i)\bSuicide Risk\b([\s\S]{20,3000}?)(?=\b(?:Functional|Differential|Comorbidity)|\z)",
                "Suicide Risk", condition);
            ExtractSection(conditionText, @"(?i)\bFunctional Consequences?[^\n]{0,50}\b([\s\S]{20,3000}?)(?=\b(?:Differential|Comorbidity)|\z)",
                "Functional Consequences", condition);
            ExtractSection(conditionText, @"(?i)\bDifferential Diagnosis\b([\s\S]{20,3000}?)(?=\b(?:Comorbidity)|\z)",
                "Differential Diagnosis", condition);
            ExtractSection(conditionText, @"(?i)\bComorbidity\b([\s\S]{20,3000})(?=\z)",
                "Comorbidity", condition);

            _logger.LogInformation("[{MethodName}] Condition {Name}: Found {Present} sections, missing {Missing}",
                nameof(ParseSingleConditionFromMarkdown), condition.Name,
                condition.PresentSections.Count, condition.MissingSections.Count);

            return condition;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error parsing single condition from markdown",
                nameof(ParseSingleConditionFromMarkdown));
            return null;
        }
    }

    private void ExtractSection(string text, string pattern, string sectionName, DSM5ConditionData condition)
    {
        var match = Regex.Match(text, pattern, RegexOptions.Singleline);
        if (match.Success && match.Groups.Count > 1)
        {
            var content = match.Groups[1].Value.Trim();
            if (!string.IsNullOrWhiteSpace(content))
            {
                // Map section name to DSM5ConditionData property
                switch (sectionName)
                {
                    case "Diagnostic Criteria":
                        condition.DiagnosticCriteria.Add(new DSM5DiagnosticCriterion
                        {
                            CriterionId = "A",
                            Title = sectionName,
                            Description = content
                        });
                        break;
                    case "Diagnostic Features":
                        condition.DiagnosticFeatures = content;
                        break;
                    case "Associated Features":
                        condition.AssociatedFeatures = content;
                        break;
                    case "Prevalence":
                        condition.Prevalence = content;
                        break;
                    case "Development and Course":
                        condition.DevelopmentAndCourse = content;
                        break;
                    case "Risk and Prognostic Factors":
                        // Store the full text; could be parsed into sub-sections later
                        condition.RiskAndPrognosticFactors = new DSM5RiskFactors
                        {
                            Temperamental = content // Store in first available field for now
                        };
                        break;
                    case "Culture-Related Diagnostic Issues":
                        condition.CultureRelatedIssues = content;
                        break;
                    case "Gender-Related Diagnostic Issues":
                        condition.GenderRelatedIssues = content;
                        break;
                    case "Suicide Risk":
                        condition.SuicideRisk = content;
                        break;
                    case "Functional Consequences":
                        condition.FunctionalConsequences = content;
                        break;
                    case "Differential Diagnosis":
                        condition.DifferentialDiagnosis.Add(content);
                        break;
                    case "Comorbidity":
                        condition.Comorbidity = content;
                        break;
                }

                condition.PresentSections.Add(sectionName);
                _logger.LogDebug("[{MethodName}] Section '{Section}': Found {Length} characters",
                    nameof(ExtractSection), sectionName, content.Length);
            }
            else
            {
                condition.MissingSections.Add(sectionName);
            }
        }
        else
        {
            condition.MissingSections.Add(sectionName);
            _logger.LogDebug("[{MethodName}] Section '{Section}': Not found",
                nameof(ExtractSection), sectionName);
        }
    }

    #endregion
}
