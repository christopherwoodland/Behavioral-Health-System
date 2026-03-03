import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { apiService } from '../api';

/**
 * Tests for apiService.
 *
 * The ApiClient constructs URLs as: `${baseUrl}${cleanEndpoint}`
 * With VITE_API_BASE_URL='http://localhost:7071/api' (set in env.setup.ts)
 * and endpoint '/sessions' → 'http://localhost:7071/api/sessions'
 *
 * Errors from ApiClient are plain AppError objects ({ code, message, details, timestamp }),
 * NOT Error class instances, because createAppError() returns a plain object.
 */

const BASE_URL = 'http://localhost:7071/api';

function mockFetchSuccess(data: unknown, status = 200) {
  (global.fetch as Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    headers: new Headers(),
  });
}

function mockFetchError(status: number, statusText: string, errorData: unknown = {}) {
  (global.fetch as Mock).mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve(errorData),
    headers: new Headers(),
  });
}

function mockFetchNetworkError() {
  (global.fetch as Mock).mockRejectedValueOnce(new TypeError('Failed to fetch'));
}

describe('apiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as Mock).mockReset();
  });

  describe('checkHealth', () => {
    it('should call the health endpoint', async () => {
      const healthData = { status: 'healthy', timestamp: new Date().toISOString() };
      mockFetchSuccess(healthData);

      const result = await apiService.checkHealth();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/health`);
      expect(result).toEqual(healthData);
    });
  });

  describe('saveSessionData', () => {
    it('should POST session data to /sessions', async () => {
      const sessionData = {
        sessionId: 'test-session-id',
        userId: 'test-user-id',
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const response = { success: true, sessionId: 'test-session-id', message: 'Saved' };
      mockFetchSuccess(response);

      const result = await apiService.saveSessionData(sessionData as any);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/sessions`);
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual(sessionData);
      expect(result).toEqual(response);
    });
  });

  describe('getSessionData', () => {
    it('should GET session by ID', async () => {
      const sessionId = 'test-session-id';
      const sessionData = { sessionId, userId: 'test-user', status: 'active' };
      mockFetchSuccess(sessionData);

      const result = await apiService.getSessionData(sessionId);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/sessions/${sessionId}`);
      expect(result).toEqual(sessionData);
    });
  });

  describe('getUserSessions', () => {
    it('should GET sessions for a user', async () => {
      const userId = 'test-user-id';
      const response = { success: true, count: 1, sessions: [{ sessionId: 's1' }] };
      mockFetchSuccess(response);

      const result = await apiService.getUserSessions(userId);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/sessions/users/${userId}`);
      expect(result).toEqual(response);
    });
  });

  describe('getAllSessions', () => {
    it('should GET all sessions', async () => {
      const response = { success: true, count: 2, sessions: [] };
      mockFetchSuccess(response);

      const result = await apiService.getAllSessions();

      const [url] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/sessions/all`);
      expect(result).toEqual(response);
    });
  });

  describe('updateSessionData', () => {
    it('should PUT session data', async () => {
      const sessionId = 'test-session-id';
      const sessionData = { sessionId, userId: 'test-user', status: 'completed' };
      const response = { success: true, message: 'Updated' };
      mockFetchSuccess(response);

      const result = await apiService.updateSessionData(sessionId, sessionData as any);

      const [url, options] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/sessions/${sessionId}`);
      expect(options.method).toBe('PUT');
      expect(result).toEqual(response);
    });
  });

  describe('deleteSessionData', () => {
    it('should DELETE session by ID', async () => {
      const sessionId = 'test-session-id';
      const response = { success: true, message: 'Deleted' };
      mockFetchSuccess(response);

      const result = await apiService.deleteSessionData(sessionId);

      const [url, options] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/sessions/${sessionId}`);
      expect(options.method).toBe('DELETE');
      expect(result).toEqual(response);
    });
  });

  describe('initiateSession', () => {
    it('should POST to sessions/initiate-selected', async () => {
      const request = { userId: 'test-user', sessionId: 'test-session' };
      const response = { sessionId: 'test-session', status: 'initiated' };
      mockFetchSuccess(response);

      const result = await apiService.initiateSession(request as any);

      const [url, options] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/sessions/initiate-selected`);
      expect(options.method).toBe('POST');
      expect(result).toEqual(response);
    });
  });

  describe('submitPrediction', () => {
    it('should POST to predictions/submit-selected', async () => {
      const request = { sessionId: 'test-session', audioUrl: 'http://example.com/audio.wav' };
      const response = { success: true, predictionId: 'pred-1' };
      mockFetchSuccess(response);

      const result = await apiService.submitPrediction(request as any);

      const [url, options] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/predictions/submit-selected`);
      expect(options.method).toBe('POST');
      expect(result).toEqual(response);
    });
  });

  describe('getPredictionBySessionId', () => {
    it('should GET prediction by session ID', async () => {
      const sessionId = 'test-session';
      const response = { sessionId, status: 'success', predictedScore: '0.8' };
      mockFetchSuccess(response);

      const result = await apiService.getPredictionBySessionId(sessionId);

      const [url] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/predictions/sessions/${sessionId}`);
      expect(result).toEqual(response);
    });
  });

  describe('getUserPredictions', () => {
    it('should GET predictions for a user', async () => {
      const userId = 'test-user';
      const response = [{ sessionId: 's1', status: 'success' }];
      mockFetchSuccess(response);

      const result = await apiService.getUserPredictions(userId);

      const [url] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/predictions/${userId}`);
      expect(result).toEqual(response);
    });
  });

  describe('generateRiskAssessment', () => {
    it('should POST to generate risk assessment', async () => {
      const sessionId = 'test-session';
      const response = { success: true, riskAssessment: {}, message: 'Generated' };
      mockFetchSuccess(response);

      const result = await apiService.generateRiskAssessment(sessionId);

      const [url, options] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/sessions/${sessionId}/risk-assessment`);
      expect(options.method).toBe('POST');
      expect(result).toEqual(response);
    });
  });

  describe('getRiskAssessment', () => {
    it('should GET risk assessment for a session', async () => {
      const sessionId = 'test-session';
      const response = { success: true, riskAssessment: {}, message: 'Found' };
      mockFetchSuccess(response);

      const result = await apiService.getRiskAssessment(sessionId);

      const [url] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/sessions/${sessionId}/risk-assessment`);
      expect(result).toEqual(response);
    });
  });

  describe('correctGrammar', () => {
    it('should POST text for grammar correction', async () => {
      const text = 'Hello wrold';
      const response = { originalText: text, correctedText: 'Hello world' };
      mockFetchSuccess(response);

      const result = await apiService.correctGrammar(text);

      const [url, options] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/CorrectGrammar`);
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ text });
      expect(result).toEqual(response);
    });
  });

  describe('correctGrammarAgent', () => {
    it('should POST text for agent grammar correction', async () => {
      const text = 'Hello wrold';
      const response = { originalText: text, correctedText: 'Hello world' };
      mockFetchSuccess(response);

      const result = await apiService.correctGrammarAgent(text);

      const [url] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/agent/grammar/correct`);
      expect(result).toEqual(response);
    });
  });

  describe('saveTranscription', () => {
    it('should POST transcription data', async () => {
      const sessionId = 'test-session';
      const transcription = 'Test transcription text';
      const response = { success: true, sessionId, message: 'Saved' };
      mockFetchSuccess(response);

      const result = await apiService.saveTranscription(sessionId, transcription);

      const [url, options] = (global.fetch as Mock).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/SaveTranscription`);
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ sessionId, transcription });
      expect(result).toEqual(response);
    });
  });

  describe('testConnection', () => {
    it('should return success when health check succeeds', async () => {
      mockFetchSuccess({ status: 'healthy' });

      const result = await apiService.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('API connection successful');
    });

    it('should return failure when health check fails', async () => {
      mockFetchNetworkError();

      const result = await apiService.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
    });
  });

  describe('Error handling', () => {
    it('should reject on network errors', async () => {
      mockFetchNetworkError();

      await expect(apiService.checkHealth()).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });

    it('should reject on HTTP errors', async () => {
      mockFetchError(500, 'Internal Server Error', { message: 'Server error' });

      // HTTP errors from handleResponse propagate directly because
      // handleResponse is called without await in request(), so the
      // catch block does not intercept them.
      await expect(apiService.checkHealth()).rejects.toMatchObject({
        code: 'HTTP_500',
      });
    });

    it('should include Content-Type header in requests', async () => {
      mockFetchSuccess({ status: 'healthy' });

      await apiService.checkHealth();

      const [, options] = (global.fetch as Mock).mock.calls[0];
      expect(options.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('URL construction', () => {
    it('should construct correct URLs from base and endpoints', async () => {
      mockFetchSuccess({});

      await apiService.getSessionData('abc-123');

      const [url] = (global.fetch as Mock).mock.calls[0];
      // baseUrl='http://localhost:7071/api' + '/sessions/abc-123'
      expect(url).toBe('http://localhost:7071/api/sessions/abc-123');
      // No double slashes
      expect(url).not.toContain('//api//');
    });
  });
});
