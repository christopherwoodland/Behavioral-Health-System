/**
 * ExtendedRiskAssessmentDisplay Component
 * Displays comprehensive extended risk assessment with schizophrenia evaluation
 * Includes DSM-5 Criterion A/B/C visualization, symptom severity charts, and functional impairment analysis
 */

import React, { useState } from 'react';
import {
  ExtendedRiskAssessment,
  SymptomPresence,
  getSeverityColor,
  getLikelihoodColor,
  getImpairmentColor,
  getRiskLevelColor,
  formatProcessingTime
} from '../types/extendedRiskAssessment';

interface ExtendedRiskAssessmentDisplayProps {
  assessment: ExtendedRiskAssessment;
  className?: string;
}

export const ExtendedRiskAssessmentDisplay: React.FC<ExtendedRiskAssessmentDisplayProps> = ({
  assessment,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'schizophrenia' | 'details'>('overview');

  const schizo = assessment.schizophreniaAssessment;
  const criterionA = schizo.criterionAEvaluation;

  // Render symptom card
  const renderSymptomCard = (title: string, symptom: SymptomPresence, description: string) => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-center gap-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
        <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getSeverityColor(symptom.severity)}`}>
          Severity: {symptom.severity}/4
        </span>
      </div>
      
      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{description}</p>
      
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600 dark:text-gray-400">Presence Level:</span>
        <span className={`font-semibold ${getSeverityColor(symptom.severity)}`}>
          {symptom.presenceLevel}
        </span>
      </div>

      {symptom.evidence && symptom.evidence.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Evidence:</span>
          <ul className="space-y-1 pl-5 list-disc">
            {symptom.evidence.map((evidence, idx) => (
              <li key={idx} className="text-xs text-gray-600 dark:text-gray-400">{evidence}</li>
            ))}
          </ul>
        </div>
      )}

      {symptom.notes && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-3 border-yellow-400 p-3 rounded space-y-2">
          <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Clinical Notes:</span>
          <p className="text-xs text-yellow-700 dark:text-yellow-300">{symptom.notes}</p>
        </div>
      )}

      {/* Severity bar */}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ${
            symptom.severity === 0 ? 'w-0 bg-gray-400' :
            symptom.severity === 1 ? 'w-1/4 bg-blue-500' :
            symptom.severity === 2 ? 'w-2/4 bg-yellow-500' :
            symptom.severity === 3 ? 'w-3/4 bg-orange-500' :
            'w-full bg-red-500'
          }`}
        />
      </div>
    </div>
  );

  return (
    <div className={`space-y-6 p-6 ${className}`}>
      <div className="space-y-4 pb-4 border-b-2 border-gray-200 dark:border-gray-700">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Extended Risk Assessment</h2>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Comprehensive Psychiatric Evaluation with DSM-5 Schizophrenia Assessment
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{assessment.modelVersion}</span>
          <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {formatProcessingTime(assessment.processingTimeMs)}
          </span>
          <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {new Date(assessment.generatedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1">
          <button
            className={`px-6 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === 'overview' 
                ? 'text-blue-600 border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`px-6 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === 'schizophrenia' 
                ? 'text-blue-600 border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            onClick={() => setActiveTab('schizophrenia')}
          >
            Schizophrenia Evaluation
          </button>
          <button
            className={`px-6 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
              activeTab === 'details' 
                ? 'text-blue-600 border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            onClick={() => setActiveTab('details')}
          >
            Clinical Details
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={`flex flex-col gap-2 p-6 rounded-lg border-2 ${getRiskLevelColor(assessment.overallRiskLevel)}`}>
                <span className="text-sm font-medium uppercase tracking-wide">Overall Risk Level</span>
                <span className="text-3xl font-bold">{assessment.overallRiskLevel}</span>
                <span className="text-sm opacity-80">Score: {assessment.riskScore}/10</span>
              </div>

              <div className={`flex flex-col gap-2 p-6 rounded-lg border-2 ${getLikelihoodColor(schizo.overallLikelihood)}`}>
                <span className="text-sm font-medium uppercase tracking-wide">Schizophrenia Likelihood</span>
                <span className="text-3xl font-bold">{schizo.overallLikelihood}</span>
                <span className="text-sm opacity-80">Confidence: {Math.round(schizo.confidenceScore * 100)}%</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clinical Summary</h3>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{assessment.summary}</p>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Schizophrenia Assessment Summary</h3>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{schizo.assessmentSummary}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">Criterion A Met</span>
                <span className={`text-2xl font-bold ${criterionA.criterionAMet ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {criterionA.criterionAMet ? 'Yes' : 'No'}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {criterionA.totalSymptomsPresent}/5 symptoms present
                </span>
              </div>

              <div className="flex flex-col gap-1 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">Criterion B Met</span>
                <span className={`text-2xl font-bold ${schizo.functionalImpairment.criterionBMet ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {schizo.functionalImpairment.criterionBMet ? 'Yes' : 'No'}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {schizo.functionalImpairment.impairmentLevel} impairment
                </span>
              </div>

              <div className="flex flex-col gap-1 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">Risk Factors</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {schizo.riskFactorsIdentified.length}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">identified</span>
              </div>

              <div className="flex flex-col gap-1 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">Recommended Actions</span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  {schizo.recommendedActions.length}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">interventions</span>
              </div>
            </div>
          </div>
        )}

        {/* Schizophrenia Evaluation Tab */}
        {activeTab === 'schizophrenia' && (
          <div className="space-y-8">
            
            {/* DSM-5 Criterion A - Characteristic Symptoms */}
            <div className="space-y-4 p-6 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  DSM-5 Criterion A: Characteristic Symptoms
                </h3>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                  criterionA.criterionAMet 
                    ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' 
                    : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                }`}>
                  {criterionA.criterionAMet ? 'Criteria Met' : 'Criteria Not Met'}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                At least TWO symptoms must be present for significant time during 1-month period. 
                At least ONE must be delusions, hallucinations, or disorganized speech.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {renderSymptomCard(
                  '1. Delusions',
                  criterionA.delusions,
                  'False beliefs not amenable to change despite conflicting evidence'
                )}
                {renderSymptomCard(
                  '2. Hallucinations',
                  criterionA.hallucinations,
                  'Perception-like experiences without external stimulus (auditory most common)'
                )}
                {renderSymptomCard(
                  '3. Disorganized Speech',
                  criterionA.disorganizedSpeech,
                  'Frequent derailment, incoherence, or tangentiality'
                )}
                {renderSymptomCard(
                  '4. Disorganized/Catatonic Behavior',
                  criterionA.disorganizedBehavior,
                  'Childlike silliness to unpredictable agitation'
                )}
                {renderSymptomCard(
                  '5. Negative Symptoms',
                  criterionA.negativeSymptoms,
                  'Diminished emotional expression, avolition, alogia, anhedonia, asociality'
                )}
              </div>
            </div>

            {/* DSM-5 Criterion B - Functional Impairment */}
            <div className="space-y-4 p-6 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  DSM-5 Criterion B: Functional Impairment
                </h3>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                  schizo.functionalImpairment.criterionBMet 
                    ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' 
                    : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                }`}>
                  {schizo.functionalImpairment.criterionBMet ? 'Criteria Met' : 'Criteria Not Met'}
                </span>
              </div>

              <div className={`flex items-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${getImpairmentColor(schizo.functionalImpairment.impairmentLevel)}`}>
                <span className="text-sm font-medium">Overall Impairment Level:</span>
                <span className="text-lg font-bold">{schizo.functionalImpairment.impairmentLevel}</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-2 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Work/Occupational Functioning</h4>
                  <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">{schizo.functionalImpairment.workFunctioning}</p>
                </div>

                <div className="space-y-2 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Interpersonal Relations</h4>
                  <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">{schizo.functionalImpairment.interpersonalRelations}</p>
                </div>

                <div className="space-y-2 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Self-Care</h4>
                  <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">{schizo.functionalImpairment.selfCare}</p>
                </div>
              </div>
            </div>

            {/* DSM-5 Criterion C - Duration */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">DSM-5 Criterion C: Duration</h3>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{schizo.durationAssessment}</p>
            </div>

            {/* Differential Diagnosis */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Differential Diagnosis Considerations</h3>
              <ul className="space-y-2 pl-6 list-decimal">
                {schizo.differentialDiagnosis.map((diagnosis, idx) => (
                  <li key={idx} className="text-sm text-gray-600 dark:text-gray-400">{diagnosis}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Clinical Details Tab */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            
            {/* Key Risk Factors */}
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-3 border-blue-500">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Key Risk Factors</h3>
              <ul className="space-y-2 pl-6 list-disc">
                {assessment.keyFactors.map((factor, idx) => (
                  <li key={idx} className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{factor}</li>
                ))}
              </ul>
            </div>

            {/* Schizophrenia-Specific Risk Factors */}
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-3 border-blue-500">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Schizophrenia-Related Risk Factors</h3>
              <ul className="space-y-2 pl-6 list-square">
                {schizo.riskFactorsIdentified.map((factor, idx) => (
                  <li key={idx} className="text-sm leading-relaxed text-yellow-700 dark:text-yellow-400">{factor}</li>
                ))}
              </ul>
            </div>

            {/* Immediate Actions */}
            {assessment.immediateActions.length > 0 && (
              <div className="space-y-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-3 border-red-500">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Immediate Actions Required</h3>
                <ul className="space-y-2 pl-6 list-circle">
                  {assessment.immediateActions.map((action, idx) => (
                    <li key={idx} className="text-sm leading-relaxed text-red-700 dark:text-red-400 font-medium">{action}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Clinical Recommendations */}
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-3 border-blue-500">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clinical Recommendations</h3>
              <ul className="space-y-2 pl-6 list-disc">
                {assessment.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{rec}</li>
                ))}
              </ul>
            </div>

            {/* Schizophrenia-Specific Recommended Actions */}
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-3 border-blue-500">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Schizophrenia Evaluation: Recommended Actions</h3>
              <ul className="space-y-2 pl-6 list-disc">
                {schizo.recommendedActions.map((action, idx) => (
                  <li key={idx} className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{action}</li>
                ))}
              </ul>
            </div>

            {/* Follow-up Recommendations */}
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-3 border-blue-500">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Follow-Up Recommendations</h3>
              <ul className="space-y-2 pl-6 list-disc">
                {assessment.followUpRecommendations.map((followup, idx) => (
                  <li key={idx} className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{followup}</li>
                ))}
              </ul>
            </div>

            {/* Clinical Notes */}
            {schizo.clinicalNotes.length > 0 && (
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-3 border-blue-500">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clinical Notes</h3>
                <ul className="space-y-2 pl-6 list-disc">
                  {schizo.clinicalNotes.map((note, idx) => (
                    <li key={idx} className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Confidence Levels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Overall Assessment Confidence</span>
                <div className="w-full h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                    style={{ width: `${assessment.confidenceLevel * 100}%` }}
                  />
                </div>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {Math.round(assessment.confidenceLevel * 100)}%
                </span>
              </div>

              <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Schizophrenia Assessment Confidence</span>
                <div className="w-full h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                    style={{ width: `${schizo.confidenceScore * 100}%` }}
                  />
                </div>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {Math.round(schizo.confidenceScore * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clinical Disclaimer */}
      <div className="p-4 text-xs leading-relaxed text-yellow-800 dark:text-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-l-4 border-yellow-400">
        <strong className="font-semibold text-yellow-900 dark:text-yellow-100">Clinical Disclaimer:</strong> This assessment is generated by AI based on limited data and should not replace 
        comprehensive clinical evaluation by a qualified mental health professional. Formal diagnosis of schizophrenia requires 
        extensive clinical interview, observation over time, medical evaluation to rule out other conditions, and consideration 
        of cultural context. Duration criteria (6 months) cannot be fully assessed from single session data.
      </div>
    </div>
  );
};

export default ExtendedRiskAssessmentDisplay;
