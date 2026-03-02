/**
 * Environment Variable Utility
 *
 * Provides runtime configuration support for containerized deployments.
 * Environment variables are read from:
 * 1. window.__RUNTIME_CONFIG__ (runtime injection for containerized deployments)
 * 2. import.meta.env (build-time Vite environment variables)
 */

// Declare global type for runtime config (injected at container startup)
declare global {
  interface Window {
    __RUNTIME_CONFIG__?: Record<string, string | undefined>;
  }
}

/**
 * Get environment variable from runtime config first, then fall back to build-time env
 * This enables runtime configuration in containerized deployments
 */
export const getEnvVar = (name: string, defaultValue: string = ''): string => {
  // First check runtime config (for containerized deployments)
  // Use 'in' operator to check key existence, not truthiness (handles 'false' and '' values)
  if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__ && name in window.__RUNTIME_CONFIG__) {
    return window.__RUNTIME_CONFIG__[name] || defaultValue;
  }
  // Fall back to build-time Vite env
  return import.meta.env[name] || defaultValue;
};

/**
 * Get environment variable as integer
 */
export const getEnvVarInt = (name: string, defaultValue: number): number => {
  const value = getEnvVar(name, String(defaultValue));
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Get environment variable as boolean
 */
export const getEnvVarBool = (name: string, defaultValue: boolean = false): boolean => {
  const value = getEnvVar(name);
  if (value === '') return defaultValue;
  return value.toLowerCase() === 'true';
};

// ============================================
// Pre-defined environment variable accessors
// ============================================

// API Configuration
export const env = {
  // API Configuration
  // Default to relative '/api' so requests go through the Vite dev proxy to avoid CORS.
  // In production containers, set VITE_API_BASE_URL to the full Functions URL.
  get API_BASE_URL() { return getEnvVar('VITE_API_BASE_URL', '/api'); },
  get API_TIMEOUT_MS() { return getEnvVarInt('VITE_API_TIMEOUT_MS', 30000); },
  get API_MAX_RETRIES() { return getEnvVarInt('VITE_API_MAX_RETRIES', 3); },
  get API_RETRY_DELAY_MS() { return getEnvVarInt('VITE_API_RETRY_DELAY_MS', 1000); },

  // Azure AD / Entra ID Authentication
  get AZURE_CLIENT_ID() { return getEnvVar('VITE_AZURE_CLIENT_ID'); },
  get AZURE_TENANT_ID() { return getEnvVar('VITE_AZURE_TENANT_ID'); },
  get AZURE_AUTHORITY() { return getEnvVar('VITE_AZURE_AUTHORITY'); },
  get AZURE_REDIRECT_URI() { return getEnvVar('VITE_AZURE_REDIRECT_URI', typeof window !== 'undefined' ? window.location.origin : ''); },
  get AZURE_POST_LOGOUT_REDIRECT_URI() { return getEnvVar('VITE_AZURE_POST_LOGOUT_REDIRECT_URI', typeof window !== 'undefined' ? window.location.origin : ''); },
  get AZURE_ADMIN_GROUP_ID() { return getEnvVar('VITE_AZURE_ADMIN_GROUP_ID'); },
  get AZURE_CONTROL_PANEL_GROUP_ID() { return getEnvVar('VITE_AZURE_CONTROL_PANEL_GROUP_ID'); },
  get ENABLE_ENTRA_AUTH() { return getEnvVarBool('VITE_ENABLE_ENTRA_AUTH', false); },
  // API App Registration ID - separate from frontend client ID for token scopes
  get AZURE_API_CLIENT_ID() { return getEnvVar('VITE_AZURE_API_CLIENT_ID', getEnvVar('VITE_AZURE_CLIENT_ID')); },

  // Azure Blob Storage
  get STORAGE_CONTAINER_NAME() { return getEnvVar('VITE_STORAGE_CONTAINER_NAME', 'audio-uploads'); },
  get AZURE_BLOB_SAS_URL() { return getEnvVar('VITE_AZURE_BLOB_SAS_URL'); },

  // Feature Flags
  get ENABLE_DEBUG_LOGGING() { return getEnvVarBool('VITE_ENABLE_DEBUG_LOGGING', false); },
  get ENABLE_FFMPEG_WORKER() { return getEnvVarBool('VITE_ENABLE_FFMPEG_WORKER', true); },
  get ENABLE_TRANSCRIPTION() { return getEnvVarBool('VITE_ENABLE_TRANSCRIPTION', true); },
  get ENABLE_AI_RISK_ASSESSMENT() { return getEnvVarBool('VITE_ENABLE_AI_RISK_ASSESSMENT', true); },
  get OFFLINE_MODE() { return getEnvVarBool('VITE_OFFLINE_MODE', false); },

  // Polling Configuration
  get CONTROL_PANEL_REFRESH_INTERVAL() { return getEnvVarInt('VITE_CONTROL_PANEL_REFRESH_INTERVAL', 30); },
  get JOB_POLL_INTERVAL_MS() { return getEnvVarInt('VITE_JOB_POLL_INTERVAL_MS', 10000); },
  get POLL_INTERVAL_MS() { return getEnvVarInt('VITE_POLL_INTERVAL_MS', 1000); },

  // Audio Processing Configuration
  get AUDIO_SILENCE_REMOVAL_ENABLED() { return getEnvVarBool('VITE_AUDIO_SILENCE_REMOVAL_ENABLED', true); },
  get AUDIO_SILENCE_THRESHOLD_DB() { return getEnvVarInt('VITE_AUDIO_SILENCE_THRESHOLD_DB', -50); },
  get AUDIO_SILENCE_MIN_DURATION() { return parseFloat(getEnvVar('VITE_AUDIO_SILENCE_MIN_DURATION', '0.1')); },
  get AUDIO_SPEECH_ENHANCEMENT_ENABLED() { return getEnvVarBool('VITE_AUDIO_SPEECH_ENHANCEMENT_ENABLED', true); },
} as const;
