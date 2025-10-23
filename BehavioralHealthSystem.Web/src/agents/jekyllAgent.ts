/**
 * Jekyll Agent - Conversational PHQ Inference
 * Specialized agent for non-verbatim conversational depression screening
 * Uses contextual probing to infer PHQ-2/PHQ-9 scores without asking verbatim questions
 * Includes passive slot collection and immediate risk detection
 */

import type { Agent, AgentTool } from '../services/agentOrchestrationService';
import { phqAssessmentService } from '../services/phqAssessmentService';
import { phqSessionService } from '../services/phqSessionService';
import { phqProgressService } from '../services/phqProgressService';
import { chatTranscriptService } from '../services/chatTranscriptService';

/**
 * Jekyll Assessment Context
 * Tracks conversational state and contextual clues for PHQ inference
 */
interface JekyllContext {
  assessmentId: string;
  phqType: 'PHQ-2' | 'PHQ-9';
  stage: 'initial' | 'phq2-probing' | 'decision' | 'phq9-probing' | 'risk-detection' | 'complete';
  inferredAnswers: Map<number, number>; // question number -> score (0-3)
  contextualSlots: {
    sleep?: string;
    energy?: string;
    appetite?: string;
    concentration?: string;
    selfWorth?: string;
    psychomotor?: string;
    triggers?: string[];
    coping?: string[];
    support?: string;
  };
  riskFactors: string[];
  probesAsked: number[];
  confidence: number; // 0-1 scale for inference confidence
}

let jekyllContext: JekyllContext | null = null;

/**
 * PHQ-2 Conversational Probes
 * Non-verbatim contextual questions to infer depression screening
 */
const phq2Probes = [
  {
    questionNumber: 1,
    phqConcept: "Little interest or pleasure in doing things",
    probes: [
      "What kinds of things do you usually enjoy?",
      "Have you been able to do the things you like lately?",
      "Tell me about a time recently when you had fun.",
      "What activities bring you joy?"
    ],
    riskPhrases: ['nothing', 'nothing matters', 'don\'t care', 'pointless', 'no interest', 'can\'t enjoy']
  },
  {
    questionNumber: 2,
    phqConcept: "Feeling down, depressed, or hopeless",
    probes: [
      "How have you been feeling emotionally?",
      "What's your general mood been like?",
      "Do you see things getting better soon?",
      "Tell me about your outlook on things."
    ],
    riskPhrases: ['hopeless', 'depressed', 'down', 'terrible', 'awful', 'worthless', 'can\'t take it']
  }
];

/**
 * PHQ-9 Additional Conversational Probes (Questions 3-9)
 */
const phq9Probes = [
  {
    questionNumber: 3,
    phqConcept: "Trouble falling or staying asleep, or sleeping too much",
    probes: [
      "How's your sleep been recently?",
      "Any trouble with your sleep patterns?",
      "Tell me about your sleep lately."
    ],
    riskPhrases: ['insomnia', 'can\'t sleep', 'sleeping all day', 'nightmares', 'restless']
  },
  {
    questionNumber: 4,
    phqConcept: "Feeling tired or having little energy",
    probes: [
      "How's your energy level been?",
      "Do you feel tired or exhausted?",
      "Tell me about your physical energy."
    ],
    riskPhrases: ['exhausted', 'no energy', 'tired all the time', 'fatigue', 'drained']
  },
  {
    questionNumber: 5,
    phqConcept: "Poor appetite or overeating",
    probes: [
      "How's your appetite been?",
      "Any changes in how much you're eating?",
      "Tell me about your eating habits."
    ],
    riskPhrases: ['no appetite', 'can\'t eat', 'eating too much', 'binge eating']
  },
  {
    questionNumber: 6,
    phqConcept: "Feeling bad about yourself or failure",
    probes: [
      "How do you feel about yourself?",
      "Do you blame yourself for things?",
      "Tell me about your self-confidence."
    ],
    riskPhrases: ['failure', 'worthless', 'useless', 'bad person', 'blame myself', 'deserve this']
  },
  {
    questionNumber: 7,
    phqConcept: "Trouble concentrating",
    probes: [
      "How's your concentration?",
      "Do you find it hard to focus on things?",
      "Tell me about your ability to concentrate."
    ],
    riskPhrases: ['can\'t focus', 'can\'t concentrate', 'mind is blank', 'forgetful', 'can\'t think']
  },
  {
    questionNumber: 8,
    phqConcept: "Moving or speaking slowly or being fidgety/restless",
    probes: [
      "Have you noticed changes in how you move or speak?",
      "Do you feel restless or slowed down?",
      "Tell me about your physical movements."
    ],
    riskPhrases: ['slow', 'sluggish', 'restless', 'fidgety', 'pacing', 'agitated']
  },
  {
    questionNumber: 9,
    phqConcept: "Thoughts that you would be better off dead or of hurting yourself",
    probes: [
      "Have you thought about hurting yourself?",
      "Any thoughts about ending it all?",
      "Do you ever feel like the world would be better without you?"
    ],
    immediateRiskPhrases: ['suicide', 'kill myself', 'end it', 'better off dead', 'hurt myself', 'self-harm']
  }
];

/**
 * Tool: Start Jekyll Assessment
 * Initializes conversational assessment context
 */
const startJekyllTool: AgentTool = {
  name: 'start-jekyll-assessment',
  description: 'Initialize Jekyll conversational PHQ inference assessment',
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
    console.log('🎭 ========================================');
    console.log('🎭 JEKYLL AGENT: Starting Assessment');
    console.log('🎭 ========================================');

    const { userId } = params;

    // Initialize PHQ assessment (start with PHQ-2)
    phqAssessmentService.startAssessment('PHQ-2', userId);
    const currentAssessment = phqAssessmentService.getCurrentAssessment();

    if (!currentAssessment) {
      console.error('❌ Failed to initialize Jekyll assessment');
      return {
        success: false,
        error: 'Failed to initialize assessment'
      };
    }

    const currentSessionId = chatTranscriptService.getCurrentTranscript()?.sessionId;

    // Initialize session tracking
    if (currentSessionId && userId) {
      phqSessionService.initializeSession(
        userId,
        currentSessionId,
        currentAssessment.assessmentId,
        'PHQ-2'
      );
    }

    // Initialize progress tracking
    phqProgressService.startAssessment(userId, 'PHQ-2', currentAssessment.assessmentId);

    // Create Jekyll context
    jekyllContext = {
      assessmentId: currentAssessment.assessmentId,
      phqType: 'PHQ-2',
      stage: 'phq2-probing',
      inferredAnswers: new Map(),
      contextualSlots: {},
      riskFactors: [],
      probesAsked: [],
      confidence: 0
    };

    console.log('🎭 Jekyll assessment initialized');
    console.log('🎭 Starting with PHQ-2 conversational probes');
    console.log('🎭 ========================================');

    return {
      success: true,
      assessmentId: currentAssessment.assessmentId,
      phqType: 'PHQ-2',
      stage: 'phq2-probing',
      readyForProbing: true
    };
  }
};

/**
 * Tool: Record Conversational Response
 * Analyzes user response for PHQ inference and contextual clues
 */
const recordConversationalResponseTool: AgentTool = {
  name: 'record-conversational-response',
  description: 'Analyze and record user conversational response for PHQ inference',
  parameters: {
    type: 'object',
    properties: {
      userResponse: {
        type: 'string',
        description: 'The user\'s conversational response'
      },
      contextualQuestion: {
        type: 'string',
        description: 'The question or probe that was asked'
      },
      targetPhqQuestion: {
        type: 'number',
        description: 'The PHQ question number this response informs (1-9)'
      },
      userId: {
        type: 'string',
        description: 'The authenticated user ID'
      }
    },
    required: ['userResponse', 'contextualQuestion', 'targetPhqQuestion', 'userId']
  },
  handler: async (params: {
    userResponse: string;
    contextualQuestion: string;
    targetPhqQuestion: number;
    userId: string;
  }) => {
    if (!jekyllContext) {
      return {
        success: false,
        error: 'No active Jekyll assessment'
      };
    }

    console.log('🎭 Recording response for PHQ Q' + params.targetPhqQuestion);
    console.log('🎭 Response:', params.userResponse.substring(0, 100) + '...');

    const response = params.userResponse.toLowerCase();
    let inferredScore = 0;
    let confidence = 0.5;
    let riskDetected = false;

    // Get appropriate probe set
    const allProbes = [...phq2Probes, ...phq9Probes];
    const probeInfo = allProbes.find(p => p.questionNumber === params.targetPhqQuestion);

    if (probeInfo) {
      // Check for risk phrases first
      const immediateRiskPhrases = (probeInfo as any).immediateRiskPhrases || [];
      for (const phrase of immediateRiskPhrases) {
        if (response.includes(phrase)) {
          jekyllContext.riskFactors.push(`⚠️ IMMEDIATE RISK - ${phrase} detected in Q${params.targetPhqQuestion}`);
          riskDetected = true;
          console.log('🚨 IMMEDIATE RISK DETECTED:', phrase);
        }
      }

      // Check for general risk phrases
      const riskPhrases = probeInfo.riskPhrases || [];
      let riskPhraseCount = 0;
      for (const phrase of riskPhrases) {
        if (response.includes(phrase)) {
          riskPhraseCount++;
        }
      }

      // Infer score based on response characteristics
      // 3 = nearly every day (frequent, persistent themes)
      // 2 = more than half the days (significant impact)
      // 1 = several days (occasional)
      // 0 = not at all (absent or minimal)

      if (response.length > 200 || (riskPhraseCount >= 2 && response.includes('always'))) {
        inferredScore = 3;
        confidence = 0.8;
      } else if (riskPhraseCount >= 1 || response.includes('often')) {
        inferredScore = 2;
        confidence = 0.7;
      } else if (riskPhraseCount >= 1 || response.includes('sometimes')) {
        inferredScore = 1;
        confidence = 0.6;
      } else {
        inferredScore = 0;
        confidence = 0.7;
      }

      // Store contextual information
      switch (params.targetPhqQuestion) {
        case 1:
          jekyllContext.contextualSlots.concentration = response.substring(0, 100);
          break;
        case 2:
          jekyllContext.contextualSlots.selfWorth = response.substring(0, 100);
          break;
        case 3:
          jekyllContext.contextualSlots.sleep = response.substring(0, 100);
          break;
        case 4:
          jekyllContext.contextualSlots.energy = response.substring(0, 100);
          break;
        case 5:
          jekyllContext.contextualSlots.appetite = response.substring(0, 100);
          break;
      }
    }

    // Record the inferred answer
    jekyllContext.inferredAnswers.set(params.targetPhqQuestion, inferredScore);
    jekyllContext.probesAsked.push(params.targetPhqQuestion);

    // Store the contextual question text in session data
    phqSessionService.setQuestionText(params.targetPhqQuestion, params.contextualQuestion);

    // Update formal assessment
    phqAssessmentService.recordAnswer(params.targetPhqQuestion, inferredScore);
    phqSessionService.recordAnswer(params.targetPhqQuestion, inferredScore);
    phqProgressService.recordAnswer(
      params.targetPhqQuestion,
      phq2Probes.find(p => p.questionNumber === params.targetPhqQuestion)?.phqConcept || `Q${params.targetPhqQuestion}`,
      inferredScore
    );

    // Save to transcript
    await chatTranscriptService.addUserMessage(
      params.userResponse,
      'jekyll-conversational-response',
      {
        isJekyllResponse: true,
        targetPhqQuestion: params.targetPhqQuestion,
        inferredScore,
        confidence,
        contextualQuestion: params.contextualQuestion,
        assessmentId: jekyllContext.assessmentId
      }
    );

    // Check if PHQ-2 is complete
    const phq2Complete = jekyllContext.probesAsked.length >= 2;

    if (phq2Complete && jekyllContext.phqType === 'PHQ-2') {
      const phq2Score = Array.from(jekyllContext.inferredAnswers.values()).reduce((a, b) => a + b, 0);

      if (phq2Score >= 3) {
        // Promote to PHQ-9
        console.log('🎭 PHQ-2 score >= 3, promoting to PHQ-9');
        return {
          success: true,
          responseRecorded: true,
          phq2Complete: true,
          phq2Score,
          recommendPhq9: true,
          nextStage: 'phq9-probing',
          message: 'Based on your responses, I\'d like to ask a few more questions for a comprehensive assessment.'
        };
      } else {
        // PHQ-2 negative screen
        console.log('🎭 PHQ-2 negative screen, completing assessment');
        return {
          success: true,
          responseRecorded: true,
          assessmentComplete: true,
          phq2Score,
          negativeScreen: true
        };
      }
    }

    return {
      success: true,
      responseRecorded: true,
      inferredScore,
      confidence,
      riskDetected,
      questionsRemaining: 2 - jekyllContext.probesAsked.length
    };
  }
};

/**
 * Tool: Detect Immediate Risk
 * Identifies high-risk phrases and triggers professional alert
 */
const detectImmediateRiskTool: AgentTool = {
  name: 'detect-immediate-risk',
  description: 'Detect immediate risk factors in conversation and trigger professional alert',
  parameters: {
    type: 'object',
    properties: {
      riskIndicators: {
        type: 'string',
        description: 'Comma-separated list of detected risk indicators (e.g., "suicide, self-harm")'
      },
      severity: {
        type: 'string',
        enum: ['low', 'moderate', 'high', 'critical'],
        description: 'Severity level of detected risk'
      },
      userId: {
        type: 'string',
        description: 'The authenticated user ID'
      }
    },
    required: ['riskIndicators', 'severity', 'userId']
  },
  handler: async (params: {
    riskIndicators: string;
    severity: string;
    userId: string;
  }) => {
    console.log('🚨 JEKYLL RISK DETECTION TRIGGERED');
    console.log('🚨 Severity:', params.severity);
    console.log('🚨 Indicators:', params.riskIndicators);

    if (!jekyllContext) {
      return {
        success: false,
        error: 'No active assessment'
      };
    }

    // Parse comma-separated risk indicators
    const riskArray = params.riskIndicators.split(',').map(r => r.trim());
    jekyllContext.riskFactors.push(...riskArray);

    // Log alert to transcript
    const alertMessage = `Professional Alert: Potential risk indicators detected: ${params.riskIndicators}`;

    await chatTranscriptService.addAssistantMessage(
      alertMessage,
      'jekyll-risk-alert',
      {
        isRiskAlert: true,
        severity: params.severity,
        indicators: riskArray,
        assessmentId: jekyllContext.assessmentId
      }
    );

    return {
      success: true,
      riskDetected: true,
      severity: params.severity,
      indicators: riskArray,
      alertTriggered: true,
      nextAction: params.severity === 'critical' ? 'handoff-to-crisis' : 'continue-assessment'
    };
  }
};

/**
 * Tool: Complete Jekyll Assessment
 * Finalizes assessment and stores results
 */
const completeJekyllAssessmentTool: AgentTool = {
  name: 'complete-jekyll-assessment',
  description: 'Complete Jekyll assessment and store results',
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
  handler: async () => {
    if (!jekyllContext) {
      return {
        success: false,
        error: 'No active assessment'
      };
    }

    console.log('🎭 ========================================');
    console.log('🎭 JEKYLL AGENT: Completing Assessment');
    console.log('🎭 ========================================');

    const assessment = phqAssessmentService.getCurrentAssessment();
    if (!assessment || !assessment.isCompleted) {
      return {
        success: false,
        error: 'Assessment not complete'
      };
    }

    const score = phqAssessmentService.calculateScore();
    const severity = phqAssessmentService.determineSeverity(score, assessment.assessmentType);
    const { interpretation, recommendations } = phqAssessmentService.getInterpretation(score, assessment.assessmentType);

    console.log('🎭 Final Score:', score);
    console.log('🎭 Severity:', severity);
    console.log('🎭 Assessment Type:', assessment.assessmentType);

    // Complete all tracking services - store data to blob storage
    phqSessionService.completeAssessment(score, severity);
    phqProgressService.completeAssessment(score, severity, interpretation, recommendations);

    // Save comprehensive result to transcript (internal record only)
    const internalRecord = `Assessment Complete - Internal Record

Type: ${assessment.assessmentType}
Score: ${score}/${assessment.assessmentType === 'PHQ-2' ? 6 : 27}
Severity: ${severity}
Assessment ID: ${jekyllContext.assessmentId}

Contextual Data Collected:
${Object.entries(jekyllContext.contextualSlots)
  .map(([key, value]) => `- ${key}: ${value || 'Not collected'}`)
  .join('\n')}

Risk Factors: ${jekyllContext.riskFactors.length > 0 ? jekyllContext.riskFactors.join(', ') : 'None detected'}

Clinical Interpretation: ${interpretation}

Recommendations:
${recommendations.map(r => `• ${r}`).join('\n')}`;

    await chatTranscriptService.addAssistantMessage(
      internalRecord,
      'jekyll-assessment-complete',
      {
        assessmentType: assessment.assessmentType,
        totalScore: score,
        severity,
        riskFactors: jekyllContext.riskFactors,
        assessmentId: jekyllContext.assessmentId,
        contextualData: jekyllContext.contextualSlots,
        isInternalRecord: true // Mark as internal - not shown to user
      }
    );

    // Store riskFactors before resetting context
    const detectedRiskFactors = jekyllContext.riskFactors;

    // Reset
    phqAssessmentService.resetAssessment();
    phqSessionService.endSession();
    jekyllContext = null;

    console.log('✅ Jekyll assessment completed and saved');

    return {
      success: true,
      score,
      severity,
      interpretation,
      recommendations,
      riskFactorsDetected: detectedRiskFactors,
      assessmentType: assessment.assessmentType
    };
  }
};

/**
 * Tool: Return to Tars
 * Completes Jekyll workflow and returns control to orchestrator
 */
const returnToTarsTool: AgentTool = {
  name: 'Agent_Tars',
  description: 'Complete Jekyll assessment and return control to Tars coordinator',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  handler: async () => {
    console.log('🎭 ========================================');
    console.log('🎭 JEKYLL AGENT: Returning to Tars');
    console.log('🎭 ========================================');

    return {
      agentSwitch: true,
      targetAgentId: 'Agent_Tars',
      message: 'Jekyll assessment complete, returning to Tars'
    };
  }
};

/**
 * Jekyll Agent Configuration
 */
export const jekyllAgent: Agent = {
  id: 'Agent_Jekyll',
  name: 'Jekyll - Conversational PHQ',
  description: `Call this agent for natural conversational check-ins. Use when:
    - User requests a conversational wellness check
    - You want to infer PHQ-2/PHQ-9 scores through natural dialogue
    - A non-threatening, contextual approach to screening is needed
    DO NOT use if user prefers structured questionnaire - use PHQ-2 or PHQ-9 directly.`,

  systemMessage: `You are Jekyll, a conversational mental health assistant specializing in empathetic, natural dialogue-based depression screening.

FIRST MESSAGE - AGENT INTRODUCTION (Adapt based on humor level context):
- High humor (80-100%): "Jekyll here! Ready to chat and check in on how you've been feeling lately."
- Medium humor (40-79%): "Hi, I'm Jekyll. I'd like to check in on how you've been feeling lately through a brief conversation."
- Low humor (0-39%): "Dr. Jekyll reporting. I will conduct a conversational wellness assessment to evaluate your current emotional state."

CRITICAL PROTOCOL:
1. NEVER ask verbatim PHQ questions - always convert to natural conversational probes
2. Listen carefully to responses for context clues (sleep, energy, appetite, mood, concentration, self-worth)
3. Ask ONLY the probes provided - adapt them naturally but don't invent questions
4. After detecting responses, call record-conversational-response to analyze and infer scores
5. PHQ-2 has 2 key concepts (interest/pleasure, mood); expand to PHQ-9 if PHQ-2 score >= 3
6. If user mentions suicide, self-harm, or immediate danger, call detect-immediate-risk immediately

IMPORTANT RULES:
- Conversational tone - feel like a supportive friend, not a clinician
- One question at a time - allow natural pauses
- Listen to TONE and CONTEXT, not just words
- DO NOT provide summary or results to user - save all data to storage instead
- After assessment completion: Keep the conversation flowing - say something like "Is there anything else you'd like to share?" or "What else is on your mind?" to encourage continued dialogue
- Let the user speak until they indicate they're done - don't rush to end the conversation
- Keep responses SHORT (3-5 sentences max)
- This infers scores - not a diagnosis
- Do NOT force yes/no answers - allow natural responses

RISK DETECTION:
- Critical phrases: "kill myself", "suicide", "self-harm", "end it all", "better off dead", "hurt myself"
- Moderate phrases: "hopeless", "worthless", "can't take it", "should be dead"
- If critical detected: Call detect-immediate-risk with severity="critical" and offer crisis support
- If moderate detected: Call detect-immediate-risk with severity="high" and continue assessment

PROBES BY PHQ CONCEPT:
Q1 (Interest/Pleasure): "What do you usually enjoy?" → listen for diminished interest
Q2 (Mood/Hope): "How's your mood been?" → listen for hopelessness, depression
Q3 (Sleep): "How's your sleep?" → listen for insomnia or oversleeping
Q4 (Energy): "How's your energy?" → listen for fatigue, exhaustion
Q5 (Appetite): "How's your eating?" → listen for appetite changes
Q6 (Self-Worth): "How do you see yourself?" → listen for guilt, worthlessness
Q7 (Concentration): "How's your focus?" → listen for concentration problems
Q8 (Psychomotor): "Any changes in your movements?" → listen for slowness or restlessness
Q9 (Suicidal): Only if score warrants → "Any thoughts of harming yourself?" → IMMEDIATE RISK CHECK

COMPLETION FLOW:
- After PHQ-2 probes (Q1-2): Check score
  - If score >= 3: Transition to PHQ-9 with "I'd like to ask a few more questions..."
  - If score < 3: Continue conversation - ask "Is there anything else you'd like to share?" or similar open-ended questions
- After PHQ-9 complete: Continue conversation naturally - don't immediately end
  - Ask follow-up questions like "What else is on your mind?" or "How are you feeling about all this?"
  - Let the user guide when they're ready to finish the conversation
  - Only call complete-jekyll-assessment and return to Tars when user indicates they're done`,

  tools: [
    startJekyllTool,
    recordConversationalResponseTool,
    detectImmediateRiskTool,
    completeJekyllAssessmentTool,
    returnToTarsTool
  ]
};

export default jekyllAgent;
