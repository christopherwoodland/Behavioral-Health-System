// Enhanced Batch Processing with CSV Support - Updated: Sept 23, 2025
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Upload, Play, Pause, X, AlertCircle, CheckCircle, Loader2, Volume2, Plus, Trash2, Edit } from 'lucide-react';
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
  sessionId?: string; // Track session ID for status updates
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    uploadedFileUrl?: string; // Track uploaded file for cleanup
  };
}

type UserMetadata = {
  userId: string;
  age?: string;
  gender?: string;
  race?: string;
  ethnicity?: string;
  language?: string;
  weight?: string;
  zipcode?: string;
  sessionNotes?: string;
};

// Default user metadata for new files
const defaultUserMetadata: UserMetadata = {
  userId: '',
  age: '',
  gender: '',
  race: '',
  ethnicity: '',
  language: '',
  weight: '',
  zipcode: '',
  sessionNotes: ''
};

interface AudioFile {
  id: string;
  file: File;
  url: string;
  duration?: number;
  // Individual patient metadata for each file in batch mode
  userMetadata?: UserMetadata;
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

// CSV batch processing types
interface CsvBatchRow {
  userId: string;
  age?: string;
  gender?: string;
  race?: string;
  ethnicity?: string;
  language?: string;
  weight?: string;
  zipcode?: string;
  sessionNotes?: string;
  fileUrl: string; // URL to file in blob storage
  fileName?: string; // Optional friendly name
}

interface CsvBatchData {
  rows: CsvBatchRow[];
  fileName: string;
}

// Processing modes
type ProcessingMode = 'single' | 'batch-files' | 'batch-csv';

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

// Interface for pre-filled data from re-run functionality
interface PrefilledSessionData {
  userMetadata?: {
    age?: number;
    gender?: string;
    race?: string;
    ethnicity?: string;
    language?: boolean;
    weight?: number;
    zipcode?: string;
    sessionNotes?: string;
  };
  audioUrl?: string;
  audioFileName?: string;
  originalSessionId?: string;
}

const UploadAnalyze: React.FC = () => {
  // Auth context for user identification
  const { user } = useAuth();
  const location = useLocation();
  
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>(() => {
    const stored = getStoredProcessingMode();
    return stored ? 'batch-files' : 'single';
  });
  const [isMultiMode, setIsMultiMode] = useState(() => getStoredProcessingMode()); // Keep for backward compatibility
  
  // Update isMultiMode based on processing mode
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress>({});
  const [results, setResults] = useState<FileResults>({});
  const [fileStates, setFileStates] = useState<FileProcessingState>({});
  const [isProcessing, setIsProcessing] = useState(false);
  
  // CSV batch processing state
  const [csvBatchData, setCsvBatchData] = useState<CsvBatchData | null>(null);
  const [csvValidationErrors, setCsvValidationErrors] = useState<string[]>([]);
  const [csvProcessingProgress, setCsvProcessingProgress] = useState({
    isProcessing: false,
    currentFile: 0,
    totalFiles: 0,
    currentFileName: '',
    message: ''
  });

  // Batch files processing progress state
  const [batchProcessingProgress, setBatchProcessingProgress] = useState({
    isProcessing: false,
    currentFile: 0,
    totalFiles: 0,
    currentFileName: '',
    message: ''
  });
  
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
  
  // Get pre-filled data from location state (for re-run functionality)
  const prefilledData = location.state as PrefilledSessionData | undefined;
  
  const [userMetadata, setUserMetadata] = useState({
    userId: '', // Will be auto-generated on component mount
    age: prefilledData?.userMetadata?.age?.toString() || '',
    gender: prefilledData?.userMetadata?.gender || '',
    race: prefilledData?.userMetadata?.race || '',
    ethnicity: prefilledData?.userMetadata?.ethnicity || '',
    language: prefilledData?.userMetadata?.language?.toString() || '',
    weight: prefilledData?.userMetadata?.weight?.toString() || '',
    zipcode: prefilledData?.userMetadata?.zipcode || '',
    sessionNotes: prefilledData?.userMetadata?.sessionNotes || ''
  });
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
    timestamp: number;
  }>>([]);

  // Validation state for real-time field validation
  const [validationErrors, setValidationErrors] = useState<{
    age?: string;
    weight?: string;
    zipcode?: string;
    sessionNotes?: string;
  }>({});

  const [isCorrectingGrammar, setIsCorrectingGrammar] = useState(false);

  // Individual file metadata editing state
  const [editingFileMetadata, setEditingFileMetadata] = useState<string | null>(null);
  const [tempMetadata, setTempMetadata] = useState<UserMetadata>(defaultUserMetadata);
  
  // Validation state for individual file metadata editing
  const [tempValidationErrors, setTempValidationErrors] = useState<{
    age?: string;
    weight?: string;
    zipcode?: string;
    sessionNotes?: string;
  }>({});

  // User ID management state - REMOVED (now part of metadata)
  
  // Auto-generate user ID when component loads (for form metadata)
  useEffect(() => {
    if (!userMetadata.userId) {
      const newUserId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      setUserMetadata(prev => ({ ...prev, userId: newUserId }));
    }
  }, [userMetadata.userId]);

  // Update isMultiMode based on processing mode
  useEffect(() => {
    setIsMultiMode(processingMode !== 'single');
  }, [processingMode]);

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

  // Handle pre-filled data from re-run functionality
  useEffect(() => {
    if (prefilledData) {
      // Show a toast to inform user that data has been pre-filled
      addToast('info', 'Session Data Pre-filled', 
        `Metadata and audio file from session ${prefilledData.originalSessionId ? prefilledData.originalSessionId.slice(0, 8) + '...' : ''} have been loaded. Click "Start Analysis" to begin processing.`);
      
      // If there's an audio URL, create a virtual audio file entry
      if (prefilledData.audioUrl && prefilledData.audioFileName) {
        // Create a mock file object since we already have the URL
        const mockFile = {
          name: prefilledData.audioFileName,
          size: 0,
          type: 'audio/wav',
          lastModified: Date.now(),
          stream: () => new ReadableStream(),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
          text: () => Promise.resolve(''),
          slice: () => new Blob()
        } as File;

        const virtualAudioFile: AudioFile = {
          id: `prefilled-${Date.now()}`,
          file: mockFile,
          url: prefilledData.audioUrl,
          duration: undefined
        };
        
        if (isMultiMode) {
          setAudioFiles([virtualAudioFile]);
        } else {
          setAudioFile(virtualAudioFile);
        }
      }
    }
  }, [prefilledData, addToast, isMultiMode]); // Include dependencies

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

  const addAudioFile = useCallback((file: File, metadata?: UserMetadata) => {
    const id = generateFileId();
    const url = URL.createObjectURL(file);
    
    // Create individual userMetadata for this file
    let fileUserMetadata: UserMetadata;
    if (processingMode === 'batch-csv' && metadata) {
      // Use provided metadata for CSV mode
      fileUserMetadata = metadata;
    } else if (processingMode === 'batch-files') {
      // Generate individual metadata for batch files mode
      fileUserMetadata = {
        userId: generateFileId(),
        age: userMetadata.age,
        gender: userMetadata.gender,
        race: userMetadata.race,
        ethnicity: userMetadata.ethnicity,
        language: userMetadata.language,
        weight: userMetadata.weight,
        zipcode: userMetadata.zipcode,
        sessionNotes: userMetadata.sessionNotes
      };
    } else {
      // For single mode, use the existing userMetadata structure
      fileUserMetadata = userMetadata;
    }
    
    const audioFile: AudioFile = { id, file, url, userMetadata: fileUserMetadata };
    
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
  }, [isMultiMode, announceToScreenReader, processingMode, userMetadata]);

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

  // Individual file metadata editing
  const updateFileMetadata = useCallback((fileId: string, newMetadata: UserMetadata) => {
    if (processingMode !== 'single') {
      setAudioFiles(prev => prev.map(file => 
        file.id === fileId ? { ...file, userMetadata: newMetadata } : file
      ));
    } else if (audioFile && audioFile.id === fileId) {
      setAudioFile(prev => prev ? { ...prev, userMetadata: newMetadata } : null);
    }
  }, [processingMode, audioFile]);

  // Temp metadata validation functions for individual file editing
  const validateTempMetadata = useCallback(() => {
    const errors: string[] = [];

    // Age validation
    if (tempMetadata.age) {
      const age = parseInt(tempMetadata.age);
      if (isNaN(age) || age < 18 || age > 130) {
        errors.push('Age must be between 18 and 130');
      }
    }

    // Weight validation
    if (tempMetadata.weight) {
      const weight = parseInt(tempMetadata.weight);
      if (isNaN(weight) || weight < 10 || weight > 1000) {
        errors.push('Weight must be between 10 and 1000 pounds (lbs)');
      }
    }

    // Zipcode validation
    if (tempMetadata.zipcode) {
      const zipcodeRegex = /^[a-zA-Z0-9]{1,10}$/;
      if (!zipcodeRegex.test(tempMetadata.zipcode)) {
        errors.push('Zipcode must be alphanumeric and contain no more than 10 characters');
      }
    }

    // Session notes validation
    if (tempMetadata.sessionNotes && tempMetadata.sessionNotes.length > 500) {
      errors.push('Session notes must be 500 characters or less');
    }

    return errors;
  }, [tempMetadata]);

  // Individual field validation functions for real-time validation
  const validateAge = useCallback((value: string): string | undefined => {
    if (!value) return undefined;
    const age = parseInt(value);
    if (isNaN(age) || age < 18 || age > 130) {
      return 'Age must be between 18 and 130';
    }
    return undefined;
  }, []);

  const validateWeight = useCallback((value: string): string | undefined => {
    if (!value) return undefined;
    const weight = parseInt(value);
    if (isNaN(weight) || weight < 10 || weight > 1000) {
      return 'Weight must be between 10 and 1000 pounds (lbs)';
    }
    return undefined;
  }, []);

  const validateZipcode = useCallback((value: string): string | undefined => {
    if (!value) return undefined; // Optional field
    const zipcodeRegex = /^[0-9]{5}$/;
    if (!zipcodeRegex.test(value)) {
      return 'Zipcode must be 5 digits (e.g., 12345)';
    }
    return undefined;
  }, []);

  const validateSessionNotes = useCallback((value: string): string | undefined => {
    if (!value) return undefined;
    if (value.length > 500) {
      return 'Session notes must be 500 characters or less';
    }
    return undefined;
  }, []);

  const validateGender = useCallback((value: string): string | undefined => {
    if (!value) return undefined; // Optional field
    const validGenders = ['female', 'male', 'non-binary', 'transgender female', 'transgender male', 'other', 'prefer'];
    if (!validGenders.includes(value)) {
      return 'Please select a valid gender option';
    }
    return undefined;
  }, []);

  const validateRace = useCallback((value: string): string | undefined => {
    if (!value) return undefined; // Optional field
    const validRaces = ['white', 'black or african-american', 'asian', 'american indian or alaskan native', 'native hawaiian or pacific islander', 'two or more races', 'other', 'prefer not to say'];
    if (!validRaces.includes(value)) {
      return 'Please select a valid race option';
    }
    return undefined;
  }, []);

  const validateEthnicity = useCallback((value: string): string | undefined => {
    if (!value) return undefined; // Optional field
    return undefined;
  }, []);

  // Real-time field validation handler for temp metadata
  const handleTempFieldValidation = useCallback((field: string, value: string) => {
    let error: string | undefined;
    
    switch (field) {
      case 'age':
        error = validateAge(value);
        break;
      case 'weight':
        error = validateWeight(value);
        break;
      case 'zipcode':
        error = validateZipcode(value);
        break;
      case 'sessionNotes':
        error = validateSessionNotes(value);
        break;
      case 'gender':
        error = validateGender(value);
        break;
      case 'race':
        error = validateRace(value);
        break;
      case 'ethnicity':
        error = validateEthnicity(value);
        break;
      default:
        return;
    }

    setTempValidationErrors(prev => ({
      ...prev,
      [field]: error
    }));
  }, [validateAge, validateWeight, validateZipcode, validateSessionNotes, validateGender, validateRace, validateEthnicity]);

  // Open metadata editor for a specific file
  const openMetadataEditor = useCallback((fileId: string, currentMetadata?: UserMetadata) => {
    setEditingFileMetadata(fileId);
    setTempMetadata(currentMetadata || { ...defaultUserMetadata, userId: crypto.randomUUID() });
    setTempValidationErrors({}); // Clear validation errors when opening
  }, []);

  // Save metadata changes
  const saveMetadataChanges = useCallback(() => {
    if (editingFileMetadata) {
      // Validate temp metadata before saving
      const validationErrors = validateTempMetadata();
      
      if (validationErrors.length > 0) {
        // Show validation errors as toast messages
        validationErrors.forEach(error => {
          addToast('error', 'Validation Error', error);
        });
        return; // Don't save if there are validation errors
      }
      
      updateFileMetadata(editingFileMetadata, tempMetadata);
      setEditingFileMetadata(null);
      setTempMetadata(defaultUserMetadata);
      setTempValidationErrors({}); // Clear validation errors
    }
  }, [editingFileMetadata, tempMetadata, updateFileMetadata, validateTempMetadata, addToast]);

  // Cancel metadata editing
  const cancelMetadataEdit = useCallback(() => {
    setEditingFileMetadata(null);
    setTempMetadata(defaultUserMetadata);
    setTempValidationErrors({}); // Clear validation errors when canceling
  }, []);

  const handleCsvFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvValidationErrors(['Please select a valid CSV file']);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const rows = csvText.split('\n').filter(row => row.trim());
        
        if (rows.length < 2) {
          setCsvValidationErrors(['CSV must contain at least a header row and one data row']);
          return;
        }

        const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const requiredHeaders = ['userId', 'fileUrl'];
        const optionalHeaders = ['age', 'gender', 'race', 'ethnicity', 'language', 'weight', 'zipcode', 'sessionNotes', 'fileName'];
        
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          setCsvValidationErrors([`Missing required columns: ${missingHeaders.join(', ')}`]);
          return;
        }

        const parsedRows: CsvBatchRow[] = [];
        const errors: string[] = [];

        for (let i = 1; i < rows.length; i++) {
          const values = rows[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const row: CsvBatchRow = { userId: '', fileUrl: '' };

          headers.forEach((header, index) => {
            const value = values[index] || '';
            if (header === 'userId' || header === 'fileUrl') {
              (row as any)[header] = value;
            } else if (optionalHeaders.includes(header)) {
              (row as any)[header] = value;
            }
          });

          if (!row.userId || !row.fileUrl) {
            errors.push(`Row ${i + 1}: Missing required values for userId or fileUrl`);
          } else if (!row.fileUrl.startsWith('http')) {
            errors.push(`Row ${i + 1}: fileUrl must be a valid URL`);
          } else {
            parsedRows.push(row);
          }
        }

        if (errors.length > 0) {
          setCsvValidationErrors(errors);
          return;
        }

        setCsvBatchData({ rows: parsedRows, fileName: file.name });
        setCsvValidationErrors([]);
        announceToScreenReader(`CSV file loaded with ${parsedRows.length} valid rows`);
      } catch (error) {
        setCsvValidationErrors(['Error parsing CSV file. Please check file format.']);
      }
    };

    reader.readAsText(file);
  }, [announceToScreenReader]);

  const processCsvBatch = useCallback(async () => {
    if (!csvBatchData) return;

    const totalFiles = csvBatchData.rows.length;
    setCsvProcessingProgress({
      isProcessing: true,
      currentFile: 0,
      totalFiles,
      currentFileName: '',
      message: 'Starting CSV batch processing...'
    });

    try {
      for (let i = 0; i < csvBatchData.rows.length; i++) {
        const row = csvBatchData.rows[i];
        const filename = row.fileName || row.fileUrl.split('/').pop() || 'audio-file.wav';
        
        setCsvProcessingProgress(prev => ({
          ...prev,
          currentFile: i + 1,
          currentFileName: filename,
          message: `Processing file ${i + 1} of ${totalFiles}: ${filename}`
        }));

        try {
          // Fetch audio file from URL
          const response = await fetch(row.fileUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch audio file: ${response.statusText}`);
          }

          const blob = await response.blob();
          const file = new (window as any).File([blob], filename, { type: blob.type || 'audio/wav' }) as File;

          // Create metadata from CSV row
          const metadata: UserMetadata = {
            userId: row.userId,
            age: row.age,
            gender: row.gender,
            race: row.race,
            ethnicity: row.ethnicity,
            language: row.language,
            weight: row.weight,
            zipcode: row.zipcode,
            sessionNotes: row.sessionNotes
          };

          // Add the file with its metadata
          addAudioFile(file, metadata);
        } catch (error) {
          console.error(`Error processing CSV row for ${row.userId}:`, error);
          addToast('error', 'File Processing Error', `Failed to process ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          // Continue with other files even if one fails
        }

        // Small delay to allow UI updates
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setCsvProcessingProgress(prev => ({
        ...prev,
        message: `Successfully processed ${totalFiles} files from CSV`
      }));

      addToast('success', 'CSV Processing Complete', `Successfully loaded ${totalFiles} files from CSV for batch processing`);
      announceToScreenReader(`CSV batch processing complete. ${totalFiles} files loaded successfully.`);

    } catch (error) {
      console.error('CSV batch processing error:', error);
      addToast('error', 'CSV Processing Failed', 'An error occurred during CSV batch processing');
    } finally {
      // Reset progress after a short delay to show completion
      setTimeout(() => {
        setCsvProcessingProgress({
          isProcessing: false,
          currentFile: 0,
          totalFiles: 0,
          currentFileName: '',
          message: ''
        });
      }, 2000);
    }
  }, [csvBatchData, addAudioFile, addToast, announceToScreenReader, audioFiles]);

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

  // @ts-ignore - Will be used for backward compatibility
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

  // Safe parsing helper to handle potential NaN values
  const safeParseFloat = useCallback((value: string | undefined | null, defaultValue: number = 0): number => {
    if (!value) return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
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
      const validGenders = ['female', 'male', 'non-binary', 'transgender female', 'transgender male', 'other', 'prefer'];
      if (!validGenders.includes(userMetadata.gender)) {
        errors.push('Invalid gender. Must be: female, male, non-binary, transgender female, transgender male, other, or prefer');
      }
    }

    // Race validation
    if (userMetadata.race) {
      const validRaces = ['white', 'black or african-american', 'asian', 'american indian or alaskan native', 'native hawaiian or pacific islander', 'two or more races', 'other', 'prefer not to say'];
      if (!validRaces.includes(userMetadata.race)) {
        errors.push('Invalid race. Must be: white, black or african-american, asian, american indian or alaskan native, native hawaiian or pacific islander, two or more races, other, prefer not to say');
      }
    }

    // Ethnicity validation - optional field
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

  // Real-time field validation handler
  const handleFieldValidation = useCallback((field: string, value: string) => {
    let error: string | undefined;
    
    switch (field) {
      case 'age':
        error = validateAge(value);
        break;
      case 'weight':
        error = validateWeight(value);
        break;
      case 'zipcode':
        error = validateZipcode(value);
        break;
      case 'sessionNotes':
        error = validateSessionNotes(value);
        break;
      case 'gender':
        error = validateGender(value);
        break;
      case 'race':
        error = validateRace(value);
        break;
      case 'ethnicity':
        error = validateEthnicity(value);
        break;
      default:
        return;
    }

    setValidationErrors(prev => {
      const newErrors = {
        ...prev,
        [field]: error
      };
      
      // Check if all validation errors are cleared
      const hasAnyErrors = Object.values(newErrors).some(err => err !== undefined);
      
      // Clear global error if no field validation errors exist, or if this specific field error was cleared
      // and the global error contains validation messages
      if (!hasAnyErrors) {
        setError(null);
      } else if (error === undefined) {
        // If this specific field error was cleared, check if global error is validation-related and clear it
        setError(prevError => {
          if (prevError && prevError.toLowerCase().includes('validation')) {
            return null;
          }
          return prevError;
        });
      }
      
      return newErrors;
    });
  }, [validateAge, validateWeight, validateZipcode, validateSessionNotes, validateGender, validateRace, validateEthnicity]);

  const handleGrammarCorrection = useCallback(async () => {
    if (!userMetadata.sessionNotes.trim()) {
      return;
    }

    setIsCorrectingGrammar(true);
    try {
      const response = await apiService.correctGrammar(userMetadata.sessionNotes);
      
      // Update the session notes with the corrected text
      setUserMetadata(prev => ({
        ...prev,
        sessionNotes: response.correctedText
      }));
      
      // Show success toast
      addToast('success', 'Grammar Corrected', 'Grammar and spelling corrected successfully');
      
    } catch (error) {
      console.error('Grammar correction failed:', error);
      const appError = error as AppError;
      
      // Show error toast
      addToast('error', 'Grammar Correction Failed', appError.message || 'Failed to correct grammar. Please try again.');
    } finally {
      setIsCorrectingGrammar(false);
    }
  }, [userMetadata.sessionNotes]);

  const buildMetadata = useCallback(() => {
    const metadata: Partial<SessionMetadata> = {};
    let hasMetadata = false;

    if (userMetadata.age) {
      const ageNum = parseInt(userMetadata.age);
      if (!isNaN(ageNum)) {
        metadata.age = ageNum;
        hasMetadata = true;
      }
    }
    if (userMetadata.gender) {
      metadata.gender = userMetadata.gender as SessionMetadata['gender'];
      hasMetadata = true;
    }
    // Required fields - always include these if provided
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
    if (userMetadata.zipcode) {
      metadata.zipcode = userMetadata.zipcode;
      hasMetadata = true;
    }
    
    // Optional fields
    if (userMetadata.language === 'true' || userMetadata.language === 'false') {
      metadata.language = userMetadata.language === 'true';
      hasMetadata = true;
    }
    if (userMetadata.weight) {
      const weightNum = parseInt(userMetadata.weight);
      if (!isNaN(weightNum)) {
        metadata.weight = weightNum;
        hasMetadata = true;
      }
    }

    return hasMetadata ? metadata : undefined;
  }, [userMetadata]);

  const buildMetadataFromUserData = useCallback((userData: UserMetadata) => {
    const metadata: Partial<SessionMetadata> = {};
    let hasMetadata = false;

    // Optional fields
    if (userData.age) {
      const ageNum = parseInt(userData.age);
      if (!isNaN(ageNum)) {
        metadata.age = ageNum;
        hasMetadata = true;
      }
    }
    if (userData.weight) {
      const weightNum = parseInt(userData.weight);
      if (!isNaN(weightNum)) {
        metadata.weight = weightNum;
        hasMetadata = true;
      }
    }
    if (userData.language === 'true' || userData.language === 'false') {
      metadata.language = userData.language === 'true';
      hasMetadata = true;
    }
    
    // Required fields - always include these if provided
    if (userData.gender) {
      metadata.gender = userData.gender as SessionMetadata['gender'];
      hasMetadata = true;
    }
    if (userData.race) {
      metadata.race = userData.race as SessionMetadata['race'];
      hasMetadata = true;
    }
    if (userData.ethnicity) {
      metadata.ethnicity = userData.ethnicity as SessionMetadata['ethnicity'];
      hasMetadata = true;
    }
    if (userData.zipcode) {
      metadata.zipcode = userData.zipcode;
      hasMetadata = true;
    }

    return hasMetadata ? metadata : undefined;
  }, []);

  // Apply to All Files function for batch-files mode
  const applyToAllFiles = useCallback(() => {
    if (processingMode !== 'batch-files' || audioFiles.length === 0) {
      return;
    }

    // Apply the current userMetadata (from the main form) to all files' userMetadata
    setAudioFiles(prevFiles => 
      prevFiles.map(file => ({
        ...file,
        userMetadata: {
          userId: userMetadata.userId || file.userMetadata?.userId || crypto.randomUUID(),
          age: userMetadata.age || file.userMetadata?.age || '',
          gender: userMetadata.gender || file.userMetadata?.gender || '',
          race: userMetadata.race || file.userMetadata?.race || '',
          ethnicity: userMetadata.ethnicity || file.userMetadata?.ethnicity || '',
          language: userMetadata.language || file.userMetadata?.language || '',
          weight: userMetadata.weight || file.userMetadata?.weight || '',
          zipcode: userMetadata.zipcode || file.userMetadata?.zipcode || '',
          sessionNotes: userMetadata.sessionNotes || file.userMetadata?.sessionNotes || ''
        }
      }))
    );

    // Show success message
    addToast('success', 'Applied to All Files', 'Patient information has been applied to all uploaded files');
    announceToScreenReader('Patient information has been applied to all uploaded files');
  }, [processingMode, audioFiles, userMetadata, addToast, announceToScreenReader]);

  // Download CSV template function for batch-csv mode
  const downloadCsvTemplate = useCallback(() => {
    // Define all CSV columns
    const headers = [
      'userId',
      'fileUrl',
      'age',
      'gender',
      'race',
      'ethnicity',
      'primary language',
      'weight',
      'zipcode',
      'sessionNotes',
      'fileName'
    ];

    // Create sample rows with default patient information if available
    const sampleRows = [
      {
        userId: userMetadata.userId || 'user-sample-1',
        fileUrl: 'https://yourstorageaccount.blob.core.windows.net/audio/sample1.wav',
        age: userMetadata.age || '30',
        gender: userMetadata.gender || 'male',
        race: userMetadata.race || 'white',
        ethnicity: userMetadata.ethnicity || 'not hispanic or latino',
        'primary language': userMetadata.language === 'true' ? 'english' : userMetadata.language === 'false' ? 'other' : userMetadata.language || 'english',
        weight: userMetadata.weight || '150',
        zipcode: userMetadata.zipcode || '12345',
        sessionNotes: userMetadata.sessionNotes || 'Sample session notes',
        fileName: 'sample1.wav'
      },
      {
        userId: userMetadata.userId ? `${userMetadata.userId}-2` : 'user-sample-2',
        fileUrl: 'https://yourstorageaccount.blob.core.windows.net/audio/sample2.wav',
        age: userMetadata.age || '25',
        gender: userMetadata.gender || 'female',
        race: userMetadata.race || 'asian',
        ethnicity: userMetadata.ethnicity || 'not hispanic or latino',
        'primary language': userMetadata.language === 'true' ? 'english' : userMetadata.language === 'false' ? 'other' : userMetadata.language || 'other',
        weight: userMetadata.weight || '120',
        zipcode: userMetadata.zipcode || '54321',
        sessionNotes: userMetadata.sessionNotes || 'Another sample session',
        fileName: 'sample2.wav'
      }
    ];

    // Convert to CSV format
    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row] || '';
          // Escape values containing commas or quotes
          return value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value;
        }).join(',')
      )
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'batch-processing-template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Show success message
    addToast('success', 'CSV Template Downloaded', 'CSV template file has been downloaded with sample data');
    announceToScreenReader('CSV template file downloaded successfully');
  }, [userMetadata, addToast, announceToScreenReader]);

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

      // Use individual file metadata or fall back to shared metadata
      const fileMetadata = audioFile.userMetadata || userMetadata;
      const metadata = audioFile.userMetadata ? buildMetadataFromUserData(audioFile.userMetadata) : buildMetadata();
      
      const sessionRequest: any = {
        userid: fileMetadata.userId.trim(),
        is_initiated: true
      };

      // Only include metadata if we have any
      if (metadata) {
        sessionRequest.metadata = metadata;
      }

      const sessionResponse = await apiService.initiateSession(sessionRequest);

      const sessionData: SessionInfo = {
        sessionId: sessionResponse.sessionId,
        userId: fileMetadata.userId.trim()
      };

      // Save initial session data to blob storage so it appears in Analysis Sessions UI
      setProcessingProgress(prev => ({
        ...prev,
        [fileId]: { stage: 'initiating', progress: 10, message: 'Saving session data...', sessionId: sessionResponse.sessionId }
      }));

      const initialSessionData = {
        sessionId: sessionResponse.sessionId,
        userId: getAuthenticatedUserId(), // Use authenticated user ID for session filtering/access control
        metadata_user_id: fileMetadata.userId.trim(), // Store metadata user ID separately
        ...(metadata && { userMetadata: metadata }), // Only include userMetadata if metadata exists
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

      let audioUrl: string;
      let fileName: string;

      // Check if this is a pre-filled session with existing audio URL (re-run scenario)
      // Ensure the URL is a valid Azure Storage URL, not a blob URL
      if (audioFile.url && !audioFile.url.startsWith('blob:')) {
        // Skip conversion and upload for re-run - audio is already processed and stored
        setProcessingProgress(prev => ({
          ...prev,
          [fileId]: { stage: 'uploading', progress: 40, message: 'Using existing audio file from previous session...' }
        }));
        
        audioUrl = audioFile.url;
        fileName = audioFile.file.name;
        
        // Skip to 65% progress since conversion and upload are not needed
        setProcessingProgress(prev => ({
          ...prev,
          [fileId]: { stage: 'submitting', progress: 65, message: 'Submitting for analysis...' }
        }));
      } else {
        // Normal flow: convert and upload new audio file
        // This includes the case where audioFile.url is a blob URL (invalid for backend)
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
        fileName = `${userMetadata.userId}_${sessionData.sessionId}_${Date.now()}.wav`;
        audioUrl = await uploadToAzureBlob(convertedBlob, fileName, (progressPercent: number) => {
          setProcessingProgress(prev => ({
            ...prev,
            [fileId]: {
              stage: 'uploading',
              progress: 40 + (progressPercent * 0.25), // 40-65% for upload
              message: `Uploading... ${Math.round(progressPercent)}%`
            }
          }));
        }, getAuthenticatedUserId()); // Use authenticated user ID for blob storage folder structure
      }

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
              depressionScore: safeParseFloat(result.predictedScoreDepression, 0),
              riskLevel: (() => {
                const score = safeParseFloat(result.predictedScoreDepression, 0);
                return score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low';
              })(),
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
                depressionScore: safeParseFloat(result.predictedScoreDepression),
                anxietyScore: safeParseFloat(result.predictedScoreAnxiety),
                riskLevel: (() => {
                  const score = safeParseFloat(result.predictedScoreDepression, 0);
                  return score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low';
                })(),
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

      // Update session status to failed if session was created
      try {
        // Try to find the session data from the processing progress or session context
        const currentProgress = processingProgress[fileId];
        if (currentProgress && currentProgress.sessionId) {
          // Update session status to failed
          const failedSessionData = {
            sessionId: currentProgress.sessionId,
            userId: getAuthenticatedUserId(),
            metadata_user_id: userMetadata.userId.trim(),
            audioFileName: audioFile.file.name,
            createdAt: new Date().toISOString(), // Set as current time since we don't have original
            status: 'failed',
            updatedAt: new Date().toISOString(),
            error: {
              code: errorCode,
              message: errorMessage,
              details: errorDetails
            }
          };
          
          await apiService.updateSessionData(currentProgress.sessionId, failedSessionData);
          console.log(`Updated session ${currentProgress.sessionId} status to failed`);
        }
      } catch (updateError) {
        console.error('Failed to update session status to failed:', updateError);
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
  }, [userMetadata.userId, buildMetadata, apiService, uploadToAzureBlob, convertAudioToWav, addToast, safeParseFloat]);

  const processMultipleFiles = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    
    // For batch processing modes, validate individual file metadata if needed
    if (processingMode === 'batch-files' || processingMode === 'batch-csv') {
      // Check that all files have userMetadata
      const filesWithoutMetadata = audioFiles.filter(file => !file.userMetadata);
      if (filesWithoutMetadata.length > 0) {
        setError('Some files are missing user metadata');
        addToast('error', 'Validation Error', 'All files must have user metadata in batch mode');
        setIsProcessing(false);
        return;
      }
    } else {
      // Original validation for shared metadata mode
      const validationErrors = validateMetadata();
      if (validationErrors.length > 0) {
        setError(`Validation error: ${validationErrors.join(', ')}`);
        addToast('error', 'Validation Error', validationErrors.join(', '));
        setIsProcessing(false);
        return;
      }
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

    // Initialize batch processing progress
    setBatchProcessingProgress({
      isProcessing: true,
      currentFile: 0,
      totalFiles,
      currentFileName: '',
      message: 'Starting batch file processing...'
    });

    try {
      for (const audioFile of filesToProcess) {
        completedFiles++;
        const fileName = audioFile.file.name;
        
        // Update progress
        setBatchProcessingProgress(prev => ({
          ...prev,
          currentFile: completedFiles,
          currentFileName: fileName,
          message: `Processing file ${completedFiles} of ${totalFiles}: ${fileName}`
        }));

        addToast('info', 'Processing File', `Processing ${fileName} (${completedFiles}/${totalFiles})`);
        
        // Set file state to processing
        setFileStates(prev => ({ ...prev, [audioFile.id]: 'processing' }));
        
        try {
          await processSingleFileById(audioFile.id, audioFile);
          setFileStates(prev => ({ ...prev, [audioFile.id]: 'complete' }));
          addToast('success', 'File Complete', `${fileName} processed successfully`);
          
          // Small delay to allow UI updates and make progress visible
          await new Promise(resolve => setTimeout(resolve, 100));
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
      
      // Update progress with completion message
      setBatchProcessingProgress(prev => ({
        ...prev,
        message: `Successfully processed ${completedFiles} files`
      }));
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      addToast('error', 'Batch Failed', errorMessage);
      announceToScreenReader(`Error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
      
      // Reset batch processing progress after a short delay to show completion
      setTimeout(() => {
        setBatchProcessingProgress({
          isProcessing: false,
          currentFile: 0,
          totalFiles: 0,
          currentFileName: '',
          message: ''
        });
      }, 2000);
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
        userId: getAuthenticatedUserId(), // Use authenticated user ID for session filtering/access control
        metadata_user_id: userMetadata.userId.trim(), // Store metadata user ID separately
        ...(metadata && { userMetadata: metadata }), // Only include userMetadata if metadata exists
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

      let audioUrl: string;
      let fileName: string;

      // Check if this is a pre-filled session with existing audio URL (re-run scenario)
      // Ensure the URL is a valid Azure Storage URL, not a blob URL
      if (audioFile.url && !audioFile.url.startsWith('blob:')) {
        // Skip conversion and upload for re-run - audio is already processed and stored
        setProgress({ stage: 'uploading', progress: 40, message: 'Using existing audio file from previous session...' });
        announceToScreenReader('Session created successfully, reusing previously processed audio file');
        
        audioUrl = audioFile.url;
        fileName = audioFile.file.name;
        
        // Skip to 65% progress since conversion and upload are not needed
        setProgress({ stage: 'submitting', progress: 65, message: 'Submitting for analysis...' });
      } else {
        // Normal flow: convert and upload new audio file
        // This includes the case where audioFile.url is a blob URL (invalid for backend)
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
        fileName = `${userMetadata.userId}_${sessionData.sessionId}_${Date.now()}.wav`;
        audioUrl = await uploadToAzureBlob(convertedBlob, fileName, (progressPercent: number) => {
          setProgress({
            stage: 'uploading',
            progress: 40 + (progressPercent * 0.25), // 40-65% for upload
            message: `Uploading... ${Math.round(progressPercent)}%`
          });
        }, getAuthenticatedUserId()); // Use authenticated user ID for blob storage folder structure
      }

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
              depressionScore: safeParseFloat(result.predictedScoreDepression, 0),
              riskLevel: (() => {
                const score = safeParseFloat(result.predictedScoreDepression, 0);
                return score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low';
              })(),
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
              depressionScore: safeParseFloat(result.predictedScoreDepression),
              anxietyScore: safeParseFloat(result.predictedScoreAnxiety),
              riskLevel: (() => {
                const score = safeParseFloat(result.predictedScoreDepression, 0);
                return score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low';
              })(),
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
  }, [audioFile, userMetadata.userId, announceToScreenReader, validateMetadata, buildMetadata, safeParseFloat]);

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
              <div className="flex items-center space-x-2">
                {['single', 'batch-files', 'batch-csv'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setProcessingMode(mode as ProcessingMode);
                      setStoredProcessingMode(mode !== 'single'); // Convert to boolean for storage
                      // Clear any existing files when switching modes
                      if (mode === 'single') {
                        setAudioFiles([]);
                        setFileStates({});
                        setProcessingProgress({});
                        setResults({});
                      } else {
                        setAudioFile(null);
                      }
                      // Clear CSV data when not in CSV mode
                      if (mode !== 'batch-csv') {
                        setCsvBatchData(null);
                        setCsvValidationErrors([]);
                      }
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                      processingMode === mode
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {mode === 'single' && 'Single File'}
                    {mode === 'batch-files' && 'Batch Files'}
                    {mode === 'batch-csv' && 'CSV Batch'}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Status Badge */}
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
              processingMode === 'single'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : processingMode === 'batch-files'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
            }`}>
              {processingMode === 'single' ? (
                <>
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm12 2H4v8h12V6z" clipRule="evenodd" />
                  </svg>
                  Single File Processing
                </>
              ) : processingMode === 'batch-files' ? (
                <>
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  Batch File Processing
                </>
              ) : (
                <>
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  CSV Batch Processing
                </>
              )}
            </div>
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Upload & Analyze Audio
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Upload {processingMode === 'single' ? 'an audio file' : processingMode === 'batch-files' ? 'multiple audio files' : 'audio files via CSV'} for behavioral health analysis using AI-powered speech pattern recognition
        </p>
        
        {/* Mode Description */}
        <div className={`inline-flex items-center px-4 py-2 rounded-lg text-sm ${
          processingMode === 'single'
            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
            : processingMode === 'batch-files'
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
            : 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
        }`}>
          {processingMode === 'single' ? (
            <>
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Upload and analyze one file at a time with detailed progress tracking
            </>
          ) : processingMode === 'batch-files' ? (
            <>
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
              </svg>
              Process multiple files with individual patient metadata for each file
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Upload CSV file with patient data and blob storage URLs for batch processing
            </>
          )}
        </div>
      </div>

      {/* User Metadata Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {processingMode === 'batch-files' 
            ? 'Patient Information (Optional, Apply to All Files)' 
            : processingMode === 'batch-csv'
            ? 'Default Patient Information (Optional, Override with CSV Data)'
            : 'Patient Information (Optional)'
          }
        </h2>
        
        {/* Explanatory text for batch modes */}
        {processingMode === 'batch-files' && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> Information entered here will be applied to all uploaded files. 
              After uploading, you can click "Edit Info" on individual files to customize their metadata.
            </p>
          </div>
        )}
        
        {processingMode === 'batch-csv' && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Note:</strong> This serves as default information. Data from your CSV file will override these values for each row.
            </p>
          </div>
        )}
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
              Age
            </label>
            <input
              type="number"
              id="age"
              value={userMetadata.age}
              onChange={(e) => {
                const newValue = e.target.value;
                setUserMetadata(prev => ({ ...prev, age: newValue }));
                // Trigger validation on change for immediate feedback
                handleFieldValidation('age', newValue);
              }}
              onBlur={(e) => handleFieldValidation('age', e.target.value)}
              onKeyUp={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  handleFieldValidation('age', e.currentTarget.value);
                }
              }}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                validationErrors.age 
                  ? 'border-red-300 dark:border-red-600' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Age in years"
              min="1"
              max="150"
              aria-describedby={validationErrors.age ? "age-error" : undefined}
            />
            {validationErrors.age && (
              <p id="age-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {validationErrors.age}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="weight" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Weight
            </label>
            <input
              type="number"
              id="weight"
              value={userMetadata.weight}
              onChange={(e) => {
                const newValue = e.target.value;
                setUserMetadata(prev => ({ ...prev, weight: newValue }));
                // Trigger validation on change for immediate feedback
                handleFieldValidation('weight', newValue);
              }}
              onBlur={(e) => handleFieldValidation('weight', e.target.value)}
              onKeyUp={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  handleFieldValidation('weight', e.currentTarget.value);
                }
              }}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                validationErrors.weight 
                  ? 'border-red-300 dark:border-red-600' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Weight in lbs"
              min="1"
              max="1000"
              aria-describedby={validationErrors.weight ? "weight-error" : undefined}
            />
            {validationErrors.weight && (
              <p id="weight-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {validationErrors.weight}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Gender
            </label>
            <select
              id="gender"
              value={userMetadata.gender}
              onChange={(e) => setUserMetadata(prev => ({ ...prev, gender: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non-binary">Non-binary</option>
              <option value="other">Other</option>
              <option value="prefer">Prefer not to specify</option>
              <option value="transgender female">Transgender Female</option>
              <option value="transgender male">Transgender Male</option>
            </select>
          </div>

          <div>
            <label htmlFor="race" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Race
            </label>
            <select
              id="race"
              value={userMetadata.race}
              onChange={(e) => setUserMetadata(prev => ({ ...prev, race: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select race</option>
              <option value="american indian or alaskan native">American Indian or Alaskan Native</option>
              <option value="asian">Asian</option>
              <option value="black or african-american">Black or African-American</option>
              <option value="native hawaiian or pacific islander">Native Hawaiian or Pacific Islander</option>
              <option value="other">Other</option>
              <option value="prefer not to say">Prefer not to say</option>
              <option value="two or more races">Two or more races</option>
              <option value="white">White</option>
            </select>
          </div>

          <div>
            <label htmlFor="ethnicity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ethnicity
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
              Primary Language
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
              ZIP Code
            </label>
            <input
              type="text"
              id="zipcode"
              value={userMetadata.zipcode}
              onChange={(e) => {
                const newValue = e.target.value;
                setUserMetadata(prev => ({ ...prev, zipcode: newValue }));
                // Trigger validation on change for immediate feedback
                handleFieldValidation('zipcode', newValue);
              }}
              onBlur={(e) => handleFieldValidation('zipcode', e.target.value)}
              onKeyUp={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  handleFieldValidation('zipcode', e.currentTarget.value);
                }
              }}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                validationErrors.zipcode 
                  ? 'border-red-300 dark:border-red-600' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Enter ZIP code"
              pattern="[0-9]{5}(-[0-9]{4})?"
              title="Enter a valid ZIP code (e.g., 12345 or 12345-6789)"
              aria-describedby={validationErrors.zipcode ? "zipcode-error" : undefined}
            />
            {validationErrors.zipcode && (
              <p id="zipcode-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {validationErrors.zipcode}
              </p>
            )}
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <label htmlFor="sessionNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Session Notes
            </label>
            <textarea
              id="sessionNotes"
              value={userMetadata.sessionNotes}
              onChange={(e) => setUserMetadata(prev => ({ ...prev, sessionNotes: e.target.value }))}
              onBlur={(e) => handleFieldValidation('sessionNotes', e.target.value)}
              onKeyUp={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                  handleFieldValidation('sessionNotes', e.currentTarget.value);
                }
              }}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                validationErrors.sessionNotes 
                  ? 'border-red-300 dark:border-red-600' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              rows={3}
              placeholder="Additional notes about this session or patient context"
              aria-describedby={validationErrors.sessionNotes ? "sessionNotes-error" : undefined}
            />
            {validationErrors.sessionNotes && (
              <p id="sessionNotes-error" className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {validationErrors.sessionNotes}
              </p>
            )}
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {userMetadata.sessionNotes.length}/500 characters
              </p>
              
              {/* Grammar Correction Button - Next to character count */}
              <button
                type="button"
                onClick={() => handleGrammarCorrection()}
                disabled={!userMetadata.sessionNotes.trim() || isCorrectingGrammar}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:text-blue-300 dark:bg-blue-900/20 dark:border-blue-700 dark:hover:bg-blue-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Correct grammar and spelling in session notes"
                title="Correct grammar and spelling"
              >
                {isCorrectingGrammar ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                ) : (
                  <svg 
                    className="w-3.5 h-3.5 mr-1.5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" 
                    />
                  </svg>
                )}
                {isCorrectingGrammar ? 'Correcting...' : 'Correct Grammar'}
              </button>

              {/* Download CSV Template Button for batch-csv mode */}
              {processingMode === 'batch-csv' && (
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 hover:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 dark:text-purple-300 dark:bg-purple-900/20 dark:border-purple-700 dark:hover:bg-purple-900/30 transition-colors ml-2"
                  aria-label="Download CSV template file with sample data"
                  title="Download CSV template"
                >
                  <svg 
                    className="w-3.5 h-3.5 mr-1.5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                    />
                  </svg>
                  Download CSV Template
                </button>
              )}

              {/* Apply to All Files Button for batch-files mode */}
              {processingMode === 'batch-files' && audioFiles.length > 0 && (
                <button
                  type="button"
                  onClick={applyToAllFiles}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 hover:border-green-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 dark:text-green-300 dark:bg-green-900/20 dark:border-green-700 dark:hover:bg-green-900/30 transition-colors ml-2"
                  aria-label="Apply patient information to all uploaded files"
                  title="Apply to all files"
                >
                  <svg 
                    className="w-3.5 h-3.5 mr-1.5" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" 
                    />
                  </svg>
                  Apply to All Files
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* File Upload Area */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {processingMode === 'batch-csv' ? 'CSV File Upload' : 'Audio File Upload'} 
          {processingMode === 'batch-files' && <span className="text-sm font-normal text-gray-500 dark:text-gray-400">(Batch Files Mode)</span>}
        </h2>

        {/* CSV Upload Section */}
        {processingMode === 'batch-csv' && (
          <div className="space-y-4">
            {!csvBatchData ? (
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-purple-400 dark:hover:border-purple-500 transition-colors">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" aria-hidden="true" />
                <div className="mb-4">
                  <button type="button"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.csv';
                      input.onchange = (e) => handleCsvFileSelect(e as any);
                      input.click();
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 dark:focus:ring-offset-gray-800"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Select CSV File
                  </button>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Upload a CSV file with patient data and file URLs
                  </p>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2">
                  <p>Required columns: userId, fileUrl</p>
                  <p>Optional columns: age, gender, race, ethnicity, language, weight, zipcode, sessionNotes, fileName</p>
                  <p>Example: userId,fileUrl,age,gender,zipcode</p>
                </div>
              </div>
            ) : (
              <div className="border border-green-200 dark:border-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-medium text-green-800 dark:text-green-200">CSV Loaded Successfully</span>
                  </div>
                  <button
                    onClick={() => {
                      setCsvBatchData(null);
                      setCsvValidationErrors([]);
                    }}
                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                  {csvBatchData.rows.length} valid records found in {csvBatchData.fileName}
                </p>
                
                {/* CSV Processing Status Bar */}
                {csvProcessingProgress.isProcessing && (
                  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Processing CSV Files
                      </span>
                      <span className="text-sm text-blue-700 dark:text-blue-300">
                        {csvProcessingProgress.currentFile} of {csvProcessingProgress.totalFiles}
                      </span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mb-2">
                      <div 
                        className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${csvProcessingProgress.totalFiles > 0 ? (csvProcessingProgress.currentFile / csvProcessingProgress.totalFiles) * 100 : 0}%` 
                        }}
                        role="progressbar"
                        aria-valuenow={csvProcessingProgress.currentFile}
                        aria-valuemin={0}
                        aria-valuemax={csvProcessingProgress.totalFiles}
                        aria-label="CSV processing progress"
                      ></div>
                    </div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {csvProcessingProgress.message}
                    </p>
                    {csvProcessingProgress.currentFileName && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Current file: {csvProcessingProgress.currentFileName}
                      </p>
                    )}
                  </div>
                )}
                <button
                  onClick={processCsvBatch}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800"
                >
                  Load Audio Files from CSV
                </button>
              </div>
            )}

            {/* CSV Validation Errors */}
            {csvValidationErrors.length > 0 && (
              <div className="border border-red-200 dark:border-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="font-medium text-red-800 dark:text-red-200">CSV Validation Errors</span>
                </div>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                  {csvValidationErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Audio File Upload Section */}
        {processingMode !== 'batch-csv' && (
          <div>
            {(processingMode === 'single' && !audioFile) || (processingMode === 'batch-files' && audioFiles.length === 0) ? (
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
                Select Audio File{processingMode !== 'single' ? 's' : ''}
              </button>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                or drag and drop {processingMode !== 'single' ? 'files' : 'file'} here
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Supported formats: WAV, MP3, M4A, AAC, FLAC (max 50MB each)
              {processingMode !== 'single' && <br />}
              {processingMode !== 'single' && 'You can select multiple files at once'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".wav,.mp3,.m4a,.aac,.flac,audio/*"
              onChange={handleFileSelect}
              multiple={processingMode !== 'single'}
              aria-label={`Select audio file${processingMode !== 'single' ? 's' : ''} for analysis`}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Single File Display */}
            {processingMode === 'single' && audioFile && (
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
            {processingMode !== 'single' && audioFiles.length > 0 && (
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
                          
                          {/* Metadata summary and edit button */}
                          <div className="flex items-center space-x-2">
                            {file.userMetadata?.userId ? (
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                ID: {file.userMetadata.userId.slice(0, 8)}...
                                {file.userMetadata.age && ` • Age: ${file.userMetadata.age}`}
                                {file.userMetadata.gender && ` • ${file.userMetadata.gender}`}
                              </div>
                            ) : (
                              <div className="text-xs text-amber-600 dark:text-amber-400">
                                No metadata set
                              </div>
                            )}
                            <button
                              onClick={() => openMetadataEditor(file.id, file.userMetadata)}
                              className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:text-blue-200 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                              aria-label={`Edit metadata for ${file.file.name}`}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit Info
                            </button>
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
                                className={`processing-progress__fill ${getProgressColor(progress.stage)}`}
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
                  multiple={processingMode === 'batch-files' || processingMode === 'batch-csv'}
                  aria-label="Select additional audio files for analysis"
                />
              </>
            )}
          </div>
        )}
      </div>
      )}

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
      {processingMode === 'single' && progress.stage !== 'idle' && !result && (
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
      {(() => {
        const hasFiles = (processingMode !== 'single' && audioFiles.length > 0) || (processingMode === 'single' && audioFile);
        const csvMode = processingMode === 'batch-csv' && csvBatchData && !csvProcessingProgress.isProcessing;
        const shouldShowButton = (hasFiles || csvMode) && 
               !result && Object.keys(results).length === 0 && 
               progress.stage === 'idle' && !isProcessing;
        
        return shouldShowButton;
      })() && (
        <div className="text-center">
          {processingMode !== 'single' ? (
            // Multi-file mode controls
            <div className="space-y-4">
              {/* Batch Processing Status Bar */}
              {batchProcessingProgress.isProcessing && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-900 dark:text-green-100">
                      Processing Batch Files
                    </span>
                    <span className="text-sm text-green-700 dark:text-green-300">
                      {batchProcessingProgress.currentFile} of {batchProcessingProgress.totalFiles}
                    </span>
                  </div>
                  <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2 mb-2">
                    <div 
                      className="bg-green-600 dark:bg-green-400 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${batchProcessingProgress.totalFiles > 0 ? (batchProcessingProgress.currentFile / batchProcessingProgress.totalFiles) * 100 : 0}%` 
                      }}
                      role="progressbar"
                      aria-valuenow={batchProcessingProgress.currentFile}
                      aria-valuemin={0}
                      aria-valuemax={batchProcessingProgress.totalFiles}
                      aria-label="Batch processing progress"
                    ></div>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {batchProcessingProgress.message}
                  </p>
                  {batchProcessingProgress.currentFileName && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Current file: {batchProcessingProgress.currentFileName}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button type="button"
                  onClick={processMultipleFiles}
                  disabled={audioFiles.length === 0 || !userMetadata.userId.trim() || 
                           !audioFiles.some(file => fileStates[file.id] === 'ready') ||
                           !!error || Object.values(validationErrors).some(err => err !== undefined)}
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
                disabled={!audioFile || !userMetadata.userId.trim() || 
                         !!error || Object.values(validationErrors).some(err => err !== undefined)}
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
      {processingMode !== 'single' && Object.keys(results).length > 0 && (
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
      
      {/* Metadata Editing Modal */}
      {editingFileMetadata && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Edit Patient Metadata
                </h3>
                <button
                  onClick={cancelMetadataEdit}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="Close metadata editor"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label htmlFor="temp-userId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  User ID
                </label>
                <input
                  id="temp-userId"
                  type="text"
                  value={tempMetadata.userId}
                  onChange={(e) => setTempMetadata(prev => ({ ...prev, userId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter user ID"
                />
              </div>
              
              <div>
                <label htmlFor="temp-age" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Age
                </label>
                <input
                  id="temp-age"
                  type="number"
                  value={tempMetadata.age}
                  onChange={(e) => {
                    setTempMetadata(prev => ({ ...prev, age: e.target.value }));
                    handleTempFieldValidation('age', e.target.value);
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                    tempValidationErrors.age 
                      ? 'border-red-500 dark:border-red-400' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Enter age"
                  min="18"
                  max="130"
                />
                {tempValidationErrors.age && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {tempValidationErrors.age}
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor="temp-gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Gender
                </label>
                <select
                  id="temp-gender"
                  value={tempMetadata.gender}
                  onChange={(e) => setTempMetadata(prev => ({ ...prev, gender: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="other">Other</option>
                  <option value="prefer">Prefer not to specify</option>
                  <option value="transgender female">Transgender Female</option>
                  <option value="transgender male">Transgender Male</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="temp-race" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Race
                </label>
                <select
                  id="temp-race"
                  value={tempMetadata.race}
                  onChange={(e) => setTempMetadata(prev => ({ ...prev, race: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select race</option>
                  <option value="american indian or alaskan native">American Indian or Alaskan Native</option>
                  <option value="asian">Asian</option>
                  <option value="black or african-american">Black or African-American</option>
                  <option value="native hawaiian or pacific islander">Native Hawaiian or Pacific Islander</option>
                  <option value="other">Other</option>
                  <option value="prefer not to say">Prefer not to say</option>
                  <option value="two or more races">Two or more races</option>
                  <option value="white">White</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="temp-ethnicity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ethnicity
                </label>
                <select
                  id="temp-ethnicity"
                  value={tempMetadata.ethnicity}
                  onChange={(e) => setTempMetadata(prev => ({ ...prev, ethnicity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select ethnicity</option>
                  <option value="Hispanic, Latino, or Spanish Origin">Hispanic, Latino, or Spanish Origin</option>
                  <option value="Not Hispanic, Latino, or Spanish Origin">Not Hispanic, Latino, or Spanish Origin</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="temp-language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Primary Language
                </label>
                <select
                  id="temp-language"
                  value={tempMetadata.language}
                  onChange={(e) => setTempMetadata(prev => ({ ...prev, language: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select language</option>
                  <option value="true">English</option>
                  <option value="false">Other</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="temp-weight" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Weight (lbs)
                </label>
                <input
                  id="temp-weight"
                  type="number"
                  value={tempMetadata.weight}
                  onChange={(e) => {
                    setTempMetadata(prev => ({ ...prev, weight: e.target.value }));
                    handleTempFieldValidation('weight', e.target.value);
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                    tempValidationErrors.weight 
                      ? 'border-red-500 dark:border-red-400' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Weight in pounds"
                  min="10"
                  max="1000"
                />
                {tempValidationErrors.weight && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {tempValidationErrors.weight}
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor="temp-zipcode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ZIP Code
                </label>
                <input
                  id="temp-zipcode"
                  type="text"
                  value={tempMetadata.zipcode}
                  onChange={(e) => {
                    setTempMetadata(prev => ({ ...prev, zipcode: e.target.value }));
                    handleTempFieldValidation('zipcode', e.target.value);
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                    tempValidationErrors.zipcode 
                      ? 'border-red-500 dark:border-red-400' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="ZIP code"
                  maxLength={10}
                />
                {tempValidationErrors.zipcode && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {tempValidationErrors.zipcode}
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor="temp-sessionNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Session Notes
                </label>
                <textarea
                  id="temp-sessionNotes"
                  value={tempMetadata.sessionNotes}
                  onChange={(e) => {
                    setTempMetadata(prev => ({ ...prev, sessionNotes: e.target.value }));
                    handleTempFieldValidation('sessionNotes', e.target.value);
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white ${
                    tempValidationErrors.sessionNotes 
                      ? 'border-red-500 dark:border-red-400' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Session notes or comments"
                  rows={3}
                  maxLength={500}
                />
                {tempValidationErrors.sessionNotes && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {tempValidationErrors.sessionNotes}
                  </p>
                )}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-600 flex justify-end space-x-3">
              <button
                onClick={cancelMetadataEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={saveMetadataChanges}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default UploadAnalyze;
