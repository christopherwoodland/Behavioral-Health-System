/**
 * Extended Risk Assessment Button Component
 * Provides UI for triggering and displaying extended risk assessments with schizophrenia evaluation
 */

import React, { useState, useEffect } from 'react';
import { Brain, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { ExtendedRiskAssessmentDisplay } from './ExtendedRiskAssessmentDisplay';
import { 
  ExtendedRiskAssessment, 
  ExtendedRiskAssessmentResponse, 
  ExtendedRiskAssessmentStatusResponse 
} from '../types/extendedRiskAssessment';
import { apiPost, apiGet } from '../utils/api';

interface ExtendedRiskAssessmentButtonProps {
  sessionId: string;
  apiBaseUrl: string;
  existingAssessment?: ExtendedRiskAssessment | null;
  onComplete?: (assessment: ExtendedRiskAssessment) => void;
  onError?: (error: string) => void;
}

export const ExtendedRiskAssessmentButton: React.FC<ExtendedRiskAssessmentButtonProps> = ({
  sessionId,
  apiBaseUrl,
  existingAssessment,
  onComplete,
  onError
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [assessment, setAssessment] = useState<ExtendedRiskAssessment | null>(existingAssessment || null);
  const [status, setStatus] = useState<ExtendedRiskAssessmentStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load existing assessment on mount or when it changes
  useEffect(() => {
    console.log('[ExtendedRiskAssessment] Component mounted for session:', sessionId);
    console.log('[ExtendedRiskAssessment] existingAssessment prop:', existingAssessment);
    
    if (existingAssessment) {
      console.log('[ExtendedRiskAssessment] ✅ Existing assessment provided, displaying immediately');
      setAssessment(existingAssessment);
    } else {
      console.log('[ExtendedRiskAssessment] No existing assessment, checking API...');
      // Check if assessment exists on the server
      fetchAssessment();
    }
  }, [sessionId, existingAssessment]);

  // Check status of extended risk assessment
  const checkStatus = async () => {
    console.log('[ExtendedRiskAssessment] Checking status for session:', sessionId);
    setIsChecking(true);
    setError(null);

    try {
      const response = await apiGet<ExtendedRiskAssessmentStatusResponse>(
        `${apiBaseUrl}/api/sessions/${sessionId}/extended-risk-assessment/status`
      );

      console.log('[ExtendedRiskAssessment] Status response:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        // Parse data if it's a string (sometimes API returns stringified JSON)
        const parsedData = typeof response.data === 'string' 
          ? JSON.parse(response.data) 
          : response.data;
        
        console.log('[ExtendedRiskAssessment] Status check successful, data:', parsedData);
        setStatus(parsedData);
        
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
    console.log('[ExtendedRiskAssessment] Fetching existing assessment for session:', sessionId);
    try {
      const response = await apiGet<ExtendedRiskAssessmentResponse>(
        `${apiBaseUrl}/api/sessions/${sessionId}/extended-risk-assessment`
      );

      console.log('[ExtendedRiskAssessment] Fetch response:', JSON.stringify(response, null, 2));

      // Check both wrapper success and inner API response success
      if (response.success && response.data) {
        // Parse data if it's a string (sometimes API returns stringified JSON)
        const parsedData = typeof response.data === 'string' 
          ? JSON.parse(response.data) 
          : response.data;
        
        console.log('[ExtendedRiskAssessment] Wrapper success: true, checking inner response...');
        console.log('[ExtendedRiskAssessment] response.data.success:', parsedData.success);
        console.log('[ExtendedRiskAssessment] response.data.extendedRiskAssessment exists:', !!parsedData.extendedRiskAssessment);
        
        if (response.data.success && response.data.extendedRiskAssessment) {
          console.log('[ExtendedRiskAssessment] ✅ Assessment fetched successfully');
          setAssessment(response.data.extendedRiskAssessment);
          onComplete?.(response.data.extendedRiskAssessment);
        } else {
          console.warn('[ExtendedRiskAssessment] ⚠️ Inner response missing success or extendedRiskAssessment');
        }
      } else {
        console.warn('[ExtendedRiskAssessment] ⚠️ Wrapper response failed or no data');
      }
    } catch (err) {
      console.error('[ExtendedRiskAssessment] ❌ Error fetching assessment:', err);
    }
  };

  // Generate new assessment
  const generateAssessment = async () => {
    console.log('[ExtendedRiskAssessment] 🚀 Starting assessment generation for session:', sessionId);
    setIsLoading(true);
    setError(null);
    // Clear existing assessment when regenerating to show loading state
    if (assessment) {
      console.log('[ExtendedRiskAssessment] Clearing existing assessment for regeneration');
      setAssessment(null);
    }

    try {
      console.log('[ExtendedRiskAssessment] Making POST request to generate assessment...');
      const response = await apiPost<ExtendedRiskAssessmentResponse>(
        `${apiBaseUrl}/api/sessions/${sessionId}/extended-risk-assessment`,
        {},
        { timeout: 180000 } // 3 minute timeout for GPT-5
      );

      console.log('[ExtendedRiskAssessment] 📥 Raw response received:', JSON.stringify(response, null, 2));
      console.log('[ExtendedRiskAssessment] Response structure check:');
      console.log('  - response.success:', response.success);
      console.log('  - response.data exists:', !!response.data);
      console.log('  - response.data type:', typeof response.data);
      console.log('  - response.error:', response.error);
      
      // Parse data if it's a string (sometimes API returns stringified JSON)
      let parsedData = response.data;
      if (response.data && typeof response.data === 'string') {
        console.log('[ExtendedRiskAssessment] ⚠️ response.data is a string, parsing JSON...');
        try {
          parsedData = JSON.parse(response.data);
          console.log('[ExtendedRiskAssessment] ✅ JSON parsed successfully');
        } catch (parseError) {
          console.error('[ExtendedRiskAssessment] ❌ Failed to parse JSON:', parseError);
          setError('Failed to parse API response');
          onError?.('Failed to parse API response');
          return;
        }
      }
      
      if (parsedData) {
        console.log('[ExtendedRiskAssessment] response.data structure:');
        console.log('  - response.data.success:', parsedData.success);
        console.log('  - response.data.message:', parsedData.message);
        console.log('  - response.data.extendedRiskAssessment exists:', !!parsedData.extendedRiskAssessment);
        console.log('  - response.data.error:', parsedData.error);
      }

      // Check both wrapper success and inner API response success
      if (response.success && parsedData) {
        console.log('[ExtendedRiskAssessment] ✅ Wrapper response successful, checking inner response...');
        
        if (parsedData.success && parsedData.extendedRiskAssessment) {
          console.log('[ExtendedRiskAssessment] ✅✅ Inner response successful! Assessment generated.');
          console.log('[ExtendedRiskAssessment] Assessment keys:', Object.keys(parsedData.extendedRiskAssessment));
          setAssessment(parsedData.extendedRiskAssessment);
          onComplete?.(parsedData.extendedRiskAssessment);
        } else {
          console.error('[ExtendedRiskAssessment] ❌ Inner response failed or missing extendedRiskAssessment');
          console.error('[ExtendedRiskAssessment] response.data.success:', parsedData.success);
          console.error('[ExtendedRiskAssessment] response.data.extendedRiskAssessment:', parsedData.extendedRiskAssessment);
          const errorMsg = parsedData.error || parsedData.message || 'Failed to generate assessment';
          console.error('[ExtendedRiskAssessment] Setting error:', errorMsg);
          setError(errorMsg);
          onError?.(errorMsg);
        }
      } else {
        console.error('[ExtendedRiskAssessment] ❌ Wrapper response failed');
        console.error('[ExtendedRiskAssessment] response.success:', response.success);
        console.error('[ExtendedRiskAssessment] response.data:', parsedData);
        const errorMsg = response.error || 'Failed to generate assessment';
        console.error('[ExtendedRiskAssessment] Setting error:', errorMsg);
        setError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (err) {
      console.error('[ExtendedRiskAssessment] ❌ Exception caught during generation:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error generating assessment';
      console.error('[ExtendedRiskAssessment] Exception error message:', errorMsg);
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      console.log('[ExtendedRiskAssessment] Generation attempt completed, setting isLoading to false');
      setIsLoading(false);
    }
  };

  // If no assessment exists and not generating/checking, show generate buttons (matching RiskAssessment component)
  if (!assessment && !isLoading && !isChecking) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Brain className="w-5 h-5 mr-2" aria-hidden="true" />
          AI Risk Assessment (Extended)
        </h2>
        
        <div className="text-center py-8">
          <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Extended Risk Assessment Available
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Generate an AI-powered extended risk assessment with comprehensive DSM-5 schizophrenia evaluation using GPT-5/O3. Processing time: 30-120 seconds.
          </p>
          
          <div className="space-y-3">
            <button type="button"
              onClick={generateAssessment}
              disabled={status?.canGenerate === false}
              className="btn btn--primary"
              aria-label="Generate extended AI risk assessment"
            >
              <Brain className="w-4 h-4 mr-2" aria-hidden="true" />
              Generate Extended Risk Assessment
            </button>
            
            <button type="button"
              onClick={checkStatus}
              className="btn btn--secondary"
              aria-label="Check for existing extended assessment"
            >
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
              Check for Existing Assessment
            </button>
          </div>
          
          {/* Status Info */}
          {status && (
            <div className="mt-6 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <span className="text-gray-600 dark:text-gray-400 block mb-1">Standard Assessment:</span>
                  <span className={`font-medium ${status.hasStandardAssessment ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                    {status.hasStandardAssessment ? '✓ Available' : '✗ Not Available'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400 block mb-1">Audio Transcription:</span>
                  <span className={`font-medium ${status.hasTranscription ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                    {status.hasTranscription ? '✓ Available' : '✗ Not Available'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400 block mb-1">Can Generate:</span>
                  <span className={`font-medium ${status.canGenerate ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {status.canGenerate ? '✓ Yes' : '✗ Prediction Required'}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-300 text-sm flex items-center justify-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                {error}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading state (matching RiskAssessment component)
  if (isLoading || isChecking) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Brain className="w-5 h-5 mr-2" aria-hidden="true" />
          AI Risk Assessment (Extended)
        </h2>
        
        <div className="text-center py-8">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" aria-hidden="true" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {isLoading ? 'Generating Extended Assessment...' : 'Checking Status...'}
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            {isLoading ? 'This may take 30-120 seconds. Using GPT-5/O3 for comprehensive evaluation.' : 'Please wait...'}
          </p>
        </div>
      </div>
    );
  }

  // Assessment display (matching RiskAssessment component)
  if (assessment) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <Brain className="w-5 h-5 mr-2" aria-hidden="true" />
            AI Risk Assessment (Extended)
          </h2>
          <button type="button"
            onClick={() => {
              console.log('[ExtendedRiskAssessment] Regenerate button clicked - calling generateAssessment()');
              generateAssessment();
            }}
            disabled={isLoading}
            className="btn btn--secondary text-sm"
            aria-label="Regenerate extended assessment"
          >
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            Regenerate
          </button>
        </div>

        {assessment && <ExtendedRiskAssessmentDisplay assessment={assessment} />}
      </div>
    );
  }

  return null;
};

export default ExtendedRiskAssessmentButton;
