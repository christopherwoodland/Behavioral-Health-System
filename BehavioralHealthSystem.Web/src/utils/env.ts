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
  get API_BASE_URL() { return getEnvVar('VITE_API_BASE_URL', 'http://localhost:7071/api'); },
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

  // Azure OpenAI Realtime API
  get AZURE_OPENAI_RESOURCE_NAME() { return getEnvVar('VITE_AZURE_OPENAI_RESOURCE_NAME'); },
  get AZURE_OPENAI_REALTIME_KEY() { return getEnvVar('VITE_AZURE_OPENAI_REALTIME_KEY'); },
  get AZURE_OPENAI_REALTIME_DEPLOYMENT() { return getEnvVar('VITE_AZURE_OPENAI_REALTIME_DEPLOYMENT', 'gpt-4o-realtime-preview'); },
  get AZURE_OPENAI_REALTIME_API_VERSION() { return getEnvVar('VITE_AZURE_OPENAI_REALTIME_API_VERSION', '2025-04-01-preview'); },
  get AZURE_OPENAI_WEBRTC_REGION() { return getEnvVar('VITE_AZURE_OPENAI_WEBRTC_REGION', 'eastus2'); },

  // Agent Voice Configuration
  get TARS_VOICE() { return getEnvVar('VITE_TARS_VOICE', 'echo'); },
  get JEKYLL_VOICE() { return getEnvVar('VITE_JEKYLL_VOICE', 'shimmer'); },
  get MATRON_VOICE() { return getEnvVar('VITE_MATRON_VOICE', 'coral'); },
  get JEKYLL_PHQ2_THRESHOLD() { return getEnvVarInt('VITE_JEKYLL_PHQ2_THRESHOLD', 1); },

  // Feature Flags
  get DEV_ENVIRONMENT() { return getEnvVarBool('VITE_DEV_ENVIRONMENT', false); },
  get DEV_ENVIRONMENT_TEXT() { return getEnvVar('VITE_DEV_ENVIRONMENT_TEXT'); },
  get AUTO_START_SESSION() { return getEnvVarBool('VITE_AUTO_START_SESSION', true); },
  get ENABLE_DEBUG_LOGGING() { return getEnvVarBool('VITE_ENABLE_DEBUG_LOGGING', false); },
  get ENABLE_FFMPEG_WORKER() { return getEnvVarBool('VITE_ENABLE_FFMPEG_WORKER', true); },
  get ENABLE_KINTSUGI() { return getEnvVarBool('VITE_ENABLE_KINTSUGI', true); },
  get ENABLE_TRANSCRIPTION() { return getEnvVarBool('VITE_ENABLE_TRANSCRIPTION', true); },
  get ENABLE_AI_RISK_ASSESSMENT() { return getEnvVarBool('VITE_ENABLE_AI_RISK_ASSESSMENT', true); },
  get AGENT_MODE_ENABLED() { return getEnvVarBool('VITE_AGENT_MODE_ENABLED', false); },
  get ENABLE_JEKYLL_AGENT() { return getEnvVarBool('VITE_ENABLE_JEKYLL_AGENT', true); },
  get ENABLE_SESSION_VOICE_RECORDING() { return getEnvVarBool('VITE_ENABLE_SESSION_VOICE_RECORDING', true); },
  get ENABLE_SMART_BAND() { return getEnvVarBool('VITE_ENABLE_SMART_BAND', false); },

  // Timing Configuration
  get BIOMETRIC_SAVE_DELAY_MS() { return getEnvVarInt('VITE_BIOMETRIC_SAVE_DELAY_MS', 2000); },
  get MATRON_MAX_COLLECTION_ATTEMPTS() { return getEnvVarInt('VITE_MATRON_MAX_COLLECTION_ATTEMPTS', 2); },
  get AGENT_HANDOFF_DELAY_MS() { return getEnvVarInt('VITE_AGENT_HANDOFF_DELAY_MS', 2000); },

  // WebRTC Configuration
  get REALTIME_MAX_RECONNECTION_ATTEMPTS() { return getEnvVarInt('VITE_REALTIME_MAX_RECONNECTION_ATTEMPTS', 3); },
  get REALTIME_RECONNECTION_DELAY_MS() { return getEnvVarInt('VITE_REALTIME_RECONNECTION_DELAY_MS', 2000); },
  get REALTIME_DATA_CHANNEL_TIMEOUT_MS() { return getEnvVarInt('VITE_REALTIME_DATA_CHANNEL_TIMEOUT_MS', 5000); },
  get INITIAL_GREETING_SESSION_DELAY_MS() { return getEnvVarInt('VITE_INITIAL_GREETING_SESSION_DELAY_MS', 1500); },
  get INITIAL_GREETING_RESPONSE_DELAY_MS() { return getEnvVarInt('VITE_INITIAL_GREETING_RESPONSE_DELAY_MS', 300); },

  // Polling Configuration
  get CONTROL_PANEL_REFRESH_INTERVAL() { return getEnvVarInt('VITE_CONTROL_PANEL_REFRESH_INTERVAL', 30); },
  get JOB_POLL_INTERVAL_MS() { return getEnvVarInt('VITE_JOB_POLL_INTERVAL_MS', 10000); },
  get POLL_INTERVAL_MS() { return getEnvVarInt('VITE_POLL_INTERVAL_MS', 1000); },

  // Band Service
  get BAND_SERVICE_URL() { return getEnvVar('VITE_BAND_SERVICE_URL', 'http://localhost:8765'); },
} as const;
