# DSM-5 Data Management Quick Reference

## Overview
The system uses Azure Document Intelligence to extract DSM-5 conditions from the official DSM-5 PDF manual. This data is stored in Azure Blob Storage and served through API endpoints.

## Prerequisites

1. **DSM-5 PDF Manual** - You need the official DSM-5 diagnostic manual in PDF format
2. **Azure Functions Running** - Local or deployed Functions host must be accessible
3. **Azure Storage Account** - Configured in `local.settings.json` (aistgvi)
4. **Document Intelligence** - API key configured in `DSM5_DOCUMENT_INTELLIGENCE_KEY`

## Initial Data Loading

### Option 1: Use PowerShell Script (Recommended)

```powershell
# Make sure Functions host is running
cd BehavioralHealthSystem.Functions
func start --port 7071

# In a new terminal, run the loading script
.\load-dsm5-data.ps1 -PdfPath "C:\Path\To\DSM5.pdf"
```

### Option 2: Manual API Calls

```powershell
# 1. Check current status
Invoke-RestMethod -Uri "http://localhost:7071/api/dsm5-admin/data-status" -Method GET

# 2. Extract from PDF
$pdfBytes = [System.IO.File]::ReadAllBytes("C:\DSM5\dsm5.pdf")
$pdfBase64 = [Convert]::ToBase64String($pdfBytes)

$extractRequest = @{
    pdfData = $pdfBase64
    startPage = 1
    endPage = 991
    extractConditionsOnly = $true
} | ConvertTo-Json

$extractResponse = Invoke-RestMethod `
    -Uri "http://localhost:7071/api/dsm5-admin/validate-extraction" `
    -Method POST `
    -Body $extractRequest `
    -ContentType "application/json"

# 3. Upload to storage
$uploadRequest = @{
    extractedData = $extractResponse.extractedData
    overwriteExisting = $true
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
    -Uri "http://localhost:7071/api/dsm5-admin/upload-data" `
    -Method POST `
    -Body $uploadRequest `
    -ContentType "application/json"
```

## API Endpoints

### 1. Get Data Status
**GET** `/api/dsm5-admin/data-status`

Returns current state of DSM-5 data in the system.

**Response:**
```json
{
  "success": true,
  "isInitialized": true,
  "totalConditions": 297,
  "lastUpdated": "2025-01-15T10:30:00Z",
  "blobExists": true
}
```

### 2. Get All Conditions
**GET** `/api/dsm5-admin/conditions?includeDetails=false`

Returns all DSM-5 conditions with optional details.

**Query Parameters:**
- `includeDetails` (bool): Include full diagnostic criteria (default: false)
- `category` (string): Filter by category (optional)

**Response:**
```json
{
  "success": true,
  "totalConditions": 297,
  "categories": [
    "Neurodevelopmental Disorders",
    "Schizophrenia Spectrum",
    "Bipolar Disorders",
    "..."
  ],
  "conditions": [
    {
      "conditionId": "F84.0",
      "name": "Autism Spectrum Disorder",
      "code": "F84.0",
      "category": "Neurodevelopmental Disorders",
      "diagnosticCriteria": "..." // Only if includeDetails=true
    }
  ]
}
```

### 3. Get Specific Condition
**GET** `/api/dsm5-admin/conditions/{conditionId}`

Returns detailed information for a specific condition.

**Response:**
```json
{
  "success": true,
  "condition": {
    "conditionId": "F84.0",
    "name": "Autism Spectrum Disorder",
    "code": "F84.0",
    "category": "Neurodevelopmental Disorders",
    "diagnosticCriteria": [
      "A. Persistent deficits in social communication...",
      "B. Restricted, repetitive patterns of behavior..."
    ],
    "specifiers": ["With or without intellectual impairment"],
    "severity": ["Level 1", "Level 2", "Level 3"]
  }
}
```

### 4. Validate Extraction
**POST** `/api/dsm5-admin/validate-extraction`

Test PDF extraction without saving to storage.

**Request Body:**
```json
{
  "pdfData": "base64_encoded_pdf_data",
  "startPage": 1,
  "endPage": 991,
  "extractConditionsOnly": true
}
```

**Response:**
```json
{
  "success": true,
  "conditionsFound": 297,
  "processingTimeMs": 45000,
  "extractedData": {
    "conditions": [...]
  },
  "message": "Successfully extracted DSM-5 data"
}
```

### 5. Upload Data
**POST** `/api/dsm5-admin/upload-data`

Upload extracted DSM-5 data to Azure Blob Storage.

**Request Body:**
```json
{
  "extractedData": {
    "conditions": [...]
  },
  "overwriteExisting": true
}
```

**Response:**
```json
{
  "success": true,
  "conditionsUploaded": 297,
  "blobUrl": "https://aistgvi.blob.core.windows.net/dsm5-data/conditions.json",
  "message": "DSM-5 data uploaded successfully"
}
```

## Frontend Integration

### DSM5 Condition Selector Component

The `DSM5ConditionSelector` component is already integrated in `SessionDetail.tsx`:

```typescript
import { DSM5ConditionSelector } from '../components/DSM5ConditionSelector';

// In component
const [selectedDSM5Conditions, setSelectedDSM5Conditions] = useState<string[]>([]);

// Render
<DSM5ConditionSelector
  selectedConditions={selectedDSM5Conditions}
  onSelectionChange={setSelectedDSM5Conditions}
  maxSelections={5}
/>
```

### Extended Risk Assessment with DSM-5

The `ExtendedRiskAssessmentButton` accepts DSM-5 conditions:

```typescript
<ExtendedRiskAssessmentButton
  sessionId={sessionId}
  disabled={!canRunAssessment || isGenerating}
  selectedDSM5Conditions={selectedDSM5Conditions} // Pass conditions here
/>
```

## Troubleshooting

### "All categories is empty"
This means DSM-5 data is not initialized. Run the loading script:
```powershell
.\load-dsm5-data.ps1 -PdfPath "C:\Path\To\DSM5.pdf"
```

### Cannot connect to API
Ensure Functions host is running:
```powershell
cd BehavioralHealthSystem.Functions
func start --port 7071
```

### PDF Extraction Takes Too Long
- Large PDF files can take 30-60 seconds
- The system uses Azure Document Intelligence which processes page by page
- Be patient and wait for the complete response

### Conditions Not Appearing After Upload
1. Check blob storage exists: `dsm5-data/conditions.json`
2. Verify API returns data: `GET /api/dsm5-admin/conditions`
3. Check browser console for errors in React app
4. Hard refresh the React app (Ctrl+F5)

### Invalid DSM-5 Data Format
The system expects specific JSON structure:
```json
{
  "conditions": [
    {
      "conditionId": "string",
      "name": "string",
      "code": "string",
      "category": "string",
      "diagnosticCriteria": ["string"],
      "specifiers": ["string"],
      "severity": ["string"]
    }
  ]
}
```

## Data Storage

### Blob Storage Location
- **Container:** `dsm5-data`
- **Blob Name:** `conditions.json`
- **Storage Account:** `aistgvi` (from local.settings.json)

### Viewing Data in Azure Storage Explorer
1. Open Azure Storage Explorer
2. Connect to `aistgvi` storage account
3. Navigate to `dsm5-data` container
4. Download `conditions.json` to inspect

## Security Notes

⚠️ **Important:** The DSM-5 PDF contains copyrighted material. Ensure you:
- Have a valid license for the DSM-5 manual
- Only use extracted data for authorized clinical purposes
- Do not redistribute the PDF or extracted data
- Follow HIPAA and data protection regulations

## Configuration

### Local Settings Required

```json
{
  "DSM5_DOCUMENT_INTELLIGENCE_KEY": "your_key_here",
  "DSM5_DOCUMENT_INTELLIGENCE_ENDPOINT": "https://your-endpoint.cognitiveservices.azure.com/",
  "AzureWebJobsStorage": "connection_string_to_aistgvi"
}
```

### Authentication Modes

The system supports two authentication modes:

1. **API Key (Local Development)**
   - Uses `DSM5_DOCUMENT_INTELLIGENCE_KEY`
   - Configured in `local.settings.json`

2. **Managed Identity (Azure Deployment)**
   - Uses `DefaultAzureCredential`
   - No API key needed when deployed to Azure

## Quick Commands Reference

```powershell
# Start Functions host
cd BehavioralHealthSystem.Functions; func start --port 7071

# Load DSM-5 data
.\load-dsm5-data.ps1

# Check status
Invoke-RestMethod -Uri "http://localhost:7071/api/dsm5-admin/data-status"

# Get all conditions
Invoke-RestMethod -Uri "http://localhost:7071/api/dsm5-admin/conditions"

# Get specific condition
Invoke-RestMethod -Uri "http://localhost:7071/api/dsm5-admin/conditions/F84.0"
```

## Next Steps After Loading Data

1. ✅ Data loaded successfully
2. 🔄 Refresh React app (Ctrl+F5)
3. 🏥 Navigate to a session detail page
4. 📋 Open Extended Risk Assessment section
5. ✔️ Select up to 5 DSM-5 conditions
6. 🚀 Run the extended risk assessment
7. 📊 View condition-specific analysis

## Support

For issues with:
- **PDF Extraction:** Check Document Intelligence logs and API key
- **Blob Storage:** Verify connection string and container exists
- **Frontend Display:** Check browser console and network tab
- **API Errors:** Review Functions host logs
