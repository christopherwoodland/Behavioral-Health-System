# PHQ Metadata Tagging Enhancement

## Problem
Questions 6-9 in PHQ assessments weren't getting proper metadata tags in chat transcripts because the AI agent's natural responses didn't have a reliable way to identify PHQ questions when they were asked through the Azure OpenAI Realtime API.

## Solution
Implemented a hidden marker system that instructs the AI to prefix all PHQ questions with invisible markers that are detected and stripped before display, but used to add proper metadata to chat transcripts.

## Implementation

### 1. Enhanced Agent Instructions
**File**: `RealtimeAgentExperience.tsx` (lines ~1007-1020)

Added explicit instructions to the AI agent:
```typescript
CRITICAL: When asking PHQ questions, you MUST prefix EVERY question with this exact hidden marker:
"[PHQ-Q#]" where # is the question number (1-9)

Example format:
"[PHQ-Q1] Question 1: Over the past 2 weeks, how often have you been bothered by..."
"[PHQ-Q6] Question 6: Over the past 2 weeks, how often have you been bothered by..."

This marker is INVISIBLE to ${getFirstName()} but REQUIRED for proper data tracking.
```

### 2. Message Processing Enhancement
**File**: `RealtimeAgentExperience.tsx` (lines ~754-810)

Enhanced the `onMessage` handler to:

#### For Assistant Messages (PHQ Questions):
```typescript
// Check for PHQ question marker [PHQ-Q#]
const phqMarkerMatch = message.content.match(/\[PHQ-Q(\d+)\]/);

if (phqMarkerMatch) {
  const questionNumber = parseInt(phqMarkerMatch[1], 10);
  const currentAssessment = phqAssessmentService.getCurrentAssessment();
  
  if (currentAssessment) {
    // Add PHQ question metadata
    metadata.isPhqQuestion = true;
    metadata.phqType = currentAssessment.assessmentType === 'PHQ-2' ? 2 : 9;
    metadata.phqQuestionNumber = questionNumber;
    metadata.assessmentId = currentAssessment.assessmentId;
  }
  
  // Remove the marker from the displayed message
  message.content = message.content.replace(/\[PHQ-Q\d+\]\s*/g, '').trim();
}
```

#### For User Messages (PHQ Answers):
```typescript
// Check if this is a PHQ answer
const currentAssessment = phqAssessmentService.getCurrentAssessment();
const isPhqAnswer = currentAssessment && !currentAssessment.isCompleted;

if (isPhqAnswer) {
  const answer = phqAssessmentService.parseAnswer(message.content);
  if (answer !== null) {
    const nextQuestion = phqAssessmentService.getNextQuestion();
    metadata.isPhqAnswer = true;
    metadata.phqType = currentAssessment.assessmentType === 'PHQ-2' ? 2 : 9;
    metadata.phqQuestionNumber = nextQuestion?.questionNumber;
    metadata.phqAnswerValue = answer;
    metadata.assessmentId = currentAssessment.assessmentId;
  }
}
```

## Data Flow

### PHQ Question Asked by AI
```
1. AI generates response: "[PHQ-Q6] Question 6: Over the past 2 weeks..."
2. Message received in onMessage handler
3. Marker detected: [PHQ-Q6]
4. Metadata added:
   - isPhqQuestion: true
   - phqQuestionNumber: 6
   - phqType: 9 (or 2 for PHQ-2)
   - assessmentId: "phq-123456..."
5. Marker stripped from content: "Question 6: Over the past 2 weeks..."
6. Saved to chat transcript with metadata
7. Displayed to user (without marker)
```

### PHQ Answer Given by User
```
1. User speaks: "2" or "two" or "number 2"
2. Message received in onMessage handler
3. Check if PHQ assessment is active
4. Parse answer value
5. Metadata added:
   - isPhqAnswer: true
   - phqQuestionNumber: 6
   - phqAnswerValue: 2
   - phqType: 9
   - assessmentId: "phq-123456..."
6. Saved to chat transcript with metadata
```

## Chat Transcript Structure

### PHQ Question Message
```json
{
  "id": "msg-123",
  "role": "assistant",
  "content": "Question 6: Over the past 2 weeks, how often have you been bothered by feeling bad about yourself...",
  "timestamp": "2025-10-08T10:30:00Z",
  "messageType": "agent-response",
  "isPhqQuestion": true,
  "phqType": 9,
  "phqQuestionNumber": 6,
  "assessmentId": "phq-1728385800-abc123"
}
```

### PHQ Answer Message
```json
{
  "id": "msg-124",
  "role": "user",
  "content": "2",
  "timestamp": "2025-10-08T10:30:15Z",
  "messageType": "voice-input",
  "isPhqAnswer": true,
  "phqType": 9,
  "phqQuestionNumber": 6,
  "phqAnswerValue": 2,
  "assessmentId": "phq-1728385800-abc123"
}
```

## Benefits

1. **Complete Metadata Coverage**: All PHQ questions 1-9 now get proper metadata tags
2. **User-Invisible Markers**: Markers are stripped before display - users never see them
3. **AI-Driven Tagging**: AI follows instructions to add markers automatically
4. **Robust Detection**: Regex pattern reliably detects markers
5. **Dual Storage**: Both chat transcript (with metadata) and PHQ session (detailed) have complete data
6. **Analytics Ready**: Can query chat transcripts for PHQ interactions using metadata

## Testing

To verify this works:

1. **Start PHQ-9 Assessment**
   - AI should ask questions prefixed with hidden markers
   - Console log: `🏷️ PHQ Question detected with marker: Q1`

2. **Answer Questions 6-9**
   - Each question should trigger marker detection
   - Console logs for Q6, Q7, Q8, Q9

3. **Check Chat Transcript**
   - Open browser DevTools → Application → Session Storage → chat-session-id
   - Retrieve transcript from blob storage
   - Verify all questions have `isPhqQuestion: true` and correct `phqQuestionNumber`

4. **Check User Answers**
   - Verify all answers have `isPhqAnswer: true` and `phqAnswerValue`

## Console Logs

Look for these console messages:
```
🏷️ PHQ Question detected with marker: Q6 { isPhqQuestion: true, phqType: 9, phqQuestionNumber: 6, assessmentId: "..." }
🏷️ PHQ Question detected with marker: Q7 { isPhqQuestion: true, phqType: 9, phqQuestionNumber: 7, assessmentId: "..." }
🏷️ PHQ Question detected with marker: Q8 { isPhqQuestion: true, phqType: 9, phqQuestionNumber: 8, assessmentId: "..." }
🏷️ PHQ Question detected with marker: Q9 { isPhqQuestion: true, phqType: 9, phqQuestionNumber: 9, assessmentId: "..." }
```

## Troubleshooting

### Markers Showing to User
- Check if marker stripping regex is working
- Pattern: `/\[PHQ-Q\d+\]\s*/g`
- Should remove `[PHQ-Q6]` and trailing spaces

### Metadata Not Added
- Check if AI is including markers in responses
- Verify `CRITICAL:` instructions are in agent config
- Look for console log: `🏷️ PHQ Question detected with marker`

### Wrong Question Numbers
- Verify AI is using correct question numbers in markers
- Check `phqAssessmentService.getNextQuestion()` returns correct question

## Future Enhancements

1. **Answer Markers**: Could add `[PHQ-A6:2]` markers to AI's acknowledgment responses
2. **Completion Marker**: `[PHQ-COMPLETE]` for end-of-assessment responses
3. **Validation Marker**: `[PHQ-INVALID]` for invalid answer feedback
4. **Skip Marker**: `[PHQ-SKIP:6]` for skipped question notifications

## Related Files

- `RealtimeAgentExperience.tsx` - Main component with marker detection
- `chatTranscriptService.ts` - Stores messages with metadata
- `phqAssessmentService.ts` - Business logic for PHQ assessments
- `phqSessionService.ts` - Progressive session storage
- `SavePhqSessionFunction.cs` - Backend function for PHQ storage
- `SaveChatTranscriptFunction.cs` - Backend function for chat storage
