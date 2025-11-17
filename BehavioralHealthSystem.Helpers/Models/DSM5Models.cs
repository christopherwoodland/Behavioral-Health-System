namespace BehavioralHealthSystem.Models;

/// <summary>
/// Represents a mental health condition from the DSM-5 with its diagnostic criteria
/// Following the complete DSM-5 structured format (13 sections)
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

    // ==================== DSM-5 STANDARD SECTIONS ====================

    /// <summary>
    /// Section 1: Diagnostic Criteria - Official lettered list of symptoms and requirements
    /// </summary>
    [JsonPropertyName("diagnosticCriteria")]
    public List<DSM5DiagnosticCriterion> DiagnosticCriteria { get; set; } = [];

    /// <summary>
    /// Section 2: Diagnostic Features - Narrative explanation of core symptoms and presentation
    /// </summary>
    [JsonPropertyName("diagnosticFeatures")]
    public string? DiagnosticFeatures { get; set; }

    /// <summary>
    /// Section 3: Associated Features Supporting Diagnosis - Additional symptoms/behaviors
    /// </summary>
    [JsonPropertyName("associatedFeatures")]
    public string? AssociatedFeatures { get; set; }

    /// <summary>
    /// Section 4: Prevalence - Data on how common the disorder is
    /// </summary>
    [JsonPropertyName("prevalence")]
    public string? Prevalence { get; set; }

    /// <summary>
    /// Section 5: Development and Course - Age at onset, progression, natural history
    /// </summary>
    [JsonPropertyName("developmentAndCourse")]
    public string? DevelopmentAndCourse { get; set; }

    /// <summary>
    /// Section 6: Risk and Prognostic Factors
    /// </summary>
    [JsonPropertyName("riskAndPrognosticFactors")]
    public DSM5RiskFactors? RiskAndPrognosticFactors { get; set; }

    /// <summary>
    /// Section 7: Culture-Related Diagnostic Issues
    /// </summary>
    [JsonPropertyName("cultureRelatedIssues")]
    public string? CultureRelatedIssues { get; set; }

    /// <summary>
    /// Section 8: Gender-Related Diagnostic Issues
    /// </summary>
    [JsonPropertyName("genderRelatedIssues")]
    public string? GenderRelatedIssues { get; set; }

    /// <summary>
    /// Section 9: Suicide Risk (for applicable disorders)
    /// </summary>
    [JsonPropertyName("suicideRisk")]
    public string? SuicideRisk { get; set; }

    /// <summary>
    /// Section 10: Functional Consequences - Impact on daily functioning, work, relationships
    /// </summary>
    [JsonPropertyName("functionalConsequences")]
    public string? FunctionalConsequences { get; set; }

    /// <summary>
    /// Section 11: Differential Diagnosis - Other disorders to consider and rule out
    /// </summary>
    [JsonPropertyName("differentialDiagnosis")]
    public List<string> DifferentialDiagnosis { get; set; } = [];

    /// <summary>
    /// Section 12: Comorbidity - Disorders commonly co-occurring
    /// </summary>
    [JsonPropertyName("comorbidity")]
    public string? Comorbidity { get; set; }

    /// <summary>
    /// Section 13: Specifiers and Subtypes (where applicable)
    /// </summary>
    [JsonPropertyName("specifiers")]
    public List<DSM5Specifier> Specifiers { get; set; } = [];

    // ==================== METADATA ====================

    /// <summary>
    /// Page numbers in the DSM-5 where this condition appears
    /// </summary>
    [JsonPropertyName("pageNumbers")]
    public List<int> PageNumbers { get; set; } = [];

    /// <summary>
    /// Which sections were present in the source document
    /// </summary>
    [JsonPropertyName("presentSections")]
    public List<string> PresentSections { get; set; } = [];

    /// <summary>
    /// Which sections were missing or empty in the source
    /// </summary>
    [JsonPropertyName("missingSections")]
    public List<string> MissingSections { get; set; } = [];

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
    public List<DSM5SubCriterion> SubCriteria { get; set; } = [];

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
    public List<string> Examples { get; set; } = [];

    /// <summary>
    /// Whether this sub-criterion is required vs optional
    /// </summary>
    [JsonPropertyName("isRequired")]
    public bool IsRequired { get; set; } = false;
}

/// <summary>
/// Risk and prognostic factors for a DSM-5 condition (Section 6)
/// </summary>
public class DSM5RiskFactors
{
    /// <summary>
    /// Temperamental risk factors (personality traits, coping styles)
    /// </summary>
    [JsonPropertyName("temperamental")]
    public string? Temperamental { get; set; }

    /// <summary>
    /// Environmental risk factors (life events, stress, trauma)
    /// </summary>
    [JsonPropertyName("environmental")]
    public string? Environmental { get; set; }

    /// <summary>
    /// Genetic and physiological factors
    /// </summary>
    [JsonPropertyName("geneticAndPhysiological")]
    public string? GeneticAndPhysiological { get; set; }

    /// <summary>
    /// Course modifiers (factors that affect prognosis)
    /// </summary>
    [JsonPropertyName("courseModifiers")]
    public string? CourseModifiers { get; set; }
}

/// <summary>
/// Specifiers and subtypes for a DSM-5 condition (Section 13)
/// </summary>
public class DSM5Specifier
{
    /// <summary>
    /// Type of specifier (e.g., "Severity", "Course", "With Features")
    /// </summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Name of the specifier
    /// </summary>
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Description of the specifier
    /// </summary>
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Code modifier if applicable
    /// </summary>
    [JsonPropertyName("code")]
    public string? Code { get; set; }

    /// <summary>
    /// Criteria for applying this specifier
    /// </summary>
    [JsonPropertyName("criteria")]
    public List<string> Criteria { get; set; } = [];
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
    public List<string> Notes { get; set; } = [];
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
    public List<string> BlobPaths { get; set; } = [];

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
    public List<string> Categories { get; set; } = [];

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
