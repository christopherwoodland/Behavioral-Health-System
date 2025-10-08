/**
 * PHQ Session Service for continuously saving PHQ assessment sessions to blob storage
 * Saves progressively as the assessment progresses, similar to chat transcript service
 */

export interface PhqQuestionResponse {
  questionNumber: number;
  questionText: string;
  answer?: number; // 0-3
  attempts: number;
  skipped: boolean;
  answeredAt?: string;
}

export interface PhqSession {
  userId: string;
  sessionId: string; // Same as chat transcript session ID
  assessmentId: string; // Unique ID for this specific assessment
  assessmentType: 'PHQ-2' | 'PHQ-9';
  createdAt: string;
  lastUpdated: string;
  completedAt?: string;
  isCompleted: boolean;
  questions: PhqQuestionResponse[];
  totalScore?: number;
  severity?: string;
  metadata?: {
    conversationSessionId: string; // Links to chat transcript
    userAgent?: string;
    clientTimezone?: string;
    version?: string;
  };
}

export interface PhqSessionSaveRequest {
  sessionData: PhqSession;
  metadata?: Record<string, any>;
  containerName?: string;
  fileName?: string;
}

class PhqSessionService {
  private currentSession: PhqSession | null = null;
  private isSaving = false;
  private saveTimer: NodeJS.Timeout | null = null;
  private readonly saveDelay = 1000; // 1 second delay to batch rapid updates

  /**
   * Initialize a new PHQ assessment session
   */
  initializeSession(
    userId: string,
    sessionId: string,
    assessmentId: string,
    assessmentType: 'PHQ-2' | 'PHQ-9'
  ): PhqSession {
    const questionCount = assessmentType === 'PHQ-2' ? 2 : 9;
    
    this.currentSession = {
      userId,
      sessionId,
      assessmentId,
      assessmentType,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isCompleted: false,
      questions: Array.from({ length: questionCount }, (_, i) => ({
        questionNumber: i + 1,
        questionText: '', // Will be filled when question is asked
        answer: undefined,
        attempts: 0,
        skipped: false
      })),
      metadata: {
        conversationSessionId: sessionId,
        userAgent: navigator.userAgent,
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        version: '1.0.0'
      }
    };

    console.log('🟢 PHQ Session initialized:', {
      assessmentType,
      assessmentId,
      sessionId,
      userId
    });

    // Save initial empty session
    this.saveSessionImmediate();
    
    return this.currentSession;
  }

  /**
   * Update a question's text (when it's first asked)
   */
  setQuestionText(questionNumber: number, questionText: string): void {
    if (!this.currentSession) {
      console.warn('No active PHQ session.');
      return;
    }

    const question = this.currentSession.questions.find(q => q.questionNumber === questionNumber);
    if (question) {
      question.questionText = questionText;
      this.currentSession.lastUpdated = new Date().toISOString();
      this.scheduleDelayedSave();
    }
  }

  /**
   * Record an answer to a question
   */
  recordAnswer(questionNumber: number, answer: number): void {
    if (!this.currentSession) {
      console.warn('No active PHQ session.');
      return;
    }

    const question = this.currentSession.questions.find(q => q.questionNumber === questionNumber);
    if (question) {
      question.answer = answer;
      question.answeredAt = new Date().toISOString();
      this.currentSession.lastUpdated = new Date().toISOString();
      
      console.log(`📝 PHQ answer recorded: Q${questionNumber} = ${answer}`);
      
      this.scheduleDelayedSave();
    }
  }

  /**
   * Record an invalid attempt for a question
   */
  recordInvalidAttempt(questionNumber: number): void {
    if (!this.currentSession) {
      console.warn('No active PHQ session.');
      return;
    }

    const question = this.currentSession.questions.find(q => q.questionNumber === questionNumber);
    if (question) {
      question.attempts++;
      
      // Mark as skipped after 3 attempts
      if (question.attempts >= 3) {
        question.skipped = true;
        console.log(`⏭️ PHQ question ${questionNumber} skipped after 3 attempts`);
      }
      
      this.currentSession.lastUpdated = new Date().toISOString();
      this.scheduleDelayedSave();
    }
  }

  /**
   * Complete the assessment with final score and severity
   */
  completeAssessment(totalScore: number, severity: string): void {
    if (!this.currentSession) {
      console.warn('No active PHQ session.');
      return;
    }

    this.currentSession.isCompleted = true;
    this.currentSession.completedAt = new Date().toISOString();
    this.currentSession.totalScore = totalScore;
    this.currentSession.severity = severity;
    this.currentSession.lastUpdated = new Date().toISOString();

    console.log('✅ PHQ Session completed:', {
      totalScore,
      severity,
      assessmentType: this.currentSession.assessmentType
    });

    // Save immediately when completed
    this.saveSessionImmediate();
  }

  /**
   * Get current session
   */
  getCurrentSession(): PhqSession | null {
    return this.currentSession;
  }

  /**
   * End the current session
   */
  endSession(): void {
    if (this.currentSession) {
      console.log('🔴 PHQ Session ended:', this.currentSession.assessmentId);
      
      // Save one final time before clearing
      this.saveSessionImmediate();
      this.currentSession = null;
    }
  }

  /**
   * Schedule a delayed save to batch rapid updates
   */
  private scheduleDelayedSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveSessionImmediate();
    }, this.saveDelay);
  }

  /**
   * Save the session immediately
   */
  private async saveSessionImmediate(): Promise<void> {
    if (!this.currentSession || this.isSaving) {
      return;
    }

    this.isSaving = true;

    try {
      const functionsBaseUrl = import.meta.env.VITE_FUNCTIONS_URL || 'http://localhost:7071';
      const endpoint = `${functionsBaseUrl}/api/SavePhqSession`;

      const request: PhqSessionSaveRequest = {
        sessionData: this.currentSession,
        metadata: {
          savedAt: new Date().toISOString(),
          version: '1.0.0'
        },
        containerName: 'phq-sessions',
        fileName: `users/${this.currentSession.userId}/${this.currentSession.assessmentType.toLowerCase()}-${this.currentSession.assessmentId}.json`
      };

      console.log('💾 Saving PHQ session:', {
        assessmentId: this.currentSession.assessmentId,
        questionCount: this.currentSession.questions.length,
        answeredCount: this.currentSession.questions.filter(q => q.answer !== undefined).length,
        isCompleted: this.currentSession.isCompleted
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to save PHQ session: ${response.status} ${response.statusText}`, errorText);
      } else {
        const result = await response.json();
        console.log('✅ PHQ session saved successfully:', result);
      }
    } catch (error) {
      console.error('❌ Error saving PHQ session:', error);
    } finally {
      this.isSaving = false;
    }
  }
}

// Export singleton instance
export const phqSessionService = new PhqSessionService();
