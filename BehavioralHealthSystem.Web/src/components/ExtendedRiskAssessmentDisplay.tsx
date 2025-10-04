/**
 * ExtendedRiskAssessmentDisplay Component
 * Displays comprehensive extended risk assessment with schizophrenia evaluation
 * Includes DSM-5 Criterion A/B/C visualization, symptom severity charts, and functional impairment analysis
 */

import React, { useState } from 'react';
import {
  ExtendedRiskAssessment,
  MultiConditionExtendedRiskAssessment,
  SymptomPresence,
  getSeverityColor,
  getLikelihoodColor,
  getImpairmentColor,
  getRiskLevelColor,
  formatProcessingTime,
  getConditionLikelihoodColor,
  getCriterionMetBadge
} from '../types/extendedRiskAssessment';

interface ExtendedRiskAssessmentDisplayProps {
  assessment: ExtendedRiskAssessment | MultiConditionExtendedRiskAssessment;
  className?: string;
}

export const ExtendedRiskAssessmentDisplay: React.FC<ExtendedRiskAssessmentDisplayProps> = ({
  assessment,
  className = ''
}) => {
  // Type detection: Check if this is a multi-condition assessment
  const isMultiCondition = 'conditionAssessments' in assessment && 
                           Array.isArray(assessment.conditionAssessments) && 
                           assessment.conditionAssessments.length > 0;
  
  // For backwards compatibility with legacy schizophrenia format
  const schizo = !isMultiCondition ? (assessment as ExtendedRiskAssessment).schizophreniaAssessment : null;
  const criterionA = schizo?.criterionAEvaluation;

  const [activeTab, setActiveTab] = useState<'overview' | 'disorders' | 'details'>('overview');

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
              activeTab === 'disorders' 
                ? 'text-blue-600 border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            onClick={() => setActiveTab('disorders')}
          >
            {isMultiCondition ? 'Disorder Evaluations' : 'Schizophrenia Evaluation'}
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

              {/* Show disorder likelihood cards based on assessment type */}
              {!isMultiCondition && schizo ? (
                <div className={`flex flex-col gap-2 p-6 rounded-lg border-2 ${getLikelihoodColor(schizo.overallLikelihood)}`}>
                  <span className="text-sm font-medium uppercase tracking-wide">Schizophrenia Likelihood</span>
                  <span className="text-3xl font-bold">{schizo.overallLikelihood}</span>
                  <span className="text-sm opacity-80">Confidence: {Math.round(schizo.confidenceScore * 100)}%</span>
                </div>
              ) : isMultiCondition ? (
                <div className="flex flex-col gap-2 p-6 rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
                  <span className="text-sm font-medium uppercase tracking-wide">Conditions Evaluated</span>
                  <span className="text-3xl font-bold">{(assessment as MultiConditionExtendedRiskAssessment).conditionAssessments.length}</span>
                  <span className="text-sm opacity-80">DSM-5 disorders analyzed</span>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clinical Summary</h3>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{assessment.summary}</p>
            </div>

            {/* Condition-specific summaries */}
            {!isMultiCondition && schizo && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Schizophrenia Assessment Summary</h3>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{schizo.assessmentSummary}</p>
              </div>
            )}

            {isMultiCondition && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Disorder Assessment Summaries</h3>
                {(assessment as MultiConditionExtendedRiskAssessment).conditionAssessments.map((condition, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">{condition.conditionName}</h4>
                        {condition.conditionCode && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{condition.conditionCode}</span>
                        )}
                      </div>
                      <div className={`px-3 py-1 text-xs font-semibold rounded-full ${getConditionLikelihoodColor(condition.overallLikelihood)}`}>
                        {condition.overallLikelihood}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{condition.assessmentSummary}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Quick stats - different for legacy vs multi-condition */}
            {!isMultiCondition && schizo && criterionA ? (
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
            ) : isMultiCondition && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(assessment as MultiConditionExtendedRiskAssessment).conditionAssessments.map((condition, idx) => {
                  const totalCriteria = condition.criteriaEvaluations.length;
                  const metCriteria = condition.criteriaEvaluations.filter(c => c.isMet).length;
                  
                  return (
                    <div key={idx} className="flex flex-col gap-1 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                      <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">{condition.conditionName}</span>
                      <span className={`text-2xl font-bold ${metCriteria >= totalCriteria / 2 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {metCriteria}/{totalCriteria}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">criteria met</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Disorders Evaluation Tab */}
        {activeTab === 'disorders' && (
          <div className="space-y-8">
            
            {/* Legacy schizophrenia format */}
            {!isMultiCondition && schizo && criterionA && (
              <>
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
              </>
            )}

            {/* Multi-condition format */}
            {isMultiCondition && (
              (assessment as MultiConditionExtendedRiskAssessment).conditionAssessments.map((condition, condIdx) => (
                <div key={condIdx} className="space-y-6 p-6 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                  {/* Condition Header */}
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{condition.conditionName}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {condition.conditionCode} • {condition.category}
                      </p>
                    </div>
                    <div className={`px-4 py-2 text-sm font-semibold rounded-lg ${getConditionLikelihoodColor(condition.overallLikelihood)}`}>
                      {condition.overallLikelihood}
                    </div>
                  </div>

                  {/* Assessment Summary */}
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400 italic">
                    {condition.assessmentSummary}
                  </p>

                  {/* DSM-5 Criteria Evaluations */}
                  {condition.criteriaEvaluations.map((criterion, critIdx) => (
                    <div key={critIdx} className="space-y-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white">{criterion.criterionTitle}</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{criterion.criterionDescription}</p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getCriterionMetBadge(criterion.isMet)}`}>
                          {criterion.isMet ? 'Met' : 'Not Met'}
                        </span>
                      </div>

                      {/* Sub-criteria */}
                      {criterion.subCriteriaEvaluations.length > 0 && (
                        <div className="space-y-2 pl-4 border-l-2 border-gray-300 dark:border-gray-600">
                          {criterion.subCriteriaEvaluations.map((sub, subIdx) => (
                            <div key={subIdx} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{sub.subCriterionName}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{sub.description}</p>
                                </div>
                                <span className={`text-xs font-semibold ${sub.isPresent ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                  {sub.isPresent ? '✓ Present' : '✗ Absent'}
                                </span>
                              </div>
                              
                              {sub.severity !== undefined && (
                                <div className="mt-2">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-600 dark:text-gray-400">Severity</span>
                                    <span className="font-medium">{sub.severity}/4</span>
                                  </div>
                                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full ${getSeverityColor(sub.severity)}`}
                                      style={{ width: `${(sub.severity / 4) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                              
                              {sub.evidence && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 italic">
                                  Evidence: {sub.evidence}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Criterion Evidence */}
                      {criterion.evidence.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Evidence:</span>
                          <ul className="pl-5 list-disc space-y-1">
                            {criterion.evidence.map((ev, evIdx) => (
                              <li key={evIdx} className="text-xs text-gray-600 dark:text-gray-400">{ev}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Clinical Notes */}
                      {criterion.notes && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                          Note: {criterion.notes}
                        </p>
                      )}

                      {/* Confidence */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400">Confidence:</span>
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-green-500"
                            style={{ width: `${criterion.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          {Math.round(criterion.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Functional Impairment */}
                  <div className="space-y-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white">Functional Impairment</h4>
                    <div className={`flex items-center gap-2 p-3 rounded-lg ${getImpairmentColor(condition.functionalImpairment.impairmentLevel)}`}>
                      <span className="text-sm font-medium">Overall Level:</span>
                      <span className="text-lg font-bold">{condition.functionalImpairment.impairmentLevel}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">Work: </span>
                        <span className="text-gray-600 dark:text-gray-400">{condition.functionalImpairment.workFunctioning}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">Relations: </span>
                        <span className="text-gray-600 dark:text-gray-400">{condition.functionalImpairment.interpersonalRelations}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">Self-Care: </span>
                        <span className="text-gray-600 dark:text-gray-400">{condition.functionalImpairment.selfCare}</span>
                      </div>
                    </div>
                  </div>

                  {/* Differential Diagnosis */}
                  {condition.differentialDiagnosis.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Differential Diagnosis</h4>
                      <ul className="pl-5 list-disc space-y-1">
                        {condition.differentialDiagnosis.map((dd, ddIdx) => (
                          <li key={ddIdx} className="text-xs text-gray-600 dark:text-gray-400">{dd}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            )}
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

            {/* Condition-Specific Risk Factors */}
            {!isMultiCondition && schizo ? (
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-3 border-blue-500">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Schizophrenia-Related Risk Factors</h3>
                <ul className="space-y-2 pl-6 list-square">
                  {schizo.riskFactorsIdentified.map((factor, idx) => (
                    <li key={idx} className="text-sm leading-relaxed text-yellow-700 dark:text-yellow-400">{factor}</li>
                  ))}
                </ul>
              </div>
            ) : isMultiCondition && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Condition-Specific Risk Factors</h3>
                {(assessment as MultiConditionExtendedRiskAssessment).conditionAssessments.map((condition, idx) => (
                  condition.riskFactorsIdentified.length > 0 && (
                    <div key={idx} className="space-y-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-3 border-yellow-500">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{condition.conditionName}</h4>
                      <ul className="space-y-1 pl-6 list-square">
                        {condition.riskFactorsIdentified.map((factor, fIdx) => (
                          <li key={fIdx} className="text-sm leading-relaxed text-yellow-700 dark:text-yellow-400">{factor}</li>
                        ))}
                      </ul>
                    </div>
                  )
                ))}
              </div>
            )}

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

            {/* Condition-Specific Recommended Actions */}
            {!isMultiCondition && schizo ? (
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-3 border-blue-500">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Schizophrenia Evaluation: Recommended Actions</h3>
                <ul className="space-y-2 pl-6 list-disc">
                  {schizo.recommendedActions.map((action, idx) => (
                    <li key={idx} className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{action}</li>
                  ))}
                </ul>
              </div>
            ) : isMultiCondition && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Condition-Specific Recommended Actions</h3>
                {(assessment as MultiConditionExtendedRiskAssessment).conditionAssessments.map((condition, idx) => (
                  condition.recommendedActions.length > 0 && (
                    <div key={idx} className="space-y-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-3 border-green-500">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{condition.conditionName}</h4>
                      <ul className="space-y-1 pl-6 list-disc">
                        {condition.recommendedActions.map((action, aIdx) => (
                          <li key={aIdx} className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{action}</li>
                        ))}
                      </ul>
                    </div>
                  )
                ))}
              </div>
            )}

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
            {!isMultiCondition && schizo && schizo.clinicalNotes.length > 0 && (
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-3 border-blue-500">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clinical Notes</h3>
                <ul className="space-y-2 pl-6 list-disc">
                  {schizo.clinicalNotes.map((note, idx) => (
                    <li key={idx} className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{note}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {isMultiCondition && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clinical Notes by Condition</h3>
                {(assessment as MultiConditionExtendedRiskAssessment).conditionAssessments.map((condition, idx) => (
                  condition.clinicalNotes.length > 0 && (
                    <div key={idx} className="space-y-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-3 border-purple-500">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{condition.conditionName}</h4>
                      <ul className="space-y-1 pl-6 list-disc">
                        {condition.clinicalNotes.map((note, nIdx) => (
                          <li key={nIdx} className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">{note}</li>
                        ))}
                      </ul>
                    </div>
                  )
                ))}
              </div>
            )}

            {/* Confidence Levels */}
            {!isMultiCondition && schizo ? (
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
            ) : isMultiCondition && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Confidence Scores by Condition</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {(assessment as MultiConditionExtendedRiskAssessment).conditionAssessments.map((condition, idx) => (
                    <div key={idx} className="space-y-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                      <span className="text-xs font-medium text-gray-900 dark:text-white">{condition.conditionName}</span>
                      <div className="w-full h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                          style={{ width: `${condition.confidenceScore * 100}%` }}
                        />
                      </div>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {Math.round(condition.confidenceScore * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Overall assessment confidence */}
                <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Overall Assessment Confidence</span>
                  <div className="w-full h-6 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-600 to-green-600 transition-all duration-500"
                      style={{ width: `${assessment.confidenceLevel * 100}%` }}
                    />
                  </div>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {Math.round(assessment.confidenceLevel * 100)}%
                  </span>
                </div>
              </div>
            )}
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
