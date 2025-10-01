# Extended Risk Assessment - Integration Guide

## Overview

The Extended Risk Assessment feature has been fully implemented with both backend Azure Functions and frontend React components. This guide explains how to integrate the extended assessment into your application.

## Components Created

### Backend (Azure Functions)

#### `ExtendedRiskAssessmentFunctions.cs`
Location: `BehavioralHealthSystem.Functions/Functions/ExtendedRiskAssessmentFunctions.cs`

**Endpoints:**
- `POST /api/sessions/{sessionId}/extended-risk-assessment` - Generate new extended assessment
- `GET /api/sessions/{sessionId}/extended-risk-assessment` - Retrieve existing assessment
- `DELETE /api/sessions/{sessionId}/extended-risk-assessment` - Delete assessment (allows regeneration)
- `GET /api/sessions/{sessionId}/extended-risk-assessment/status` - Check assessment availability

**Features:**
- Caching: Returns existing assessment if available
- Timeout: 2-minute timeout for GPT-5/O3 processing
- Processing time tracking: Records milliseconds for performance monitoring
- Comprehensive error handling and logging

### Frontend (React/TypeScript)

#### 1. Type Definitions (`extendedRiskAssessment.ts`)
Location: `BehavioralHealthSystem.Web/src/types/extendedRiskAssessment.ts`

TypeScript interfaces for:
- `ExtendedRiskAssessment`
- `SchizophreniaAssessment`
- `CriterionAEvaluation`
- `SymptomPresence`
- `FunctionalImpairmentAssessment`

Helper functions:
- `getSeverityLabel()`, `getSeverityColor()`
- `getLikelihoodColor()`, `getImpairmentColor()`
- `getRiskLevelColor()`, `formatProcessingTime()`

#### 2. Display Component (`ExtendedRiskAssessmentDisplay.tsx`)
Location: `BehavioralHealthSystem.Web/src/components/ExtendedRiskAssessmentDisplay.tsx`

A comprehensive UI component with three tabs:
- **Overview**: Risk summary, schizophrenia likelihood, quick facts
- **Schizophrenia Evaluation**: DSM-5 Criteria A/B/C with detailed symptom cards
- **Clinical Details**: Risk factors, recommendations, confidence levels

Styles: `BehavioralHealthSystem.Web/src/styles/extended-risk-assessment.scss`

#### 3. Button Component (`ExtendedRiskAssessmentButton.tsx`)
Location: `BehavioralHealthSystem.Web/src/components/ExtendedRiskAssessmentButton.tsx`

A ready-to-use button component that:
- Checks assessment status
- Generates assessment with loading state
- Displays assessment when available
- Shows processing time and status information
- Handles errors gracefully

Styles: `BehavioralHealthSystem.Web/src/styles/extended-risk-assessment-button.scss`

#### 4. API Utilities
Location: `BehavioralHealthSystem.Web/src/utils/api.ts`

Added endpoint builders:
```typescript
extendedRiskAssessment = {
  generate: (sessionId: string) => buildUrl(...),
  get: (sessionId: string) => buildUrl(...),
  delete: (sessionId: string) => buildUrl(...),
  status: (sessionId: string) => buildUrl(...)
}
```

## Integration Examples

### Example 1: Basic Integration (Recommended)

```typescript
import { ExtendedRiskAssessmentButton } from '../components/ExtendedRiskAssessmentButton';

// In your component
<ExtendedRiskAssessmentButton
  sessionId={currentSessionId}
  apiBaseUrl={API_BASE_URL}
  onComplete={(assessment) => {
    console.log('Assessment completed:', assessment);
    // Handle completion (e.g., update UI, show notification)
  }}
  onError={(error) => {
    console.error('Assessment error:', error);
    // Handle error (e.g., show error toast)
  }}
/>
```

### Example 2: Manual API Calls

```typescript
import { apiPost, apiGet } from '../utils/api';
import { ExtendedRiskAssessmentResponse } from '../types/extendedRiskAssessment';

// Generate assessment
const generateExtendedAssessment = async (sessionId: string) => {
  const response = await apiPost<ExtendedRiskAssessmentResponse>(
    `${API_BASE_URL}/api/sessions/${sessionId}/extended-risk-assessment`,
    {},
    { timeout: 180000 } // 3 minute timeout
  );

  if (response.success && response.data?.extendedRiskAssessment) {
    return response.data.extendedRiskAssessment;
  }
  
  throw new Error(response.error || 'Failed to generate assessment');
};

// Retrieve existing assessment
const getExtendedAssessment = async (sessionId: string) => {
  const response = await apiGet<ExtendedRiskAssessmentResponse>(
    `${API_BASE_URL}/api/sessions/${sessionId}/extended-risk-assessment`
  );

  if (response.success && response.data?.extendedRiskAssessment) {
    return response.data.extendedRiskAssessment;
  }
  
  return null;
};
```

### Example 3: Custom Display

```typescript
import { ExtendedRiskAssessmentDisplay } from '../components/ExtendedRiskAssessmentDisplay';
import { ExtendedRiskAssessment } from '../types/extendedRiskAssessment';

// In your component
const [assessment, setAssessment] = useState<ExtendedRiskAssessment | null>(null);

// After fetching assessment...
{assessment && (
  <ExtendedRiskAssessmentDisplay 
    assessment={assessment}
    className="my-custom-class"
  />
)}
```

### Example 4: Adding to ControlPanel

```typescript
// In ControlPanel.tsx or similar page component
import { ExtendedRiskAssessmentButton } from '../components/ExtendedRiskAssessmentButton';

// Add to your session detail view
<div className="control-panel__session-actions">
  {/* Existing buttons */}
  <ExtendedRiskAssessmentButton
    sessionId={selectedSession.sessionId}
    apiBaseUrl={API_BASE_URL}
    onComplete={(assessment) => {
      // Refresh session data or show success notification
      console.log('Extended assessment generated:', assessment.schizophreniaAssessment.overallLikelihood);
    }}
    onError={(error) => {
      // Show error notification
      alert(`Error: ${error}`);
    }}
  />
</div>
```

### Example 5: Adding to UploadAnalyze Page

```typescript
// In UploadAnalyze.tsx after predictions are complete
import { ExtendedRiskAssessmentButton } from '../components/ExtendedRiskAssessmentButton';

// Add after the analysis results section
{sessionId && predictionComplete && (
  <section className="upload-analyze__extended-assessment">
    <h2>Advanced AI Assessment</h2>
    <ExtendedRiskAssessmentButton
      sessionId={sessionId}
      apiBaseUrl={API_BASE_URL}
      className="upload-analyze__extended-assessment-btn"
    />
  </section>
)}
```

## API Endpoints Reference

### Generate Extended Assessment
**POST** `/api/sessions/{sessionId}/extended-risk-assessment`

**Response:**
```json
{
  "success": true,
  "message": "Extended risk assessment generated successfully",
  "extendedRiskAssessment": { /* full assessment object */ },
  "processingTimeSeconds": 45.2,
  "cached": false
}
```

**Processing Time:** 30-120 seconds (depends on GPT-5/O3 model)

### Retrieve Assessment
**GET** `/api/sessions/{sessionId}/extended-risk-assessment`

**Response:**
```json
{
  "success": true,
  "extendedRiskAssessment": { /* full assessment object */ }
}
```

### Check Status
**GET** `/api/sessions/{sessionId}/extended-risk-assessment/status`

**Response:**
```json
{
  "success": true,
  "sessionId": "abc123",
  "hasExtendedAssessment": true,
  "hasStandardAssessment": true,
  "hasTranscription": true,
  "hasPrediction": true,
  "generatedAt": "2025-09-30T12:34:56Z",
  "processingTimeMs": 45234,
  "overallLikelihood": "Low",
  "canGenerate": true
}
```

## Configuration Requirements

### Backend Configuration

Ensure your `local.settings.json` or Azure configuration includes:

```json
{
  "AzureOpenAI": {
    "Enabled": true,
    "Endpoint": "https://your-openai-resource.openai.azure.com/",
    "ApiKey": "your-api-key",
    "DeploymentName": "gpt-5-deployment-name",
    "ApiVersion": "2024-08-01-preview",
    "MaxTokens": 4000
  }
}
```

**Important:** The deployment name should contain "gpt-5" or "o3" for optimal results.

### Frontend Configuration

Update your API base URL constant:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071';
```

## Features

### Backend
- ✅ Asynchronous processing with 2-minute timeout
- ✅ GPT-5/O3 model detection and optimization
- ✅ Complete DSM-5 Criterion A (5 symptoms) evaluation
- ✅ Functional impairment assessment (Criterion B)
- ✅ Duration assessment (Criterion C)
- ✅ Differential diagnosis considerations
- ✅ Audio transcription integration
- ✅ Caching (returns existing assessment)
- ✅ Processing time tracking
- ✅ Comprehensive error handling

### Frontend
- ✅ Three-tab interface (Overview, Schizophrenia, Details)
- ✅ DSM-5 symptom severity visualization (0-4 scale)
- ✅ Color-coded risk levels and likelihood indicators
- ✅ Functional impairment breakdown (work, interpersonal, self-care)
- ✅ Confidence level progress bars
- ✅ Clinical recommendations and immediate actions
- ✅ Responsive design (mobile-friendly)
- ✅ Dark mode support
- ✅ Print-friendly layout
- ✅ Loading states with time estimates
- ✅ Status checking before generation

## Clinical Considerations

**Important Disclaimer:** This assessment is generated by AI and should not replace comprehensive clinical evaluation by a qualified mental health professional.

**Limitations:**
- Based on limited session data
- Cannot fully assess duration criteria (requires 6+ months observation)
- Requires comprehensive clinical interview for formal diagnosis
- Must rule out other conditions through medical evaluation
- Cultural context must be carefully considered

**Recommended Use:**
- As a preliminary screening tool
- To identify cases requiring further evaluation
- To supplement (not replace) clinical judgment
- For research and quality improvement purposes

## Testing

### Backend Testing
```bash
cd BehavioralHealthSystem.Functions
dotnet test
```

### Frontend Testing
```bash
cd BehavioralHealthSystem.Web
npm test
```

### Manual Testing
1. Start Azure Functions locally: `func start`
2. Start frontend dev server: `npm run dev`
3. Create a session with prediction and transcription data
4. Click "Generate Extended Risk Assessment"
5. Verify 30-120 second processing time
6. Review all three tabs of results

## Performance

**Expected Processing Times:**
- Standard assessment: 5-15 seconds
- Extended assessment: 30-120 seconds
- Status check: <1 second
- Retrieval: <1 second

**Token Usage:**
- Standard prompt: ~1,000 tokens
- Extended prompt: ~2,500 tokens
- GPT-5 response: ~1,500-2,500 tokens

## Troubleshooting

### Assessment Takes Too Long
- Check Azure OpenAI deployment status
- Verify GPT-5/O3 model is deployed and available
- Check network connectivity
- Review Azure Function timeout settings

### Assessment Returns Null
- Ensure session has prediction data
- Verify Azure OpenAI configuration
- Check Function logs for errors
- Confirm deployment name contains "gpt-5" or "o3"

### UI Not Displaying Correctly
- Verify SCSS files are imported
- Check browser console for errors
- Ensure all dependencies are installed
- Clear build cache and rebuild

## Next Steps

1. **Add unit tests** for frontend components
2. **Implement caching** in frontend to avoid refetching
3. **Add WebSocket** for real-time progress updates
4. **Create admin dashboard** for monitoring assessments
5. **Add export functionality** for PDF/report generation
6. **Implement comparison view** for tracking changes over time

## Support

For questions or issues:
- Review documentation files in `/docs/`
- Check Azure Function logs
- Review browser console for frontend errors
- Consult DSM-5 documentation for clinical questions
