/**
 * Extended Risk Assessment Button Component
 * Provides UI for triggering and viewing extended risk assessments with schizophrenia evaluation
 */

import React, { useState } from 'react';
import { Brain, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { ExtendedRiskAssessmentDisplay } from './ExtendedRiskAssessmentDisplay';
import { 
  ExtendedRiskAssessment, 
  ExtendedRiskAssessmentResponse, 
  ExtendedRiskAssessmentStatusResponse 
} from '../types/extendedRiskAssessment';
import { apiPost, apiGet } from '../utils/api';
import '../styles/extended-risk-assessment-button.scss';

interface ExtendedRiskAssessmentButtonProps {
  sessionId: string;
  apiBaseUrl: string;
  onComplete?: (assessment: ExtendedRiskAssessment) => void;
  onError?: (error: string) => void;
  className?: string;
}

export const ExtendedRiskAssessmentButton: React.FC<ExtendedRiskAssessmentButtonProps> = ({
  sessionId,
  apiBaseUrl,
  onComplete,
  onError,
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [assessment, setAssessment] = useState<ExtendedRiskAssessment | null>(null);
  const [status, setStatus] = useState<ExtendedRiskAssessmentStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAssessment, setShowAssessment] = useState(false);

  // Check status of extended risk assessment
  const checkStatus = async () => {
    setIsChecking(true);
    setError(null);

    try {
      const response = await apiGet<ExtendedRiskAssessmentStatusResponse>(
        `${apiBaseUrl}/api/sessions/${sessionId}/extended-risk-assessment/status`
      );

      if (response.success && response.data) {
        setStatus(response.data);
        
        // If assessment exists, fetch it
        if (response.data.hasExtendedAssessment) {
          await fetchAssessment();
        }
      } else {
        setError(response.error || 'Failed to check assessment status');
        onError?.(response.error || 'Failed to check assessment status');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error checking status';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsChecking(false);
    }
  };

  // Fetch existing assessment
  const fetchAssessment = async () => {
    try {
      const response = await apiGet<ExtendedRiskAssessmentResponse>(
        `${apiBaseUrl}/api/sessions/${sessionId}/extended-risk-assessment`
      );

      if (response.success && response.data?.extendedRiskAssessment) {
        setAssessment(response.data.extendedRiskAssessment);
        onComplete?.(response.data.extendedRiskAssessment);
      }
    } catch (err) {
      console.error('Error fetching assessment:', err);
    }
  };

  // Generate new assessment
  const generateAssessment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiPost<ExtendedRiskAssessmentResponse>(
        `${apiBaseUrl}/api/sessions/${sessionId}/extended-risk-assessment`,
        {},
        { timeout: 180000 } // 3 minute timeout for GPT-5
      );

      if (response.success && response.data?.extendedRiskAssessment) {
        setAssessment(response.data.extendedRiskAssessment);
        setShowAssessment(true);
        onComplete?.(response.data.extendedRiskAssessment);
      } else {
        const errorMsg = response.error || response.data?.message || 'Failed to generate assessment';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error generating assessment';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle button click
  const handleClick = async () => {
    if (assessment) {
      setShowAssessment(true);
    } else {
      await checkStatus();
      
      // If no assessment exists after check, generate one
      if (!status?.hasExtendedAssessment) {
        await generateAssessment();
      } else {
        setShowAssessment(true);
      }
    }
  };

  return (
    <div className={`extended-assessment-button ${className}`}>
      {/* Trigger Button */}
      {!showAssessment && (
        <div className="extended-assessment-button__trigger-section">
          <button
            className={`extended-assessment-button__trigger ${isLoading || isChecking ? 'extended-assessment-button__trigger--loading' : ''}`}
            onClick={handleClick}
            disabled={isLoading || isChecking}
          >
            {isLoading ? (
              <>
                <Loader2 className="extended-assessment-button__icon extended-assessment-button__icon--spin" size={20} />
                <span>Generating Extended Assessment (30-120s)...</span>
              </>
            ) : isChecking ? (
              <>
                <Loader2 className="extended-assessment-button__icon extended-assessment-button__icon--spin" size={20} />
                <span>Checking Status...</span>
              </>
            ) : assessment ? (
              <>
                <CheckCircle className="extended-assessment-button__icon" size={20} />
                <span>View Extended Risk Assessment</span>
              </>
            ) : (
              <>
                <Brain className="extended-assessment-button__icon" size={20} />
                <span>Generate Extended Risk Assessment (GPT-5)</span>
              </>
            )}
          </button>

          {/* Info Banner */}
          {!assessment && !isLoading && (
            <div className="extended-assessment-button__info">
              <Brain size={16} />
              <span>
                Extended assessment includes comprehensive DSM-5 schizophrenia evaluation using GPT-5/O3. 
                Processing time: 30-120 seconds.
              </span>
            </div>
          )}

          {/* Status Info */}
          {status && !isLoading && (
            <div className="extended-assessment-button__status-info">
              <div className="extended-assessment-button__status-item">
                <span className="extended-assessment-button__status-label">Standard Assessment:</span>
                <span className={`extended-assessment-button__status-value ${status.hasStandardAssessment ? 'extended-assessment-button__status-value--yes' : 'extended-assessment-button__status-value--no'}`}>
                  {status.hasStandardAssessment ? 'Available' : 'Not Available'}
                </span>
              </div>
              <div className="extended-assessment-button__status-item">
                <span className="extended-assessment-button__status-label">Audio Transcription:</span>
                <span className={`extended-assessment-button__status-value ${status.hasTranscription ? 'extended-assessment-button__status-value--yes' : 'extended-assessment-button__status-value--no'}`}>
                  {status.hasTranscription ? 'Available' : 'Not Available'}
                </span>
              </div>
              <div className="extended-assessment-button__status-item">
                <span className="extended-assessment-button__status-label">Can Generate:</span>
                <span className={`extended-assessment-button__status-value ${status.canGenerate ? 'extended-assessment-button__status-value--yes' : 'extended-assessment-button__status-value--no'}`}>
                  {status.canGenerate ? 'Yes' : 'No - Prediction Required'}
                </span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="extended-assessment-button__error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Assessment Display */}
      {showAssessment && assessment && (
        <div className="extended-assessment-button__display-section">
          <button
            className="extended-assessment-button__close"
            onClick={() => setShowAssessment(false)}
            title="Close Extended Assessment"
          >
            ← Back
          </button>

          <ExtendedRiskAssessmentDisplay assessment={assessment} />
        </div>
      )}
    </div>
  );
};

export default ExtendedRiskAssessmentButton;
