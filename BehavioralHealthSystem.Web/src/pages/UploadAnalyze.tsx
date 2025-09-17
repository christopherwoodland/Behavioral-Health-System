import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Play, Pause, X, AlertCircle, CheckCircle, Loader2, Volume2, Plus, Trash2, Files, File } from 'lucide-react';
import { convertAudioToWav } from '../services/audio';
import { uploadToAzureBlob } from '../services/azure';
import { apiService, PredictionPoller } from '../services/api';
import { useAccessibility } from '../hooks/useAccessibility';
import { getStoredProcessingMode, setStoredProcessingMode, getUserId } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import type { PredictionResult, AppError, SessionMetadata } from '../types';

interface UploadProgress {
  stage: 'idle' | 'starting' | 'initiating' | 'converting' | 'uploading' | 'submitting' | 'analyzing' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    uploadedFileUrl?: string; // Track uploaded file for cleanup
  };
}

interface AudioFile {
  id: string;
  file: File;
  url: string;
  duration?: number;
}

interface ProcessingProgress {
  [fileId: string]: UploadProgress;
}

interface FileResults {
  [fileId: string]: AnalysisResult;
}

interface FileProcessingState {
  [fileId: string]: 'ready' | 'processing' | 'complete' | 'error';
}

interface SessionInfo {
  sessionId: string;
  userId: string;
}

interface AnalysisResult {
  sessionId: string;
  depressionScore?: number;
  riskLevel?: 'low' | 'medium' | 'high';
  confidence?: number;
  insights?: string[];
  timestamp: string;
  audioUrl?: string;
  rawApiResponse?: any; // Store the complete API response
}

const UploadAnalyze: React.FC = () => {
  // Auth context for user identification
  const { user } = useAuth();
  
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [isMultiMode, setIsMultiMode] = useState(() => getStoredProcessingMode());
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress>({});
  const [results, setResults] = useState<FileResults>({});
  const [fileStates, setFileStates] = useState<FileProcessingState>({});
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Legacy single file state for backward compatibility
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [progress, setProgress] = useState<UploadProgress>({
    stage: 'idle',
    progress: 0,
    message: ''
  });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playingFileId, setPlayingFileId] = useState<string | null>(null);
  const [userMetadata, setUserMetadata] = useState({
    userId: '', // Will be auto-generated on component mount
    age: '',
    gender: '',
    race: '',
    ethnicity: '',
    language: '',
    weight: '',
    zipcode: '',
    sessionNotes: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
    timestamp: number;
  }>>([]);

  // User ID management state - REMOVED (now part of metadata)
  
  // Auto-generate user ID when component loads (for form metadata)
  useEffect(() => {
    if (!userMetadata.userId) {
      const newUserId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      setUserMetadata(prev => ({ ...prev, userId: newUserId }));
    }
  }, [userMetadata.userId]);

  // Helper function to get authenticated user ID for blob storage
  const getAuthenticatedUserId = useCallback((): string => {
    // Use authenticated user ID if available, otherwise fall back to getUserId utility
    return user?.id || getUserId();
  }, [user?.id]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { announceToScreenReader } = useAccessibility();

  // Toast utility functions
  const addToast = useCallback((type: 'error' | 'warning' | 'info' | 'success', title: string, message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast = {
      id,
      type,
      title,
      message,
      timestamp: Date.now()
    };
    setToasts(prev => [...prev, newToast]);
    
    // Auto-remove toast after 8 seconds for errors, 5 seconds for others
    const duration = type === 'error' ? 8000 : 5000;
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const resetState = useCallback(() => {
    setAudioFiles([]);
    setAudioFile(null);
    setProgress({ stage: 'idle', progress: 0, message: '' });
    setResult(null);
    setResults({});
    setProcessingProgress({});
    setError(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setPlayingFileId(null);
    setIsProcessing(false);
  }, []);

  const generateFileId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  const addAudioFile = useCallback((file: File) => {
    const id = generateFileId();
    const url = URL.createObjectURL(file);
    const audioFile: AudioFile = { id, file, url };
    
    if (isMultiMode) {
      setAudioFiles(prev => [...prev, audioFile]);
      setFileStates(prev => ({ ...prev, [id]: 'ready' }));
      setProcessingProgress(prev => ({ ...prev, [id]: { stage: 'idle', progress: 0, message: 'Ready to process' } }));
    } else {
      setAudioFile(audioFile);
    }
    
    announceToScreenReader(`Audio file selected: ${file.name}`);

    // Get audio duration
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => {
      if (isMultiMode) {
        setAudioFiles(prev => prev.map(af => 
          af.id === id ? { ...af, duration: audio.duration } : af
        ));
      } else {
        setAudioFile(prev => prev ? { ...prev, duration: audio.duration } : null);
      }
    });
  }, [isMultiMode, announceToScreenReader]);

  const removeAudioFile = useCallback((fileId: string) => {
    if (isMultiMode) {
      setAudioFiles(prev => {
        const fileToRemove = prev.find(f => f.id === fileId);
        if (fileToRemove) {
          URL.revokeObjectURL(fileToRemove.url);
        }
        return prev.filter(f => f.id !== fileId);
      });
      // Clean up associated progress, results, and states
      setProcessingProgress(prev => {
        const { [fileId]: removed, ...rest } = prev;
        return rest;
      });
      setResults(prev => {
        const { [fileId]: removed, ...rest } = prev;
        return rest;
      });
      setFileStates(prev => {
        const { [fileId]: removed, ...rest } = prev;
        return rest;
      });
    }
  }, [isMultiMode]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Process multiple files or single file
    Array.from(files).forEach(file => {
      // Validate file type - check both MIME type and file extension
      const supportedMimeTypes = [
        'audio/wav', 'audio/wave', 'audio/x-wav',
        'audio/mp3', 'audio/mpeg', 'audio/mp4',
        'audio/m4a', 'audio/x-m4a', 'audio/mp4a-latm',
        'audio/aac', 'audio/x-aac',
        'audio/flac', 'audio/x-flac'
      ];
      
      const fileName = file.name.toLowerCase();
      const supportedExtensions = ['.wav', '.mp3', '.m4a', '.aac', '.flac'];
      const hasValidExtension = supportedExtensions.some(ext => fileName.endsWith(ext));
      const hasValidMimeType = supportedMimeTypes.includes(file.type);
      
      // Accept file if either MIME type OR extension is valid (some browsers don't set MIME types correctly)
      if (!hasValidMimeType && !hasValidExtension) {
        setError(`Unsupported file type for ${file.name}. Please select supported audio files (WAV, MP3, M4A, AAC, or FLAC)`);
        addToast('error', 'Unsupported File', `${file.name} is not a supported audio file format`);
        announceToScreenReader(`Error: Unsupported file format selected for ${file.name}`);
        return;
      }

      // Validate file size (50MB limit)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        setError(`File ${file.name} is too large. File size must be less than 50MB`);
        addToast('error', 'File Too Large', `${file.name} size must be less than 50MB`);
        announceToScreenReader(`Error: File ${file.name} is too large`);
        return;
      }

      addAudioFile(file);
      setError(null);
    });
  }, [announceToScreenReader, addAudioFile, addToast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const mockEvent = { target: { files } } as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(mockEvent);
    }
  }, [handleFileSelect]);

  const toggleMode = useCallback(() => {
    setIsMultiMode(prev => {
      const newMode = !prev;
      // Save to localStorage
      setStoredProcessingMode(newMode);
      // Clear files when switching modes
      resetState();
      return newMode;
    });
  }, [resetState]);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      announceToScreenReader('Audio paused');
    } else {
      audioRef.current.play();
      setIsPlaying(true);
      announceToScreenReader('Audio playing');
    }
  }, [isPlaying, announceToScreenReader]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const validateMetadata = useCallback(() => {
    const errors: string[] = [];

    // Age validation
    if (userMetadata.age) {
      const age = parseInt(userMetadata.age);
      if (isNaN(age) || age < 18 || age > 130) {
        errors.push('Age must be between 18 and 130');
      }
    }

    // Gender validation
    if (userMetadata.gender) {
      const validGenders = ['male', 'female', 'non-binary', 'transgender female', 'transgender male', 'other', 'prefer'];
      if (!validGenders.includes(userMetadata.gender)) {
        errors.push('Invalid gender. Must be: male, female, non-binary, transgender female, transgender male, other, or prefer');
      }
    }

    // Race validation
    if (userMetadata.race) {
      const validRaces = ['white', 'black or african-american', 'asian', 'american indian or alaskan native', 'native Hawaiian or pacific islander', 'two or more races', 'other', 'prefer not to say'];
      if (!validRaces.includes(userMetadata.race)) {
        errors.push('Invalid race. Must be: white, black or african-american, asian, american indian or alaskan native, native Hawaiian or pacific islander, two or more races, other, prefer not to say');
      }
    }

    // Ethnicity validation
    if (userMetadata.ethnicity) {
      const validEthnicities = ['Hispanic, Latino, or Spanish Origin', 'Not Hispanic, Latino, or Spanish Origin'];
      if (!validEthnicities.includes(userMetadata.ethnicity)) {
        errors.push('Invalid ethnicity. Must be: Hispanic, Latino, or Spanish Origin | Not Hispanic, Latino, or Spanish Origin');
      }
    }

    // Zipcode validation
    if (userMetadata.zipcode) {
      const zipcodeRegex = /^[a-zA-Z0-9]{1,10}$/;
      if (!zipcodeRegex.test(userMetadata.zipcode)) {
        errors.push('Zipcode must be alphanumeric and contain no more than 10 characters');
      }
    }

    // Weight validation
    if (userMetadata.weight) {
      const weight = parseInt(userMetadata.weight);
      if (isNaN(weight) || weight < 10 || weight > 1000) {
        errors.push('Weight must be between 10 and 1000 pounds (lbs)');
      }
    }

    return errors;
  }, [userMetadata]);

  const buildMetadata = useCallback(() => {
    const metadata: Partial<SessionMetadata> = {};
    let hasMetadata = false;

    if (userMetadata.age) {
      metadata.age = parseInt(userMetadata.age);
      hasMetadata = true;
    }
    if (userMetadata.gender) {
      metadata.gender = userMetadata.gender as SessionMetadata['gender'];
      hasMetadata = true;
    }
    if (userMetadata.race) {
      metadata.race = userMetadata.race as SessionMetadata['race'];
      hasMetadata = true;
    }
    if (userMetadata.ethnicity) {
      metadata.ethnicity = userMetadata.ethnicity as SessionMetadata['ethnicity'];
      hasMetadata = true;
    }
    if (userMetadata.language === 'true' || userMetadata.language === 'false') {
      metadata.language = userMetadata.language === 'true';
      hasMetadata = true;
    }
    if (userMetadata.weight) {
      metadata.weight = parseInt(userMetadata.weight);
      hasMetadata = true;
    }
    if (userMetadata.zipcode) {
      metadata.zipcode = userMetadata.zipcode;
      hasMetadata = true;
    }

    return hasMetadata ? metadata : undefined;
  }, [userMetadata]);

  const processAndAnalyze = useCallback(async () => {
    if (isMultiMode) {
      if (audioFiles.length === 0 || !userMetadata.userId.trim()) {
        setError('Please select audio files. User ID is automatically generated.');
        addToast('error', 'Missing Information', 'Please select audio files. User ID is automatically generated.');
        return;
      }
      await processMultipleFiles();
    } else {
      if (!audioFile || !userMetadata.userId.trim()) {
        setError('Please select an audio file. User ID is automatically generated.');
        addToast('error', 'Missing Information', 'Please select an audio file. User ID is automatically generated.');
        return;
      }
      await processSingleFile();
    }
  }, [audioFile, audioFiles, userMetadata.userId, isMultiMode]);

  const processSingleFileById = useCallback(async (fileId: string, audioFile: AudioFile) => {
    try {
      // Step 1: Initiate session
      setProcessingProgress(prev => ({
        ...prev,
        [fileId]: { stage: 'initiating', progress: 5, message: 'Initiating session...' }
      }));

      const metadata = buildMetadata();
      const sessionRequest: any = {
        userid: userMetadata.userId.trim(),
        is_initiated: true
      };

      // Only include metadata if we have any
      if (metadata) {
        sessionRequest.metadata = metadata;
      }

      const sessionResponse = await apiService.initiateSession(sessionRequest);

      const sessionData: SessionInfo = {
        sessionId: sessionResponse.sessionId,
        userId: userMetadata.userId.trim()
      };

      // Save initial session data to blob storage so it appears in Analysis Sessions UI
      setProcessingProgress(prev => ({
        ...prev,
        [fileId]: { stage: 'initiating', progress: 10, message: 'Saving session data...' }
      }));

      const initialSessionData = {
        sessionId: sessionResponse.sessionId,
        userId: getAuthenticatedUserId(), // Use authenticated user ID for proper folder structure
        userMetadata: metadata,
        audioFileName: audioFile.file.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'initiated'
      };

      try {
        console.log('Attempting to save session data (multi-file):', initialSessionData);
        const saveResult = await apiService.saveSessionData(initialSessionData);
        console.log('Session data saved successfully (multi-file):', saveResult);
      } catch (error) {
        console.error('Failed to save session data (multi-file):', error);
        console.error('Session data that failed to save:', initialSessionData);
        addToast('warning', 'Session Save Warning', 'Session data could not be saved to storage, but processing will continue.');
        // Continue with the process even if saving fails
        // This is not critical for the main workflow, but user should be informed
      }

      setProcessingProgress(prev => ({
        ...prev,
        [fileId]: { stage: 'converting', progress: 15, message: 'Converting audio to required format...' }
      }));

      // Step 2: Convert audio using FFmpeg
      const convertedBlob = await convertAudioToWav(audioFile.file, (progressPercent: number) => {
        setProcessingProgress(prev => ({
          ...prev,
          [fileId]: {
            stage: 'converting',
            progress: 15 + (progressPercent * 0.25), // 15-40% for conversion
            message: `Converting audio... ${Math.round(progressPercent)}%`
          }
        }));
      });

      setProcessingProgress(prev => ({
        ...prev,
        [fileId]: { stage: 'uploading', progress: 40, message: 'Uploading to Azure Blob Storage...' }
      }));

      // Step 3: Upload to Azure Blob Storage
      const fileName = `${userMetadata.userId}_${sessionData.sessionId}_${Date.now()}.wav`;
      const audioUrl = await uploadToAzureBlob(convertedBlob, fileName, (progressPercent: number) => {
        setProcessingProgress(prev => ({
          ...prev,
          [fileId]: {
            stage: 'uploading',
            progress: 40 + (progressPercent * 0.25), // 40-65% for upload
            message: `Uploading... ${Math.round(progressPercent)}%`
          }
        }));
      }, getAuthenticatedUserId()); // Use authenticated user ID for blob storage folder structure

      setProcessingProgress(prev => ({
        ...prev,
        [fileId]: { stage: 'submitting', progress: 65, message: 'Submitting for analysis...' }
      }));

      // Update session data with audio information
      try {
        const updatedSessionData = {
          ...initialSessionData,
          audioUrl: audioUrl,
          audioFileName: fileName,
          status: 'processing',
          updatedAt: new Date().toISOString()
        };
        await apiService.updateSessionData(sessionData.sessionId, updatedSessionData);
      } catch (error) {
        console.warn('Failed to update session data with audio info:', error);
        // Continue with the process even if updating fails
      }

      // Step 4: Submit prediction with URL to /predictions/submit endpoint
      await apiService.submitPrediction({
        userId: userMetadata.userId.trim(),
        sessionid: sessionData.sessionId,
        audioFileUrl: audioUrl,
        audioFileName: fileName
      });

      setProcessingProgress(prev => ({
        ...prev,
        [fileId]: { stage: 'analyzing', progress: 70, message: 'Analyzing audio with Kintsugi Health API...' }
      }));

      // Step 5: Poll for results
      const poller = new PredictionPoller(sessionData.sessionId);
      
      await new Promise<void>((resolve, reject) => {
        poller.start(
          (result: PredictionResult) => {
            // Update progress during polling
            const progressPercent = result.status === 'processing' ? 80 : 
                                  result.status === 'success' ? 95 : 70;
            setProcessingProgress(prev => ({
              ...prev,
              [fileId]: { 
                stage: 'analyzing', 
                progress: progressPercent, 
                message: `Analysis ${result.status}...` 
              }
            }));

            // Check for predict_error and show toast
            if (result.predictError) {
              addToast('error', 'Prediction Error', 
                `${result.predictError.error}: ${result.predictError.message}`);
            }
          },
          (result: PredictionResult) => {
            // Check for final errors before completing
            if (result.predictError) {
              addToast('error', 'Analysis Failed', 
                `The analysis completed with an error: ${result.predictError.error} - ${result.predictError.message}`);
              setProcessingProgress(prev => ({
                ...prev,
                [fileId]: { stage: 'error', progress: 0, message: 'Analysis failed with errors' }
              }));
              reject(new Error(`Prediction error: ${result.predictError.error}`));
              return;
            }

            // Analysis complete successfully
            const analysisResult: AnalysisResult = {
              sessionId: sessionData.sessionId,
              depressionScore: result.predictedScoreDepression ? parseFloat(result.predictedScoreDepression) : 0,
              riskLevel: result.predictedScoreDepression && parseFloat(result.predictedScoreDepression) > 0.7 ? 'high' :
                        result.predictedScoreDepression && parseFloat(result.predictedScoreDepression) > 0.4 ? 'medium' : 'low',
              confidence: 0.85, // This would come from the API in a real scenario
              insights: [
                'Analysis completed using Kintsugi Health API',
                result.predictedScoreDepression ? `Depression score: ${result.predictedScoreDepression}` : '',
                result.predictedScoreAnxiety ? `Anxiety score: ${result.predictedScoreAnxiety}` : '',
                'Results should be reviewed by a qualified healthcare professional'
              ].filter(insight => insight.trim() !== ''),
              timestamp: result.updatedAt,
              audioUrl: audioUrl,
              rawApiResponse: result // Store the complete API response
            };
            
            // Update session data with final analysis results (fire-and-forget)
            const finalSessionData = {
              ...initialSessionData,
              audioUrl: audioUrl,
              prediction: result, // Store the complete API response
              analysisResults: {
                depressionScore: result.predictedScoreDepression ? parseFloat(result.predictedScoreDepression) : undefined,
                anxietyScore: result.predictedScoreAnxiety ? parseFloat(result.predictedScoreAnxiety) : undefined,
                riskLevel: result.predictedScoreDepression && parseFloat(result.predictedScoreDepression) > 0.7 ? 'high' :
                          result.predictedScoreDepression && parseFloat(result.predictedScoreDepression) > 0.4 ? 'medium' : 'low',
                confidence: 0.85, // This would come from the API in a real scenario
                insights: [
                  'Analysis completed using Kintsugi Health API',
                  result.predictedScoreDepression ? `Depression score: ${result.predictedScoreDepression}` : '',
                  result.predictedScoreAnxiety ? `Anxiety score: ${result.predictedScoreAnxiety}` : '',
                  'Results should be reviewed by a qualified healthcare professional'
                ].filter(insight => insight.trim() !== ''),
                completedAt: new Date().toISOString()
              },
              status: 'completed',
              completedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            // Save analysis results to session storage (async, non-blocking)
            apiService.saveSessionData(finalSessionData)
              .then((result) => {
                console.log('Multi-file session data saved with analysis results for session:', sessionData.sessionId);
                console.log('Save result:', result);
                addToast('success', 'Session Saved', 'Analysis results have been saved to session storage.');
              })
              .catch((error) => {
                console.error('Failed to save multi-file analysis results to session storage:', error);
                console.error('Session data that failed to save:', finalSessionData);
                addToast('warning', 'Save Warning', 'Analysis completed but failed to save to session storage. Results are still available.');
              });
              
            setProcessingProgress(prev => ({
              ...prev,
              [fileId]: { stage: 'complete', progress: 100, message: 'Analysis complete!' }
            }));
            setResults(prev => ({
              ...prev,
              [fileId]: analysisResult
            }));
            resolve();
          },
          (error: AppError) => {
            reject(error);
          }
        );
      });

    } catch (err) {
      console.error(`Error processing file ${fileId}:`, err);
      
      // Extract error details for enhanced error display
      let errorCode = 'UNKNOWN_ERROR';
      let errorMessage = 'An unexpected error occurred';
      let errorDetails: Record<string, unknown> = {};

      if (err && typeof err === 'object') {
        // Handle AppError interface
        if ('code' in err && typeof err.code === 'string') {
          errorCode = err.code;
        }
        if ('message' in err && typeof err.message === 'string') {
          errorMessage = err.message;
        }
        if ('details' in err && typeof err.details === 'object') {
          errorDetails = err.details as Record<string, unknown>;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
        errorCode = err.name || 'ERROR';
      }

      // Attempt to find and cleanup uploaded file if it exists
      // The file name should follow the pattern we used: `${userMetadata.userId}_${sessionId}_${timestamp}.wav`
      try {
        // Try to extract session ID from error context or generate cleanup pattern
        const currentProgress = processingProgress[fileId];
        if (currentProgress && (currentProgress.stage === 'uploading' || 
                              currentProgress.stage === 'submitting' || 
                              currentProgress.stage === 'analyzing')) {
          // File was likely uploaded, attempt cleanup with pattern matching
          const fileName = `${userMetadata.userId}_*_*.wav`; // Pattern for potential cleanup
          // Note: In a real implementation, you'd want to track the exact fileName
          // For now, log the cleanup attempt
          console.log(`Attempting cleanup for file pattern: ${fileName}`);
        }
      } catch (cleanupError) {
        console.warn('Error during cleanup attempt:', cleanupError);
      }

      setProcessingProgress(prev => ({
        ...prev,
        [fileId]: { 
          stage: 'error', 
          progress: 0, 
          message: 'Processing failed',
          error: {
            code: errorCode,
            message: errorMessage,
            details: errorDetails
          }
        }
      }));
      throw err; // Re-throw to be handled by the calling function
    }
  }, [userMetadata.userId, buildMetadata, apiService, uploadToAzureBlob, convertAudioToWav, addToast]);

  const processMultipleFiles = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    
    // Validate metadata once for all files
    const validationErrors = validateMetadata();
    if (validationErrors.length > 0) {
      setError(`Validation error: ${validationErrors.join(', ')}`);
      addToast('error', 'Validation Error', validationErrors.join(', '));
      setIsProcessing(false);
      return;
    }

    // Only process files that are in 'ready' state
    const filesToProcess = audioFiles.filter(file => fileStates[file.id] === 'ready');
    
    if (filesToProcess.length === 0) {
      addToast('info', 'No Files Ready', 'No files are ready to process');
      setIsProcessing(false);
      return;
    }

    const totalFiles = filesToProcess.length;
    let completedFiles = 0;

    try {
      for (const audioFile of filesToProcess) {
        completedFiles++;
        addToast('info', 'Processing File', `Processing ${audioFile.file.name} (${completedFiles}/${totalFiles})`);
        
        // Set file state to processing
        setFileStates(prev => ({ ...prev, [audioFile.id]: 'processing' }));
        
        try {
          await processSingleFileById(audioFile.id, audioFile);
          setFileStates(prev => ({ ...prev, [audioFile.id]: 'complete' }));
          addToast('success', 'File Complete', `${audioFile.file.name} processed successfully`);
        } catch (error) {
          // Extract detailed error information
          let errorCode = 'FILE_PROCESSING_ERROR';
          let errorMessage = 'An unexpected error occurred';
          let errorDetails: Record<string, unknown> = {};

          if (error && typeof error === 'object') {
            if ('code' in error && typeof error.code === 'string') {
              errorCode = error.code;
            }
            if ('message' in error && typeof error.message === 'string') {
              errorMessage = error.message;
            }
            if ('details' in error && typeof error.details === 'object') {
              errorDetails = error.details as Record<string, unknown>;
            }
          } else if (error instanceof Error) {
            errorMessage = error.message;
            errorCode = error.name || 'ERROR';
          }

          addToast('error', 'File Failed', `Failed to process ${audioFile.file.name}: ${errorMessage}`);
          
          // Set error state for this file with detailed error information
          setFileStates(prev => ({ ...prev, [audioFile.id]: 'error' }));
          setProcessingProgress(prev => ({
            ...prev,
            [audioFile.id]: { 
              stage: 'error', 
              progress: 0, 
              message: `Failed: ${errorMessage}`,
              error: {
                code: errorCode,
                message: errorMessage,
                details: errorDetails
              }
            }
          }));
        }
      }
      
      addToast('success', 'Batch Complete', `Processed ${completedFiles} file${completedFiles !== 1 ? 's' : ''}`);
      announceToScreenReader(`Batch processing complete. ${completedFiles} files processed.`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      addToast('error', 'Batch Failed', errorMessage);
      announceToScreenReader(`Error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  }, [audioFiles, fileStates, validateMetadata, addToast, announceToScreenReader, processSingleFileById]);

  const startSingleFile = useCallback(async (fileId: string) => {
    const audioFile = audioFiles.find(f => f.id === fileId);
    if (!audioFile) return;

    // Validate metadata
    const validationErrors = validateMetadata();
    if (validationErrors.length > 0) {
      setError(`Validation error: ${validationErrors.join(', ')}`);
      addToast('error', 'Validation Error', validationErrors.join(', '));
      return;
    }

    setFileStates(prev => ({ ...prev, [fileId]: 'processing' }));
    
    try {
      await processSingleFileById(fileId, audioFile);
      setFileStates(prev => ({ ...prev, [fileId]: 'complete' }));
      addToast('success', 'File Complete', `${audioFile.file.name} processed successfully`);
    } catch (error) {
      console.error(`Error processing ${audioFile.file.name}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      addToast('error', 'File Failed', `Failed to process ${audioFile.file.name}: ${errorMessage}`);
      setFileStates(prev => ({ ...prev, [fileId]: 'error' }));
      setProcessingProgress(prev => ({
        ...prev,
        [fileId]: { stage: 'error', progress: 0, message: `Failed: ${errorMessage}` }
      }));
    }
  }, [audioFiles, validateMetadata, addToast, processSingleFileById]);

  const processSingleFile = useCallback(async () => {
    if (!audioFile || !userMetadata.userId.trim()) {
      setError('Please select an audio file. User ID is automatically generated.');
      addToast('error', 'Missing Information', 'Please select an audio file. User ID is automatically generated.');
      return;
    }

    // Validate metadata
    const validationErrors = validateMetadata();
    if (validationErrors.length > 0) {
      setError(`Validation error: ${validationErrors.join(', ')}`);
      addToast('error', 'Validation Error', validationErrors.join(', '));
      return;
    }

    try {
      setError(null);
      
      // Step 1: Initiate session
      setProgress({ stage: 'initiating', progress: 5, message: 'Initiating session...' });
      announceToScreenReader('Starting analysis process - initiating session');

      const metadata = buildMetadata();
      const sessionRequest: any = {
        userid: userMetadata.userId.trim(),
        is_initiated: true
      };

      // Only include metadata if we have any
      if (metadata) {
        sessionRequest.metadata = metadata;
      }

      const sessionResponse = await apiService.initiateSession(sessionRequest);

      const sessionData: SessionInfo = {
        sessionId: sessionResponse.sessionId,
        userId: userMetadata.userId.trim()
      };

      // Save initial session data to blob storage so it appears in Analysis Sessions UI
      setProgress({ stage: 'initiating', progress: 10, message: 'Saving session data...' });

      const initialSessionData = {
        sessionId: sessionResponse.sessionId,
        userId: getAuthenticatedUserId(), // Use authenticated user ID for proper folder structure
        userMetadata: metadata,
        audioFileName: audioFile.file.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'initiated'
      };

      try {
        console.log('Attempting to save session data (single-file):', initialSessionData);
        const saveResult = await apiService.saveSessionData(initialSessionData);
        console.log('Session data saved successfully (single-file):', saveResult);
      } catch (error) {
        console.error('Failed to save session data (single-file):', error);
        console.error('Session data that failed to save:', initialSessionData);
        addToast('warning', 'Session Save Warning', 'Session data could not be saved to storage, but processing will continue.');
        // Continue with the process even if saving fails
        // This is not critical for the main workflow, but user should be informed
      }

      setProgress({ stage: 'converting', progress: 15, message: 'Converting audio to required format...' });
      announceToScreenReader('Session created successfully, now converting audio');

      // Step 2: Convert audio using FFmpeg
      const convertedBlob = await convertAudioToWav(audioFile.file, (progressPercent: number) => {
        setProgress({
          stage: 'converting',
          progress: 15 + (progressPercent * 0.25), // 15-40% for conversion
          message: `Converting audio... ${Math.round(progressPercent)}%`
        });
      });

      setProgress({ stage: 'uploading', progress: 40, message: 'Uploading to Azure Blob Storage...' });
      announceToScreenReader('Audio converted successfully, now uploading');

      // Step 3: Upload to Azure Blob Storage
      const fileName = `${userMetadata.userId}_${sessionData.sessionId}_${Date.now()}.wav`;
      const audioUrl = await uploadToAzureBlob(convertedBlob, fileName, (progressPercent: number) => {
        setProgress({
          stage: 'uploading',
          progress: 40 + (progressPercent * 0.25), // 40-65% for upload
          message: `Uploading... ${Math.round(progressPercent)}%`
        });
      }, getAuthenticatedUserId()); // Use authenticated user ID for blob storage folder structure

      setProgress({ stage: 'submitting', progress: 65, message: 'Submitting for analysis...' });
      announceToScreenReader('Upload complete, submitting for behavioral health analysis');

      // Update session data with audio information
      try {
        const updatedSessionData = {
          ...initialSessionData,
          audioUrl: audioUrl,
          audioFileName: fileName,
          status: 'processing',
          updatedAt: new Date().toISOString()
        };
        await apiService.updateSessionData(sessionData.sessionId, updatedSessionData);
      } catch (error) {
        console.warn('Failed to update session data with audio info:', error);
        // Continue with the process even if updating fails
      }

      // Step 4: Submit prediction with URL to /predictions/submit endpoint
      await apiService.submitPrediction({
        userId: userMetadata.userId.trim(),
        sessionid: sessionData.sessionId,
        audioFileUrl: audioUrl,
        audioFileName: fileName
      });

      setProgress({ stage: 'analyzing', progress: 70, message: 'Analyzing audio with Kintsugi Health API...' });
      announceToScreenReader('Prediction submitted, analysis in progress');

      // Step 5: Poll for results
      const poller = new PredictionPoller(sessionData.sessionId);
      
      await new Promise<void>((resolve, reject) => {
        poller.start(
          (result: PredictionResult) => {
            // Update progress during polling
            const progressPercent = result.status === 'processing' ? 80 : 
                                  result.status === 'success' ? 95 : 70;
            setProgress({ 
              stage: 'analyzing', 
              progress: progressPercent, 
              message: `Analysis ${result.status}...` 
            });

            // Check for predict_error and show toast
            if (result.predictError) {
              addToast('error', 'Prediction Error', 
                `${result.predictError.error}: ${result.predictError.message}`);
            }
          },
          (result: PredictionResult) => {
            // Check for final errors before completing
            if (result.predictError) {
              addToast('error', 'Analysis Failed', 
                `The analysis completed with an error: ${result.predictError.error} - ${result.predictError.message}`);
              setProgress({ stage: 'error', progress: 0, message: 'Analysis failed with errors' });
              reject(new Error(`Prediction error: ${result.predictError.error}`));
              return;
            }

            // Analysis complete successfully
            const analysisResult: AnalysisResult = {
              sessionId: sessionData.sessionId,
              depressionScore: result.predictedScoreDepression ? parseFloat(result.predictedScoreDepression) : 0,
              riskLevel: result.predictedScoreDepression && parseFloat(result.predictedScoreDepression) > 0.7 ? 'high' :
                        result.predictedScoreDepression && parseFloat(result.predictedScoreDepression) > 0.4 ? 'medium' : 'low',
              confidence: 0.85, // This would come from the API in a real scenario
            insights: [
              'Analysis completed using Kintsugi Health API',
              result.predictedScoreDepression ? `Depression score: ${result.predictedScoreDepression}` : '',
              result.predictedScoreAnxiety ? `Anxiety score: ${result.predictedScoreAnxiety}` : '',
              'Results should be reviewed by a qualified healthcare professional'
            ].filter(insight => insight.trim() !== ''),
            timestamp: result.updatedAt,
            audioUrl: audioUrl,
            rawApiResponse: result // Store the complete API response
          };
          
          // Update session data with final analysis results (fire-and-forget)
          const finalSessionData = {
            ...initialSessionData,
            audioUrl: audioUrl,
            prediction: result, // Store the complete API response
            analysisResults: {
              depressionScore: result.predictedScoreDepression ? parseFloat(result.predictedScoreDepression) : undefined,
              anxietyScore: result.predictedScoreAnxiety ? parseFloat(result.predictedScoreAnxiety) : undefined,
              riskLevel: result.predictedScoreDepression && parseFloat(result.predictedScoreDepression) > 0.7 ? 'high' :
                        result.predictedScoreDepression && parseFloat(result.predictedScoreDepression) > 0.4 ? 'medium' : 'low',
              confidence: 0.85, // This would come from the API in a real scenario
              insights: [
                'Analysis completed using Kintsugi Health API',
                result.predictedScoreDepression ? `Depression score: ${result.predictedScoreDepression}` : '',
                result.predictedScoreAnxiety ? `Anxiety score: ${result.predictedScoreAnxiety}` : '',
                'Results should be reviewed by a qualified healthcare professional'
              ].filter(insight => insight.trim() !== ''),
              completedAt: new Date().toISOString()
            },
            status: 'completed',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          // Save analysis results to session storage (async, non-blocking)
          apiService.saveSessionData(finalSessionData)
            .then((result) => {
              console.log('Session data saved with analysis results for session:', sessionData.sessionId);
              console.log('Save result:', result);
              addToast('success', 'Session Saved', 'Analysis results have been saved to session storage.');
            })
            .catch((error) => {
              console.error('Failed to save analysis results to session storage:', error);
              console.error('Session data that failed to save:', finalSessionData);
              addToast('warning', 'Save Warning', 'Analysis completed but failed to save to session storage. Results are still available.');
            });
            
          setProgress({ stage: 'complete', progress: 100, message: 'Analysis complete!' });
          setResult(analysisResult);
          addToast('success', 'Analysis Complete', 'Your behavioral health analysis has been completed successfully.');
          announceToScreenReader('Behavioral health analysis completed successfully');
          resolve();
          },
          (error: AppError) => {
            addToast('error', 'Analysis Error', error.message || 'An unexpected error occurred during analysis.');
            reject(error);
          }
        );
      });

    } catch (err) {
      console.error('Processing error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      setProgress({ stage: 'error', progress: 0, message: 'Processing failed' });
      addToast('error', 'Processing Failed', errorMessage);
      announceToScreenReader(`Error: ${errorMessage}`);
    }
  }, [audioFile, userMetadata.userId, announceToScreenReader, validateMetadata, buildMetadata]);

  const getProgressColor = useCallback((stage: string) => {
    switch (stage) {
      case 'error': return 'processing-progress__fill--error';
      case 'complete': return 'processing-progress__fill--success';
      default: return ''; // Use default blue color from CSS
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header with Dark Mode Toggle and Mode Switcher */}
      <div className="text-center">
        <div className="flex justify-between items-center mb-6">
          {/* Mode Switcher */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Processing Mode:</span>
              <div className="relative inline-flex items-center">
                <button type="button"
                  onClick={toggleMode}
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                    isMultiMode 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500'
                  }`}
                  aria-label={`Switch to ${isMultiMode ? 'single file' : 'multi-file'} mode`}
                >
                  <span
                    className={`inline-flex h-6 w-6 transform rounded-full bg-white items-center justify-center transition-transform ${
                      isMultiMode ? 'translate-x-9' : 'translate-x-1'
                    }`}
                  >
                    {isMultiMode ? (
                      <Files className="h-3 w-3 text-blue-600" />
                    ) : (
                      <File className="h-3 w-3 text-gray-600" />
                    )}
                  </span>
                </button>
                <div className="ml-3 flex items-center space-x-4">
                  <span className={`text-sm font-medium ${!isMultiMode ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    Single
                  </span>
                  <span className={`text-sm font-medium ${isMultiMode ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    Multi
                  </span>
                </div>
              </div>
            </div>
            
            {/* Status Badge */}
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              isMultiMode 
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            }`}>
              {isMultiMode ? (
                <>
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  Batch Processing
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clipRule="evenodd" />
                  </svg>
                  Single File
                </>
              )}
            </div>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Upload & Analyze Audio
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Upload {isMultiMode ? 'multiple audio files' : 'an audio file'} for behavioral health analysis using AI-powered speech pattern recognition
        </p>
        
        {/* Mode Description */}
        <div className={`inline-flex items-center px-4 py-2 rounded-lg text-sm ${
          isMultiMode 
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
            : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
        }`}>
          {isMultiMode ? (
            <>
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
              </svg>
              Process multiple files with individual controls and batch options
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Upload and analyze one file at a time with detailed progress tracking
            </>
          )}
        </div>
      </div>

      {/* User Metadata Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Patient Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              User ID (Auto-generated, editable)
            </label>
            <input
              type="text"
              id="userId"
              value={userMetadata.userId}
              onChange={(e) => setUserMetadata(prev => ({ ...prev, userId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Auto-generated user ID"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Unique identifier for API calls. Auto-generated but can be customized.
            </p>
          </div>

          <div>
            <label htmlFor="age" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Age (Optional)
            </label>
            <input
              type="number"
              id="age"
              value={userMetadata.age}
              onChange={(e) => setUserMetadata(prev => ({ ...prev, age: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Age in years"
              min="1"
              max="150"
            />
          </div>

          <div>
            <label htmlFor="weight" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Weight (Optional)
            </label>
            <input
              type="number"
              id="weight"
              value={userMetadata.weight}
              onChange={(e) => setUserMetadata(prev => ({ ...prev, weight: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Weight in lbs"
              min="1"
              max="1000"
            />
          </div>

          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gender (Optional)
            </label>
            <select
              id="gender"
              value={userMetadata.gender}
              onChange={(e) => setUserMetadata(prev => ({ ...prev, gender: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non-binary">Non-binary</option>
              <option value="transgender female">Transgender female</option>
              <option value="transgender male">Transgender male</option>
              <option value="other">Other</option>
              <option value="prefer">Prefer</option>
            </select>
          </div>

          <div>
            <label htmlFor="race" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Race (Optional)
            </label>
            <select
              id="race"
              value={userMetadata.race}
              onChange={(e) => setUserMetadata(prev => ({ ...prev, race: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select race</option>
              <option value="white">White</option>
              <option value="black or african-american">Black or African-American</option>
              <option value="asian">Asian</option>
              <option value="american indian or alaskan native">American Indian or Alaskan Native</option>
              <option value="native Hawaiian or pacific islander">Native Hawaiian or Pacific Islander</option>
              <option value="two or more races">Two or more races</option>
              <option value="other">Other</option>
              <option value="prefer not to say">Prefer not to say</option>
            </select>
          </div>

          <div>
            <label htmlFor="ethnicity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ethnicity (Optional)
            </label>
            <select
              id="ethnicity"
              value={userMetadata.ethnicity}
              onChange={(e) => setUserMetadata(prev => ({ ...prev, ethnicity: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select ethnicity</option>
              <option value="Hispanic, Latino, or Spanish Origin">Hispanic, Latino, or Spanish Origin</option>
              <option value="Not Hispanic, Latino, or Spanish Origin">Not Hispanic, Latino, or Spanish Origin</option>
            </select>
          </div>

          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Primary Language (Optional)
            </label>
            <select
              id="language"
              value={userMetadata.language}
              onChange={(e) => setUserMetadata(prev => ({ ...prev, language: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select language</option>
              <option value="true">English</option>
              <option value="false">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="zipcode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ZIP Code (Optional)
            </label>
            <input
              type="text"
              id="zipcode"
              value={userMetadata.zipcode}
              onChange={(e) => setUserMetadata(prev => ({ ...prev, zipcode: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Enter ZIP code"
              pattern="[0-9]{5}(-[0-9]{4})?"
              title="Enter a valid ZIP code (e.g., 12345 or 12345-6789)"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <label htmlFor="sessionNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Session Notes (Optional)
            </label>
            <textarea
              id="sessionNotes"
              value={userMetadata.sessionNotes}
              onChange={(e) => setUserMetadata(prev => ({ ...prev, sessionNotes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder="Additional notes about this session or patient context"
            />
          </div>
        </div>
      </div>

      {/* File Upload Area */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Audio File Upload {isMultiMode && <span className="text-sm font-normal text-gray-500 dark:text-gray-400">(Multi-File Mode)</span>}
        </h2>
        
        {(!isMultiMode && !audioFile) || (isMultiMode && audioFiles.length === 0) ? (
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" aria-hidden="true" />
            <div className="mb-4">
              <button type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                Select Audio File{isMultiMode ? 's' : ''}
              </button>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                or drag and drop {isMultiMode ? 'files' : 'file'} here
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Supported formats: WAV, MP3, M4A, AAC, FLAC (max 50MB each)
              {isMultiMode && <br />}
              {isMultiMode && 'You can select multiple files at once'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".wav,.mp3,.m4a,.aac,.flac,audio/*"
              onChange={handleFileSelect}
              multiple={isMultiMode}
              aria-label={`Select audio file${isMultiMode ? 's' : ''} for analysis`}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Single File Display */}
            {!isMultiMode && audioFile && (
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Volume2 className="h-5 w-5 text-blue-500" aria-hidden="true" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {audioFile.file.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {(audioFile.file.size / 1024 / 1024).toFixed(2)} MB
                        {audioFile.duration && ` • ${formatTime(audioFile.duration)}`}
                      </p>
                    </div>
                  </div>
                  <button type="button"
                    onClick={resetState}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    aria-label="Remove selected file"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Audio Player */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <button type="button"
                      onClick={handlePlayPause}
                      className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                      aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
                    >
                      {isPlaying ? (
                        <Pause className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Play className="h-5 w-5 ml-0.5" aria-hidden="true" />
                      )}
                    </button>
                    <div className="flex-1">
                      {audioFile.duration && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {formatTime(currentTime)} / {formatTime(audioFile.duration)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {audioFile.duration && (
                    <div className="audio-progress">
                      <div
                        className="audio-progress__fill progress-animated"
                        style={{ width: `${(currentTime / audioFile.duration) * 100}%` }}
                        role="progressbar"
                        aria-label="Audio playback progress"
                        aria-valuenow={currentTime}
                        aria-valuemin={0}
                        aria-valuemax={audioFile.duration}
                      />
                    </div>
                  )}
                </div>

                <audio
                  ref={audioRef}
                  src={audioFile.url}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="hidden"
                />
              </div>
            )}

            {/* Multi-File Display */}
            {isMultiMode && audioFiles.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Selected Files ({audioFiles.length})
                  </h3>
                  <button type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add More Files
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {audioFiles.map((file) => {
                    const fileState = fileStates[file.id] || 'ready';
                    const progress = processingProgress[file.id];
                    
                    return (
                      <div key={file.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <Volume2 className="h-4 w-4 text-blue-500 flex-shrink-0" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {file.file.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {(file.file.size / 1024 / 1024).toFixed(2)} MB
                                {file.duration && ` • ${formatTime(file.duration)}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {/* Start button for individual file */}
                            {fileState === 'ready' && (
                              <button type="button"
                                onClick={() => startSingleFile(file.id)}
                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800"
                                aria-label={`Start processing ${file.file.name}`}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Start
                              </button>
                            )}
                            {fileState === 'processing' && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                Processing...
                              </span>
                            )}
                            {fileState === 'complete' && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Complete
                              </span>
                            )}
                            {fileState === 'error' && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                <X className="h-3 w-3 mr-1" />
                                Error
                              </span>
                            )}
                            <button type="button"
                              onClick={() => removeAudioFile(file.id)}
                              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                              aria-label={`Remove ${file.file.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Processing status for this file */}
                        {progress && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 dark:text-gray-400">
                                {progress.message}
                              </span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {Math.round(progress.progress)}%
                              </span>
                            </div>
                            <div className="processing-progress mt-1">
                              <div
                                className={`processing-progress__fill progress-animated ${getProgressColor(progress.stage)}`}
                                style={{ width: `${progress.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".wav,.mp3,.m4a,.aac,.flac,audio/*"
                  onChange={handleFileSelect}
                  multiple={isMultiMode}
                  aria-label="Select additional audio files for analysis"
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4" role="alert">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" aria-hidden="true" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Progress Display - Only show in single-file mode */}
      {!isMultiMode && progress.stage !== 'idle' && !result && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Processing Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {progress.message}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {Math.round(progress.progress)}%
              </span>
            </div>
            <div className="processing-progress">
              <div
                className={`processing-progress__fill progress-animated ${getProgressColor(progress.stage)}`}
                style={{ width: `${progress.progress}%` }}
                role="progressbar"
                aria-label="Processing progress"
                aria-valuenow={progress.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            {progress.stage === 'analyzing' && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
                This may take a few minutes...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="h-6 w-6 text-green-500 mr-2" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Analysis Results
            </h3>
          </div>
          
          {/* Raw API Response */}
          {result.rawApiResponse && (
            <div className="mb-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">API Response Details</h4>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border">
                <div className="space-y-3">
                  {/* Predicted Scores */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Predicted Scores</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Depression:</span>
                        <span className="font-mono text-gray-900 dark:text-white">{result.rawApiResponse.predicted_score_depression || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Anxiety:</span>
                        <span className="font-mono text-gray-900 dark:text-white">{result.rawApiResponse.predicted_score_anxiety || 'N/A'}</span>
                      </div>
                      {/* Note: Overall predicted_score is deprecated and no longer displayed */}
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Status:</span>
                        <span className={`font-mono ${result.rawApiResponse.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {result.rawApiResponse.status || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Model Information */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Model Information</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Category:</span>
                        <span className="font-mono text-gray-900 dark:text-white">{result.rawApiResponse.model_category || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Granularity:</span>
                        <span className="font-mono text-gray-900 dark:text-white">{result.rawApiResponse.model_granularity || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Calibrated:</span>
                        <span className={`font-mono ${result.rawApiResponse.is_calibrated ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                          {result.rawApiResponse.is_calibrated ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actual Scores (if available) */}
                  {result.rawApiResponse.actual_score && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Clinical Assessment Scores</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {result.rawApiResponse.actual_score.depression_binary !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Depression Binary:</span>
                            <span className="font-mono text-gray-900 dark:text-white">
                              {result.rawApiResponse.actual_score.depression_binary || 'N/A'}
                            </span>
                          </div>
                        )}
                        {result.rawApiResponse.actual_score.anxiety_binary !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Anxiety Binary:</span>
                            <span className="font-mono text-gray-900 dark:text-white">
                              {result.rawApiResponse.actual_score.anxiety_binary || 'N/A'}
                            </span>
                          </div>
                        )}
                        {result.rawApiResponse.actual_score.phq_9 && result.rawApiResponse.actual_score.phq_9.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">PHQ-9:</span>
                            <span className="font-mono text-gray-900 dark:text-white">
                              [{result.rawApiResponse.actual_score.phq_9.join(', ')}]
                            </span>
                          </div>
                        )}
                        {result.rawApiResponse.actual_score.phq_2 && result.rawApiResponse.actual_score.phq_2.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">PHQ-2:</span>
                            <span className="font-mono text-gray-900 dark:text-white">
                              [{result.rawApiResponse.actual_score.phq_2.join(', ')}]
                            </span>
                          </div>
                        )}
                        {result.rawApiResponse.actual_score.gad_7 && result.rawApiResponse.actual_score.gad_7.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">GAD-7:</span>
                            <span className="font-mono text-gray-900 dark:text-white">
                              [{result.rawApiResponse.actual_score.gad_7.join(', ')}]
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Timeline</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Created:</span>
                        <span className="font-mono text-gray-900 dark:text-white text-xs">
                          {result.rawApiResponse.created_at ? new Date(result.rawApiResponse.created_at).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Updated:</span>
                        <span className="font-mono text-gray-900 dark:text-white text-xs">
                          {result.rawApiResponse.updated_at ? new Date(result.rawApiResponse.updated_at).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Session Information */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Session Information</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Session ID:</span>
                        <span className="font-mono text-gray-900 dark:text-white text-xs">
                          {result.sessionId}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Error Information (if present) */}
                  {result.rawApiResponse.predict_error && (
                    <div className="border-l-4 border-red-400 bg-red-50 dark:bg-red-900/20 p-3">
                      <h5 className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Prediction Error</h5>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-red-600 dark:text-red-400">Error Type:</span>
                          <span className="font-mono text-red-900 dark:text-red-100">{result.rawApiResponse.predict_error.error}</span>
                        </div>
                        <div className="text-red-700 dark:text-red-300">
                          <span className="font-medium">Message:</span> {result.rawApiResponse.predict_error.message}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Raw JSON Toggle */}
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                      View Raw JSON Response
                    </summary>
                    <div className="mt-2 bg-gray-100 dark:bg-gray-800 rounded p-3 overflow-auto">
                      <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        {JSON.stringify(result.rawApiResponse, null, 2)}
                      </pre>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          )}

          {result.insights && result.insights.length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Clinical Insights</h4>
              <ul className="space-y-1">
                {result.insights.map((insight, index) => (
                  <li key={index} className="text-gray-600 dark:text-gray-400 text-sm">
                    • {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex space-x-3">
            <button type="button"
              onClick={resetState}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
            >
              Analyze Another File
            </button>
          </div>
        </div>
      )}

      {/* Analyze Button */}
      {((isMultiMode && audioFiles.length > 0) || (!isMultiMode && audioFile)) && 
       !result && Object.keys(results).length === 0 && 
       progress.stage === 'idle' && !isProcessing && (
        <div className="text-center">
          {isMultiMode ? (
            // Multi-file mode controls
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button type="button"
                  onClick={processMultipleFiles}
                  disabled={audioFiles.length === 0 || !userMetadata.userId.trim() || 
                           !audioFiles.some(file => fileStates[file.id] === 'ready')}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800"
                >
                  <Play className="h-5 w-5 mr-2" aria-hidden="true" />
                  Start All Ready Files
                  {audioFiles.filter(file => fileStates[file.id] === 'ready').length > 0 && 
                   ` (${audioFiles.filter(file => fileStates[file.id] === 'ready').length})`}
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Use individual "Start" buttons on each file for selective processing, or "Start All" to process all ready files sequentially
              </p>
            </div>
          ) : (
            // Single-file mode controls
            <div>
              <button type="button"
                onClick={processAndAnalyze}
                disabled={!audioFile || !userMetadata.userId.trim()}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-gray-800"
              >
                <Play className="h-5 w-5 mr-2" aria-hidden="true" />
                Start Analysis
              </button>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This will convert, upload, and analyze your audio file
              </p>
            </div>
          )}
        </div>
      )}

      {/* Multi-File Results */}
      {isMultiMode && Object.keys(results).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="h-6 w-6 text-green-500 mr-2" aria-hidden="true" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Batch Analysis Results ({Object.keys(results).length} files)
            </h3>
          </div>

          <div className="space-y-6">
            {Object.entries(results).map(([fileId, result]) => {
              const audioFile = audioFiles.find(f => f.id === fileId);
              const progress = processingProgress[fileId];
              
              return (
                <div key={fileId} className="border dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {audioFile?.file.name || `File ${fileId}`}
                    </h4>
                    <div className="flex items-center space-x-2">
                      {progress?.stage === 'complete' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </span>
                      )}
                      {progress?.stage === 'error' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          <X className="h-3 w-3 mr-1" />
                          Error
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Error Details Section */}
                  {progress?.stage === 'error' && progress?.error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-3">
                      <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                            Error Details
                          </h4>
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div className="flex justify-between">
                                <span className="text-red-600 dark:text-red-400 font-medium">Error Code:</span>
                                <span className="font-mono text-red-900 dark:text-red-100">{progress.error.code}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-red-600 dark:text-red-400 font-medium">Error Message:</span>
                                <span className="font-mono text-red-900 dark:text-red-100 text-right">{progress.error.message}</span>
                              </div>
                            </div>
                            {progress.error.details && Object.keys(progress.error.details).length > 0 && (
                              <details className="mt-3">
                                <summary className="cursor-pointer text-sm font-medium text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100">
                                  View Additional Error Details
                                </summary>
                                <div className="mt-2 bg-red-100 dark:bg-red-900/40 rounded p-3 overflow-auto max-h-32">
                                  <pre className="text-xs text-red-800 dark:text-red-200 whitespace-pre-wrap">
                                    {JSON.stringify(progress.error.details, null, 2)}
                                  </pre>
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* API Response Summary for this file */}
                  {result.rawApiResponse && (
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {/* Note: Overall predicted_score is deprecated */}
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Depression:</span>
                          <span className="font-mono text-gray-900 dark:text-white">
                            {result.rawApiResponse.predicted_score_depression || 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Anxiety:</span>
                          <span className="font-mono text-gray-900 dark:text-white">
                            {result.rawApiResponse.predicted_score_anxiety || 'N/A'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Session Info */}
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Session ID:</span>
                            <span className="font-mono text-gray-900 dark:text-white">{result.sessionId}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Status:</span>
                            <span className="font-mono text-gray-900 dark:text-white">
                              {result.rawApiResponse.status || 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Raw JSON Toggle for this file */}
                      <details className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
                          View Raw JSON Response
                        </summary>
                        <div className="mt-2 bg-gray-100 dark:bg-gray-800 rounded p-3 overflow-auto max-h-64">
                          <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                            {JSON.stringify(result.rawApiResponse, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </div>
                  )}

                  {/* Audio Player for this file */}
                  {audioFile && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <button type="button"
                          onClick={() => {
                            const audio = document.getElementById(`audio-${fileId}`) as HTMLAudioElement;
                            if (audio.paused) {
                              // Pause all other audio elements first
                              document.querySelectorAll('audio').forEach(a => a.pause());
                              setPlayingFileId(fileId);
                              audio.play();
                            } else {
                              audio.pause();
                              setPlayingFileId(null);
                            }
                          }}
                          className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                          aria-label={playingFileId === fileId ? 'Pause audio' : 'Play audio'}
                        >
                          {playingFileId === fileId ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </button>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {audioFile.file.name} • {audioFile.duration ? `${Math.round(audioFile.duration)}s` : 'Duration unknown'}
                        </span>
                      </div>
                      <audio
                        id={`audio-${fileId}`}
                        src={audioFile.url}
                        onEnded={() => setPlayingFileId(null)}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`max-w-sm w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg border-l-4 p-4 transition-all duration-300 transform ${
                toast.type === 'error' ? 'border-red-500' :
                toast.type === 'warning' ? 'border-yellow-500' :
                toast.type === 'success' ? 'border-green-500' : 'border-blue-500'
              }`}
              role="alert"
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {toast.type === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
                  )}
                  {toast.type === 'warning' && (
                    <AlertCircle className="h-5 w-5 text-yellow-500" aria-hidden="true" />
                  )}
                  {toast.type === 'success' && (
                    <CheckCircle className="h-5 w-5 text-green-500" aria-hidden="true" />
                  )}
                  {toast.type === 'info' && (
                    <AlertCircle className="h-5 w-5 text-blue-500" aria-hidden="true" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {toast.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {toast.message}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button type="button"
                    onClick={() => removeToast(toast.id)}
                    className="inline-flex text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Close notification"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UploadAnalyze;
