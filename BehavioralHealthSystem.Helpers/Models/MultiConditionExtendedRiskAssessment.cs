namespace BehavioralHealthSystem.Models;

/// <summary>
/// Multi-condition extended risk assessment that supports evaluation against multiple DSM-5 conditions
/// Backwards compatible with single-condition schizophrenia assessments
/// </summary>
public class MultiConditionExtendedRiskAssessment : RiskAssessment
{
    /// <summary>
    /// Indicates whether this is an extended assessment
    /// </summary>
    [JsonPropertyName("isExtended")]
    public bool IsExtended { get; set; } = true;

    /// <summary>
    /// Whether this assessment evaluates multiple conditions
    /// </summary>
    [JsonPropertyName("isMultiCondition")]
    public bool IsMultiCondition { get; set; }

    /// <summary>
    /// Processing time for the extended assessment
    /// </summary>
    [JsonPropertyName("processingTimeMs")]
    public long ProcessingTimeMs { get; set; }

    /// <summary>
    /// DSM-5 conditions that were evaluated
    /// </summary>
    [JsonPropertyName("evaluatedConditions")]
    public List<string> EvaluatedConditions { get; set; } = new();

    /// <summary>
    /// Assessment results for each evaluated condition
    /// </summary>
    [JsonPropertyName("conditionAssessments")]
    public List<ConditionAssessmentResult> ConditionAssessments { get; set; } = new();

    /// <summary>
    /// Overall summary across all evaluated conditions
    /// </summary>
    [JsonPropertyName("overallAssessmentSummary")]
    public string OverallAssessmentSummary { get; set; } = string.Empty;

    /// <summary>
    /// Highest risk condition identified
    /// </summary>
    [JsonPropertyName("highestRiskCondition")]
    public string? HighestRiskCondition { get; set; }

    /// <summary>
    /// Combined recommended actions across all conditions
    /// </summary>
    [JsonPropertyName("combinedRecommendedActions")]
    public List<string> CombinedRecommendedActions { get; set; } = new();

    /// <summary>
    /// Cross-condition differential diagnosis considerations
    /// </summary>
    [JsonPropertyName("crossConditionDifferentialDiagnosis")]
    public List<string> CrossConditionDifferentialDiagnosis { get; set; } = new();

    /// <summary>
    /// Legacy schizophrenia assessment for backward compatibility
    /// Populated when schizophrenia is one of the evaluated conditions
    /// </summary>
    [JsonPropertyName("schizophreniaAssessment")]
    public SchizophreniaAssessment? SchizophreniaAssessment { get; set; }
}

/// <summary>
/// Assessment result for a specific DSM-5 condition
/// </summary>
public class ConditionAssessmentResult
{
    /// <summary>
    /// Unique identifier of the DSM-5 condition
    /// </summary>
    [JsonPropertyName("conditionId")]
    public string ConditionId { get; set; } = string.Empty;

    /// <summary>
    /// Full name of the condition
    /// </summary>
    [JsonPropertyName("conditionName")]
    public string ConditionName { get; set; } = string.Empty;

    /// <summary>
    /// DSM-5 diagnostic code
    /// </summary>
    [JsonPropertyName("conditionCode")]
    public string ConditionCode { get; set; } = string.Empty;

    /// <summary>
    /// Category/chapter from DSM-5
    /// </summary>
    [JsonPropertyName("category")]
    public string Category { get; set; } = string.Empty;

    /// <summary>
    /// Overall likelihood assessment for this condition
    /// Values: None, Minimal, Low, Moderate, High, Very High
    /// </summary>
    [JsonPropertyName("overallLikelihood")]
    public string OverallLikelihood { get; set; } = string.Empty;

    /// <summary>
    /// Confidence score for this condition's assessment (0-1 scale)
    /// </summary>
    [JsonPropertyName("confidenceScore")]
    public double ConfidenceScore { get; set; }

    /// <summary>
    /// Risk score specific to this condition (1-10 scale)
    /// </summary>
    [JsonPropertyName("conditionRiskScore")]
    public int ConditionRiskScore { get; set; }

    /// <summary>
    /// Detailed summary for this condition
    /// </summary>
    [JsonPropertyName("assessmentSummary")]
    public string AssessmentSummary { get; set; } = string.Empty;

    /// <summary>
    /// Evaluation of diagnostic criteria for this condition
    /// </summary>
    [JsonPropertyName("criteriaEvaluations")]
    public List<CriterionEvaluationResult> CriteriaEvaluations { get; set; } = new();

    /// <summary>
    /// Risk factors identified for this specific condition
    /// </summary>
    [JsonPropertyName("riskFactorsIdentified")]
    public List<string> RiskFactorsIdentified { get; set; } = new();

    /// <summary>
    /// Recommended actions specific to this condition
    /// </summary>
    [JsonPropertyName("recommendedActions")]
    public List<string> RecommendedActions { get; set; } = new();

    /// <summary>
    /// Clinical notes specific to this condition
    /// </summary>
    [JsonPropertyName("clinicalNotes")]
    public List<string> ClinicalNotes { get; set; } = new();

    /// <summary>
    /// Differential diagnosis considerations for this condition
    /// </summary>
    [JsonPropertyName("differentialDiagnosis")]
    public List<string> DifferentialDiagnosis { get; set; } = new();

    /// <summary>
    /// Duration assessment notes for this condition
    /// </summary>
    [JsonPropertyName("durationAssessment")]
    public string DurationAssessment { get; set; } = string.Empty;

    /// <summary>
    /// Functional impairment assessment for this condition
    /// </summary>
    [JsonPropertyName("functionalImpairment")]
    public FunctionalImpairmentAssessment? FunctionalImpairment { get; set; }
}

/// <summary>
/// Evaluation result for a specific diagnostic criterion
/// </summary>
public class CriterionEvaluationResult
{
    /// <summary>
    /// Criterion identifier (A, B, C, etc.)
    /// </summary>
    [JsonPropertyName("criterionId")]
    public string CriterionId { get; set; } = string.Empty;

    /// <summary>
    /// Title of the criterion
    /// </summary>
    [JsonPropertyName("criterionTitle")]
    public string CriterionTitle { get; set; } = string.Empty;

    /// <summary>
    /// Description of the criterion
    /// </summary>
    [JsonPropertyName("criterionDescription")]
    public string CriterionDescription { get; set; } = string.Empty;

    /// <summary>
    /// Whether this criterion is met
    /// </summary>
    [JsonPropertyName("isMet")]
    public bool IsMet { get; set; }

    /// <summary>
    /// Confidence in the criterion evaluation (0-1 scale)
    /// </summary>
    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }

    /// <summary>
    /// Evidence supporting the criterion evaluation
    /// </summary>
    [JsonPropertyName("evidence")]
    public List<string> Evidence { get; set; } = new();

    /// <summary>
    /// Evaluation of sub-criteria within this criterion
    /// </summary>
    [JsonPropertyName("subCriteriaEvaluations")]
    public List<SubCriterionEvaluationResult> SubCriteriaEvaluations { get; set; } = new();

    /// <summary>
    /// Additional notes about this criterion
    /// </summary>
    [JsonPropertyName("notes")]
    public string Notes { get; set; } = string.Empty;

    /// <summary>
    /// Duration requirement assessment for this criterion
    /// </summary>
    [JsonPropertyName("durationRequirementMet")]
    public bool? DurationRequirementMet { get; set; }

    /// <summary>
    /// Number of sub-criteria required vs met
    /// </summary>
    [JsonPropertyName("subCriteriaRequired")]
    public int SubCriteriaRequired { get; set; }

    /// <summary>
    /// Number of sub-criteria that are met
    /// </summary>
    [JsonPropertyName("subCriteriaMet")]
    public int SubCriteriaMet { get; set; }
}

/// <summary>
/// Evaluation result for a sub-criterion or symptom
/// </summary>
public class SubCriterionEvaluationResult
{
    /// <summary>
    /// Sub-criterion identifier
    /// </summary>
    [JsonPropertyName("subCriterionId")]
    public string SubCriterionId { get; set; } = string.Empty;

    /// <summary>
    /// Name of the sub-criterion/symptom
    /// </summary>
    [JsonPropertyName("subCriterionName")]
    public string SubCriterionName { get; set; } = string.Empty;

    /// <summary>
    /// Description of the sub-criterion
    /// </summary>
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Severity rating (0-4 scale: 0=not present, 1=mild, 2=moderate, 3=marked, 4=severe)
    /// </summary>
    [JsonPropertyName("severity")]
    public int Severity { get; set; }

    /// <summary>
    /// Whether this sub-criterion is present
    /// </summary>
    [JsonPropertyName("isPresent")]
    public bool IsPresent { get; set; }

    /// <summary>
    /// Confidence in this evaluation (0-1 scale)
    /// </summary>
    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }

    /// <summary>
    /// Evidence supporting this evaluation
    /// </summary>
    [JsonPropertyName("evidence")]
    public string Evidence { get; set; } = string.Empty;

    /// <summary>
    /// Additional notes about this sub-criterion
    /// </summary>
    [JsonPropertyName("notes")]
    public string Notes { get; set; } = string.Empty;

    /// <summary>
    /// Examples or manifestations observed
    /// </summary>
    [JsonPropertyName("observedExamples")]
    public List<string> ObservedExamples { get; set; } = new();
}

/// <summary>
/// Request for multi-condition assessment
/// </summary>
public class MultiConditionAssessmentRequest
{
    /// <summary>
    /// Session ID to assess
    /// </summary>
    [JsonPropertyName("sessionId")]
    public string SessionId { get; set; } = string.Empty;

    /// <summary>
    /// List of DSM-5 condition IDs to evaluate
    /// </summary>
    [JsonPropertyName("selectedConditions")]
    public List<string> SelectedConditions { get; set; } = new();

    /// <summary>
    /// Additional assessment options
    /// </summary>
    [JsonPropertyName("assessmentOptions")]
    public AssessmentOptions? AssessmentOptions { get; set; }
}

/// <summary>
/// Options for customizing the assessment
/// </summary>
public class AssessmentOptions
{
    /// <summary>
    /// Whether to include standard risk assessment
    /// </summary>
    [JsonPropertyName("includeStandardRisk")]
    public bool IncludeStandardRisk { get; set; } = true;

    /// <summary>
    /// Maximum processing time in seconds
    /// </summary>
    [JsonPropertyName("maxProcessingTimeSeconds")]
    public int MaxProcessingTimeSeconds { get; set; } = 120;

    /// <summary>
    /// Minimum confidence threshold for reporting findings
    /// </summary>
    [JsonPropertyName("confidenceThreshold")]
    public double ConfidenceThreshold { get; set; } = 0.3;

    /// <summary>
    /// Whether to generate detailed clinical notes
    /// </summary>
    [JsonPropertyName("generateDetailedNotes")]
    public bool GenerateDetailedNotes { get; set; } = true;

    /// <summary>
    /// Whether to include cross-condition differential diagnosis
    /// </summary>
    [JsonPropertyName("includeCrossDiagnosis")]
    public bool IncludeCrossDiagnosis { get; set; } = true;

    /// <summary>
    /// Focus on specific symptoms or areas
    /// </summary>
    [JsonPropertyName("focusAreas")]
    public List<string> FocusAreas { get; set; } = new();
}

/// <summary>
/// Response from multi-condition assessment API
/// </summary>
public class MultiConditionAssessmentResponse
{
    /// <summary>
    /// Whether the assessment was successful
    /// </summary>
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    /// <summary>
    /// Error message if assessment failed
    /// </summary>
    [JsonPropertyName("message")]
    public string? Message { get; set; }

    /// <summary>
    /// The complete multi-condition assessment result
    /// </summary>
    [JsonPropertyName("multiConditionAssessment")]
    public MultiConditionExtendedRiskAssessment? MultiConditionAssessment { get; set; }

    /// <summary>
    /// Processing time in seconds
    /// </summary>
    [JsonPropertyName("processingTimeSeconds")]
    public double ProcessingTimeSeconds { get; set; }

    /// <summary>
    /// Whether the result was cached
    /// </summary>
    [JsonPropertyName("cached")]
    public bool Cached { get; set; }

    /// <summary>
    /// Error details if assessment failed
    /// </summary>
    [JsonPropertyName("error")]
    public string? Error { get; set; }

    /// <summary>
    /// Job ID for tracking async processing
    /// </summary>
    [JsonPropertyName("jobId")]
    public string? JobId { get; set; }
}