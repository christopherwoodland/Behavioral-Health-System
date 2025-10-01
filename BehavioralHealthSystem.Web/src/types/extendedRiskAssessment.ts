/**
 * TypeScript type definitions for Extended Risk Assessment with Schizophrenia Evaluation
 * Maps to C# models in BehavioralHealthSystem.Helpers/Models/ExtendedRiskAssessment.cs
 */

export type PresenceLevel = 'Not Present' | 'Possible' | 'Likely' | 'Present' | 'Clearly Present';
export type SchizophreniaLikelihood = 'None' | 'Minimal' | 'Low' | 'Moderate' | 'High' | 'Very High';
export type ImpairmentLevel = 'None' | 'Mild' | 'Moderate' | 'Marked' | 'Severe';
export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface SymptomPresence {
  presenceLevel: PresenceLevel;
  severity: number; // 0-4 scale
  evidence: string[];
  notes?: string;
}

export interface CriterionAEvaluation {
  delusions: SymptomPresence;
  hallucinations: SymptomPresence;
  disorganizedSpeech: SymptomPresence;
  disorganizedBehavior: SymptomPresence;
  negativeSymptoms: SymptomPresence;
  totalSymptomsPresent: number; // 0-5
  criterionAMet: boolean;
}

export interface FunctionalImpairmentAssessment {
  impairmentLevel: ImpairmentLevel;
  workFunctioning: string;
  interpersonalRelations: string;
  selfCare: string;
  criterionBMet: boolean;
}

export interface SchizophreniaAssessment {
  overallLikelihood: SchizophreniaLikelihood;
  confidenceScore: number; // 0.0-1.0
  assessmentSummary: string;
  criterionAEvaluation: CriterionAEvaluation;
  functionalImpairment: FunctionalImpairmentAssessment;
  durationAssessment: string;
  differentialDiagnosis: string[];
  riskFactorsIdentified: string[];
  recommendedActions: string[];
  clinicalNotes: string[];
}

export interface ExtendedRiskAssessment {
  // Base risk assessment fields
  overallRiskLevel: RiskLevel;
  riskScore: number; // 1-10
  summary: string;
  keyFactors: string[];
  recommendations: string[];
  immediateActions: string[];
  followUpRecommendations: string[];
  confidenceLevel: number; // 0.0-1.0
  
  // Extended assessment specific fields
  isExtended: boolean;
  generatedAt: string; // ISO 8601 datetime
  modelVersion: string;
  processingTimeMs: number;
  
  // Schizophrenia evaluation
  schizophreniaAssessment: SchizophreniaAssessment;
}

export interface ExtendedRiskAssessmentResponse {
  success: boolean;
  message?: string;
  extendedRiskAssessment?: ExtendedRiskAssessment;
  processingTimeSeconds?: number;
  cached?: boolean;
  error?: string;
}

export interface ExtendedRiskAssessmentStatusResponse {
  success: boolean;
  sessionId: string;
  hasExtendedAssessment: boolean;
  hasStandardAssessment: boolean;
  hasTranscription: boolean;
  hasPrediction: boolean;
  generatedAt?: string;
  processingTimeMs?: number;
  overallLikelihood?: SchizophreniaLikelihood;
  canGenerate: boolean;
  message?: string;
  error?: string;
}

// Helper functions for UI display
export const getSeverityLabel = (severity: number): string => {
  if (severity === 0) return 'Not Present';
  if (severity === 1) return 'Minimal';
  if (severity === 2) return 'Mild';
  if (severity === 3) return 'Moderate';
  if (severity === 4) return 'Severe';
  return 'Unknown';
};

export const getSeverityColor = (severity: number): string => {
  if (severity === 0) return 'text-gray-400';
  if (severity === 1) return 'text-blue-500';
  if (severity === 2) return 'text-yellow-500';
  if (severity === 3) return 'text-orange-500';
  if (severity === 4) return 'text-red-600';
  return 'text-gray-500';
};

export const getLikelihoodColor = (likelihood: SchizophreniaLikelihood): string => {
  switch (likelihood) {
    case 'None':
    case 'Minimal':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'Low':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'Moderate':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'High':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'Very High':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const getImpairmentColor = (level: ImpairmentLevel): string => {
  switch (level) {
    case 'None':
      return 'text-green-600';
    case 'Mild':
      return 'text-blue-600';
    case 'Moderate':
      return 'text-yellow-600';
    case 'Marked':
      return 'text-orange-600';
    case 'Severe':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

export const getRiskLevelColor = (level: RiskLevel): string => {
  switch (level) {
    case 'Low':
      return 'text-green-600 bg-green-50';
    case 'Moderate':
      return 'text-yellow-600 bg-yellow-50';
    case 'High':
      return 'text-orange-600 bg-orange-50';
    case 'Critical':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

export const formatProcessingTime = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};
