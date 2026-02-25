import { env } from '@/utils/env';

// Environment configuration
export const config = {
  api: {
    baseUrl: env.API_BASE_URL,
  },
  azure: {
    blobSasUrl: env.AZURE_BLOB_SAS_URL,
    containerName: env.STORAGE_CONTAINER_NAME,
  },
  polling: {
    intervalMs: env.POLL_INTERVAL_MS,
    jobIntervalMs: env.JOB_POLL_INTERVAL_MS,
    maxAttempts: 60, // 3 minutes at 3s intervals
    backoffFactor: 1.2,
  },
  features: {
    enableFFmpegWorker: env.ENABLE_FFMPEG_WORKER,
    enableDebugLogging: env.ENABLE_DEBUG_LOGGING,
  },
  audio: {
    acceptedFormats: ['.wav', '.mp3', '.m4a', '.aac', '.flac', '.mp4', '.webm', '.ogg'],
    maxFileSizeMB: 100,
    targetSampleRate: 44100,
    targetChannels: 1,
    speechEnhancement: {
      enabled: env.AUDIO_SPEECH_ENHANCEMENT_ENABLED,
    },
    silenceRemoval: {
      enabled: env.AUDIO_SILENCE_REMOVAL_ENABLED,
      thresholdDb: env.AUDIO_SILENCE_THRESHOLD_DB,
      minDuration: env.AUDIO_SILENCE_MIN_DURATION,
    },
  },
} as const;

// Storage keys
export const STORAGE_KEYS = {
  USER_ID: 'bh_user_id',
  THEME: 'bh_theme',
  UPLOAD_SESSIONS: 'bh_upload_sessions',
  PROCESSING_MODE: 'bh_processing_mode',
  USER_ID_CUSTOM: 'bh_user_id_custom',
} as const;

// API endpoints
export const API_ENDPOINTS = {
  HEALTH: '/health',
  SESSIONS_INITIATE: '/sessions/initiate-selected',
  PREDICTIONS_SUBMIT: '/predictions/submit-selected',
  PREDICTIONS_BY_USER: '/predictions',
  PREDICTIONS_BY_SESSION: '/predictions/sessions',
} as const;

// Validation constants
export const VALIDATION = {
  USER_ID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  SESSION_ID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
} as const;

// Accessibility constants
export const A11Y = {
  SKIP_TO_CONTENT_ID: 'main-content',
  ANNOUNCEMENTS_ID: 'a11y-announcements',
  FOCUS_TIMEOUT: 100,
  DEBOUNCE_MS: 300,
} as const;
