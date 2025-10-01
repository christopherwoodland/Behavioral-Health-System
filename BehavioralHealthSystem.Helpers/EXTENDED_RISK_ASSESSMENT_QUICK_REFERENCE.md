# Extended Risk Assessment - Quick Reference

## When to Use Which Assessment

| Feature | Standard Assessment | Extended Assessment |
|---------|-------------------|-------------------|
| **Processing Time** | 5-30 seconds | 30 seconds - 2 minutes |
| **Model** | Standard GPT | GPT-5/O3 preferred |
| **Focus** | Depression/Anxiety risk | Comprehensive + Schizophrenia |
| **Transcription** | ✅ Included | ✅ Included |
| **Use Case** | Quick screening | Detailed psychiatric evaluation |
| **Cost** | Lower | Higher (GPT-5 pricing) |

## Quick Start

### Generate Standard Assessment
```csharp
var assessment = await riskAssessmentService.GenerateRiskAssessmentAsync(sessionData);
```

### Generate Extended Assessment (Async)
```csharp
var extendedAssessment = await riskAssessmentService.GenerateExtendedRiskAssessmentAsync(sessionData);
```

### Update Session with Extended Assessment
```csharp
// Fire and forget - runs asynchronously
var success = await riskAssessmentService.UpdateSessionWithExtendedRiskAssessmentAsync(sessionId);
```

## Accessing Results

### Standard Assessment
```csharp
var riskLevel = session.RiskAssessment?.OverallRiskLevel;
var riskScore = session.RiskAssessment?.RiskScore;
var summary = session.RiskAssessment?.Summary;
```

### Extended Assessment - General
```csharp
var riskLevel = session.ExtendedRiskAssessment?.OverallRiskLevel;
var processingTime = session.ExtendedRiskAssessment?.ProcessingTimeMs;
```

### Extended Assessment - Schizophrenia
```csharp
var schizAssess = session.ExtendedRiskAssessment?.SchizophreniaAssessment;

// Overall likelihood
var likelihood = schizAssess?.OverallLikelihood; // None, Minimal, Low, Moderate, High, Very High

// Confidence
var confidence = schizAssess?.ConfidenceScore; // 0.0 - 1.0

// Criterion A symptoms
var criterionA = schizAssess?.CriterionAEvaluation;
var hasDelusions = criterionA?.Delusions?.PresenceLevel;
var delusionSeverity = criterionA?.Delusions?.Severity; // 0-4
var criterionAMet = criterionA?.CriterionAMet; // Boolean

// Functional impairment (Criterion B)
var functionalImpairment = schizAssess?.FunctionalImpairment;
var impairmentLevel = functionalImpairment?.ImpairmentLevel; // None, Mild, Moderate, Marked, Severe
var criterionBMet = functionalImpairment?.CriterionBMet; // Boolean

// Clinical recommendations
var recommendations = schizAssess?.RecommendedActions;
var differentialDx = schizAssess?.DifferentialDiagnosis;
var clinicalNotes = schizAssess?.ClinicalNotes;
```

## Schizophrenia Likelihood Levels

| Level | Meaning | Clinical Action |
|-------|---------|----------------|
| **None** | No evidence | No concerns |
| **Minimal** | Slight indications | Monitor |
| **Low** | Some symptoms | Consider follow-up |
| **Moderate** | Multiple symptoms | Further evaluation recommended |
| **High** | Strong evidence | Clinical assessment needed |
| **Very High** | Meets criteria | Urgent psychiatric referral |

## DSM-5 Criteria Quick Reference

### Criterion A (≥2 symptoms, ≥1 must be A1/A2/A3)
1. ✅ **Delusions** - False fixed beliefs
2. ✅ **Hallucinations** - Perceptions without stimulus
3. ✅ **Disorganized Speech** - Incoherent, derailed
4. **Disorganized Behavior** - Inappropriate, unpredictable
5. **Negative Symptoms** - Flat affect, avolition

✅ = Required (at least one)

### Criterion B
Functional impairment in work, relationships, or self-care

### Criterion C
Duration: 6 months minimum (cannot be fully assessed from single session)

## Important Clinical Caveats

⚠️ **This is a preliminary AI assessment, NOT a clinical diagnosis**

1. Formal diagnosis requires licensed professional evaluation
2. Cultural context must be considered
3. Duration criteria requires longitudinal observation
4. Medical conditions must be ruled out
5. Differential diagnosis requires comprehensive evaluation

## Configuration Requirements

### Recommended Model Setup
```json
{
  "AzureOpenAI": {
    "Enabled": true,
    "Endpoint": "https://your-resource.openai.azure.com/",
    "ApiKey": "your-key",
    "DeploymentName": "gpt-5-preview", // or "o3-mini"
    "ApiVersion": "2024-02-15-preview",
    "MaxTokens": 4000 // Minimum for extended assessment
  }
}
```

### Model Detection
System automatically detects GPT-5/O3 by deployment name containing:
- "gpt-5"
- "o3"

If not detected, logs warning but continues with configured model.

## Performance Optimization

### For Quick Results
Use standard assessment:
```csharp
var assessment = await riskAssessmentService.GenerateRiskAssessmentAsync(sessionData);
```

### For Comprehensive Analysis
Use extended assessment asynchronously:
```csharp
// Start assessment (non-blocking)
_ = riskAssessmentService.UpdateSessionWithExtendedRiskAssessmentAsync(sessionId);

// Continue with other operations
// Check back later for results
```

### Check Processing Time
```csharp
var processingTimeMs = session.ExtendedRiskAssessment?.ProcessingTimeMs;
Console.WriteLine($"Extended assessment completed in {processingTimeMs}ms");
```

## Error Handling

Both assessment types return `null` on error. Check logs for details:
- Configuration validation failures
- API timeouts (30s standard, 2min extended)
- JSON parsing errors
- Network issues

## Example Workflow

```csharp
// 1. Upload audio and create session
var sessionData = await CreateSession(audioFile, metadata);

// 2. Generate standard assessment (quick)
var quickAssessment = await riskAssessmentService.GenerateRiskAssessmentAsync(sessionData);

// 3. If warranted, generate extended assessment
if (quickAssessment?.RiskScore >= 7) // High risk threshold
{
    // Start extended assessment asynchronously
    var extendedSuccess = await riskAssessmentService
        .UpdateSessionWithExtendedRiskAssessmentAsync(sessionData.SessionId);
    
    if (extendedSuccess)
    {
        // Poll or notify when complete
        // Extended assessment includes schizophrenia evaluation
    }
}
```

## Transcription Impact

### With Transcription
- Enables speech pattern analysis
- Detects disorganized speech
- Assesses thought processes
- More accurate assessments

### Without Transcription
- Limited to numerical scores
- Cannot assess speech patterns
- Lower confidence in assessment
- Note logged in clinical notes

## Cost Considerations

### Standard Assessment
- Lower token usage (~1,000-2,000 tokens)
- Standard GPT pricing
- Faster processing

### Extended Assessment
- Higher token usage (~2,000-4,000 tokens)
- GPT-5/O3 premium pricing
- Longer processing time
- More comprehensive results

**Recommendation**: Use standard assessment for screening, extended assessment for high-risk cases or when detailed evaluation is clinically indicated.
