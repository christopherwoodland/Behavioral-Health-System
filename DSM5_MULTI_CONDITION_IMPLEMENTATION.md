# DSM-5 Multi-Condition Assessment Implementation

## Overview

This document describes the comprehensive implementation of a dynamic DSM-5 multi-condition assessment system that extends the existing schizophrenia-focused assessment to support evaluation against any mental health condition listed in the DSM-5.

## Architecture Overview

The solution consists of several key components:

### 1. **DSM-5 PDF Extraction Service** (`DSM5DataService`)
- **Purpose**: Extracts structured diagnostic criteria from the DSM-5 PDF using Azure Document Intelligence
- **Technology**: Azure AI Document Intelligence, Azure Blob Storage
- **Key Features**:
  - Automated PDF processing and text extraction
  - Structured parsing of diagnostic criteria
  - Blob storage for efficient data retrieval
  - Page-range processing for targeted extraction

### 2. **Multi-Condition Assessment Models**
- **MultiConditionExtendedRiskAssessment**: Extended assessment supporting multiple conditions
- **ConditionAssessmentResult**: Individual condition evaluation results
- **DSM5ConditionData**: Structured DSM-5 condition data with diagnostic criteria
- **Backward compatibility** with existing SchizophreniaAssessment

### 3. **Dynamic Assessment Engine** (Enhanced `RiskAssessmentService`)
- **Purpose**: Generates AI-powered assessments against selected DSM-5 conditions
- **Features**:
  - Dynamic prompt generation based on selected conditions
  - GPT-5/O3 model integration for complex evaluations
  - Cross-condition differential diagnosis
  - Confidence scoring and evidence tracking

### 4. **User Interface Components**
- **DSM5ConditionSelector**: React component for condition selection
- **Multi-condition assessment displays**
- **Enhanced session management UI**

## Implementation Details

### Phase 1: Core Infrastructure ✅

#### DSM-5 Data Models (`DSM5Models.cs`)
```csharp
public class DSM5ConditionData
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Code { get; set; }
    public string Category { get; set; }
    public List<DSM5DiagnosticCriterion> DiagnosticCriteria { get; set; }
    // ... additional properties
}

public class DSM5DiagnosticCriterion
{
    public string CriterionId { get; set; } // A, B, C, etc.
    public string Title { get; set; }
    public string Description { get; set; }
    public List<DSM5SubCriterion> SubCriteria { get; set; }
    public bool IsRequired { get; set; }
    public int? MinimumRequired { get; set; }
}
```

#### Multi-Condition Assessment Models (`MultiConditionExtendedRiskAssessment.cs`)
```csharp
public class MultiConditionExtendedRiskAssessment : RiskAssessment
{
    public bool IsMultiCondition { get; set; }
    public List<string> EvaluatedConditions { get; set; }
    public List<ConditionAssessmentResult> ConditionAssessments { get; set; }
    public string OverallAssessmentSummary { get; set; }
    public string HighestRiskCondition { get; set; }
    // Backward compatibility
    public SchizophreniaAssessment? SchizophreniaAssessment { get; set; }
}

public class ConditionAssessmentResult
{
    public string ConditionId { get; set; }
    public string ConditionName { get; set; }
    public string OverallLikelihood { get; set; }
    public double ConfidenceScore { get; set; }
    public List<CriterionEvaluationResult> CriteriaEvaluations { get; set; }
    // ... additional assessment details
}
```

### Phase 2: PDF Extraction Service ✅

#### DSM-5 Data Service (`DSM5DataService.cs`)
- **Azure Document Intelligence Integration**: Uses prebuilt-layout model for structured text extraction
- **Blob Storage Management**: Stores extracted conditions in organized blob structure
- **Pattern Matching**: Identifies DSM-5 diagnostic codes and condition structure
- **Metadata Tracking**: Maintains extraction confidence and processing details

#### Key Methods:
```csharp
Task<DSM5ExtractionResult> ExtractDiagnosticCriteriaAsync(string pdfUrl, string? pageRanges, bool autoUpload)
Task<List<DSM5ConditionData>> GetAvailableConditionsAsync(string? category, string? searchTerm, bool includeDetails)
Task<DSM5ConditionData?> GetConditionDetailsAsync(string conditionId)
Task<Dictionary<string, DSM5ConditionData>> GetConditionsForAssessmentAsync(List<string> conditionIds)
```

#### Azure Functions (`DSM5AdministrationFunctions.cs`)
- **POST /api/dsm5-admin/validate-extraction**: Extract data from PDF
- **GET /api/dsm5-admin/conditions**: List available conditions
- **GET /api/dsm5-admin/conditions/{id}**: Get condition details
- **POST /api/dsm5-admin/upload-data**: Upload extracted data to storage
- **GET /api/dsm5-admin/data-status**: Check data initialization status

### Phase 3: Enhanced Assessment Engine ✅

#### Multi-Condition Assessment Methods (Added to `RiskAssessmentService`)
```csharp
public async Task<MultiConditionExtendedRiskAssessment?> GenerateMultiConditionAssessmentAsync(
    SessionData sessionData, 
    List<string> selectedConditions, 
    AssessmentOptions? options = null)

public async Task<bool> UpdateSessionWithMultiConditionAssessmentAsync(
    string sessionId, 
    List<string> selectedConditions, 
    AssessmentOptions? options = null)
```

#### Dynamic Prompt Generation
- **Condition-Specific Criteria**: Dynamically includes DSM-5 criteria for selected conditions
- **Cross-Condition Analysis**: Evaluates differential diagnosis across multiple conditions
- **Evidence-Based Scoring**: Provides detailed evidence for each criterion evaluation
- **Clinical Context**: Maintains clinical best practices and limitations

### Phase 4: User Interface Components ✅

#### DSM-5 Condition Selector (`DSM5ConditionSelector.tsx`)
- **Multi-selection interface** with category filtering
- **Search functionality** across condition names, codes, and descriptions
- **Visual feedback** for selection limits and status
- **Accessibility features** and responsive design

#### TypeScript Types (`dsm5Types.ts`)
- Complete type definitions for all DSM-5 models
- API response interfaces
- UI state management types
- Validation error types

## Configuration Requirements

### Azure Services Setup

#### 1. **Azure Document Intelligence**
```bash
# Environment Variables
DSM5_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-document-intelligence.cognitiveservices.azure.com/
DSM5_STORAGE_ACCOUNT_NAME=your-storage-account
DSM5_CONTAINER_NAME=dsm5-data
```

#### 2. **Azure Blob Storage**
- **Container Structure**:
  ```
  dsm5-data/
  ├── conditions/
  │   ├── schizophrenia.json
  │   ├── major-depression.json
  │   └── ...
  └── metadata/
      └── extraction-history.json
  ```

#### 3. **Managed Identity Configuration**
- Document Intelligence access
- Blob Storage read/write permissions
- Function App identity configuration

### Package Dependencies

#### Backend (.NET)
```xml
<PackageReference Include="Azure.AI.DocumentIntelligence" Version="1.0.0-beta.3" />
<PackageReference Include="Azure.Identity" Version="1.10.4" />
<PackageReference Include="Azure.Storage.Blobs" Version="12.19.1" />
```

#### Frontend (React/TypeScript)
- Enhanced types for multi-condition support
- Updated component interfaces
- API client modifications

## Testing Strategy

### 1. **DSM-5 Extraction Testing** 
```powershell
# Test script provided: test-dsm5-extraction.ps1
.\test-dsm5-extraction.ps1 -PageRanges "123-124" -AutoUpload $false
```

### 2. **Multi-Condition Assessment Testing**
- Select multiple conditions (e.g., Depression, Anxiety, PTSD)
- Validate cross-condition analysis
- Test confidence scoring accuracy
- Verify differential diagnosis logic

### 3. **Performance Testing**
- Large PDF processing (full DSM-5)
- Concurrent condition evaluations
- Assessment generation timing
- Blob storage efficiency

## Deployment Process

### Phase 1: Infrastructure Setup
1. **Deploy Azure Resources**:
   - Document Intelligence service
   - Storage account with blob container
   - Configure Managed Identity

2. **Initialize DSM-5 Data**:
   ```bash
   # Extract from PDF and upload to blob storage
   POST /api/dsm5-admin/validate-extraction
   {
     "pdfUrl": "https://...",
     "pageRanges": null,  // Process entire PDF
     "autoUpload": true
   }
   ```

### Phase 2: Application Deployment
1. **Backend Services**:
   - Deploy Functions with new DSM-5 services
   - Update dependency injection configuration
   - Configure environment variables

2. **Frontend Updates**:
   - Deploy new DSM-5 condition selector
   - Update assessment workflow
   - Integrate multi-condition displays

### Phase 3: Data Migration
1. **Backward Compatibility**:
   - Existing schizophrenia assessments remain functional
   - Gradual migration to multi-condition format
   - Preserve historical assessment data

## Usage Workflow

### 1. **Condition Selection**
```typescript
// User selects conditions through DSM5ConditionSelector
const selectedConditions = ['major-depression', 'generalized-anxiety', 'ptsd'];
```

### 2. **Assessment Initiation**
```csharp
// API call to start multi-condition assessment
POST /api/sessions/{sessionId}/multi-condition-assessment
{
  "selectedConditions": ["major-depression", "generalized-anxiety", "ptsd"],
  "assessmentOptions": {
    "includeStandardRisk": true,
    "maxProcessingTimeSeconds": 120,
    "confidenceThreshold": 0.3
  }
}
```

### 3. **Results Processing**
```typescript
// Results include assessments for each condition
interface MultiConditionResult {
  conditionAssessments: ConditionAssessmentResult[];
  overallRiskLevel: string;
  highestRiskCondition: string;
  crossConditionDifferentialDiagnosis: string[];
}
```

## Security Considerations

### 1. **Data Protection**
- **HIPAA Compliance**: All patient data encrypted in transit and at rest
- **Access Controls**: Role-based access to DSM-5 administration functions
- **Audit Logging**: Complete assessment and extraction activity tracking

### 2. **Azure Security**
- **Managed Identity**: No stored credentials for Azure services
- **Network Security**: Private endpoints for storage and cognitive services
- **Least Privilege**: Minimal required permissions for each service

## Performance Optimizations

### 1. **Caching Strategy**
- **Condition Data**: Cache frequently accessed DSM-5 conditions
- **Assessment Results**: Cache completed assessments per session
- **PDF Processing**: Cache extraction results by page range

### 2. **Parallel Processing**
- **Multi-Condition Evaluation**: Parallel assessment of multiple conditions
- **Async Operations**: Non-blocking assessment generation
- **Background Jobs**: Long-running PDF processing

## Monitoring and Observability

### 1. **Key Metrics**
- **Assessment Generation Time**: Track processing duration by condition count
- **PDF Extraction Success Rate**: Monitor document intelligence performance
- **API Response Times**: Track endpoint performance
- **Error Rates**: Monitor service reliability

### 2. **Application Insights Integration**
- **Custom Telemetry**: Track assessment outcomes and confidence scores
- **Dependency Tracking**: Monitor Azure service calls
- **User Journey Analytics**: Track assessment workflow completion

## Future Enhancements

### 1. **Advanced Features**
- **Machine Learning Models**: Train custom models for improved accuracy
- **Clinical Decision Support**: Integration with clinical guidelines
- **Longitudinal Analysis**: Track assessment changes over time
- **Multi-Language Support**: Support for international DSM-5 translations

### 2. **Integration Opportunities**
- **EHR Integration**: Connect with electronic health record systems
- **Clinical Workflow**: Integration with existing clinical decision tools
- **Research Platform**: Anonymized data for mental health research

## Conclusion

This comprehensive DSM-5 multi-condition assessment system transforms the existing single-condition (schizophrenia) assessment into a dynamic, scalable platform capable of evaluating any mental health condition from the DSM-5. The solution maintains backward compatibility while providing the flexibility to assess multiple conditions simultaneously, offering clinicians a powerful tool for comprehensive mental health evaluation.

The implementation follows Azure best practices for security, scalability, and maintainability, ensuring the system can grow with organizational needs while maintaining high standards for clinical accuracy and data protection.