import { useQuery } from '@tanstack/react-query';

// Query keys for feature flags
export const FEATURE_FLAGS_QUERY_KEYS = {
  all: ['feature-flags'] as const,
  list: () => [...FEATURE_FLAGS_QUERY_KEYS.all, 'list'] as const,
  single: (flagName: string) => [...FEATURE_FLAGS_QUERY_KEYS.all, flagName] as const,
} as const;

/**
 * Hook for fetching all feature flags from the backend
 * Results are cached and reused across components
 */
export const useFeatureFlags = () => {
  return useQuery<Record<string, boolean>, Error>({
    queryKey: FEATURE_FLAGS_QUERY_KEYS.list(),
    queryFn: async () => {
      const response = await fetch('/api/feature-flags', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch feature flags: ${response.statusText}`);
      }

      return response.json();
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    // Default to all features enabled if fetch fails
    initialData: {
      AGENT_MODE_ENABLED: true,
    },
  });
};

/**
 * Hook for checking a specific feature flag
 * @param flagName - Name of the feature flag to check (e.g., "AGENT_MODE_ENABLED")
 * @param defaultValue - Default value if the flag is not found or fetch fails
 */
export const useFeatureFlag = (flagName: string, defaultValue: boolean = true) => {
  const { data: flags = {}, isLoading, error } = useFeatureFlags();

  const flagValue = (flags as Record<string, boolean>)[flagName] ?? defaultValue;

  return {
    isEnabled: flagValue,
    isLoading,
    error,
    isFlagMissing: flags && typeof flags === 'object' && !(flagName in flags),
  };
};

/**
 * Helper function to check agent mode without a hook
 * Useful for non-React contexts or conditional logic
 */
export const checkAgentModeEnabled = async (defaultValue: boolean = true): Promise<boolean> => {
  try {
    const response = await fetch('/api/feature-flags', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return defaultValue;
    }

    const flags = await response.json();
    return (flags as Record<string, boolean>)['AGENT_MODE_ENABLED'] ?? defaultValue;
  } catch (error) {
    console.error('Failed to check feature flags:', error);
    return defaultValue;
  }
};
