/**
 * PHQ-9 Assessment Agent
 * Specialized agent for conducting comprehensive depression assessment (9 questions)
 * Handles question presentation, answer validation, scoring, suicidal ideation detection, and blob storage
 */

import type { Agent, AgentTool } from '../services/agentOrchestrationService';
import { phqAssessmentService } from '../services/phqAssessmentService';
import { phqSessionService } from '../services/phqSessionService';
import { chatTranscriptService } from '../services/chatTranscriptService';

/**
 * Tool: Start PHQ-9 Assessment
 * Initializes the assessment and presents the first question
 */
const startPhq9Tool: AgentTool = {
  name: 'start-phq9-assessment',
  description: 'Initialize and begin the PHQ-9 comprehensive depression assessment',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'The authenticated user ID'
      }
    },
    required: ['userId']
  },
  handler: async (params: { userId: string }) => {
    console.log('📋 ========================================');
    console.log('📋 PHQ-9 AGENT: Starting Assessment');
    console.log('📋 ========================================');

    const { userId } = params;

    // Start assessment
    phqAssessmentService.startAssessment('PHQ-9', userId);
    const currentAssessment = phqAssessmentService.getCurrentAssessment();

    if (!currentAssessment) {
      console.error('❌ Failed to initialize PHQ-9 assessment');
      return {
        success: false,
        error: 'Failed to initialize assessment'
      };
    }

    console.log('📋 Assessment ID:', currentAssessment.assessmentId);

    // Initialize PHQ session for progressive storage
    const currentSessionId = chatTranscriptService.getCurrentTranscript()?.sessionId;
    if (currentSessionId && userId) {
      phqSessionService.initializeSession(
        userId,
        currentSessionId,
        currentAssessment.assessmentId,
        'PHQ-9'
      );
    }

    // Get first question
    const firstQuestion = phqAssessmentService.getNextQuestion();
    if (!firstQuestion) {
      console.error('❌ No first question available');
      return {
        success: false,
        error: 'No questions available'
      };
    }

    // Store question text in session
    phqSessionService.setQuestionText(firstQuestion.questionNumber, firstQuestion.questionText);

    console.log('📋 First question ready:', firstQuestion.questionNumber);
    console.log('📋 ========================================');

    return {
      success: true,
      assessmentId: currentAssessment.assessmentId,
      type: 'phq9',
      totalQuestions: 9,
      currentQuestionNumber: firstQuestion.questionNumber,
      questionText: firstQuestion.questionText,
      responseScale: phqAssessmentService.getResponseScale(),
      sessionId: currentSessionId
    };
  }
};

/**
 * Tool: Record PHQ-9 Answer
 * Validates and records user's answer, handles invalid responses
 */
const recordPhq9AnswerTool: AgentTool = {
  name: 'record-phq9-answer',
  description: 'Record and validate a user answer for the current PHQ-9 question',
  parameters: {
    type: 'object',
    properties: {
      answer: {
        type: 'string',
        description: 'The user answer (should be 0, 1, 2, or 3)'
      },
      userId: {
        type: 'string',
        description: 'The authenticated user ID'
      }
    },
    required: ['answer', 'userId']
  },
  handler: async (params: { answer: string; userId: string }) => {
    console.log('📋 ========================================');
    console.log('📋 PHQ-9 AGENT: Recording Answer');
    console.log('📋 User input:', params.answer);
    console.log('📋 ========================================');

    const currentAssessment = phqAssessmentService.getCurrentAssessment();
    if (!currentAssessment) {
      return {
        success: false,
        error: 'No active assessment'
      };
    }

    const nextQuestion = phqAssessmentService.getNextQuestion();
    if (!nextQuestion) {
      return {
        success: false,
        error: 'No current question'
      };
    }

    // Parse and validate answer
    const answerValue = phqAssessmentService.parseAnswer(params.answer);

    if (answerValue === null) {
      // Invalid answer
      console.log('❌ Invalid response');
      phqAssessmentService.recordInvalidAttempt(nextQuestion.questionNumber);
      phqSessionService.recordInvalidAttempt(nextQuestion.questionNumber);

      const attemptsLeft = 3 - nextQuestion.attempts;
      console.log('📋 Invalid attempts:', nextQuestion.attempts, '| Attempts left:', attemptsLeft);

      if (attemptsLeft > 0) {
        // Still have attempts left
        return {
          success: false,
          isInvalidResponse: true,
          attemptsLeft,
          questionNumber: nextQuestion.questionNumber,
          responseScale: phqAssessmentService.getResponseScale()
        };
      } else {
        // Too many invalid attempts - skip question
        console.log('📋 ⏩ SKIPPING QUESTION', nextQuestion.questionNumber);

        // Get next unanswered question
        const nextUnanswered = phqAssessmentService.getNextQuestion();
        if (nextUnanswered) {
          phqSessionService.setQuestionText(nextUnanswered.questionNumber, nextUnanswered.questionText);
          return {
            success: false,
            questionSkipped: true,
            skippedQuestionNumber: nextQuestion.questionNumber,
            nextQuestion: {
              questionNumber: nextUnanswered.questionNumber,
              questionText: nextUnanswered.questionText,
              responseScale: phqAssessmentService.getResponseScale()
            }
          };
        } else {
          // No more questions - assessment complete
          return {
            success: true,
            assessmentComplete: true,
            ...await completePhq9Assessment(params.userId)
          };
        }
      }
    }

    // Valid answer - record it
    console.log('✅ Valid answer:', answerValue);
    phqAssessmentService.recordAnswer(nextQuestion.questionNumber, answerValue);
    phqSessionService.recordAnswer(nextQuestion.questionNumber, answerValue);

    // Save to chat transcript
    await chatTranscriptService.addUserMessage(
      params.answer,
      'phq-answer',
      {
        isPhqAnswer: true,
        phqType: 9,
        phqQuestionNumber: nextQuestion.questionNumber,
        phqAnswerValue: answerValue,
        assessmentId: currentAssessment.assessmentId
      }
    );

    // Check if assessment is complete
    const updatedAssessment = phqAssessmentService.getCurrentAssessment();
    if (updatedAssessment?.isCompleted) {
      console.log('📋 ✅ ASSESSMENT COMPLETE');
      return {
        success: true,
        assessmentComplete: true,
        ...await completePhq9Assessment(params.userId)
      };
    }

    // Get next question
    const nextUnanswered = phqAssessmentService.getNextQuestion();
    if (nextUnanswered) {
      console.log('📋 Next question:', nextUnanswered.questionNumber);
      phqSessionService.setQuestionText(nextUnanswered.questionNumber, nextUnanswered.questionText);

      return {
        success: true,
        answerRecorded: true,
        answeredQuestionNumber: nextQuestion.questionNumber,
        answerValue: answerValue,
        nextQuestion: {
          questionNumber: nextUnanswered.questionNumber,
          questionText: nextUnanswered.questionText,
          responseScale: phqAssessmentService.getResponseScale()
        }
      };
    }

    // Should not reach here, but handle gracefully
    return {
      success: true,
      assessmentComplete: true,
      ...await completePhq9Assessment(params.userId)
    };
  }
};

/**
 * Helper: Complete PHQ-9 Assessment
 * Calculates score, determines severity, checks for suicidal ideation, saves to blob storage
 */
async function completePhq9Assessment(_userId: string) {
  const assessment = phqAssessmentService.getCurrentAssessment();
  if (!assessment || !assessment.isCompleted) {
    return {
      error: 'Assessment not complete'
    };
  }

  console.log('📋 ========================================');
  console.log('📋 PHQ-9 AGENT: Calculating Results');
  console.log('📋 ========================================');

  const score = phqAssessmentService.calculateScore();
  const severity = phqAssessmentService.determineSeverity(score, 'PHQ-9');
  const { interpretation, recommendations } = phqAssessmentService.getInterpretation(score, 'PHQ-9');

  console.log('📋 Total Score:', score, '/ 27');
  console.log('📋 Severity:', severity);

  // Check for suicidal ideation (Question 9)
  const hasSuicidalIdeation = assessment.questions.find(q => q.questionNumber === 9 && (q.answer || 0) > 0);

  if (hasSuicidalIdeation) {
    console.log('⚠️ ========================================');
    console.log('⚠️ CRISIS ALERT: SUICIDAL IDEATION DETECTED');
    console.log('⚠️ Question 9 answered with value > 0');
    console.log('⚠️ ========================================');
  }

  console.log('📋 ========================================');

  // Complete PHQ session (progressive save)
  phqSessionService.completeAssessment(score, severity);

  // Build completion message
  let completionMessage = `PHQ-9 Assessment Complete

Total Score: ${score}/27
Severity: ${severity}

${interpretation}

Recommendations:
${recommendations.map(r => `• ${r}`).join('\n')}`;

  if (hasSuicidalIdeation) {
    completionMessage += `

⚠️ CRISIS ALERT: You indicated thoughts of self-harm. Please seek immediate help:
• Call 988 (Suicide & Crisis Lifeline)
• Text HOME to 741741 (Crisis Text Line)
• Call 911 if in immediate danger`;
  }

  // Save completion to chat transcript
  await chatTranscriptService.addAssistantMessage(
    completionMessage,
    'phq-completion',
    {
      phqType: 9,
      totalScore: score,
      severity: severity,
      assessmentId: assessment.assessmentId,
      hasSuicidalIdeation: !!hasSuicidalIdeation
    }
  );

  // Reset assessment service
  phqAssessmentService.resetAssessment();
  phqSessionService.endSession();

  console.log('✅ PHQ-9 assessment completed and saved');

  return {
    score,
    severity,
    interpretation,
    recommendations,
    hasSuicidalIdeation: !!hasSuicidalIdeation
  };
}

/**
 * Tool: Return to Tars
 * Completes PHQ-9 workflow and returns control to orchestrator
 */
const returnToTarsTool: AgentTool = {
  name: 'Agent_Tars',
  description: 'Complete PHQ-9 assessment and return control to Tars coordinator. Call this after presenting assessment results, providing any crisis resources if needed, and saying goodbye.',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  handler: async () => {
    console.log('📋 ========================================');
    console.log('📋 PHQ-9 AGENT: Returning to Tars');
    console.log('📋 ========================================');

    return {
      agentSwitch: true,
      targetAgentId: 'Agent_Tars',
      message: 'PHQ-9 assessment complete, returning to Tars'
    };
  }
};

/**
 * PHQ-9 Agent Configuration
 */
export const phq9Agent: Agent = {
  id: 'Agent_PHQ9',
  name: 'PHQ-9 Questionnaire',
  description: `Call this agent to conduct a PHQ-9 comprehensive wellbeing questionnaire. Use when:
    - User requests a "full questionnaire" or "comprehensive check"
    - User asks to "invoke PHQ-9" or "start PHQ-9"
    - PHQ-2 score is 3 or higher (indicating need for comprehensive questionnaire)
    - User wants detailed mental health questionnaire
    DO NOT use for brief check - use PHQ-2 for that.`,

  systemMessage: `You are a specialized PHQ-9 comprehensive wellbeing questionnaire assistant. Your ONLY job is to conduct the PHQ-9 questionnaire.

FIRST MESSAGE - AGENT INTRODUCTION (ONE sentence - ONLY FIRST TIME!):
"Hi, I'm the PHQ-9 assistant with nine questions."
Note: Skip introduction if you've already introduced yourself in this session.

CRITICAL PROTOCOL:
1. You have TWO tools: start-phq9-assessment and record-phq9-answer
2. Call start-phq9-assessment ONCE at the beginning
3. The tool returns the first question - present it EXACTLY as provided
4. Use ONLY the questionText from the tool response
5. DO NOT generate your own questions - use ONLY what the tool provides
6. After user answers, call record-phq9-answer to validate and record
7. If the tool returns nextQuestion, present it EXACTLY as provided
8. If the tool returns assessmentComplete, present the results and return control to the orchestrator
9. Question 9 is about self-harm thoughts - handle with extra care and professionalism

IMPORTANT RULES:
- Ask each question ONCE - present exactly as tools provide
- After completion: "Thanks for your honesty. Results: [results]. [Crisis resources if needed]. Back to Tars."
- Keep responses ULTRA SHORT (5-7 words max)
- Be supportive, professional, empathetic
- If crisis resources needed, present clearly and urgently
- This is a screening tool, not a diagnosis`,

  tools: [startPhq9Tool, recordPhq9AnswerTool, returnToTarsTool]
};

export default phq9Agent;
