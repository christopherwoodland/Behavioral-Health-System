import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService, PredictionPoller } from '@/services/api';
import { getUserId } from '@/utils';
import type {
  SessionInitiateRequest,
  PredictionSubmitRequest,
  PredictionResult,
  HealthCheckResponse,
  SessionData,
  AppError,
} from '@/types';

// Query keys
export const QUERY_KEYS = {
  health: ['health'] as const,
  userPredictions: (userId: string) => ['predictions', 'user', userId] as const,
  sessionPrediction: (sessionId: string) => ['predictions', 'session', sessionId] as const,
  userSessions: (userId: string) => ['sessions', 'user', userId] as const,
} as const;

// Health check query
export const useHealthCheck = () => {
  return useQuery<HealthCheckResponse, AppError>({
    queryKey: QUERY_KEYS.health,
    queryFn: () => apiService.checkHealth(),
    retry: 2,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });
};

// Session initiation mutation
export const useInitiateSession = () => {
  return useMutation({
    mutationFn: (request: SessionInitiateRequest) =>
      apiService.initiateSession(request),
    onError: () => {
      // Error is handled by the UI components
    },
  });
};

// Prediction submission mutation
export const useSubmitPrediction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: PredictionSubmitRequest) =>
      apiService.submitPrediction(request),
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.sessionPrediction(variables.sessionId),
      });

      const userId = getUserId();
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.userPredictions(userId),
      });
    },
    onError: () => {
      // Error is handled by the UI components
    },
  });
};

// Get prediction by session ID
export const useSessionPrediction = (sessionId: string, enabled = true) => {
  return useQuery<PredictionResult, AppError>({
    queryKey: QUERY_KEYS.sessionPrediction(sessionId),
    queryFn: () => apiService.getPredictionBySessionId(sessionId),
    enabled: enabled && Boolean(sessionId),
    retry: (failureCount, error) => {
      // Don't retry on 404s (session not found)
      if (error.code === 'HTTP_404') {
        return false;
      }
      return failureCount < 3;
    },
    refetchOnWindowFocus: false,
  });
};

// Get user predictions
export const useUserPredictions = (userId?: string) => {
  const effectiveUserId = userId || getUserId();

  return useQuery<PredictionResult[], AppError>({
    queryKey: QUERY_KEYS.userPredictions(effectiveUserId),
    queryFn: () => apiService.getUserPredictions(effectiveUserId),
    enabled: Boolean(effectiveUserId),
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });
};

// Get user sessions with complete session data
export const useUserSessions = (userId?: string) => {
  const effectiveUserId = userId || getUserId();

  return useQuery<{ success: boolean; count: number; sessions: SessionData[] }, AppError>({
    queryKey: QUERY_KEYS.userSessions(effectiveUserId),
    queryFn: () => apiService.getUserSessions(effectiveUserId),
    enabled: Boolean(effectiveUserId),
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });
};

// Prediction polling hook
export const usePredictionPolling = () => {
  const queryClient = useQueryClient();

  const startPolling = (
    sessionId: string,
    options?: {
      onUpdate?: (result: PredictionResult) => void;
      onComplete?: (result: PredictionResult) => void;
      onError?: (error: AppError) => void;
    }
  ) => {
    const poller = new PredictionPoller(sessionId);

    return poller.start(
      (result) => {
        // Update cache
        queryClient.setQueryData(
          QUERY_KEYS.sessionPrediction(sessionId),
          result
        );
        options?.onUpdate?.(result);
      },
      (result) => {
        // Final update and invalidate user predictions
        queryClient.setQueryData(
          QUERY_KEYS.sessionPrediction(sessionId),
          result
        );

        const userId = getUserId();
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.userPredictions(userId),
        });

        options?.onComplete?.(result);
      },
      (error) => {
        options?.onError?.(error);
      }
    );
  };

  return { startPolling };
};

// API connection test
export const useTestConnection = () => {
  return useMutation({
    mutationFn: () => apiService.testConnection(),
    onError: () => {
      // Error is handled by the UI components
    },
  });
};

// Optimistic updates helper
export const useOptimisticUpdates = () => {
  const queryClient = useQueryClient();

  const updateSessionStatus = (sessionId: string, status: PredictionResult['status']) => {
    queryClient.setQueryData(
      QUERY_KEYS.sessionPrediction(sessionId),
      (old: PredictionResult | undefined) => {
        if (!old) return old;
        return {
          ...old,
          status,
          updatedAt: new Date().toISOString(),
        };
      }
    );
  };

  const addNewSession = (sessionId: string, userId: string) => {
    const newSession: PredictionResult = {
      sessionId,
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add to session cache
    queryClient.setQueryData(
      QUERY_KEYS.sessionPrediction(sessionId),
      newSession
    );

    // Add to user predictions cache
    queryClient.setQueryData(
      QUERY_KEYS.userPredictions(userId),
      (old: PredictionResult[] | undefined) => {
        if (!old) return [newSession];
        return [newSession, ...old];
      }
    );
  };

  return {
    updateSessionStatus,
    addNewSession,
  };
};
