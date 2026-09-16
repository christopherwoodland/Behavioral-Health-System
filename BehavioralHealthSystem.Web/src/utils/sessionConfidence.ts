import type { SessionData } from '../types';

export const getSessionConfidence = (session: SessionData): number | null => {
  const confidence = session.multiConditionAssessment?.confidenceLevel
    ?? session.extendedRiskAssessment?.confidenceLevel
    ?? session.riskAssessment?.confidenceLevel
    ?? session.analysisResults?.confidence;

  return typeof confidence === 'number' && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
    ? confidence
    : null;
};
