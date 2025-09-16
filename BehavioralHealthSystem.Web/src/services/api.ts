import { config, API_ENDPOINTS } from '@/config/constants';
import { createAppError, isNetworkError } from '@/utils';
import type {
  SessionInitiateRequest,
  SessionInitiateResponse,
  PredictionSubmitRequest,
  PredictionSubmitResponse,
  PredictionResult,
  HealthCheckResponse,
  SessionData,
  RiskAssessment,
  AppError,
} from '@/types';

// Type for authentication context
interface AuthHeaders {
  getAuthHeaders(): Promise<Record<string, string>>;
}

// Base API client with error handling and authentication
class ApiClient {
  private baseUrl: string;
  private authProvider?: AuthHeaders;

  constructor(baseUrl: string, authProvider?: AuthHeaders) {
    this.baseUrl = baseUrl;
    this.authProvider = authProvider;
  }

  setAuthProvider(authProvider: AuthHeaders) {
    this.authProvider = authProvider;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      throw createAppError(
        `HTTP_${response.status}`,
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
        }
      );
    }

    return response.json();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      // Handle trailing/leading slashes to avoid double slashes
      const baseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const url = `${baseUrl}${cleanEndpoint}`;
      
      const defaultHeaders = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      // Add authentication headers if available
      if (this.authProvider) {
        try {
          const authHeaders = await this.authProvider.getAuthHeaders();
          Object.assign(defaultHeaders, authHeaders);
        } catch (authError) {
          // Log auth error but continue with request - some endpoints may not require auth
          console.warn('Failed to get authentication headers:', authError);
        }
      }

      const response = await fetch(url, {
        ...options,
        headers: defaultHeaders,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      if (isNetworkError(error)) {
        throw createAppError(
          'NETWORK_ERROR',
          'Unable to connect to the server. Please check your internet connection.',
          { originalError: error }
        );
      }
      
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw AppError
      }
      
      throw createAppError(
        'UNKNOWN_ERROR',
        'An unexpected error occurred',
        { originalError: error }
      );
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Create API client instance
const apiClient = new ApiClient(config.api.baseUrl);

// Function to set authentication provider (called from app initialization)
export const setApiAuthProvider = (authProvider: AuthHeaders) => {
  apiClient.setAuthProvider(authProvider);
};

// API Service functions
export const apiService = {
  // Health check
  async checkHealth(): Promise<HealthCheckResponse> {
    return apiClient.get<HealthCheckResponse>(API_ENDPOINTS.HEALTH);
  },

  // Session management
  async initiateSession(request: SessionInitiateRequest): Promise<SessionInitiateResponse> {
    return apiClient.post<SessionInitiateResponse>(
      API_ENDPOINTS.SESSIONS_INITIATE,
      request
    );
  },

  // Prediction submission
  async submitPrediction(request: PredictionSubmitRequest): Promise<PredictionSubmitResponse> {
    return apiClient.post<PredictionSubmitResponse>(
      API_ENDPOINTS.PREDICTIONS_SUBMIT,
      request
    );
  },

  // Get prediction results
  async getPredictionBySessionId(sessionId: string): Promise<PredictionResult> {
    return apiClient.get<PredictionResult>(
      `${API_ENDPOINTS.PREDICTIONS_BY_SESSION}/${sessionId}`
    );
  },

  // Get user predictions
  async getUserPredictions(userId: string): Promise<PredictionResult[]> {
    return apiClient.get<PredictionResult[]>(
      `${API_ENDPOINTS.PREDICTIONS_BY_USER}/${userId}`
    );
  },

  // Session Storage API methods
  async saveSessionData(sessionData: SessionData): Promise<{ success: boolean; sessionId: string; message: string }> {
    return apiClient.post<{ success: boolean; sessionId: string; message: string }>(
      'sessions',
      sessionData
    );
  },

  async getSessionData(sessionId: string): Promise<SessionData> {
    return apiClient.get<SessionData>(`sessions/${sessionId}`);
  },

  async getUserSessions(userId: string): Promise<{ success: boolean; count: number; sessions: SessionData[] }> {
    return apiClient.get<{ success: boolean; count: number; sessions: SessionData[] }>(
      `sessions/users/${userId}`
    );
  },

  async updateSessionData(sessionId: string, sessionData: SessionData): Promise<{ success: boolean; message: string }> {
    return apiClient.put<{ success: boolean; message: string }>(
      `sessions/${sessionId}`,
      sessionData
    );
  },

  async deleteSessionData(sessionId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.delete<{ success: boolean; message: string }>(
      `sessions/${sessionId}`
    );
  },

  // Test API connection
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.checkHealth();
      return { success: true, message: 'API connection successful' };
    } catch (error) {
      const appError = error as AppError;
      return { 
        success: false, 
        message: appError.message || 'Connection test failed' 
      };
    }
  },



  // Risk Assessment API methods
  async generateRiskAssessment(sessionId: string): Promise<{ success: boolean; riskAssessment?: RiskAssessment; message: string }> {
    return apiClient.post<{ success: boolean; riskAssessment?: RiskAssessment; message: string }>(
      `sessions/${sessionId}/risk-assessment`
    );
  },

  async getRiskAssessment(sessionId: string): Promise<{ success: boolean; riskAssessment?: RiskAssessment; message: string }> {
    return apiClient.get<{ success: boolean; riskAssessment?: RiskAssessment; message: string }>(
      `sessions/${sessionId}/risk-assessment`
    );
  },
};

// Polling utilities
export class PredictionPoller {
  private sessionId: string;
  private intervalMs: number;
  private maxAttempts: number;
  private backoffFactor: number;
  private currentAttempt = 0;
  private timeoutId: number | null = null;
  private isPolling = false;

  constructor(
    sessionId: string,
    options: {
      intervalMs?: number;
      maxAttempts?: number;
      backoffFactor?: number;
    } = {}
  ) {
    this.sessionId = sessionId;
    this.intervalMs = options.intervalMs || config.polling.intervalMs;
    this.maxAttempts = options.maxAttempts || config.polling.maxAttempts;
    this.backoffFactor = options.backoffFactor || config.polling.backoffFactor;
  }

  async start(
    onUpdate: (result: PredictionResult) => void,
    onComplete: (result: PredictionResult) => void,
    onError: (error: AppError) => void
  ): Promise<void> {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    this.currentAttempt = 0;

    const poll = async (): Promise<void> => {
      try {
        const result = await apiService.getPredictionBySessionId(this.sessionId);
        
        onUpdate(result);

        if (result.status === 'succeeded' || result.status === 'success' || result.status === 'failed') {
          this.stop();
          onComplete(result);
          return;
        }

        this.currentAttempt++;

        if (this.currentAttempt >= this.maxAttempts) {
          this.stop();
          onError(createAppError(
            'POLLING_TIMEOUT',
            'Prediction polling timed out. Please check the session manually.',
            { sessionId: this.sessionId, attempts: this.currentAttempt }
          ));
          return;
        }

        // Schedule next poll with exponential backoff
        const nextInterval = this.intervalMs * Math.pow(this.backoffFactor, this.currentAttempt);
        this.timeoutId = window.setTimeout(poll, nextInterval);

      } catch (error) {
        this.stop();
        onError(error as AppError);
      }
    };

    // Start polling immediately
    await poll();
  }

  stop(): void {
    this.isPolling = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  getStatus(): { isPolling: boolean; attempt: number; maxAttempts: number } {
    return {
      isPolling: this.isPolling,
      attempt: this.currentAttempt,
      maxAttempts: this.maxAttempts,
    };
  }
}


// Export PredictionResult type for external use
export type { PredictionResult } from '@/types';
