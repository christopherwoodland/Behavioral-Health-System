/**
 * PHQ Assessment Service for storing a  private currentAssessment: PhqAssessmentData | null = null; retrieving PHQ-2 and PHQ-9 assessments
 * Handles JSON storage in Azure Blob Storage with proper metadata
 */

export interface PhqQuestion {
  questionNumber: number;
  questionText: string;
  answer?: number;
  attempts: number;
  skipped: boolean;
  timestamp?: string;
}

export interface PhqAssessmentResult {
  assessmentId: string;
  userId: string;
  assessmentType: 'PHQ-2' | 'PHQ-9';
  startTime: string;
  completedTime?: string;
  isCompleted: boolean;
  questions: PhqQuestion[];
  totalScore?: number;
  severity?: string;
  interpretation?: string;
  recommendations?: string[];
  metadata: {
    userAgent: string;
    ipAddress?: string;
    sessionId?: string;
    version: string;
  };
}

export interface PhqStorageMetadata {
  assessmentType: string;
  userId: string;
  completedTime?: string;
  totalScore?: string;
  severity?: string;
  isCompleted: string;
}

class PhqAssessmentService {
  private currentAssessment: PhqAssessmentResult | null = null;
  private readonly storageEndpoint = '/api/assessments'; // Backend endpoint for blob storage

  /**
   * PHQ-2 Questions (first 2 questions from PHQ-9)
   */
  private readonly phq2Questions: Omit<PhqQuestion, 'answer' | 'attempts' | 'skipped'>[] = [
    {
      questionNumber: 1,
      questionText: "Over the last 2 weeks, how often have you been bothered by little interest or pleasure in doing things?"
    },
    {
      questionNumber: 2,
      questionText: "Over the last 2 weeks, how often have you been bothered by feeling down, depressed, or hopeless?"
    }
  ];

  /**
   * PHQ-9 Questions (complete depression assessment)
   */
  private readonly phq9Questions: Omit<PhqQuestion, 'answer' | 'attempts' | 'skipped'>[] = [
    {
      questionNumber: 1,
      questionText: "Over the last 2 weeks, how often have you been bothered by little interest or pleasure in doing things?"
    },
    {
      questionNumber: 2,
      questionText: "Over the last 2 weeks, how often have you been bothered by feeling down, depressed, or hopeless?"
    },
    {
      questionNumber: 3,
      questionText: "Over the last 2 weeks, how often have you been bothered by trouble falling or staying asleep, or sleeping too much?"
    },
    {
      questionNumber: 4,
      questionText: "Over the last 2 weeks, how often have you been bothered by feeling tired or having little energy?"
    },
    {
      questionNumber: 5,
      questionText: "Over the last 2 weeks, how often have you been bothered by poor appetite or overeating?"
    },
    {
      questionNumber: 6,
      questionText: "Over the last 2 weeks, how often have you been bothered by feeling bad about yourself or that you are a failure or have let yourself or your family down?"
    },
    {
      questionNumber: 7,
      questionText: "Over the last 2 weeks, how often have you been bothered by trouble concentrating on things, such as reading the newspaper or watching television?"
    },
    {
      questionNumber: 8,
      questionText: "Over the last 2 weeks, how often have you been bothered by moving or speaking so slowly that other people could have noticed, or the opposite - being so fidgety or restless that you have been moving around a lot more than usual?"
    },
    {
      questionNumber: 9,
      questionText: "Over the last 2 weeks, how often have you been bothered by thoughts that you would be better off dead, or of hurting yourself in some way?"
    }
  ];

  /**
   * Response scale for both PHQ-2 and PHQ-9
   */
  private readonly responseScale = {
    0: "Not at all",
    1: "Several days", 
    2: "More than half the days",
    3: "Nearly every day"
  };

  /**
   * Start a new PHQ assessment
   */
  startAssessment(type: 'PHQ-2' | 'PHQ-9', userId: string): PhqAssessmentResult {
    const questions = type === 'PHQ-2' ? this.phq2Questions : this.phq9Questions;
    
    this.currentAssessment = {
      assessmentId: this.generateAssessmentId(),
      userId,
      assessmentType: type,
      startTime: new Date().toISOString(),
      isCompleted: false,
      questions: questions.map(q => ({
        ...q,
        attempts: 0,
        skipped: false
      })),
      metadata: {
        userAgent: navigator.userAgent,
        sessionId: this.generateSessionId(),
        version: '1.0.0'
      }
    };

    return this.currentAssessment;
  }

  /**
   * Get the current assessment
   */
  getCurrentAssessment(): PhqAssessmentResult | null {
    return this.currentAssessment;
  }

  /**
   * Get the next unanswered question
   */
  getNextQuestion(): PhqQuestion | null {
    if (!this.currentAssessment) return null;

    // First pass: get unskipped questions without answers
    const unanswered = this.currentAssessment.questions.find(q => 
      q.answer === undefined && !q.skipped
    );
    
    if (unanswered) return unanswered;

    // Second pass: get skipped questions (return to them later)
    const skipped = this.currentAssessment.questions.find(q => 
      q.answer === undefined && q.skipped
    );
    
    return skipped || null;
  }

  /**
   * Record an answer to a question
   */
  recordAnswer(questionNumber: number, answer: number): boolean {
    if (!this.currentAssessment) return false;
    
    const question = this.currentAssessment.questions.find(q => q.questionNumber === questionNumber);
    if (!question) return false;

    // Validate answer (0-3 scale)
    if (answer < 0 || answer > 3) return false;

    question.answer = answer;
    question.timestamp = new Date().toISOString();
    
    // Check if assessment is complete
    const allAnswered = this.currentAssessment.questions.every(q => q.answer !== undefined);
    if (allAnswered) {
      this.completeAssessment();
    }

    return true;
  }

  /**
   * Record an invalid attempt for a question
   */
  recordInvalidAttempt(questionNumber: number): void {
    if (!this.currentAssessment) return;
    
    const question = this.currentAssessment.questions.find(q => q.questionNumber === questionNumber);
    if (question) {
      question.attempts++;
      
      // Skip question after 3 invalid attempts
      if (question.attempts >= 3) {
        question.skipped = true;
      }
    }
  }

  /**
   * Calculate total score
   */
  calculateScore(): number {
    if (!this.currentAssessment) return 0;
    
    return this.currentAssessment.questions
      .filter(q => q.answer !== undefined)
      .reduce((sum, q) => sum + (q.answer || 0), 0);
  }

  /**
   * Determine severity based on score and assessment type
   */
  determineSeverity(score: number, type: 'PHQ-2' | 'PHQ-9'): string {
    if (type === 'PHQ-2') {
      return score >= 3 ? 'Positive Screen' : 'Negative Screen';
    } else {
      // PHQ-9 severity ranges
      if (score <= 4) return 'Minimal';
      if (score <= 9) return 'Mild';
      if (score <= 14) return 'Moderate';
      if (score <= 19) return 'Moderately Severe';
      return 'Severe';
    }
  }

  /**
   * Get interpretation and recommendations
   */
  getInterpretation(score: number, type: 'PHQ-2' | 'PHQ-9'): { interpretation: string; recommendations: string[] } {
    if (type === 'PHQ-2') {
      if (score >= 3) {
        return {
          interpretation: "Positive screen for depression. Further evaluation recommended.",
          recommendations: [
            "Consider completing PHQ-9 for comprehensive assessment",
            "Discuss results with healthcare provider",
            "Consider mental health professional consultation"
          ]
        };
      } else {
        return {
          interpretation: "Negative screen for depression. Low likelihood of major depression.",
          recommendations: [
            "Continue monitoring mood and wellbeing",
            "Seek help if symptoms worsen or persist"
          ]
        };
      }
    } else {
      // PHQ-9 interpretations
      const interpretations = {
        'Minimal': "Minimal depression. May not require treatment.",
        'Mild': "Mild depression. Consider counseling, follow-up, or watchful waiting.",
        'Moderate': "Moderate depression. Consider psychotherapy or medication.",
        'Moderately Severe': "Moderately severe depression. Active treatment recommended.",
        'Severe': "Severe depression. Immediate active treatment required."
      };
      
      const severity = this.determineSeverity(score, type);
      const interpretation = interpretations[severity as keyof typeof interpretations];
      
      const recommendations = [];
      if (score >= 10) {
        recommendations.push("Consider professional mental health treatment");
        recommendations.push("Discuss medication options with healthcare provider");
      }
      if (score >= 5) {
        recommendations.push("Consider psychotherapy or counseling");
        recommendations.push("Monitor symptoms closely");
      }
      
      // Check for suicidal ideation (question 9)
      const suicidalQuestion = this.currentAssessment?.questions.find(q => q.questionNumber === 9);
      if (suicidalQuestion && (suicidalQuestion.answer || 0) > 0) {
        recommendations.unshift("⚠️ PRIORITY: Seek immediate help for suicidal thoughts");
        recommendations.push("Contact crisis hotline: 988 (US) or local emergency services");
      }
      
      return { interpretation, recommendations };
    }
  }

  /**
   * Complete the assessment
   */
  private completeAssessment(): void {
    if (!this.currentAssessment) return;

    const score = this.calculateScore();
    const severity = this.determineSeverity(score, this.currentAssessment.assessmentType);
    const { interpretation, recommendations } = this.getInterpretation(score, this.currentAssessment.assessmentType);

    this.currentAssessment.completedTime = new Date().toISOString();
    this.currentAssessment.isCompleted = true;
    this.currentAssessment.totalScore = score;
    this.currentAssessment.severity = severity;
    this.currentAssessment.interpretation = interpretation;
    this.currentAssessment.recommendations = recommendations;
  }

  /**
   * Save assessment to blob storage
   */
  async saveAssessment(): Promise<boolean> {
    if (!this.currentAssessment || !this.currentAssessment.isCompleted) {
      return false;
    }

    try {
      // Get the Azure Functions endpoint from environment or use default
      const functionsBaseUrl = process.env.REACT_APP_FUNCTIONS_URL || 'http://localhost:7071';
      const endpoint = `${functionsBaseUrl}/api/SavePhqAssessment`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assessmentData: this.currentAssessment,
          metadata: {
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            sessionId: sessionStorage.getItem('session-id') || 'unknown',
            clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          containerName: 'phq-assessments',
          fileName: `${this.currentAssessment.assessmentType.toLowerCase().replace('-', '')}-${this.currentAssessment.assessmentId}.json`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to save assessment: ${response.status} ${response.statusText} - ${errorText}`);
        return false;
      }

      const result = await response.json();
      console.log('Assessment saved successfully:', result);
      return true;
    } catch (error) {
      console.error('Failed to save assessment:', error);
      return false;
    }
  }

  /**
   * Get assessment progress summary
   */
  getProgressSummary(): string {
    if (!this.currentAssessment) return "No active assessment";

    const answered = this.currentAssessment.questions.filter(q => q.answer !== undefined).length;
    const total = this.currentAssessment.questions.length;
    const skipped = this.currentAssessment.questions.filter(q => q.skipped && q.answer === undefined).length;

    let summary = `${this.currentAssessment.assessmentType} Progress: ${answered}/${total} questions answered`;
    if (skipped > 0) {
      summary += `, ${skipped} skipped (will revisit)`;
    }

    return summary;
  }

  /**
   * Reset current assessment
   */
  resetAssessment(): void {
    this.currentAssessment = null;
  }

  /**
   * Generate unique assessment ID
   */
  private generateAssessmentId(): string {
    return `phq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get response scale text
   */
  getResponseScale(): string {
    return Object.entries(this.responseScale)
      .map(([value, text]) => `${value} = ${text}`)
      .join('\n');
  }

  /**
   * Check if answer is valid
   */
  isValidAnswer(answer: string): boolean {
    const num = parseInt(answer.trim());
    return !isNaN(num) && num >= 0 && num <= 3;
  }

  /**
   * Parse answer from user input
   */
  parseAnswer(input: string): number | null {
    const trimmed = input.trim();
    const num = parseInt(trimmed);
    return (this.isValidAnswer(trimmed)) ? num : null;
  }
}

// Export singleton instance
export const phqAssessmentService = new PhqAssessmentService();
export default phqAssessmentService;