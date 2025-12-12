/**
 * Frontend Feature Flags Hook
 * All feature flags are read from environment variables (VITE_*)
 * No backend API calls - purely client-side configuration
 */

// Map of feature flag names to their environment variable names
const FEATURE_FLAG_ENV_MAP: Record<string, string> = {
  AGENT_MODE_ENABLED: 'VITE_AGENT_MODE_ENABLED',
  DEV_ENVIRONMENT: 'VITE_DEV_ENVIRONMENT',
  AUTO_START_SESSION: 'VITE_AUTO_START_SESSION',
  ENABLE_DEBUG_LOGGING: 'VITE_ENABLE_DEBUG_LOGGING',
  ENABLE_FFMPEG_WORKER: 'VITE_ENABLE_FFMPEG_WORKER',
  ENABLE_KINTSUGI: 'VITE_ENABLE_KINTSUGI',
  ENABLE_TRANSCRIPTION: 'VITE_ENABLE_TRANSCRIPTION',
  ENABLE_VERBOSE_LOGGING: 'VITE_ENABLE_VERBOSE_LOGGING',
  ENABLE_AI_RISK_ASSESSMENT: 'VITE_ENABLE_AI_RISK_ASSESSMENT',
  ENABLE_JEKYLL_AGENT: 'VITE_ENABLE_JEKYLL_AGENT',
  ENABLE_SESSION_VOICE_RECORDING: 'VITE_ENABLE_SESSION_VOICE_RECORDING',
  ENABLE_SMART_BAND: 'VITE_ENABLE_SMART_BAND',
  ENABLE_ENTRA_AUTH: 'VITE_ENABLE_ENTRA_AUTH',
};

/**
 * Parse environment variable value to boolean
 */
const parseEnvBoolean = (value: string | boolean | undefined, defaultValue: boolean): boolean => {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return value.toLowerCase() === 'true';
};

/**
 * Get all feature flags from environment variables
 */
const getFeatureFlags = (): Record<string, boolean> => {
  const flags: Record<string, boolean> = {};

  for (const [flagName, envVar] of Object.entries(FEATURE_FLAG_ENV_MAP)) {
    const envValue = import.meta.env[envVar];
    // Default to true for most flags, false for debug/dev flags
    const defaultValue = !flagName.includes('DEBUG') && !flagName.includes('VERBOSE') && !flagName.includes('DEV_ENVIRONMENT');
    flags[flagName] = parseEnvBoolean(envValue, defaultValue);
  }

  return flags;
};

// Query keys for feature flags (kept for API compatibility)
export const FEATURE_FLAGS_QUERY_KEYS = {
  all: ['feature-flags'] as const,
  list: () => [...FEATURE_FLAGS_QUERY_KEYS.all, 'list'] as const,
  single: (flagName: string) => [...FEATURE_FLAGS_QUERY_KEYS.all, flagName] as const,
} as const;

/**
 * Hook for getting all feature flags
 * Reads from environment variables (no backend API calls)
 */
export const useFeatureFlags = () => {
  const flags = getFeatureFlags();

  return {
    data: flags,
    isLoading: false,
    error: null,
  };
};

/**
 * Hook for checking a specific feature flag
 * @param flagName - Name of the feature flag to check (e.g., "AGENT_MODE_ENABLED")
 * @param defaultValue - Default value if the flag is not found
 */
export const useFeatureFlag = (flagName: string, defaultValue: boolean = true) => {
  // Get environment variable name for this flag
  const envVarName = FEATURE_FLAG_ENV_MAP[flagName] || `VITE_${flagName}`;
  const envValue = import.meta.env[envVarName];

  const isEnabled = parseEnvBoolean(envValue, defaultValue);

  return {
    isEnabled,
    isLoading: false,
    error: null,
    isFlagMissing: envValue === undefined,
  };
};

/**
 * Helper function to check agent mode without a hook (synchronous)
 * Useful for non-React contexts or conditional logic
 */
export const checkAgentModeEnabled = (defaultValue: boolean = true): boolean => {
  const envValue = import.meta.env.VITE_AGENT_MODE_ENABLED;
  return parseEnvBoolean(envValue, defaultValue);
};

/**
 * Helper function to check any feature flag without a hook (synchronous)
 */
export const checkFeatureFlag = (flagName: string, defaultValue: boolean = true): boolean => {
  const envVarName = FEATURE_FLAG_ENV_MAP[flagName] || `VITE_${flagName}`;
  const envValue = import.meta.env[envVarName];
  return parseEnvBoolean(envValue, defaultValue);
};
