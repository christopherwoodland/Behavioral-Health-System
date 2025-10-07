# PHQ Assessment System Test

## Overview
This document describes how to test the new PHQ assessment system with Tars.

## Components
1. **Frontend Service**: `phqAssessmentService.ts` - Manages PHQ-2 and PHQ-9 assessments
2. **Backend Function**: `SavePhqAssessmentFunction.cs` - Saves assessments to Azure blob storage
3. **Agent Integration**: Integrated into `RealtimeAgentExperience.tsx`

## Testing Steps

### 1. Start Local Development
```powershell
# Start Functions
cd BehavioralHealthSystem.Functions
func start --port 7071

# Start Web App (in separate terminal)
cd BehavioralHealthSystem.Web
npm start
```

### 2. Test Voice Commands
Open the Realtime Agent Experience and try these voice commands:

#### PHQ-2 (Rapid Depression Screening)
1. Say: **"invoke-phq2"**
2. Expected: Tars starts PHQ-2 assessment
3. Answer questions 1-2 with scores 0-3
4. Assessment completes automatically
5. Results saved to blob storage

#### PHQ-9 (Comprehensive Depression Assessment)
1. Say: **"invoke-phq9"**
2. Expected: Tars starts PHQ-9 assessment
3. Answer questions 1-9 with scores 0-3
4. Assessment completes automatically
5. Results saved to blob storage

### 3. Test Invalid Responses
- Try answering with invalid numbers (4, 5, -1)
- Try non-numeric responses
- Test the 3-attempt retry system
- Test skipping questions and revisiting them

### 4. Test Crisis Detection
- Answer Question 9 (PHQ-9) with score > 0
- Expected: Special crisis intervention message

### 5. Verify Blob Storage
Check Azure Storage Explorer or portal for saved assessments in the `phq-assessments` container.

## Assessment Types

### PHQ-2 Questions
1. Little interest or pleasure in doing things
2. Feeling down, depressed, or hopeless

**Scoring**: 0-6 total, cutoff ≥3 for positive screen

### PHQ-9 Questions
1. Little interest or pleasure in doing things
2. Feeling down, depressed, or hopeless
3. Trouble falling/staying asleep or sleeping too much
4. Feeling tired or having little energy
5. Poor appetite or overeating
6. Feeling bad about yourself
7. Trouble concentrating
8. Moving/speaking slowly or being restless
9. Thoughts of death or self-harm

**Scoring**: 0-27 total
- 0-4: Minimal
- 5-9: Mild
- 10-14: Moderate
- 15-19: Moderately severe
- 20-27: Severe

## Voice Command Examples
- "I'd like to take the PHQ-9 assessment"
- "Can you start the depression screening?"
- "invoke-phq2"
- "invoke-phq9"
- "Let's do the mental health assessment"

## Expected Behavior
1. Natural conversation flow with Tars
2. Question-by-question progression
3. Retry logic for invalid answers
4. Skip and revisit functionality
5. Automatic scoring and interpretation
6. Crisis intervention for suicidal ideation
7. Results saved to Azure blob storage
8. Completion summary with recommendations

## Error Handling
- Invalid responses trigger retry (max 3 attempts)
- Blob storage failures don't block assessment completion
- Network errors are gracefully handled
- Assessment state is maintained during conversation