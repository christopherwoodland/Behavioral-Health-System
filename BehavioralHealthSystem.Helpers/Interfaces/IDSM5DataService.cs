namespace BehavioralHealthSystem.Services;

/// <summary>
/// Service for managing DSM-5 diagnostic criteria data extraction and storage
/// </summary>
public interface IDSM5DataService
{
    /// <summary>
    /// Extracts diagnostic criteria from DSM-5 PDF using Azure Document Intelligence
    /// </summary>
    /// <param name="pdfUrl">URL of the DSM-5 PDF (HTTP/HTTPS)</param>
    /// <param name="pdfBase64">Base64-encoded PDF data (alternative to pdfUrl)</param>
    /// <param name="pageRanges">Optional page ranges to process (e.g., "123-124,200-205")</param>
    /// <param name="autoUpload">Whether to automatically upload results to blob storage</param>
    /// <returns>Extraction result with structured DSM-5 data</returns>
    Task<DSM5ExtractionResult> ExtractDiagnosticCriteriaAsync(string? pdfUrl = null, string? pdfBase64 = null, string? pageRanges = null, bool autoUpload = false);

    /// <summary>
    /// Gets a list of available DSM-5 conditions from blob storage
    /// </summary>
    /// <param name="category">Optional category filter</param>
    /// <param name="searchTerm">Optional search term</param>
    /// <param name="includeDetails">Whether to include full diagnostic criteria details</param>
    /// <returns>List of available DSM-5 conditions</returns>
    Task<List<DSM5ConditionData>> GetAvailableConditionsAsync(string? category = null, string? searchTerm = null, bool includeDetails = false);

    /// <summary>
    /// Gets detailed information about a specific DSM-5 condition
    /// </summary>
    /// <param name="conditionId">Unique identifier of the condition</param>
    /// <returns>Detailed condition data or null if not found</returns>
    Task<DSM5ConditionData?> GetConditionDetailsAsync(string conditionId);

    /// <summary>
    /// Uploads extracted DSM-5 conditions to blob storage
    /// </summary>
    /// <param name="conditions">List of conditions to upload</param>
    /// <param name="overwriteExisting">Whether to overwrite existing data</param>
    /// <returns>Upload result</returns>
    Task<DSM5UploadResult> UploadConditionsToStorageAsync(List<DSM5ConditionData> conditions, bool overwriteExisting = false);

    /// <summary>
    /// Gets the status of DSM-5 data in blob storage
    /// </summary>
    /// <returns>Data status information</returns>
    Task<DSM5DataStatus> GetDataStatusAsync();

    /// <summary>
    /// Gets diagnostic criteria for multiple conditions for use in assessments
    /// </summary>
    /// <param name="conditionIds">List of condition IDs to retrieve</param>
    /// <returns>Dictionary of condition ID to diagnostic criteria</returns>
    Task<Dictionary<string, DSM5ConditionData>> GetConditionsForAssessmentAsync(List<string> conditionIds);
}