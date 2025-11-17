import { describe, it, expect, beforeEach, vi } from 'vitest';
import { phqAssessmentService } from '../phqAssessmentService';

describe('PHQ Assessment Service', () => {
  beforeEach(() => {
    // Clear any existing assessment
    phqAssessmentService.clearCurrentAssessment();
  });

  describe('Assessment Initialization', () => {
    it('should initialize a new PHQ-2 assessment', () => {
      const userId = 'test-user-123';
      const assessment = phqAssessmentService.startPhq2Assessment(userId);

      expect(assessment).toBeDefined();
      expect(assessment.userId).toBe(userId);
      expect(assessment.assessmentType).toBe('PHQ-2');
      expect(assessment.isCompleted).toBe(false);
      expect(assessment.questions).toHaveLength(2);
      expect(assessment.assessmentId).toBeTruthy();
    });

    it('should initialize a new PHQ-9 assessment', () => {
      const userId = 'test-user-456';
      const assessment = phqAssessmentService.startPhq9Assessment(userId);

      expect(assessment).toBeDefined();
      expect(assessment.userId).toBe(userId);
      expect(assessment.assessmentType).toBe('PHQ-9');
      expect(assessment.isCompleted).toBe(false);
      expect(assessment.questions).toHaveLength(9);
      expect(assessment.assessmentId).toBeTruthy();
    });

    it('should include metadata in new assessment', () => {
      const userId = 'test-user-789';
      const sessionId = 'session-123';
      const assessment = phqAssessmentService.startPhq2Assessment(userId, sessionId);

      expect(assessment.metadata).toBeDefined();
      expect(assessment.metadata.userAgent).toBeTruthy();
      expect(assessment.metadata.version).toBe('1.0');
      expect(assessment.metadata.sessionId).toBe(sessionId);
    });
  });

  describe('Question Management', () => {
    it('should record answer for PHQ-2 question', () => {
      const userId = 'test-user';
      phqAssessmentService.startPhq2Assessment(userId);

      const result = phqAssessmentService.recordAnswer(1, 2);

      expect(result).toBe(true);
      const assessment = phqAssessmentService.getCurrentAssessment();
      expect(assessment?.questions[0].answer).toBe(2);
      expect(assessment?.questions[0].skipped).toBe(false);
    });

    it('should handle skipped questions', () => {
      const userId = 'test-user';
      phqAssessmentService.startPhq2Assessment(userId);

      const result = phqAssessmentService.skipQuestion(1);

      expect(result).toBe(true);
      const assessment = phqAssessmentService.getCurrentAssessment();
      expect(assessment?.questions[0].skipped).toBe(true);
      expect(assessment?.questions[0].answer).toBeUndefined();
    });

    it('should reject invalid question numbers', () => {
      const userId = 'test-user';
      phqAssessmentService.startPhq2Assessment(userId);

      const result = phqAssessmentService.recordAnswer(5, 2);

      expect(result).toBe(false);
    });

    it('should reject invalid answer values', () => {
      const userId = 'test-user';
      phqAssessmentService.startPhq2Assessment(userId);

      const result = phqAssessmentService.recordAnswer(1, 5);

      expect(result).toBe(false);
    });

    it('should increment attempts on repeated answers', () => {
      const userId = 'test-user';
      phqAssessmentService.startPhq2Assessment(userId);

      phqAssessmentService.recordAnswer(1, 1);
      phqAssessmentService.recordAnswer(1, 2);

      const assessment = phqAssessmentService.getCurrentAssessment();
      expect(assessment?.questions[0].attempts).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Assessment Completion', () => {
    it('should calculate PHQ-2 score correctly', () => {
      const userId = 'test-user';
      phqAssessmentService.startPhq2Assessment(userId);

      phqAssessmentService.recordAnswer(1, 2);
      phqAssessmentService.recordAnswer(2, 3);

      const result = phqAssessmentService.completeAssessment();

      expect(result.totalScore).toBe(5);
      expect(result.isCompleted).toBe(true);
    });

    it('should calculate PHQ-9 score correctly', () => {
      const userId = 'test-user';
      phqAssessmentService.startPhq9Assessment(userId);

      for (let i = 1; i <= 9; i++) {
        phqAssessmentService.recordAnswer(i, 2);
      }

      const result = phqAssessmentService.completeAssessment();

      expect(result.totalScore).toBe(18);
      expect(result.isCompleted).toBe(true);
    });

    it('should provide severity interpretation for PHQ-9', () => {
      const userId = 'test-user';
      phqAssessmentService.startPhq9Assessment(userId);

      // Moderate depression range (10-14)
      for (let i = 1; i <= 9; i++) {
        phqAssessmentService.recordAnswer(i, i <= 5 ? 2 : 0);
      }

      const result = phqAssessmentService.completeAssessment();

      expect(result.severity).toBeDefined();
      expect(result.interpretation).toBeDefined();
    });

    it('should handle incomplete assessments', () => {
      const userId = 'test-user';
      phqAssessmentService.startPhq2Assessment(userId);

      phqAssessmentService.recordAnswer(1, 1);
      // Question 2 not answered

      expect(() => phqAssessmentService.completeAssessment()).toThrow();
    });
  });

  describe('Assessment Retrieval', () => {
    it('should return current assessment', () => {
      const userId = 'test-user';
      const assessment = phqAssessmentService.startPhq2Assessment(userId);

      const retrieved = phqAssessmentService.getCurrentAssessment();

      expect(retrieved).toEqual(assessment);
    });

    it('should return null when no assessment exists', () => {
      const retrieved = phqAssessmentService.getCurrentAssessment();

      expect(retrieved).toBeNull();
    });

    it('should clear current assessment', () => {
      const userId = 'test-user';
      phqAssessmentService.startPhq2Assessment(userId);

      phqAssessmentService.clearCurrentAssessment();
      const retrieved = phqAssessmentService.getCurrentAssessment();

      expect(retrieved).toBeNull();
    });
  });

  describe('PHQ Question Text', () => {
    it('should provide PHQ-2 questions', () => {
      const questions = phqAssessmentService.getPhq2Questions();

      expect(questions).toHaveLength(2);
      expect(questions[0].questionNumber).toBe(1);
      expect(questions[0].questionText).toContain('little interest or pleasure');
      expect(questions[1].questionText).toContain('feeling down, depressed');
    });

    it('should provide PHQ-9 questions', () => {
      const questions = phqAssessmentService.getPhq9Questions();

      expect(questions).toHaveLength(9);
      expect(questions[0].questionNumber).toBe(1);
      expect(questions[8].questionNumber).toBe(9);
    });
  });

  describe('Score Interpretation', () => {
    it('should interpret minimal PHQ-9 depression', () => {
      const userId = 'test-user';
      phqAssessmentService.startPhq9Assessment(userId);

      for (let i = 1; i <= 9; i++) {
        phqAssessmentService.recordAnswer(i, 0);
      }

      const result = phqAssessmentService.completeAssessment();

      expect(result.totalScore).toBe(0);
      expect(result.severity).toContain('Minimal');
    });

    it('should interpret severe PHQ-9 depression', () => {
      const userId = 'test-user';
      phqAssessmentService.startPhq9Assessment(userId);

      for (let i = 1; i <= 9; i++) {
        phqAssessmentService.recordAnswer(i, 3);
      }

      const result = phqAssessmentService.completeAssessment();

      expect(result.totalScore).toBe(27);
      expect(result.severity).toContain('Severe');
    });
  });
});
