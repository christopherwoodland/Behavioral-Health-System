# DSM-5 Multi-Condition Assessment - Quick Reference

## For Developers

### Key Files

**Backend**:
- `BehavioralHealthSystem.Helpers/Services/DSM5DataService.cs` - DSM-5 data service
- `BehavioralHealthSystem.Functions/Functions/DSM5AdministrationFunctions.cs` - API endpoints

**Frontend**:
- `src/services/dsm5Service.ts` - Service layer for DSM-5 API calls
- `src/components/DSM5ConditionSelector.tsx` - Condition selection UI
- `src/components/ExtendedRiskAssessmentButton.tsx` - Assessment trigger
- `src/pages/SessionDetail.tsx` - Integration point
- `src/types/dsm5Types.ts` - TypeScript type definitions

### API Endpoints

```
GET  /api/dsm5-admin/data-status              - Check initialization status
GET  /api/dsm5-admin/conditions               - List available conditions
GET  /api/dsm5-admin/conditions/{id}          - Get condition details
POST /api/dsm5-admin/validate-extraction      - Test PDF extraction
POST /api/dsm5-admin/upload-data              - Upload extracted data
```

### Frontend Service Usage

```typescript
import { dsm5Service } from '@/services/dsm5Service';

// Check if DSM-5 data is initialized
const status = await dsm5Service.getDataStatus();

// Get all conditions
const conditions = await dsm5Service.getAvailableConditions();

// Get conditions by category
const anxietyConditions = await dsm5Service.getConditionsByCategory('Anxiety Disorders');

// Search conditions
const searchResults = await dsm5Service.searchConditions('depression');
```

### Component Usage

```tsx
import { DSM5ConditionSelector } from '@/components/DSM5ConditionSelector';

const [selectedConditions, setSelectedConditions] = useState<string[]>([]);

<DSM5ConditionSelector
  selectedConditions={selectedConditions}
  onSelectionChange={setSelectedConditions}
  maxSelections={5}
  disabled={false}
/>
```

## For Testing

### Test Checklist

**Frontend (No Backend Required)**:
- [ ] Selector renders in SessionDetail page
- [ ] Search filters conditions correctly
- [ ] Category dropdown works
- [ ] Can select up to 5 conditions
- [ ] Cannot select more than max
- [ ] Selected badges display
- [ ] Can remove selections via badge X button
- [ ] Clear All button works
- [ ] Dark mode styling correct
- [ ] Responsive on mobile

**Backend (Requires Working Host)**:
- [ ] Run `DSM5_TEST_SCRIPT.ps1`
- [ ] All 5 endpoints respond
- [ ] Data status shows initialization state
- [ ] Conditions list populated
- [ ] Condition details include criteria
- [ ] PDF extraction works

**Integration**:
- [ ] Selecting conditions enables assessment button
- [ ] Conditions sent in API request
- [ ] Assessment includes selected conditions
- [ ] Results display correctly

## For Troubleshooting

### Functions Host Won't Start

```powershell
# Check for port conflicts
netstat -ano | findstr :7071

# Start with verbose logging
cd BehavioralHealthSystem.Functions
func start --verbose --port 7071

# Check Windows Event Viewer
eventvwr.msc  # Application logs
```

### Frontend Errors

**"Failed to load DSM-5 conditions"**:
- Check API is running on port 7071
- Verify CORS settings
- Check network tab in browser DevTools

**"Config undefined"**:
- Check `.env` file exists
- Verify `VITE_API_BASE` environment variable
- Restart Vite dev server

### Backend Errors

**"Document Intelligence credentials not found"**:
- Check `local.settings.json` has `DSM5_DOCUMENT_INTELLIGENCE_KEY`
- Verify key is valid in Azure Portal

**"Blob storage not accessible"**:
- Check `AzureWebJobsStorage` connection string
- Verify storage account exists
- Check container `dsm5-data` created

## Status Overview

✅ **Complete**:
- Azure configuration
- Frontend service layer
- UI components
- State management
- API integration

⚠️ **Blocked**:
- Functions host stability
- DSM-5 PDF processing
- Condition catalog building
- End-to-end testing

## Quick Commands

```powershell
# Start Functions backend (once fixed)
cd BehavioralHealthSystem.Functions
func start

# Start frontend
cd BehavioralHealthSystem.Web
npm run dev

# Run tests
cd BehavioralHealthSystem.Tests
dotnet test

# Test DSM-5 endpoints (once host stable)
.\DSM5_TEST_SCRIPT.ps1
```

## Configuration

### Local Settings Required

```json
{
  "Values": {
    "DSM5_DOCUMENT_INTELLIGENCE_ENDPOINT": "https://doc-intel-behavioral-health.cognitiveservices.azure.com/",
    "DSM5_DOCUMENT_INTELLIGENCE_KEY": "<your-key>",
    "DSM5_STORAGE_ACCOUNT_NAME": "aistgvi",
    "DSM5_CONTAINER_NAME": "dsm5-data",
    "AzureWebJobsStorage": "<connection-string>"
  }
}
```

### Environment Variables

```env
VITE_API_BASE=http://localhost:7071/api
```

## Known Limitations

1. **Max 5 Conditions**: Prevents overwhelming AI analysis
2. **Backend Blocked**: Host issue prevents testing
3. **No Mock Data**: Service expects real API responses
4. **No Persistence**: Selections not saved to session
5. **No Recommendations**: No AI-suggested conditions (yet)
