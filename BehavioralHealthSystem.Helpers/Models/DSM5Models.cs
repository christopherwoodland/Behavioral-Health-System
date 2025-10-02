namespace BehavioralHealthSystem.Models;

/// <summary>
/// Represents a mental health condition from the DSM-5 with its diagnostic criteria
/// </summary>
public class DSM5ConditionData
{
    /// <summary>
    /// Unique identifier for the condition (normalized name)
    /// </summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Full name of the mental health condition
    /// </summary>
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// DSM-5 diagnostic code (e.g., "295.90 (F20.9)")
    /// </summary>
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Category/chapter from DSM-5 (e.g., "Schizophrenia Spectrum and Other Psychotic Disorders")
    /// </summary>
    [JsonPropertyName("category")]
    public string Category { get; set; } = string.Empty;

    /// <summary>
    /// Brief description of the condition
    /// </summary>
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// List of diagnostic criteria (A, B, C, etc.)
    /// </summary>
    [JsonPropertyName("diagnosticCriteria")]
    public List<DSM5DiagnosticCriterion> DiagnosticCriteria { get; set; } = new();

    /// <summary>
    /// Differential diagnosis considerations
    /// </summary>
    [JsonPropertyName("differentialDiagnosis")]
    public List<string> DifferentialDiagnosis { get; set; } = new();

    /// <summary>
    /// Prevalence information
    /// </summary>
    [JsonPropertyName("prevalence")]
    public string Prevalence { get; set; } = string.Empty;

    /// <summary>
    /// Development and course information
    /// </summary>
    [JsonPropertyName("development")]
    public string Development { get; set; } = string.Empty;

    /// <summary>
    /// Risk and prognostic factors
    /// </summary>
    [JsonPropertyName("riskFactors")]
    public List<string> RiskFactors { get; set; } = new();

    /// <summary>
    /// Page numbers in the DSM-5 where this condition appears
    /// </summary>
    [JsonPropertyName("pageNumbers")]
    public List<int> PageNumbers { get; set; } = new();

    /// <summary>
    /// Whether this condition is available for use in assessments
    /// </summary>
    [JsonPropertyName("isAvailableForAssessment")]
    public bool IsAvailableForAssessment { get; set; } = true;

    /// <summary>
    /// When this condition data was last updated
    /// </summary>
    [JsonPropertyName("lastUpdated")]
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Metadata about the extraction process
    /// </summary>
    [JsonPropertyName("extractionMetadata")]
    public DSM5ExtractionMetadata? ExtractionMetadata { get; set; }
}

/// <summary>
/// Represents a single diagnostic criterion (e.g., Criterion A, B, C)
/// </summary>
public class DSM5DiagnosticCriterion
{
    /// <summary>
    /// Criterion identifier (A, B, C, etc.)
    /// </summary>
    [JsonPropertyName("criterionId")]
    public string CriterionId { get; set; } = string.Empty;

    /// <summary>
    /// Title/summary of the criterion
    /// </summary>
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Full text description of the criterion
    /// </summary>
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Sub-criteria or symptoms (numbered items under a criterion)
    /// </summary>
    [JsonPropertyName("subCriteria")]
    public List<DSM5SubCriterion> SubCriteria { get; set; } = new();

    /// <summary>
    /// Whether this criterion is required for diagnosis
    /// </summary>
    [JsonPropertyName("isRequired")]
    public bool IsRequired { get; set; } = true;

    /// <summary>
    /// Minimum number of sub-criteria that must be met
    /// </summary>
    [JsonPropertyName("minimumRequired")]
    public int? MinimumRequired { get; set; }

    /// <summary>
    /// Duration requirement for this criterion
    /// </summary>
    [JsonPropertyName("durationRequirement")]
    public string? DurationRequirement { get; set; }
}

/// <summary>
/// Represents a sub-criterion or symptom within a diagnostic criterion
/// </summary>
public class DSM5SubCriterion
{
    /// <summary>
    /// Identifier (1, 2, 3, etc. or a, b, c, etc.)
    /// </summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Name/title of the symptom
    /// </summary>
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Detailed description of the symptom
    /// </summary>
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Examples or manifestations of this symptom
    /// </summary>
    [JsonPropertyName("examples")]
    public List<string> Examples { get; set; } = new();

    /// <summary>
    /// Whether this sub-criterion is required vs optional
    /// </summary>
    [JsonPropertyName("isRequired")]
    public bool IsRequired { get; set; } = false;
}

/// <summary>
/// Metadata about the DSM-5 extraction process
/// </summary>
public class DSM5ExtractionMetadata
{
    /// <summary>
    /// When the extraction was performed
    /// </summary>
    [JsonPropertyName("extractedAt")]
    public DateTime ExtractedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// URL of the source PDF
    /// </summary>
    [JsonPropertyName("sourcePdfUrl")]
    public string SourcePdfUrl { get; set; } = string.Empty;

    /// <summary>
    /// Page ranges that were processed
    /// </summary>
    [JsonPropertyName("pageRanges")]
    public string PageRanges { get; set; } = string.Empty;

    /// <summary>
    /// Confidence score of the extraction (0.0 - 1.0)
    /// </summary>
    [JsonPropertyName("confidenceScore")]
    public double ConfidenceScore { get; set; }

    /// <summary>
    /// Processing time in milliseconds
    /// </summary>
    [JsonPropertyName("processingTimeMs")]
    public long ProcessingTimeMs { get; set; }

    /// <summary>
    /// Version of the extraction algorithm used
    /// </summary>
    [JsonPropertyName("extractionVersion")]
    public string ExtractionVersion { get; set; } = "1.0";

    /// <summary>
    /// Any notes about the extraction quality or issues
    /// </summary>
    [JsonPropertyName("notes")]
    public List<string> Notes { get; set; } = new();
}

/// <summary>
/// Response from DSM-5 PDF extraction operation
/// </summary>
public class DSM5ExtractionResult
{
    /// <summary>
    /// Whether the extraction was successful
    /// </summary>
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    /// <summary>
    /// Error message if extraction failed
    /// </summary>
    [JsonPropertyName("errorMessage")]
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// List of extracted mental health conditions
    /// </summary>
    [JsonPropertyName("extractedConditions")]
    public List<DSM5ConditionData>? ExtractedConditions { get; set; }

    /// <summary>
    /// Number of pages processed
    /// </summary>
    [JsonPropertyName("pagesProcessed")]
    public int PagesProcessed { get; set; }

    /// <summary>
    /// Processing time in milliseconds
    /// </summary>
    [JsonPropertyName("processingTimeMs")]
    public long ProcessingTimeMs { get; set; }

    /// <summary>
    /// Whether the data was uploaded to blob storage
    /// </summary>
    [JsonPropertyName("uploadedToStorage")]
    public bool UploadedToStorage { get; set; }

    /// <summary>
    /// Blob storage path if uploaded
    /// </summary>
    [JsonPropertyName("blobPath")]
    public string? BlobPath { get; set; }
}

/// <summary>
/// Response from DSM-5 data upload operation
/// </summary>
public class DSM5UploadResult
{
    /// <summary>
    /// Whether the upload was successful
    /// </summary>
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    /// <summary>
    /// Error message if upload failed
    /// </summary>
    [JsonPropertyName("errorMessage")]
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// Number of conditions successfully uploaded
    /// </summary>
    [JsonPropertyName("uploadedCount")]
    public int UploadedCount { get; set; }

    /// <summary>
    /// Number of conditions skipped (already existed)
    /// </summary>
    [JsonPropertyName("skippedCount")]
    public int SkippedCount { get; set; }

    /// <summary>
    /// Number of conditions updated
    /// </summary>
    [JsonPropertyName("updatedCount")]
    public int UpdatedCount { get; set; }

    /// <summary>
    /// Blob paths where data was stored
    /// </summary>
    [JsonPropertyName("blobPaths")]
    public List<string> BlobPaths { get; set; } = new();

    /// <summary>
    /// Processing time in milliseconds
    /// </summary>
    [JsonPropertyName("processingTimeMs")]
    public long ProcessingTimeMs { get; set; }
}

/// <summary>
/// Status of DSM-5 data in blob storage
/// </summary>
public class DSM5DataStatus
{
    /// <summary>
    /// Whether DSM-5 data has been initialized
    /// </summary>
    [JsonPropertyName("isInitialized")]
    public bool IsInitialized { get; set; }

    /// <summary>
    /// Total number of conditions in storage
    /// </summary>
    [JsonPropertyName("totalConditions")]
    public int TotalConditions { get; set; }

    /// <summary>
    /// Number of conditions available for assessment
    /// </summary>
    [JsonPropertyName("availableConditions")]
    public int AvailableConditions { get; set; }

    /// <summary>
    /// Available categories
    /// </summary>
    [JsonPropertyName("categories")]
    public List<string> Categories { get; set; } = new();

    /// <summary>
    /// When the data was last updated
    /// </summary>
    [JsonPropertyName("lastUpdated")]
    public DateTime? LastUpdated { get; set; }

    /// <summary>
    /// Version of the data
    /// </summary>
    [JsonPropertyName("dataVersion")]
    public string DataVersion { get; set; } = string.Empty;

    /// <summary>
    /// Whether the storage container exists
    /// </summary>
    [JsonPropertyName("containerExists")]
    public bool ContainerExists { get; set; }

    /// <summary>
    /// Total size of blob data in bytes
    /// </summary>
    [JsonPropertyName("totalBlobSizeBytes")]
    public long TotalBlobSizeBytes { get; set; }

    /// <summary>
    /// Number of blobs in storage
    /// </summary>
    [JsonPropertyName("blobCount")]
    public int BlobCount { get; set; }
}