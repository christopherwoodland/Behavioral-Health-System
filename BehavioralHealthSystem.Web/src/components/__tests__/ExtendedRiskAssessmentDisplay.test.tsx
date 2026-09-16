import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ExtendedRiskAssessmentDisplay } from '../ExtendedRiskAssessmentDisplay';
import {
  ExtendedRiskAssessment,
  MultiConditionExtendedRiskAssessment,
  SymptomPresence,
} from '../../types/extendedRiskAssessment';

const symptom: SymptomPresence = {
  presenceLevel: 'Not Present',
  severity: 0,
  evidence: [],
};

const baseAssessment = {
  overallRiskLevel: 'Low' as const,
  riskScore: 1,
  evidenceSufficiency: 'Sufficient' as const,
  summary: 'Assessment summary',
  keyFactors: [],
  recommendations: [],
  immediateActions: [],
  followUpRecommendations: [],
  confidenceLevel: 0.8,
  isExtended: true,
  generatedAt: '2026-09-15T00:00:00Z',
  modelVersion: 'test-model',
  processingTimeMs: 100,
};

describe('ExtendedRiskAssessmentDisplay', () => {
  it('renders a multi-condition assessment with missing functional impairment', async () => {
    const assessment: MultiConditionExtendedRiskAssessment = {
      ...baseAssessment,
      isMultiCondition: true,
      evaluatedConditions: ['major-depressive-disorder'],
      overallAssessmentSummary: 'Overall summary',
      highestRiskCondition: null,
      combinedRecommendedActions: [],
      crossConditionDifferentialDiagnosis: [],
      conditionAssessments: [{
        conditionId: 'major-depressive-disorder',
        conditionName: 'Major Depressive Disorder',
        conditionCode: '296.20',
        category: 'Depressive Disorders',
        overallLikelihood: 'Low',
        confidenceScore: 0.7,
        conditionRiskScore: 2,
        assessmentSummary: 'Condition summary',
        criteriaEvaluations: [],
        riskFactorsIdentified: [],
        recommendedActions: [],
        clinicalNotes: [],
        differentialDiagnosis: [],
        durationAssessment: 'Insufficient information',
        functionalImpairment: null,
      }],
    };

    render(<ExtendedRiskAssessmentDisplay assessment={assessment} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Disorder Evaluations' }));

    expect(screen.getByText('Functional impairment was not available in this assessment.')).toBeInTheDocument();
  });

  it('renders a legacy assessment with missing functional impairment', async () => {
    const assessment: ExtendedRiskAssessment = {
      ...baseAssessment,
      schizophreniaAssessment: {
        overallLikelihood: 'Low',
        confidenceScore: 0.7,
        assessmentSummary: 'Schizophrenia summary',
        criterionAEvaluation: {
          delusions: symptom,
          hallucinations: symptom,
          disorganizedSpeech: symptom,
          disorganizedBehavior: symptom,
          negativeSymptoms: symptom,
          totalSymptomsPresent: 0,
          criterionAMet: false,
        },
        functionalImpairment: null,
        durationAssessment: 'Insufficient information',
        differentialDiagnosis: [],
        riskFactorsIdentified: [],
        recommendedActions: [],
        clinicalNotes: [],
      },
    };

    render(<ExtendedRiskAssessmentDisplay assessment={assessment} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Schizophrenia Evaluation' }));

    expect(screen.getByText('Functional impairment was not available in this assessment.')).toBeInTheDocument();
  });
});
