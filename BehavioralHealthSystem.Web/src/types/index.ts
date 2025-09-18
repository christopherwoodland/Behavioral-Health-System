// API Types
export interface User {
  id: string;
  createdAt: string;
}

export interface SessionMetadata {
  age?: number;
  gender?: 'male' | 'female' | 'non-binary' | 'transgender female' | 'transgender male' | 'other' | 'prefer';
  race?: 'white' | 'black or african-american' | 'asian' | 'american indian or alaskan native' | 'native Hawaiian or pacific islander' | 'two or more races' | 'other' | 'prefer not to say';
  ethnicity?: 'Hispanic, Latino, or Spanish Origin' | 'Not Hispanic, Latino, or Spanish Origin';
  language?: boolean;
  weight?: number;
  zipcode?: string;
}

export interface SessionInitiateRequest {
  userid: string;
  is_initiated: boolean;
  metadata?: SessionMetadata;
}

export interface SessionInitiateResponse {
  sessionId: string;
}

export interface PredictionSubmitRequest {
  userId: string;
  sessionid: string;
  audioFileUrl: string;
  audioFileName: string;
}

export interface PredictionSubmitResponse {
  success: boolean;
  sessionId: string;
  status: string;
  message: string;
}

export interface PredictionResult {
  sessionId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'processing' | 'success';
  predictedScore?: string;
  predictedScoreAnxiety?: string;
  predictedScoreDepression?: string;
  createdAt: string;
  updatedAt: string;
  actualScore?: {
    anxietyBinary: string;
    depressionBinary: string;
  };
  predictError?: {
    error: string;
    message: string;
    additionalData?: Record<string, unknown>;
  };
}

export interface HealthCheckResponse {
  status: 'Healthy' | 'Degraded' | 'Unhealthy';
  timestamp: string;
  totalDuration?: number;
  checks?: Record<string, {
    status: string;
    description?: string;
    duration?: number;
  }>;
}

export interface SessionData {
  sessionId: string;
  userId: string; // Authenticated user ID (for session filtering/access control)
  metadata_user_id?: string; // Patient/metadata user ID
  prediction?: PredictionResult;
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
  createdAt: string;
  updatedAt: string;
  status: string;
  analysisResults?: {
    depressionScore?: number;
    anxietyScore?: number;
    riskLevel: string;
    confidence?: number;
    insights: string[];
    completedAt: string;
  };
  riskAssessment?: RiskAssessment;
}

export interface RiskAssessment {
  overallRiskLevel: string;
  riskScore: number; // 1-10 scale
  summary: string;
  keyFactors: string[];
  recommendations: string[];
  immediateActions: string[];
  followUpRecommendations: string[];
  confidenceLevel: number; // 0-1 scale
  generatedAt: string;
  modelVersion: string;
}

// UI Types
export interface AudioFile {
  file: File;
  duration?: number;
  size: number;
  type: string;
}

export interface ConversionProgress {
  stage: 'idle' | 'loading' | 'converting' | 'uploading' | 'submitting' | 'polling' | 'completed' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export interface UploadSession {
  id: string;
  fileName: string;
  status: ConversionProgress['stage'];
  createdAt: string;
  sessionId?: string;
  result?: PredictionResult;
  error?: string;
}

// Theme Types
export type Theme = 'light' | 'dark';

// Filter Types
export interface SessionFilter {
  status?: PredictionResult['status'][];
  dateRange?: {
    start: string;
    end: string;
  };
  search?: string;
}

// Audio Processing Types
export interface AudioConversionOptions {
  outputFormat: 'wav';
  sampleRate: 44100;
  channels: 1;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

// Accessibility Types
export interface A11yAnnouncement {
  message: string;
  priority: 'polite' | 'assertive';
  id: string;
}
