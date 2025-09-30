namespace BehavioralHealthSystem.Models;

/// <summary>
/// Extended risk assessment that includes schizophrenia evaluation
/// Generated using GPT-5 with more comprehensive analysis
/// </summary>
public class ExtendedRiskAssessment : RiskAssessment
{
    /// <summary>
    /// Schizophrenia-specific assessment
    /// </summary>
    [JsonPropertyName("schizophreniaAssessment")]
    public SchizophreniaAssessment? SchizophreniaAssessment { get; set; }
    
    /// <summary>
    /// Indicates whether this is an extended assessment
    /// </summary>
    [JsonPropertyName("isExtended")]
    public bool IsExtended { get; set; } = true;
    
    /// <summary>
    /// Processing time for the extended assessment
    /// </summary>
    [JsonPropertyName("processingTimeMs")]
    public long ProcessingTimeMs { get; set; }
}

/// <summary>
/// Assessment of schizophrenia based on DSM-5 criteria (295.90 F20.9)
/// </summary>
public class SchizophreniaAssessment
{
    /// <summary>
    /// Overall assessment of schizophrenia likelihood
    /// Values: None, Minimal, Low, Moderate, High, Very High
    /// </summary>
    [JsonPropertyName("overallLikelihood")]
    public string OverallLikelihood { get; set; } = string.Empty;
    
    /// <summary>
    /// Confidence score for the assessment (0-1 scale)
    /// </summary>
    [JsonPropertyName("confidenceScore")]
    public double ConfidenceScore { get; set; }
    
    /// <summary>
    /// Detailed assessment summary
    /// </summary>
    [JsonPropertyName("assessmentSummary")]
    public string AssessmentSummary { get; set; } = string.Empty;
    
    /// <summary>
    /// Evaluation against DSM-5 Criterion A symptoms
    /// </summary>
    [JsonPropertyName("criterionAEvaluation")]
    public CriterionAEvaluation CriterionAEvaluation { get; set; } = new();
    
    /// <summary>
    /// Functional impairment assessment (Criterion B)
    /// </summary>
    [JsonPropertyName("functionalImpairment")]
    public FunctionalImpairmentAssessment? FunctionalImpairment { get; set; }
    
    /// <summary>
    /// Duration assessment (Criterion C)
    /// </summary>
    [JsonPropertyName("durationAssessment")]
    public string DurationAssessment { get; set; } = string.Empty;
    
    /// <summary>
    /// Differential diagnosis considerations
    /// </summary>
    [JsonPropertyName("differentialDiagnosis")]
    public List<string> DifferentialDiagnosis { get; set; } = new();
    
    /// <summary>
    /// Risk factors identified
    /// </summary>
    [JsonPropertyName("riskFactorsIdentified")]
    public List<string> RiskFactorsIdentified { get; set; } = new();
    
    /// <summary>
    /// Recommended clinical actions
    /// </summary>
    [JsonPropertyName("recommendedActions")]
    public List<string> RecommendedActions { get; set; } = new();
    
    /// <summary>
    /// Important clinical notes and caveats
    /// </summary>
    [JsonPropertyName("clinicalNotes")]
    public List<string> ClinicalNotes { get; set; } = new();
}

/// <summary>
/// Evaluation of DSM-5 Criterion A symptoms for schizophrenia
/// </summary>
public class CriterionAEvaluation
{
    /// <summary>
    /// Presence of delusions (Criterion A1)
    /// </summary>
    [JsonPropertyName("delusions")]
    public SymptomPresence Delusions { get; set; } = new();
    
    /// <summary>
    /// Presence of hallucinations (Criterion A2)
    /// </summary>
    [JsonPropertyName("hallucinations")]
    public SymptomPresence Hallucinations { get; set; } = new();
    
    /// <summary>
    /// Presence of disorganized speech (Criterion A3)
    /// </summary>
    [JsonPropertyName("disorganizedSpeech")]
    public SymptomPresence DisorganizedSpeech { get; set; } = new();
    
    /// <summary>
    /// Presence of grossly disorganized or catatonic behavior (Criterion A4)
    /// </summary>
    [JsonPropertyName("disorganizedBehavior")]
    public SymptomPresence DisorganizedBehavior { get; set; } = new();
    
    /// <summary>
    /// Presence of negative symptoms (Criterion A5)
    /// </summary>
    [JsonPropertyName("negativeSymptoms")]
    public SymptomPresence NegativeSymptoms { get; set; } = new();
    
    /// <summary>
    /// Total number of Criterion A symptoms present
    /// </summary>
    [JsonPropertyName("totalSymptomsPresent")]
    public int TotalSymptomsPresent { get; set; }
    
    /// <summary>
    /// Whether Criterion A is met (at least 2 symptoms, with at least one being A1, A2, or A3)
    /// </summary>
    [JsonPropertyName("criterionAMet")]
    public bool CriterionAMet { get; set; }
}

/// <summary>
/// Represents the presence and severity of a symptom
/// </summary>
public class SymptomPresence
{
    /// <summary>
    /// Whether the symptom is present
    /// Values: Not Present, Possible, Likely, Present, Clearly Present
    /// </summary>
    [JsonPropertyName("presenceLevel")]
    public string PresenceLevel { get; set; } = "Not Present";
    
    /// <summary>
    /// Severity rating (0-4 scale where 0=not present, 4=severe)
    /// </summary>
    [JsonPropertyName("severity")]
    public int Severity { get; set; }
    
    /// <summary>
    /// Evidence supporting this assessment
    /// </summary>
    [JsonPropertyName("evidence")]
    public List<string> Evidence { get; set; } = new();
    
    /// <summary>
    /// Additional notes about this symptom
    /// </summary>
    [JsonPropertyName("notes")]
    public string Notes { get; set; } = string.Empty;
}

/// <summary>
/// Assessment of functional impairment (DSM-5 Criterion B)
/// </summary>
public class FunctionalImpairmentAssessment
{
    /// <summary>
    /// Overall functional impairment level
    /// Values: None, Mild, Moderate, Marked, Severe
    /// </summary>
    [JsonPropertyName("impairmentLevel")]
    public string ImpairmentLevel { get; set; } = string.Empty;
    
    /// <summary>
    /// Work/occupational functioning assessment
    /// </summary>
    [JsonPropertyName("workFunctioning")]
    public string WorkFunctioning { get; set; } = string.Empty;
    
    /// <summary>
    /// Interpersonal relations assessment
    /// </summary>
    [JsonPropertyName("interpersonalRelations")]
    public string InterpersonalRelations { get; set; } = string.Empty;
    
    /// <summary>
    /// Self-care assessment
    /// </summary>
    [JsonPropertyName("selfCare")]
    public string SelfCare { get; set; } = string.Empty;
    
    /// <summary>
    /// Whether Criterion B is met
    /// </summary>
    [JsonPropertyName("criterionBMet")]
    public bool CriterionBMet { get; set; }
}
