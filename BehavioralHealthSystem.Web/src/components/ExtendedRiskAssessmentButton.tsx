/**
 * Extended Risk Assessment Button Component
 * Provides UI for triggering and displaying extended risk assessments with schizophrenia evaluation
 * Uses async job pattern to handle long-running GPT-5/O3 calls without timeout issues
 */

import React, { useState, useEffect, useRef } from 'react';
import { Brain, Loader2, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { ExtendedRiskAssessmentDisplay } from './ExtendedRiskAssessmentDisplay';
import { 
  ExtendedRiskAssessment, 
  ExtendedRiskAssessmentResponse, 
  ExtendedRiskAssessmentStatusResponse 
} from '../types/extendedRiskAssessment';
import { apiPost, apiGet } from '../utils/api';

// Job-related types
interface ExtendedAssessmentJob {
  jobId: string;
  sessionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'timedout';
  progressPercentage: number;
  currentStep?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  processingTimeMs?: number;
  elapsedTimeMs: number;
  isCompleted: boolean;
  isProcessing: boolean;
  errorMessage?: string;
  modelUsed?: string;
  retryCount: number;
  canRetry: boolean;
}

interface JobStatusResponse {
  success: boolean;
  job: ExtendedAssessmentJob;
  message?: string;
  error?: string;
}

interface StartJobResponse {
  success: boolean;
  message: string;
  jobId: string;
  instanceId: string;
  sessionId: string;
  statusUrl: string;
  resultUrl: string;
  estimatedProcessingTime: string;
  error?: string;
}

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
  
  // Job-related state
  const [currentJob, setCurrentJob] = useState<ExtendedAssessmentJob | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStep, setJobStep] = useState<string>('');
  const [processingStartTime, setProcessingStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Refs for cleanup
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (elapsedTimeIntervalRef.current) {
        clearInterval(elapsedTimeIntervalRef.current);
      }
    };
  }, []);

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
        console.log('[ExtendedRiskAssessment] parsedData.success:', parsedData.success);
        console.log('[ExtendedRiskAssessment] parsedData.extendedRiskAssessment exists:', !!parsedData.extendedRiskAssessment);
        
        if (parsedData.success && parsedData.extendedRiskAssessment) {
          console.log('[ExtendedRiskAssessment] ✅ Assessment fetched successfully');
          setAssessment(parsedData.extendedRiskAssessment);
          setIsLoading(false); // Make sure to stop loading when we get the result
          onComplete?.(parsedData.extendedRiskAssessment);
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

  // Start async job for assessment generation
  const generateAssessment = async () => {
    console.log('[ExtendedRiskAssessment] 🚀 Starting async job for session:', sessionId);
    setIsLoading(true);
    setError(null);
    setCurrentJob(null);
    setJobProgress(0);
    setJobStep('');
    setElapsedTime(0);
    
    // Clear existing assessment when regenerating to show loading state
    if (assessment) {
      console.log('[ExtendedRiskAssessment] Clearing existing assessment for regeneration');
      setAssessment(null);
    }

    try {
      console.log('[ExtendedRiskAssessment] Making POST request to start async job...');
      const response = await apiPost<StartJobResponse>(
        `${apiBaseUrl}/api/sessions/${sessionId}/extended-risk-assessment`,
        {}
      );

      console.log('[ExtendedRiskAssessment] 📥 Job start response:', JSON.stringify(response, null, 2));
      
      if (response.success && response.data) {
        // Parse the JSON string response
        const jobData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        console.log('[ExtendedRiskAssessment] ✅ Job started successfully! Job ID:', jobData.jobId);
        
        setJobStep('Job created, starting processing...');
        setProcessingStartTime(new Date());
        
        // Start polling for job status
        startJobPolling(jobData.jobId);
      } else {
        console.error('[ExtendedRiskAssessment] ❌ Failed to start job');
        const errorMsg = response.error || 'Failed to start assessment job';
        setError(errorMsg);
        onError?.(errorMsg);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('[ExtendedRiskAssessment] ❌ Exception starting job:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error starting assessment job';
      setError(errorMsg);
      onError?.(errorMsg);
      setIsLoading(false);
    }
  };

  // Start polling for job completion
  const startJobPolling = (jobId: string) => {
    console.log('[ExtendedRiskAssessment] 🔄 Starting job polling for:', jobId);
    
    // Start elapsed time counter
    elapsedTimeIntervalRef.current = setInterval(() => {
      if (processingStartTime) {
        const elapsed = Math.floor((Date.now() - processingStartTime.getTime()) / 1000);
        setElapsedTime(elapsed);
      }
    }, 1000);
    
    // Poll job status every 2 seconds
    const pollJob = async () => {
      try {
        const response = await apiGet<JobStatusResponse>(
          `${apiBaseUrl}/api/jobs/${jobId}`
        );
        
        // Parse response.data if it's a string
        const jobData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        
        if (response.success && jobData?.job) {
          const job = jobData.job;
          setCurrentJob(job);
          setJobProgress(job.progressPercentage);
          setJobStep(job.currentStep || '');
          
          console.log('[ExtendedRiskAssessment] Job status:', job.status, job.progressPercentage + '%', job.currentStep);
          
          if (job.isCompleted) {
            console.log('[ExtendedRiskAssessment] 🎉 Job completed!');
            stopJobPolling();
            
            if (job.status === 'completed') {
              // Job completed successfully, fetch the result
              await fetchAssessment();
            } else {
              // Job failed
              const errorMsg = job.errorMessage || 'Assessment job failed';
              setError(errorMsg);
              onError?.(errorMsg);
              setIsLoading(false);
            }
          }
        } else {
          console.error('[ExtendedRiskAssessment] Failed to get job status');
        }
      } catch (err) {
        console.error('[ExtendedRiskAssessment] Error polling job:', err);
      }
    };
    
    // Poll immediately and then every 2 seconds
    pollJob();
    pollingIntervalRef.current = setInterval(pollJob, 2000);
  };

  // Stop job polling
  const stopJobPolling = () => {
    console.log('[ExtendedRiskAssessment] 🛑 Stopping job polling');
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    if (elapsedTimeIntervalRef.current) {
      clearInterval(elapsedTimeIntervalRef.current);
      elapsedTimeIntervalRef.current = null;
    }
  };

  // Format elapsed time
  const formatElapsedTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  // Loading state with job progress
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
            {isLoading ? 'Processing Extended Assessment...' : 'Checking Status...'}
          </h3>
          
          {/* Job Progress */}
          {isLoading && currentJob && (
            <div className="max-w-md mx-auto">
              {/* Progress Bar */}
              <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{'--progress-width': `${jobProgress}%`, width: 'var(--progress-width)'} as React.CSSProperties}
                ></div>
              </div>
              
              {/* Progress Info */}
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <div className="flex justify-between items-center">
                  <span>Progress:</span>
                  <span className="font-medium">{jobProgress}%</span>
                </div>
                {jobStep && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {jobStep}
                  </div>
                )}
                {elapsedTime > 0 && (
                  <div className="flex justify-between items-center text-xs">
                    <span>Elapsed Time:</span>
                    <span className="font-medium flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatElapsedTime(elapsedTime)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <p className="text-gray-600 dark:text-gray-300 mt-4">
            {isLoading ? 'Using GPT-5/O3 for comprehensive evaluation. This typically takes 30-120 seconds.' : 'Please wait...'}
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
              console.log('[ExtendedRiskAssessment] Regenerate button clicked - stopping polling and calling generateAssessment()');
              stopJobPolling();
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
