# PHQ Progressive Session Storage Implementation

## Overview
Reverted from embedding PHQ data in chat transcripts back to separate PHQ storage, but with **progressive saving pattern** similar to chat transcripts. This provides the best of both approaches:
- Separate storage for detailed PHQ session analysis
- Progressive saving to prevent data loss
- Dual storage: both chat transcript (with metadata) and PHQ session (detailed Q&A)

## Architecture

### Frontend (TypeScript)

#### New Service: `phqSessionService.ts`
Located: `BehavioralHealthSystem.Web/src/services/phqSessionService.ts`

**Purpose**: Manages PHQ session lifecycle with progressive saving pattern

**Key Interfaces**:
```typescript
interface PhqQuestionResponse {
  questionNumber: number;
  questionText: string;
  answer?: number; // 0-3
  attempts: number;
  skipped: boolean;
  answeredAt?: string;
}

interface PhqSession {
  userId: string;
  sessionId: string; // Same as chat transcript session ID
  assessmentId: string; // Unique ID for this assessment
  assessmentType: 'PHQ-2' | 'PHQ-9';
  createdAt: string;
  lastUpdated: string;
  completedAt?: string;
  isCompleted: boolean;
  questions: PhqQuestionResponse[];
  totalScore?: number;
  severity?: string;
  metadata?: {
    conversationSessionId: string;
    userAgent?: string;
    clientTimezone?: string;
    version?: string;
  };
}
```

**Key Methods**:
- `initializeSession()` - Creates new PHQ session and saves immediately
- `setQuestionText()` - Updates question text when asked
- `recordAnswer()` - Records answer and triggers progressive save
- `recordInvalidAttempt()` - Tracks invalid attempts and skipped questions
- `completeAssessment()` - Marks session complete with score/severity
- `endSession()` - Final save and cleanup

**Progressive Save Pattern**:
- Batches rapid updates with 1-second delay (`saveDelay`)
- Saves entire session JSON to blob storage
- Overwrites existing file on each save
- Container: `phq-sessions`
- Path: `users/{userId}/{assessmentType}-{assessmentId}.json`

#### Updated Component: `RealtimeAgentExperience.tsx`

**Changes in `handlePhqAssessmentStart()`**:
```typescript
// Initialize PHQ session for separate progressive storage
const currentSessionId = chatTranscriptService.getCurrentTranscript()?.sessionId;
if (currentSessionId && authenticatedUserId) {
  phqSessionService.initializeSession(
    authenticatedUserId,
    currentSessionId,
    currentAssessment.assessmentId,
    type
  );
}

// Update PHQ session with first question text
phqSessionService.setQuestionText(nextQuestion.questionNumber, nextQuestion.questionText);
```

**Changes in `handlePhqAssessmentResponse()`**:
```typescript
// For invalid attempts
phqSessionService.recordInvalidAttempt(nextQuestion.questionNumber);

// For valid answers
phqSessionService.recordAnswer(nextQuestion.questionNumber, answer);

// When asking next question
phqSessionService.setQuestionText(nextUnanswered.questionNumber, nextUnanswered.questionText);
```

**Changes in `handlePhqAssessmentComplete()`**:
```typescript
// Complete PHQ session in separate storage
phqSessionService.completeAssessment(score, severity);

// Removed: Old saveAssessment() call and saving indicators
// Removed: Try-catch block for single save at end

// Added: End session cleanup
phqSessionService.endSession();
```

### Backend (C#)

#### New Function: `SavePhqSessionFunction.cs`
Located: `BehavioralHealthSystem.Functions/Functions/SavePhqSessionFunction.cs`

**Endpoint**: `/api/SavePhqSession`

**Request Model**:
```csharp
public class SaveSessionRequest
{
    public PhqSessionData SessionData { get; set; }
    public Dictionary<string, object>? Metadata { get; set; }
    public string? ContainerName { get; set; } // Default: "phq-sessions"
    public string? FileName { get; set; }
}
```

**Validation**:
- Session ID, User ID, Assessment ID required
- Assessment type must be PHQ-2 or PHQ-9
- Correct number of questions (2 or 9)
- Valid question numbers (1-2 or 1-9)
- Valid answers (0-3) if present
- Completed sessions must have at least one valid answer and total score

**Storage**:
- Container: `phq-sessions` (default)
- Path: `users/{userId}/{assessmentType}-{assessmentId}.json`
- Overwrites existing blob for progressive saves
- Stores entire session JSON with metadata

**Blob Metadata**:
- assessment_type, user_id, session_id, assessment_id
- is_completed, created_at, last_updated, saved_at
- completed_at, total_score, severity (when available)

## Data Flow

### 1. Assessment Start
```
User says "start PHQ-9" 
→ phqAssessmentService.startAssessment() (business logic)
→ phqSessionService.initializeSession() (storage)
  → Creates empty session with 9 question slots
  → Immediate save to blob
→ phqSessionService.setQuestionText(1, "question text")
  → Updates question 1 text
  → Batched save (1s delay)
```

### 2. Each Answer
```
User answers "2"
→ phqAssessmentService.recordAnswer() (business logic)
→ phqSessionService.recordAnswer(questionNumber, answer)
  → Updates answer in session
  → Batched save (1s delay)
→ Next question asked
→ phqSessionService.setQuestionText(nextNumber, "question text")
  → Updates next question text
  → Batched save (1s delay)
```

### 3. Invalid Attempts
```
User answers "four"
→ phqAssessmentService.recordInvalidAttempt()
→ phqSessionService.recordInvalidAttempt(questionNumber)
  → Increments attempts
  → Marks as skipped after 3 attempts
  → Batched save (1s delay)
```

### 4. Assessment Complete
```
All questions answered/skipped
→ phqAssessmentService.calculateScore()
→ phqSessionService.completeAssessment(score, severity)
  → Sets isCompleted = true
  → Adds score and severity
  → Immediate save to blob
→ phqSessionService.endSession()
  → Final save and cleanup
```

## Storage Comparison

### Old Approach (Single Save at End)
❌ Lost data if user closed browser mid-assessment
❌ Lost partial progress on errors
❌ All-or-nothing save strategy

### Previous Approach (Embedded in Chat Transcript)
✅ Progressive saving
❌ Questions 6-9 missing metadata (implementation bug)
❌ Mixed concerns (chat + assessment data)
❌ Difficult to query PHQ data independently

### New Approach (Separate + Progressive)
✅ Progressive saving (no data loss)
✅ Separate storage for PHQ analytics
✅ Clean data structure
✅ Links to chat transcript via sessionId
✅ Both detailed (PHQ session) and contextual (chat transcript) data
✅ Can query PHQ sessions independently

## Session Linking

Both storage systems use the **same sessionId** for linking:

**Chat Transcript**:
- Container: `chat-transcripts`
- Path: `users/{userId}/conversations/{sessionId}.json`
- Contains: Full conversation with PHQ metadata in messages

**PHQ Session**:
- Container: `phq-sessions`
- Path: `users/{userId}/{assessmentType}-{assessmentId}.json`
- Contains: Detailed Q&A, scores, attempts, timestamps
- Links back: `metadata.conversationSessionId === sessionId`

## Benefits

1. **No Data Loss**: Progressive saves throughout assessment
2. **Detailed Analytics**: Separate PHQ storage optimized for analysis
3. **Conversation Context**: Chat transcript preserves conversation flow
4. **Flexible Querying**: Can query PHQ sessions independently
5. **Data Integrity**: Dual storage provides redundancy
6. **Better Structure**: Clean separation of concerns

## Testing Checklist

- [ ] Start PHQ-2 assessment - session initialized in blob
- [ ] Answer first question - progressive save updates blob
- [ ] Give invalid answer - attempt recorded and saved
- [ ] Skip question (3 invalid attempts) - marked as skipped
- [ ] Answer remaining questions - each answer saved progressively
- [ ] Complete assessment - final save with score/severity
- [ ] Verify chat transcript has PHQ metadata in messages
- [ ] Verify PHQ session file in blob storage
- [ ] Verify sessionId matches between both storages
- [ ] Test PHQ-9 assessment with all 9 questions
- [ ] Test browser refresh during assessment (partial data saved)

## Migration Notes

**No Breaking Changes**:
- Chat transcript metadata remains (backward compatible)
- Old PHQ assessment function still exists (can be removed later)
- Progressive service adds new storage, doesn't replace existing

**To Remove (Future Cleanup)**:
- `SavePhqProgressFunction.cs` (deprecated)
- Old `SavePhqAssessmentFunction` validation if not needed
- Can keep SavePhqAssessmentFunction for different use cases

## Environment Variables

No new environment variables required. Uses existing:
- `VITE_FUNCTIONS_URL` - Azure Functions endpoint
- Azure Storage connection string (configured in Functions)
