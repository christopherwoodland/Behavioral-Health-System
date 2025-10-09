# PHQ Duplication and Data Quality Fixes

## Issues Fixed

### 1. AI Speech Being Saved as User Messages (Duplicate Content)
**Problem:** Azure OpenAI Realtime API was capturing the AI's own speech through the microphone and transcribing it as user input with `role: 'user'`, causing duplicate messages where the AI's words appeared as both assistant and user messages. Some duplicates had identical timestamps and content.

**Root Cause:** The duplicate check was comparing against the `messages` state array, but assistant messages were being saved to the transcript BEFORE being added to state, so the comparison failed. Additionally, some duplicate checks happened too late in the message processing flow.

**Solution:** Multi-layer filtering at the VERY START of message processing (before any other logic):

1. **Content Match Check** - Compare against last 10 assistant messages from BOTH state and transcript
2. **Timestamp Match Check** - Block user messages with identical timestamp to recent AI messages
3. **AI Phrase Pattern Check** - Detect long messages starting with AI-typical phrases (greetings, acknowledgments)

**File:** `RealtimeAgentExperience.tsx` lines 577-617

```typescript
// Check against BOTH messages state AND saved transcript
const currentTranscript = chatTranscriptService.getCurrentTranscript();
const recentAIMessages = [
  ...messages.filter(m => m.role === 'assistant').slice(-5),
  ...(currentTranscript?.messages.filter(m => m.role === 'assistant').slice(-5) || [])
];

const isDuplicateAIContent = recentAIMessages.some(aiMsg => 
  aiMsg.content.trim() === message.content.trim()
);

if (isDuplicateAIContent) {
  console.warn('⚠️ BLOCKED: AI speech incorrectly transcribed as user input:', message.content.substring(0, 60) + '...');
  return; // Don't add this message at all
}
```

### 2. Duplicate PHQ Assessment Starts
**Problem:** PHQ assessments were starting twice - once from voice command detection and once from function calling.

**Solution:**
- Removed voice command detection for `invoke-phq-9` and `invoke-phq-2`
- PHQ assessments now ONLY start through function calling mechanism
- Function calling handler now properly calls `handlePhqAssessmentStart()` to initialize both services

**File:** `RealtimeAgentExperience.tsx`
- Lines 733-738: Removed duplicate voice command triggers
- Lines 1132-1145: Updated function handlers to call `handlePhqAssessmentStart()`

### 3. Missing Question Text in PHQ Session
**Problem:** Question 2 had empty `questionText` field because the AI was asking questions through the Realtime API without going through the normal flow that would call `phqSessionService.setQuestionText()`.

**Solution:**
- Extract question text from AI messages that contain PHQ markers `[PHQ-Q#]`
- Use regex to find "Question X: [question text]?" pattern
- Automatically save question text to PHQ session when detected

**File:** `RealtimeAgentExperience.tsx` lines 808-820

```typescript
// Extract the question text from the AI's message
// Look for "Question X: [question text]" pattern
const questionTextMatch = message.content.match(/Question \d+:\s*([^?]+\?)/);
if (questionTextMatch && questionTextMatch[1]) {
  const questionText = questionTextMatch[1].trim();
  console.log(`📝 Extracted question text for Q${questionNumber}:`, questionText);
  
  // Save question text to PHQ session
  phqSessionService.setQuestionText(questionNumber, questionText);
}
```

### 4. PHQ Session Enhanced with Message History
**Problem:** PHQ session only had structured question/answer data but didn't capture the full conversational flow like the chat transcript does.

**Solution:**
- Added `messages` array to `PhqSession` interface
- Created `PhqSessionMessage` interface for conversation tracking
- Added `addMessage()` method to capture all PHQ-related interactions
- Messages automatically added to PHQ session for both user and assistant during assessment

**Files:**
- `phqSessionService.ts`: Added message tracking infrastructure (lines 1-40, 165-189)
- `RealtimeAgentExperience.tsx`: Integrated message capture (lines 799-802, 829)

**New PHQ Session Structure:**
```typescript
{
  userId: string,
  sessionId: string,
  assessmentId: string,
  assessmentType: 'PHQ-2' | 'PHQ-9',
  createdAt: string,
  lastUpdated: string,
  completedAt?: string,
  isCompleted: boolean,
  questions: PhqQuestionResponse[], // Structured data
  messages: PhqSessionMessage[],    // NEW: Complete conversational flow
  totalScore?: number,
  severity?: string,
  metadata: {...}
}
```

### 5. PHQ Answers Not Being Recorded
**Problem:** User answers were being captured in chat transcript but the structured `questions` array in PHQ session showed all questions as skipped or unanswered (answer: null, skipped: true), even when the user provided valid answers.

**Root Cause:** When the AI acknowledges answers conversationally (e.g., "I've noted your response as 0"), the answer wasn't being extracted and recorded in the PHQ services. The `handlePhqAssessmentResponse()` flow wasn't being triggered because the AI was handling questions through its natural conversation flow instead of the structured handlers.

**Solution:**
- Parse AI's acknowledgment messages for answer patterns (e.g., "noted your response as 2")
- Parse AI's skip/completion messages (e.g., "We'll skip this question", "That completes the PHQ-2")
- Extract acknowledged answer values using regex
- Automatically record answers in both `phqAssessmentService` and `phqSessionService`
- Auto-complete assessment when AI indicates completion
- **Important:** Null answers are valid for skipped questions and are correctly handled in score calculation

**File:** `RealtimeAgentExperience.tsx` lines 838-866

```typescript
// Check if AI is acknowledging a PHQ answer
const answerAckMatch = message.content.match(/(?:noted|recorded|noted down|captured|registered|logged)\s+(?:your\s+)?(?:response|answer)?\s+(?:as|of)?\s*(\d)/i);

if (answerAckMatch) {
  const acknowledgedAnswer = parseInt(answerAckMatch[1], 10);
  const currentQuestion = phqAssessmentService.getNextQuestion();
  
  if (currentQuestion && acknowledgedAnswer >= 0 && acknowledgedAnswer <= 3) {
    console.log(`🎯 AI acknowledged answer ${acknowledgedAnswer} for Q${currentQuestion.questionNumber}`);
    
    // Record the answer in both services
    phqAssessmentService.recordAnswer(currentQuestion.questionNumber, acknowledgedAnswer);
    phqSessionService.recordAnswer(currentQuestion.questionNumber, acknowledgedAnswer);
    
    // Check if assessment is now complete
    const updatedAssessment = phqAssessmentService.getCurrentAssessment();
    if (updatedAssessment?.isCompleted) {
      const score = phqAssessmentService.calculateScore();
      const severity = phqAssessmentService.determineSeverity(score, updatedAssessment.assessmentType);
      phqSessionService.completeAssessment(score, severity);
    }
  }
}
```

## Testing Checklist

- [ ] Start voice session with agent
- [ ] Say "start PHQ-2" or "begin PHQ-9"
- [ ] Verify assessment only starts once (not twice)
- [ ] Answer all questions with voice (0, 1, 2, or 3)
- [ ] Check console for:
  - [ ] "⚠️ BLOCKED: AI speech incorrectly transcribed" warnings (should not see duplicates)
  - [ ] "🎯 AI acknowledged answer X for QY" messages (confirms answers being recorded)
  - [ ] "✅ PHQ Assessment completed! Score: X, Severity: Y" message
- [ ] Verify chat transcript has NO duplicate AI content with user role
- [ ] Verify PHQ session blob has:
  - [ ] All question texts filled in (not empty)
  - [ ] **Correct answers recorded (NOT null)**
  - [ ] **isCompleted: true**
  - [ ] **totalScore and severity populated**
  - [ ] `messages` array with complete conversational flow
  - [ ] Both user and assistant messages captured
- [ ] Verify visual display shows:
  - [ ] Agent messages in one color
  - [ ] User messages in different color
  - [ ] No duplicate messages on screen

## How Null Answers Work

**Valid Scenarios for `answer: null`:**

1. **Skipped Questions:** After 3 invalid attempts, a question is marked as `skipped: true` with `answer: null`
2. **Score Calculation:** The `calculateScore()` method filters out null answers (only counts answered questions)
3. **Completion:** An assessment can be marked complete even with null answers for skipped questions

**Example Valid PHQ Session:**
```json
{
  "questions": [
    {
      "questionNumber": 1,
      "answer": 0,           // ✅ Answered
      "skipped": false
    },
    {
      "questionNumber": 2,
      "answer": null,        // ✅ Valid - skipped after 3 attempts
      "attempts": 3,
      "skipped": true
    }
  ],
  "isCompleted": true,       // ✅ Can complete with skipped questions
  "totalScore": 0,           // ✅ Score only counts answered questions
  "severity": "Negative Screen"
}
```

## Benefits

1. **Clean Transcripts:** Chat transcripts now only contain legitimate user input and agent responses
2. **No Duplicates:** AI no longer talks to itself
3. **Complete Data:** PHQ sessions capture both structured data AND conversational flow
4. **Question Tracking:** All question texts automatically extracted and saved
5. **Single Assessment Start:** PHQ assessments start exactly once via function calling
6. **Flexible Completion:** Assessments can complete with skipped questions (null answers)

## Related Files

- `BehavioralHealthSystem.Web/src/pages/RealtimeAgentExperience.tsx`
- `BehavioralHealthSystem.Web/src/services/phqSessionService.ts`
- `BehavioralHealthSystem.Web/src/services/chatTranscriptService.ts`
