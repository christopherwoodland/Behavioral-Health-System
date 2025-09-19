/**
 * PHQ-2 Realtime Agent
 * Specialized agent for conducting PHQ-2 depression screening via speech
 * Integrates with existing PHQ-2 models and questionnaire system
 */

export interface Phq2Response {
  questionNumber: number;
  score: Phq2ResponseScale;
  responseDate: string;
  numericScore: number;
}

export enum Phq2ResponseScale {
  NotAtAll = 0,
  SeveralDays = 1,
  MoreThanHalfTheDays = 2,
  NearlyEveryDay = 3
}

export enum Phq2Severity {
  Minimal = 0,    // 0-2: Minimal depression likelihood
  Positive = 1    // 3-6: Positive screen - further evaluation recommended
}

export interface Phq2Assessment {
  userId: string;
  sessionId: string;
  startDate: string;
  completedDate?: string;
  responses: Phq2Response[];
  isCompleted: boolean;
  totalScore?: number;
  severity?: Phq2Severity;
}

export interface Phq2Question {
  number: number;
  text: string;
  description: string;
}

export class Phq2RealtimeAgent extends EventTarget {
  private currentAssessment: Phq2Assessment | null = null;
  private currentQuestionNumber = 1;
  private isActive = false;
  private sessionId: string = '';
  private userId: string = '';

  // PHQ-2 Questions (same as backend models)
  private readonly questions: Phq2Question[] = [
    {
      number: 1,
      text: "Little interest or pleasure in doing things",
      description: "Over the last 2 weeks, how often have you been bothered by little interest or pleasure in doing things?"
    },
    {
      number: 2,
      text: "Feeling down, depressed or hopeless", 
      description: "Over the last 2 weeks, how often have you been bothered by feeling down, depressed or hopeless?"
    }
  ];

  // Response options with descriptions
  private readonly responseOptions = new Map<Phq2ResponseScale, string>([
    [Phq2ResponseScale.NotAtAll, "Not at all"],
    [Phq2ResponseScale.SeveralDays, "Several days"],
    [Phq2ResponseScale.MoreThanHalfTheDays, "More than half the days"],
    [Phq2ResponseScale.NearlyEveryDay, "Nearly every day"]
  ]);

  constructor() {
    super();
  }

  startAssessment(sessionId: string, userId?: string): Phq2Assessment {
    this.sessionId = sessionId;
    this.userId = userId || `user_${Date.now()}`;
    this.currentQuestionNumber = 1;
    this.isActive = true;

    this.currentAssessment = {
      userId: this.userId,
      sessionId: this.sessionId,
      startDate: new Date().toISOString(),
      responses: [],
      isCompleted: false
    };

    console.log('PHQ-2 assessment started:', this.currentAssessment);
    this.dispatchEvent(new CustomEvent('assessment_started', { 
      detail: { assessment: this.currentAssessment } 
    }));

    return this.currentAssessment;
  }

  getCurrentQuestion(): Phq2Question | null {
    if (!this.isActive || this.currentQuestionNumber > 2) {
      return null;
    }
    return this.questions.find(q => q.number === this.currentQuestionNumber) || null;
  }

  getFormattedCurrentQuestion(): string {
    const question = this.getCurrentQuestion();
    if (!question) {
      return "Assessment is complete or not started.";
    }

    const responseText = Array.from(this.responseOptions.entries())
      .map(([score, description]) => `${score}. ${description} (${score} ${score === 1 ? 'point' : 'points'})`)
      .join('\n');

    return `
PHQ-2 Question ${question.number}: ${question.text}

${question.description}

Please respond with the number that best describes your experience:
${responseText}

You can say the number or the description (for example: "0", "not at all", "several days", or "2").
    `.trim();
  }

  recordResponse(responseText: string): boolean {
    if (!this.isActive || !this.currentAssessment) {
      console.warn('No active assessment to record response');
      return false;
    }

    const score = this.parseResponse(responseText);
    if (score === null) {
      console.warn('Could not parse response:', responseText);
      this.dispatchEvent(new CustomEvent('response_parse_error', { 
        detail: { responseText, currentQuestion: this.getCurrentQuestion() } 
      }));
      return false;
    }

    const response: Phq2Response = {
      questionNumber: this.currentQuestionNumber,
      score: score,
      responseDate: new Date().toISOString(),
      numericScore: score
    };

    this.currentAssessment.responses.push(response);
    
    console.log('Recorded PHQ-2 response:', response);
    this.dispatchEvent(new CustomEvent('response_recorded', { 
      detail: { response, question: this.getCurrentQuestion() } 
    }));

    // Move to next question or complete assessment
    if (this.currentQuestionNumber < 2) {
      this.currentQuestionNumber++;
      this.dispatchEvent(new CustomEvent('next_question', { 
        detail: { questionNumber: this.currentQuestionNumber, question: this.getCurrentQuestion() } 
      }));
    } else {
      this.completeAssessment();
    }

    return true;
  }

  private parseResponse(responseText: string): Phq2ResponseScale | null {
    const cleanText = responseText.toLowerCase().trim();

    // Direct numeric matches
    if (cleanText === '0' || cleanText === 'zero') return Phq2ResponseScale.NotAtAll;
    if (cleanText === '1' || cleanText === 'one') return Phq2ResponseScale.SeveralDays;
    if (cleanText === '2' || cleanText === 'two') return Phq2ResponseScale.MoreThanHalfTheDays;
    if (cleanText === '3' || cleanText === 'three') return Phq2ResponseScale.NearlyEveryDay;

    // Phrase matching
    if (cleanText.includes('not at all') || cleanText.includes('never') || cleanText.includes('none')) {
      return Phq2ResponseScale.NotAtAll;
    }
    
    if (cleanText.includes('several days') || cleanText.includes('few days') || cleanText.includes('sometimes')) {
      return Phq2ResponseScale.SeveralDays;
    }
    
    if (cleanText.includes('more than half') || cleanText.includes('most days') || cleanText.includes('often')) {
      return Phq2ResponseScale.MoreThanHalfTheDays;
    }
    
    if (cleanText.includes('nearly every day') || cleanText.includes('almost every day') || 
        cleanText.includes('every day') || cleanText.includes('daily') || cleanText.includes('always')) {
      return Phq2ResponseScale.NearlyEveryDay;
    }

    // Additional flexible parsing
    if (cleanText.includes('rarely') || cleanText.includes('barely')) {
      return Phq2ResponseScale.NotAtAll;
    }
    
    if (cleanText.includes('frequently') || cleanText.includes('regularly')) {
      return Phq2ResponseScale.MoreThanHalfTheDays;
    }

    return null; // Could not parse
  }

  private completeAssessment(): void {
    if (!this.currentAssessment) return;

    this.currentAssessment.completedDate = new Date().toISOString();
    this.currentAssessment.isCompleted = true;
    this.currentAssessment.totalScore = this.calculateScore();
    this.currentAssessment.severity = this.determineSeverity(this.currentAssessment.totalScore);
    
    this.isActive = false;

    console.log('PHQ-2 assessment completed:', this.currentAssessment);
    this.dispatchEvent(new CustomEvent('assessment_completed', { 
      detail: { assessment: this.currentAssessment } 
    }));
  }

  calculateScore(): number {
    if (!this.currentAssessment) return 0;
    return this.currentAssessment.responses.reduce((sum, response) => sum + response.numericScore, 0);
  }

  determineSeverity(totalScore: number): Phq2Severity {
    return totalScore >= 3 ? Phq2Severity.Positive : Phq2Severity.Minimal;
  }

  getInterpretation(): string {
    if (!this.currentAssessment || !this.currentAssessment.isCompleted || 
        this.currentAssessment.totalScore === undefined) {
      return "Assessment not completed.";
    }

    const score = this.currentAssessment.totalScore;
    const interpretation = score >= 3 
      ? "Positive screen for depression. Further evaluation with PHQ-9 or clinical interview is recommended."
      : "Minimal depression likelihood. Score indicates low probability of major depressive disorder.";

    return `PHQ-2 Score: ${score}/6 - ${interpretation}`;
  }

  getRecommendations(): string {
    if (!this.currentAssessment || !this.currentAssessment.isCompleted || 
        this.currentAssessment.totalScore === undefined) {
      return "Complete the assessment to receive recommendations.";
    }

    const score = this.currentAssessment.totalScore;
    
    if (score >= 3) {
      return `Further evaluation recommended:
• Complete PHQ-9 for comprehensive depression screening
• Consider clinical interview with mental health professional  
• Discuss symptoms and concerns with healthcare provider

If you're experiencing thoughts of self-harm or suicide, please contact:
• National Suicide Prevention Lifeline: 988
• Crisis Text Line: Text HOME to 741741
• Or go to your nearest emergency room`;
    } else {
      return `Continue routine care. Monitor for any changes in mood or symptoms.
      
If you ever experience persistent sadness, loss of interest, or thoughts of self-harm, please reach out to a healthcare professional or mental health crisis line.`;
    }
  }

  getDetailedResults(): string {
    if (!this.currentAssessment || !this.currentAssessment.isCompleted) {
      return "Assessment not completed.";
    }

    let results = "PHQ-2 Depression Screening Results\n\n";
    
    // Individual responses
    this.currentAssessment.responses.forEach(response => {
      const question = this.questions.find(q => q.number === response.questionNumber);
      const responseText = this.responseOptions.get(response.score);
      results += `Question ${response.questionNumber}: ${question?.text}\n`;
      results += `Response: ${responseText} (${response.numericScore} points)\n\n`;
    });

    // Total score and interpretation
    results += `Total Score: ${this.currentAssessment.totalScore}/6\n`;
    results += `Severity: ${this.currentAssessment.severity === Phq2Severity.Positive ? 'Positive Screen' : 'Minimal Risk'}\n\n`;
    results += `Interpretation: ${this.getInterpretation()}\n\n`;
    results += `Recommendations:\n${this.getRecommendations()}`;

    return results;
  }

  // Helper method for the coordinator to get next response prompt
  getNextResponsePrompt(): string {
    if (!this.isActive) {
      return "Assessment is not active.";
    }

    if (this.currentAssessment?.isCompleted) {
      return `Assessment completed. ${this.getDetailedResults()}`;
    }

    return this.getFormattedCurrentQuestion();
  }

  // Get current progress
  getProgress(): { current: number; total: number; percentage: number } {
    const current = this.currentAssessment?.responses.length || 0;
    const total = 2;
    const percentage = Math.round((current / total) * 100);
    
    return { current, total, percentage };
  }

  getCurrentAssessment(): Phq2Assessment | null {
    return this.currentAssessment;
  }

  isAssessmentActive(): boolean {
    return this.isActive;
  }

  isAssessmentCompleted(): boolean {
    return this.currentAssessment?.isCompleted || false;
  }

  // Reset for new assessment
  reset(): void {
    this.currentAssessment = null;
    this.currentQuestionNumber = 1;
    this.isActive = false;
    this.sessionId = '';
    this.userId = '';
    
    this.dispatchEvent(new CustomEvent('agent_reset'));
  }

  // Export assessment data for backend integration
  exportAssessmentData(): any {
    if (!this.currentAssessment) return null;

    return {
      userId: this.currentAssessment.userId,
      sessionId: this.currentAssessment.sessionId,
      startDate: this.currentAssessment.startDate,
      completedDate: this.currentAssessment.completedDate,
      responses: this.currentAssessment.responses.map(response => ({
        questionNumber: response.questionNumber,
        score: response.score,
        responseDate: response.responseDate,
        numericScore: response.numericScore
      })),
      totalScore: this.currentAssessment.totalScore,
      severity: this.currentAssessment.severity,
      isCompleted: this.currentAssessment.isCompleted
    };
  }

  // Clinical information for reference
  getClinicalInformation(): string {
    return `PHQ-2 (Patient Health Questionnaire-2) Clinical Information:

Purpose: First-step depression screening tool
Questions: 2 items (first two questions from PHQ-9)
Scoring: 0-6 total points (each question scored 0-3)
Optimal Cutpoint: Score ≥3 indicates positive screen

Clinical Usage:
• Rapid depression screening in primary care
• Initial assessment before comprehensive evaluation
• Population-level screening programs

Next Steps for Positive Screens (≥3):
• Administer PHQ-9 for comprehensive assessment
• Clinical interview by mental health professional
• Further diagnostic evaluation as indicated

Operating Characteristics (at cutpoint ≥3):
• Sensitivity: 82.9% for Major Depressive Disorder
• Specificity: 90.0% for Major Depressive Disorder
• Positive Predictive Value: 38.4% (varies with population prevalence)

Reference: Kroenke K, et al. Medical Care. 2003;41:1284-92.`;
  }
}