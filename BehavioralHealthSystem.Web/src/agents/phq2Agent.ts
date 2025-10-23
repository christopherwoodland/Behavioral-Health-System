/**
 * PHQ-2 Assessment Agent
 * Specialized agent for conducting quick depression screening (2 questions)
 * Handles question presentation, answer validation, scoring, and blob storage
 */

import type { Agent, AgentTool } from '../services/agentOrchestrationService';
import { phqAssessmentService } from '../services/phqAssessmentService';
import { phqSessionService } from '../services/phqSessionService';
import { chatTranscriptService } from '../services/chatTranscriptService';

/**
 * Tool: Start PHQ-2 Assessment
 * Initializes the assessment and presents the first question
 */
const startPhq2Tool: AgentTool = {
  name: 'start-phq2-assessment',
  description: 'Initialize and begin the PHQ-2 quick depression screening assessment',
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
    console.log('📋 PHQ-2 AGENT: Starting Assessment');
    console.log('📋 ========================================');

    const { userId } = params;

    // Start assessment
    phqAssessmentService.startAssessment('PHQ-2', userId);
    const currentAssessment = phqAssessmentService.getCurrentAssessment();

    if (!currentAssessment) {
      console.error('❌ Failed to initialize PHQ-2 assessment');
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
        'PHQ-2'
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
      type: 'phq2',
      totalQuestions: 2,
      currentQuestionNumber: firstQuestion.questionNumber,
      questionText: firstQuestion.questionText,
      responseScale: phqAssessmentService.getResponseScale(),
      sessionId: currentSessionId
    };
  }
};

/**
 * Tool: Record PHQ-2 Answer
 * Validates and records user's answer, handles invalid responses
 */
const recordPhq2AnswerTool: AgentTool = {
  name: 'record-phq2-answer',
  description: 'Record and validate a user answer for the current PHQ-2 question',
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
    console.log('📋 PHQ-2 AGENT: Recording Answer');
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
            ...await completePhq2Assessment(params.userId)
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
        phqType: 2,
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
        ...await completePhq2Assessment(params.userId)
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
      ...await completePhq2Assessment(params.userId)
    };
  }
};

/**
 * Helper: Complete PHQ-2 Assessment
 * Calculates score, determines severity, saves to blob storage
 */
async function completePhq2Assessment(_userId: string) {
  const assessment = phqAssessmentService.getCurrentAssessment();
  if (!assessment || !assessment.isCompleted) {
    return {
      error: 'Assessment not complete'
    };
  }

  console.log('📋 ========================================');
  console.log('📋 PHQ-2 AGENT: Calculating Results');
  console.log('📋 ========================================');

  const score = phqAssessmentService.calculateScore();
  const severity = phqAssessmentService.determineSeverity(score, 'PHQ-2');
  const { interpretation, recommendations } = phqAssessmentService.getInterpretation(score, 'PHQ-2');

  console.log('📋 Total Score:', score, '/ 6');
  console.log('📋 Severity:', severity);
  console.log('📋 ========================================');

  // Complete PHQ session (progressive save)
  phqSessionService.completeAssessment(score, severity);

  // Save completion to chat transcript
  const completionMessage = `PHQ-2 Assessment Complete

Total Score: ${score}/6
Severity: ${severity}

${interpretation}

Recommendations:
${recommendations.map(r => `• ${r}`).join('\n')}`;

  await chatTranscriptService.addAssistantMessage(
    completionMessage,
    'phq-completion',
    {
      phqType: 2,
      totalScore: score,
      severity: severity,
      assessmentId: assessment.assessmentId
    }
  );

  // Reset assessment service
  phqAssessmentService.resetAssessment();
  phqSessionService.endSession();

  console.log('✅ PHQ-2 assessment completed and saved');

  return {
    score,
    severity,
    interpretation,
    recommendations,
    suggestPhq9: score >= 3 // Suggest comprehensive assessment if score is 3 or higher
  };
}

/**
 * Tool: Return to Tars
 * Completes PHQ-2 workflow and returns control to orchestrator
 */
const returnToTarsTool: AgentTool = {
  name: 'Agent_Tars',
  description: 'Complete PHQ-2 assessment and return control to Tars coordinator. Call this after presenting assessment results and saying goodbye.',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  handler: async () => {
    console.log('📋 ========================================');
    console.log('📋 PHQ-2 AGENT: Returning to Tars');
    console.log('📋 ========================================');

    return {
      agentSwitch: true,
      targetAgentId: 'Agent_Tars',
      message: 'PHQ-2 assessment complete, returning to Tars'
    };
  }
};

/**
 * PHQ-2 Agent Configuration
 */
export const phq2Agent: Agent = {
  id: 'Agent_PHQ2',
  name: 'PHQ-2 Screener',
  description: `Call this agent to conduct a PHQ-2 brief wellbeing questionnaire. Use when:
    - User requests a "quick check" or "brief questionnaire"
    - User asks to "invoke PHQ-2" or "start PHQ-2"
    - User wants a brief mental health check
    DO NOT use if user requests comprehensive questionnaire - use PHQ-9 instead.`,

  systemMessage: `You are a specialized PHQ-2 wellbeing questionnaire assistant. Your ONLY job is to conduct the PHQ-2 brief questionnaire.

FIRST MESSAGE - AGENT INTRODUCTION (Adapt based on humor level context - ONLY FIRST TIME!):
- High humor (80-100%): "PHQ-2 Assistant ready to roll! Two quick questions coming your way."
- Medium humor (40-79%): "Hi, I'm the PHQ-2 assistant with two quick questions."
- Low humor (0-39%): "PHQ-2 Assessment Agent initiated. Commencing standardized evaluation protocol."
Note: Skip introduction if you've already introduced yourself in this session.

CRITICAL PROTOCOL:
1. You have TWO tools: start-phq2-assessment and record-phq2-answer
2. Call start-phq2-assessment ONCE at the beginning
3. The tool returns the first question - present it EXACTLY as provided
4. Use ONLY the questionText from the tool response
5. DO NOT generate your own questions - use ONLY what the tool provides
6. After user answers, call record-phq2-answer to validate and record
7. If the tool returns nextQuestion, present it EXACTLY as provided
8. If the tool returns assessmentComplete, present the results and return control to the orchestrator

IMPORTANT RULES:
- Ask each question ONCE - present exactly as tools provide
- After completion: "Thanks for sharing. Here are your results: [results]. Back to Tars."
- Keep responses ULTRA SHORT (5-7 words max)
- Be supportive and professional
- This is a screening tool, not a diagnosis`,

  tools: [startPhq2Tool, recordPhq2AnswerTool, returnToTarsTool]
};

export default phq2Agent;
