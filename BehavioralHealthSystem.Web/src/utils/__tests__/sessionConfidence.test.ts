import { describe, expect, it } from 'vitest';
import type { SessionData } from '../../types';
import { getSessionConfidence } from '../sessionConfidence';

const sessionWith = (values: Partial<SessionData>): SessionData => values as SessionData;

describe('getSessionConfidence', () => {
  it('prefers multi-condition confidence over older assessment values', () => {
    const session = sessionWith({
      multiConditionAssessment: { confidenceLevel: 0.91 } as SessionData['multiConditionAssessment'],
      extendedRiskAssessment: { confidenceLevel: 0.82 } as SessionData['extendedRiskAssessment'],
      riskAssessment: { confidenceLevel: 0.73 } as SessionData['riskAssessment'],
      analysisResults: { confidence: 0.64 } as SessionData['analysisResults'],
    });

    expect(getSessionConfidence(session)).toBe(0.91);
  });

  it('falls back through standard assessment and legacy analysis confidence', () => {
    expect(getSessionConfidence(sessionWith({
      riskAssessment: { confidenceLevel: 0.76 } as SessionData['riskAssessment'],
      analysisResults: { confidence: 0.58 } as SessionData['analysisResults'],
    }))).toBe(0.76);

    expect(getSessionConfidence(sessionWith({
      analysisResults: { confidence: 0.58 } as SessionData['analysisResults'],
    }))).toBe(0.58);
  });

  it('returns null when confidence is missing or outside the documented scale', () => {
    expect(getSessionConfidence(sessionWith({}))).toBeNull();
    expect(getSessionConfidence(sessionWith({
      analysisResults: { confidence: Number.NaN } as SessionData['analysisResults'],
    }))).toBeNull();
    expect(getSessionConfidence(sessionWith({
      analysisResults: { confidence: 75 } as SessionData['analysisResults'],
    }))).toBeNull();
  });

  it('preserves an explicitly measured zero confidence', () => {
    expect(getSessionConfidence(sessionWith({
      riskAssessment: { confidenceLevel: 0 } as SessionData['riskAssessment'],
    }))).toBe(0);
  });
});
