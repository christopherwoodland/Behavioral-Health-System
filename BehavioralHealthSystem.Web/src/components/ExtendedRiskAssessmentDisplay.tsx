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
import '../styles/extended-risk-assessment.scss';

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
    <div className="extended-assessment__symptom-card">
      <div className="extended-assessment__symptom-header">
        <h4 className="extended-assessment__symptom-title">{title}</h4>
        <span className={`extended-assessment__symptom-badge ${getSeverityColor(symptom.severity)}`}>
          Severity: {symptom.severity}/4
        </span>
      </div>
      
      <p className="extended-assessment__symptom-description">{description}</p>
      
      <div className="extended-assessment__symptom-presence">
        <span className="extended-assessment__label">Presence Level:</span>
        <span className={`extended-assessment__value ${getSeverityColor(symptom.severity)}`}>
          {symptom.presenceLevel}
        </span>
      </div>

      {symptom.evidence && symptom.evidence.length > 0 && (
        <div className="extended-assessment__symptom-evidence">
          <span className="extended-assessment__label">Evidence:</span>
          <ul className="extended-assessment__evidence-list">
            {symptom.evidence.map((evidence, idx) => (
              <li key={idx} className="extended-assessment__evidence-item">{evidence}</li>
            ))}
          </ul>
        </div>
      )}

      {symptom.notes && (
        <div className="extended-assessment__symptom-notes">
          <span className="extended-assessment__label">Clinical Notes:</span>
          <p className="extended-assessment__notes-text">{symptom.notes}</p>
        </div>
      )}

      {/* Severity bar */}
      <div className="extended-assessment__severity-bar">
        <div 
          className={`extended-assessment__severity-fill extended-assessment__severity-fill--level-${symptom.severity}`}
          data-severity-width={`${(symptom.severity / 4) * 100}%`}
        />
      </div>
    </div>
  );

  return (
    <div className={`extended-assessment ${className}`}>
      <div className="extended-assessment__header">
        <div className="extended-assessment__title-section">
          <h2 className="extended-assessment__title">Extended Risk Assessment</h2>
          <span className="extended-assessment__subtitle">
            Comprehensive Psychiatric Evaluation with DSM-5 Schizophrenia Assessment
          </span>
        </div>
        
        <div className="extended-assessment__metadata">
          <span className="extended-assessment__model-badge">{assessment.modelVersion}</span>
          <span className="extended-assessment__time-badge">
            {formatProcessingTime(assessment.processingTimeMs)}
          </span>
          <span className="extended-assessment__date-badge">
            {new Date(assessment.generatedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="extended-assessment__tabs">
        <button
          className={`extended-assessment__tab ${activeTab === 'overview' ? 'extended-assessment__tab--active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`extended-assessment__tab ${activeTab === 'schizophrenia' ? 'extended-assessment__tab--active' : ''}`}
          onClick={() => setActiveTab('schizophrenia')}
        >
          Schizophrenia Evaluation
        </button>
        <button
          className={`extended-assessment__tab ${activeTab === 'details' ? 'extended-assessment__tab--active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Clinical Details
        </button>
      </div>

      {/* Tab Content */}
      <div className="extended-assessment__content">
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="extended-assessment__overview">
            <div className="extended-assessment__risk-summary">
              <div className={`extended-assessment__risk-level ${getRiskLevelColor(assessment.overallRiskLevel)}`}>
                <span className="extended-assessment__risk-level-label">Overall Risk Level</span>
                <span className="extended-assessment__risk-level-value">{assessment.overallRiskLevel}</span>
                <span className="extended-assessment__risk-score">Score: {assessment.riskScore}/10</span>
              </div>

              <div className={`extended-assessment__schizo-likelihood ${getLikelihoodColor(schizo.overallLikelihood)}`}>
                <span className="extended-assessment__likelihood-label">Schizophrenia Likelihood</span>
                <span className="extended-assessment__likelihood-value">{schizo.overallLikelihood}</span>
                <span className="extended-assessment__confidence">Confidence: {Math.round(schizo.confidenceScore * 100)}%</span>
              </div>
            </div>

            <div className="extended-assessment__summary-section">
              <h3 className="extended-assessment__section-title">Clinical Summary</h3>
              <p className="extended-assessment__summary-text">{assessment.summary}</p>
            </div>

            <div className="extended-assessment__schizo-summary-section">
              <h3 className="extended-assessment__section-title">Schizophrenia Assessment Summary</h3>
              <p className="extended-assessment__summary-text">{schizo.assessmentSummary}</p>
            </div>

            <div className="extended-assessment__quick-facts">
              <div className="extended-assessment__fact-card">
                <span className="extended-assessment__fact-label">Criterion A Met</span>
                <span className={`extended-assessment__fact-value ${criterionA.criterionAMet ? 'text-red-600' : 'text-green-600'}`}>
                  {criterionA.criterionAMet ? 'Yes' : 'No'}
                </span>
                <span className="extended-assessment__fact-detail">
                  {criterionA.totalSymptomsPresent}/5 symptoms present
                </span>
              </div>

              <div className="extended-assessment__fact-card">
                <span className="extended-assessment__fact-label">Criterion B Met</span>
                <span className={`extended-assessment__fact-value ${schizo.functionalImpairment.criterionBMet ? 'text-red-600' : 'text-green-600'}`}>
                  {schizo.functionalImpairment.criterionBMet ? 'Yes' : 'No'}
                </span>
                <span className="extended-assessment__fact-detail">
                  {schizo.functionalImpairment.impairmentLevel} impairment
                </span>
              </div>

              <div className="extended-assessment__fact-card">
                <span className="extended-assessment__fact-label">Risk Factors</span>
                <span className="extended-assessment__fact-value">
                  {schizo.riskFactorsIdentified.length}
                </span>
                <span className="extended-assessment__fact-detail">identified</span>
              </div>

              <div className="extended-assessment__fact-card">
                <span className="extended-assessment__fact-label">Recommended Actions</span>
                <span className="extended-assessment__fact-value">
                  {schizo.recommendedActions.length}
                </span>
                <span className="extended-assessment__fact-detail">interventions</span>
              </div>
            </div>
          </div>
        )}

        {/* Schizophrenia Evaluation Tab */}
        {activeTab === 'schizophrenia' && (
          <div className="extended-assessment__schizophrenia">
            
            {/* DSM-5 Criterion A - Characteristic Symptoms */}
            <div className="extended-assessment__criterion-section">
              <div className="extended-assessment__criterion-header">
                <h3 className="extended-assessment__section-title">
                  DSM-5 Criterion A: Characteristic Symptoms
                </h3>
                <span className={`extended-assessment__criterion-badge ${criterionA.criterionAMet ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {criterionA.criterionAMet ? 'Criteria Met' : 'Criteria Not Met'}
                </span>
              </div>
              
              <p className="extended-assessment__criterion-description">
                At least TWO symptoms must be present for significant time during 1-month period. 
                At least ONE must be delusions, hallucinations, or disorganized speech.
              </p>

              <div className="extended-assessment__symptoms-grid">
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
            <div className="extended-assessment__criterion-section">
              <div className="extended-assessment__criterion-header">
                <h3 className="extended-assessment__section-title">
                  DSM-5 Criterion B: Functional Impairment
                </h3>
                <span className={`extended-assessment__criterion-badge ${schizo.functionalImpairment.criterionBMet ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {schizo.functionalImpairment.criterionBMet ? 'Criteria Met' : 'Criteria Not Met'}
                </span>
              </div>

              <div className={`extended-assessment__impairment-level ${getImpairmentColor(schizo.functionalImpairment.impairmentLevel)}`}>
                <span className="extended-assessment__impairment-label">Overall Impairment Level:</span>
                <span className="extended-assessment__impairment-value">{schizo.functionalImpairment.impairmentLevel}</span>
              </div>

              <div className="extended-assessment__impairment-details">
                <div className="extended-assessment__impairment-card">
                  <h4 className="extended-assessment__impairment-title">Work/Occupational Functioning</h4>
                  <p className="extended-assessment__impairment-text">{schizo.functionalImpairment.workFunctioning}</p>
                </div>

                <div className="extended-assessment__impairment-card">
                  <h4 className="extended-assessment__impairment-title">Interpersonal Relations</h4>
                  <p className="extended-assessment__impairment-text">{schizo.functionalImpairment.interpersonalRelations}</p>
                </div>

                <div className="extended-assessment__impairment-card">
                  <h4 className="extended-assessment__impairment-title">Self-Care</h4>
                  <p className="extended-assessment__impairment-text">{schizo.functionalImpairment.selfCare}</p>
                </div>
              </div>
            </div>

            {/* DSM-5 Criterion C - Duration */}
            <div className="extended-assessment__criterion-section">
              <h3 className="extended-assessment__section-title">DSM-5 Criterion C: Duration</h3>
              <p className="extended-assessment__duration-text">{schizo.durationAssessment}</p>
            </div>

            {/* Differential Diagnosis */}
            <div className="extended-assessment__differential-section">
              <h3 className="extended-assessment__section-title">Differential Diagnosis Considerations</h3>
              <ul className="extended-assessment__differential-list">
                {schizo.differentialDiagnosis.map((diagnosis, idx) => (
                  <li key={idx} className="extended-assessment__differential-item">{diagnosis}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Clinical Details Tab */}
        {activeTab === 'details' && (
          <div className="extended-assessment__details">
            
            {/* Key Risk Factors */}
            <div className="extended-assessment__detail-section">
              <h3 className="extended-assessment__section-title">Key Risk Factors</h3>
              <ul className="extended-assessment__detail-list">
                {assessment.keyFactors.map((factor, idx) => (
                  <li key={idx} className="extended-assessment__detail-item">{factor}</li>
                ))}
              </ul>
            </div>

            {/* Schizophrenia-Specific Risk Factors */}
            <div className="extended-assessment__detail-section">
              <h3 className="extended-assessment__section-title">Schizophrenia-Related Risk Factors</h3>
              <ul className="extended-assessment__detail-list extended-assessment__detail-list--warning">
                {schizo.riskFactorsIdentified.map((factor, idx) => (
                  <li key={idx} className="extended-assessment__detail-item">{factor}</li>
                ))}
              </ul>
            </div>

            {/* Immediate Actions */}
            {assessment.immediateActions.length > 0 && (
              <div className="extended-assessment__detail-section extended-assessment__detail-section--urgent">
                <h3 className="extended-assessment__section-title">Immediate Actions Required</h3>
                <ul className="extended-assessment__detail-list extended-assessment__detail-list--urgent">
                  {assessment.immediateActions.map((action, idx) => (
                    <li key={idx} className="extended-assessment__detail-item">{action}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Clinical Recommendations */}
            <div className="extended-assessment__detail-section">
              <h3 className="extended-assessment__section-title">Clinical Recommendations</h3>
              <ul className="extended-assessment__detail-list">
                {assessment.recommendations.map((rec, idx) => (
                  <li key={idx} className="extended-assessment__detail-item">{rec}</li>
                ))}
              </ul>
            </div>

            {/* Schizophrenia-Specific Recommended Actions */}
            <div className="extended-assessment__detail-section">
              <h3 className="extended-assessment__section-title">Schizophrenia Evaluation: Recommended Actions</h3>
              <ul className="extended-assessment__detail-list">
                {schizo.recommendedActions.map((action, idx) => (
                  <li key={idx} className="extended-assessment__detail-item">{action}</li>
                ))}
              </ul>
            </div>

            {/* Follow-up Recommendations */}
            <div className="extended-assessment__detail-section">
              <h3 className="extended-assessment__section-title">Follow-Up Recommendations</h3>
              <ul className="extended-assessment__detail-list">
                {assessment.followUpRecommendations.map((followup, idx) => (
                  <li key={idx} className="extended-assessment__detail-item">{followup}</li>
                ))}
              </ul>
            </div>

            {/* Clinical Notes */}
            {schizo.clinicalNotes.length > 0 && (
              <div className="extended-assessment__detail-section">
                <h3 className="extended-assessment__section-title">Clinical Notes</h3>
                <ul className="extended-assessment__detail-list">
                  {schizo.clinicalNotes.map((note, idx) => (
                    <li key={idx} className="extended-assessment__detail-item">{note}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Confidence Levels */}
            <div className="extended-assessment__confidence-section">
              <div className="extended-assessment__confidence-card">
                <span className="extended-assessment__confidence-label">Overall Assessment Confidence</span>
                <div className="extended-assessment__confidence-bar">
                  {/* eslint-disable-next-line react/forbid-dom-props */}
                  <div 
                    className="extended-assessment__confidence-fill"
                    style={{ width: `${assessment.confidenceLevel * 100}%` }}
                  />
                </div>
                <span className="extended-assessment__confidence-value">
                  {Math.round(assessment.confidenceLevel * 100)}%
                </span>
              </div>

              <div className="extended-assessment__confidence-card">
                <span className="extended-assessment__confidence-label">Schizophrenia Assessment Confidence</span>
                <div className="extended-assessment__confidence-bar">
                  {/* eslint-disable-next-line react/forbid-dom-props */}
                  <div 
                    className="extended-assessment__confidence-fill"
                    style={{ width: `${schizo.confidenceScore * 100}%` }}
                  />
                </div>
                <span className="extended-assessment__confidence-value">
                  {Math.round(schizo.confidenceScore * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clinical Disclaimer */}
      <div className="extended-assessment__disclaimer">
        <strong>Clinical Disclaimer:</strong> This assessment is generated by AI based on limited data and should not replace 
        comprehensive clinical evaluation by a qualified mental health professional. Formal diagnosis of schizophrenia requires 
        extensive clinical interview, observation over time, medical evaluation to rule out other conditions, and consideration 
        of cultural context. Duration criteria (6 months) cannot be fully assessed from single session data.
      </div>
    </div>
  );
};

export default ExtendedRiskAssessmentDisplay;
