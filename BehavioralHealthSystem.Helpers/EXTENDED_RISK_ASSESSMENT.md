# Extended Risk Assessment Implementation

## Overview
This document describes the implementation of the Extended Risk Assessment feature, which includes comprehensive schizophrenia evaluation based on DSM-5 diagnostic criteria.

## Key Features

### 1. **Dual Assessment System**
- **Standard Risk Assessment**: Fast, focused assessment for depression/anxiety risk
- **Extended Risk Assessment**: Comprehensive assessment including schizophrenia evaluation using GPT-5/O3 models

### 2. **Audio Transcription Integration**
Both assessment types now include audio transcription in their prompts when available:
- Critical for speech pattern analysis
- Enables detection of disorganized speech (key schizophrenia symptom)
- Provides context for thought processes and emotional state

### 3. **Schizophrenia Assessment (DSM-5 Criteria 295.90 F20.9)**

The extended assessment evaluates:

#### **Criterion A - Characteristic Symptoms** (5 symptoms evaluated):
1. **Delusions** - False fixed beliefs
2. **Hallucinations** - Perceptual experiences without external stimulus
3. **Disorganized Speech** - Derailment, incoherence, tangentiality
4. **Disorganized/Catatonic Behavior** - Unpredictable or inappropriate behavior
5. **Negative Symptoms** - Diminished emotional expression, avolition, alogia

Each symptom rated on 0-4 scale (0=not present, 4=severe)

#### **Criterion B - Functional Impairment**
Assessment of:
- Work/occupational functioning
- Interpersonal relations  
- Self-care capabilities

#### **Criterion C - Duration**
Note: Cannot be fully assessed from single-session data, but patterns can be noted

#### **Differential Diagnosis**
The assessment considers alternative explanations:
- Schizoaffective disorder
- Bipolar/depression with psychotic features
- Substance-induced psychotic disorder
- Medical conditions
- Autism spectrum disorder
- Communication disorders

## Data Models

### ExtendedRiskAssessment
Extends the base `RiskAssessment` class with:
- `SchizophreniaAssessment` - Complete schizophrenia evaluation
- `IsExtended` - Flag indicating extended assessment
- `ProcessingTimeMs` - Tracks processing duration

### SchizophreniaAssessment
Contains:
- `OverallLikelihood` - None, Minimal, Low, Moderate, High, Very High
- `ConfidenceScore` - 0-1 scale
- `AssessmentSummary` - Detailed narrative
- `CriterionAEvaluation` - Structured symptom evaluation
- `FunctionalImpairment` - Criterion B assessment
- `DurationAssessment` - Criterion C notes
- `DifferentialDiagnosis` - Alternative considerations
- `RiskFactorsIdentified` - Contributing factors
- `RecommendedActions` - Clinical next steps
- `ClinicalNotes` - Important caveats and limitations

### CriterionAEvaluation
Detailed assessment of each symptom with:
- `PresenceLevel` - Not Present to Clearly Present
- `Severity` - 0-4 scale
- `Evidence` - Supporting observations
- `Notes` - Additional context
- `TotalSymptomsPresent` - Count of identified symptoms
- `CriterionAMet` - Boolean (requires ≥2 symptoms, with ≥1 being A1, A2, or A3)

## Service Implementation

### New Methods

#### `GenerateExtendedRiskAssessmentAsync(SessionData)`
- Generates comprehensive assessment including schizophrenia evaluation
- Uses GPT-5/O3 models for enhanced analysis
- Tracks processing time
- Timeout: 2 minutes (vs 30 seconds for standard)
- Includes audio transcription analysis when available

#### `UpdateSessionWithExtendedRiskAssessmentAsync(string sessionId)`
- Asynchronous update of session with extended assessment
- Checks if assessment already exists before generating
- Updates session storage with results

#### `BuildExtendedRiskAssessmentPrompt(SessionData)`
- Creates comprehensive prompt including:
  - All standard risk assessment data
  - Audio transcription (when available)
  - Complete DSM-5 schizophrenia criteria
  - Differential diagnosis requirements
  - Cultural considerations
  - Clinical caveats and limitations

#### `CallAzureOpenAIForExtendedAssessmentAsync(string)`
- Specialized API call for extended assessment
- Prefers GPT-5/O3 models (logs warning if unavailable)
- Extended timeout (2 minutes)
- Higher max tokens (4000+)
- Specialized system message emphasizing psychiatric expertise

#### `ParseExtendedRiskAssessmentResponse(string)`
- Parses complex JSON response
- Validates all constraint values
- Sets metadata (timestamp, model version, extended flag)

## Updated Methods

### `BuildRiskAssessmentPrompt(SessionData)`
Now includes audio transcription section when available, enabling:
- Speech pattern analysis
- Emotional tone assessment
- Thought process evaluation

## Usage

### Standard Assessment (Quick)
```csharp
var assessment = await riskAssessmentService.GenerateRiskAssessmentAsync(sessionData);
await riskAssessmentService.UpdateSessionWithRiskAssessmentAsync(sessionId);
```

### Extended Assessment (Comprehensive)
```csharp
var extendedAssessment = await riskAssessmentService.GenerateExtendedRiskAssessmentAsync(sessionData);
await riskAssessmentService.UpdateSessionWithExtendedRiskAssessmentAsync(sessionId);
```

### Accessing Results
```csharp
var session = await sessionStorageService.GetSessionDataAsync(sessionId);

// Standard assessment
var riskLevel = session.RiskAssessment?.OverallRiskLevel;

// Extended assessment with schizophrenia evaluation
var schizophreniaLikelihood = session.ExtendedRiskAssessment?.SchizophreniaAssessment?.OverallLikelihood;
var criterionAMet = session.ExtendedRiskAssessment?.SchizophreniaAssessment?.CriterionAEvaluation?.CriterionAMet;
var processingTime = session.ExtendedRiskAssessment?.ProcessingTimeMs;
```

## Clinical Considerations

### Important Caveats
1. **Limited Data Context**: Assessment based on single session data
2. **Duration Criterion**: Cannot fully assess 6-month duration requirement
3. **Cultural Sensitivity**: AI assessment may not fully account for cultural variations
4. **Formal Diagnosis**: Requires comprehensive clinical interview by licensed professional
5. **Differential Diagnosis**: Medical evaluation needed to rule out other conditions
6. **Transcription Quality**: Assessment quality depends on transcription accuracy

### Likelihood Interpretations

- **None**: No evidence of schizophrenia-related symptoms
- **Minimal**: Very slight indications, likely not clinically significant
- **Low**: Some symptoms present but not meeting diagnostic criteria
- **Moderate**: Multiple symptoms present, warrants further evaluation
- **High**: Strong evidence of multiple criteria being met
- **Very High**: Clear evidence suggesting meeting DSM-5 diagnostic criteria

**Note**: Even "Very High" likelihood requires formal clinical evaluation for diagnosis

## Performance Characteristics

### Standard Assessment
- Processing Time: 5-30 seconds
- Model: Standard GPT (GPT-4, etc.)
- Timeout: 30 seconds
- Max Tokens: Configured value
- Focus: Depression/anxiety risk

### Extended Assessment
- Processing Time: 30 seconds - 2 minutes
- Model: GPT-5/O3 preferred
- Timeout: 2 minutes
- Max Tokens: ≥4000
- Focus: Comprehensive including schizophrenia

## Model Configuration

The system automatically detects GPT-5/O3 models by deployment name and adjusts:
- Parameter support (GPT-5 has limited parameters)
- Timeout expectations
- Token limits
- System message complexity

### Recommended Deployment Names
- `gpt-5-preview`
- `gpt-o3-mini`
- `o3-preview`
- Any name containing "gpt-5" or "o3"

## Error Handling

Both assessments include comprehensive error handling:
- Configuration validation
- API timeout management
- JSON parsing error recovery
- Value constraint enforcement
- Detailed logging at all stages

## Logging

Structured logging includes:
- Method names with `[MethodName]` prefix
- Session IDs for traceability
- Processing times for performance monitoring
- Model information (GPT-5 vs standard)
- Response lengths and validation results
- Warnings for configuration issues

## Future Enhancements

Potential improvements:
1. Support for additional DSM-5 disorders
2. Longitudinal assessment (multiple sessions)
3. Severity scoring trends over time
4. Integration with structured clinical interviews
5. Support for additional languages/transcription formats
6. Risk stratification algorithms
7. Treatment response prediction

## References

- **DSM-5**: Diagnostic and Statistical Manual of Mental Disorders, Fifth Edition
- **Criterion 295.90 (F20.9)**: Schizophrenia diagnostic criteria
- **Azure OpenAI**: GPT-5/O3 model documentation
