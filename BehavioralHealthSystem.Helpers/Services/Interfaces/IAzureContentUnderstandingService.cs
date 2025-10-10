namespace BehavioralHealthSystem.Helpers.Services;

/// <summary>
/// Service for extracting structured data from documents using Azure Content Understanding API
/// </summary>
public interface IAzureContentUnderstandingService
{
    /// <summary>
    /// Extracts DSM-5 condition data from a PDF document
    /// </summary>
    /// <param name="pdfData">PDF file as byte array</param>
    /// <param name="startPage">Starting page number (1-based)</param>
    /// <param name="endPage">Ending page number (inclusive)</param>
    /// <returns>List of extracted DSM-5 conditions with full structure</returns>
    Task<List<DSM5ConditionData>> ExtractDSM5ConditionsAsync(
        byte[] pdfData, 
        int startPage = 1, 
        int? endPage = null);

    /// <summary>
    /// Extracts a single DSM-5 condition from specific pages
    /// </summary>
    /// <param name="pdfData">PDF file as byte array</param>
    /// <param name="conditionName">Name of the condition to extract</param>
    /// <param name="pageNumbers">Specific page numbers where this condition appears</param>
    /// <returns>Extracted DSM-5 condition data</returns>
    Task<DSM5ConditionData?> ExtractSingleConditionAsync(
        byte[] pdfData,
        string conditionName,
        List<int> pageNumbers);

    /// <summary>
    /// Validates the extraction quality and completeness
    /// </summary>
    /// <param name="condition">Extracted condition to validate</param>
    /// <returns>Validation result with quality score and issues</returns>
    Task<DSM5ValidationResult> ValidateExtractionAsync(DSM5ConditionData condition);
}

/// <summary>
/// Result of DSM-5 extraction validation
/// </summary>
public class DSM5ValidationResult
{
    /// <summary>
    /// Whether the extraction meets quality standards
    /// </summary>
    public bool IsValid { get; set; }

    /// <summary>
    /// Quality score (0.0 - 1.0)
    /// </summary>
    public double QualityScore { get; set; }

    /// <summary>
    /// List of validation issues found
    /// </summary>
    public List<string> Issues { get; set; } = new();

    /// <summary>
    /// List of warnings (non-critical)
    /// </summary>
    public List<string> Warnings { get; set; } = new();

    /// <summary>
    /// Sections that were successfully extracted
    /// </summary>
    public List<string> CompleteSections { get; set; } = new();

    /// <summary>
    /// Sections that are incomplete or missing
    /// </summary>
    public List<string> IncompleteSections { get; set; } = new();
}
