/**
 * PHQ Assessment Progress Service for continuously saving assessment progress to blob storage
 * Tracks question-by-question progress during PHQ-2 and PHQ-9 assessments
 */

import { env } from '@/utils/env';

export interface PhqAnsweredQuestion {
  questionNumber: number;
  questionText: string;
  answer: number;
  answeredAt: string;
  attempts: number;
  wasSkipped: boolean;
}

export interface PhqAssessmentProgress {
  userId: string;
  assessmentId: string;
  assessmentType: 'PHQ-2' | 'PHQ-9';
  startedAt: string;
  lastUpdated: string;
  completedAt?: string;
  isCompleted: boolean;
  totalQuestions: number;
  answeredQuestions: PhqAnsweredQuestion[];
  totalScore?: number;
  severity?: string;
  interpretation?: string;
  recommendations?: string[];
  metadata?: {
    sessionId?: string;
    userAgent?: string;
    clientTimezone?: string;
    ipAddress?: string;
    customData?: Record<string, any>;
  };
}

export interface PhqProgressSaveRequest {
  progressData: PhqAssessmentProgress;
  metadata?: Record<string, any>;
  containerName?: string;
  fileName?: string;
}

class PhqProgressService {
  private currentProgress: PhqAssessmentProgress | null = null;
  private isSaving = false;
  private saveTimer: NodeJS.Timeout | null = null;
  private readonly saveDelay = 500; // 500ms delay for progress updates

  /**
   * Start a new PHQ assessment progress tracking
   */
  startAssessment(userId: string, assessmentType: 'PHQ-2' | 'PHQ-9', assessmentId?: string): PhqAssessmentProgress {
    const newAssessmentId = assessmentId || this.generateAssessmentId();
    const totalQuestions = assessmentType === 'PHQ-2' ? 2 : 9;

    this.currentProgress = {
      userId,
      assessmentId: newAssessmentId,
      assessmentType,
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isCompleted: false,
      totalQuestions,
      answeredQuestions: [],
      metadata: {
        sessionId: this.getSessionId(),
        userAgent: navigator.userAgent,
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        customData: {}
      }
    };

    // Save initial empty progress
    this.saveProgressImmediate();

    return this.currentProgress;
  }

  /**
   * Record an answer to a question
   */
  recordAnswer(
    questionNumber: number,
    questionText: string,
    answer: number,
    attempts: number = 1,
    wasSkipped: boolean = false
  ): boolean {
    if (!this.currentProgress) {
      console.warn('No active PHQ assessment. Start assessment first.');
      return false;
    }

    if (answer < 0 || answer > 3) {
      console.warn('Invalid answer value. Must be between 0 and 3.');
      return false;
    }

    // Remove existing answer for this question if it exists
    this.currentProgress.answeredQuestions = this.currentProgress.answeredQuestions.filter(
      q => q.questionNumber !== questionNumber
    );

    // Add new answer
    const answeredQuestion: PhqAnsweredQuestion = {
      questionNumber,
      questionText,
      answer,
      answeredAt: new Date().toISOString(),
      attempts,
      wasSkipped
    };

    this.currentProgress.answeredQuestions.push(answeredQuestion);
    this.currentProgress.lastUpdated = new Date().toISOString();

    // Sort by question number
    this.currentProgress.answeredQuestions.sort((a, b) => a.questionNumber - b.questionNumber);

    // Check if assessment is complete
    this.checkAndUpdateCompletion();

    // Schedule save
    this.scheduleDelayedSave();

    return true;
  }

  /**
   * Mark a question as skipped
   */
  skipQuestion(questionNumber: number, questionText: string, attempts: number = 3): void {
    if (!this.currentProgress) return;

    // Record as skipped (no answer)
    const skippedQuestion: PhqAnsweredQuestion = {
      questionNumber,
      questionText,
      answer: -1, // Use -1 to indicate skipped
      answeredAt: new Date().toISOString(),
      attempts,
      wasSkipped: true
    };

    // Remove existing entry for this question
    this.currentProgress.answeredQuestions = this.currentProgress.answeredQuestions.filter(
      q => q.questionNumber !== questionNumber
    );

    this.currentProgress.answeredQuestions.push(skippedQuestion);
    this.currentProgress.lastUpdated = new Date().toISOString();

    // Sort by question number
    this.currentProgress.answeredQuestions.sort((a, b) => a.questionNumber - b.questionNumber);

    // Schedule save
    this.scheduleDelayedSave();
  }

  /**
   * Complete the assessment with final scores and interpretation
   */
  completeAssessment(
    totalScore: number,
    severity: string,
    interpretation: string,
    recommendations: string[]
  ): void {
    if (!this.currentProgress) return;

    this.currentProgress.isCompleted = true;
    this.currentProgress.completedAt = new Date().toISOString();
    this.currentProgress.lastUpdated = new Date().toISOString();
    this.currentProgress.totalScore = totalScore;
    this.currentProgress.severity = severity;
    this.currentProgress.interpretation = interpretation;
    this.currentProgress.recommendations = recommendations;

    // Force immediate save for completion
    this.saveProgressImmediate();
  }

  /**
   * Get current assessment progress
   */
  getCurrentProgress(): PhqAssessmentProgress | null {
    return this.currentProgress;
  }

  /**
   * Get progress summary
   */
  getProgressSummary(): { answeredCount: number; totalQuestions: number; percentComplete: number; isCompleted: boolean } | null {
    if (!this.currentProgress) return null;

    const answeredCount = this.currentProgress.answeredQuestions.filter(q => q.answer >= 0).length;
    const totalQuestions = this.currentProgress.totalQuestions;
    const percentComplete = Math.round((answeredCount / totalQuestions) * 100);

    return {
      answeredCount,
      totalQuestions,
      percentComplete,
      isCompleted: this.currentProgress.isCompleted
    };
  }

  /**
   * Update custom metadata
   */
  updateMetadata(customData: Record<string, any>): void {
    if (!this.currentProgress) return;

    if (!this.currentProgress.metadata) {
      this.currentProgress.metadata = {};
    }

    if (!this.currentProgress.metadata.customData) {
      this.currentProgress.metadata.customData = {};
    }

    Object.assign(this.currentProgress.metadata.customData, customData);
    this.currentProgress.lastUpdated = new Date().toISOString();

    // Schedule save for metadata updates
    this.scheduleDelayedSave();
  }

  /**
   * Check if assessment is complete and update status
   */
  private checkAndUpdateCompletion(): void {
    if (!this.currentProgress) return;

    // Count valid answers (not skipped)
    const validAnswers = this.currentProgress.answeredQuestions.filter(q => q.answer >= 0).length;

    // Assessment is complete if all questions have valid answers
    if (validAnswers === this.currentProgress.totalQuestions && !this.currentProgress.isCompleted) {
      // Don't auto-complete here, wait for explicit completion call with scores
      // This just tracks question progress
    }
  }

  /**
   * Schedule a delayed save
   */
  private scheduleDelayedSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveProgressImmediate();
    }, this.saveDelay);
  }

  /**
   * Save progress immediately
   */
  private async saveProgressImmediate(): Promise<void> {
    if (!this.currentProgress || this.isSaving) return;

    try {
      this.isSaving = true;

      // Clear any pending timer
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }

      const apiBaseUrl = env.API_BASE_URL;
      const endpoint = `${apiBaseUrl}/SavePhqProgress`;

      console.log('🟢 Saving PHQ progress to:', endpoint);
      console.log('📊 Progress data:', {
        assessmentId: this.currentProgress.assessmentId,
        userId: this.currentProgress.userId,
        assessmentType: this.currentProgress.assessmentType,
        isCompleted: this.currentProgress.isCompleted,
        questionsAnswered: this.currentProgress.answeredQuestions.length,
        totalQuestions: this.currentProgress.totalQuestions
      });

      const request: PhqProgressSaveRequest = {
        progressData: { ...this.currentProgress },
        metadata: {
          saveTimestamp: new Date().toISOString(),
          questionsAnswered: this.currentProgress.answeredQuestions.length,
          isCompleted: this.currentProgress.isCompleted
        },
        containerName: 'phq'
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save PHQ progress: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('PHQ assessment progress saved successfully:', result);

    } catch (error) {
      console.error('Error saving PHQ assessment progress:', error);

      // Retry failed saves after a delay
      setTimeout(() => {
        if (this.currentProgress) {
          this.saveProgressImmediate();
        }
      }, 5000); // Retry after 5 seconds
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Force save without delay (for critical events)
   */
  async forceSave(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.saveProgressImmediate();
  }

  /**
   * Reset progress (start new assessment)
   */
  resetProgress(): void {
    this.currentProgress = null;

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  /**
   * Generate unique assessment ID
   */
  private generateAssessmentId(): string {
    return `phq-progress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get session ID from session storage or generate one
   */
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('chat-session-id');
    if (!sessionId) {
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('chat-session-id', sessionId);
    }
    return sessionId;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    // Force final save if there is current progress
    if (this.currentProgress) {
      this.saveProgressImmediate();
    }
  }
}

// Export singleton instance
export const phqProgressService = new PhqProgressService();
export default phqProgressService;
