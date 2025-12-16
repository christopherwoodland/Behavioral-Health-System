import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiService } from '../api';
import type { SessionData, SessionInitiateRequest, PredictionSubmitRequest } from '../../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Service', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('Session Storage API', () => {
    const mockSessionData: SessionData = {
      sessionId: 'test-session-123',
      userId: 'test-user-456', // Authenticated user ID
      metadata_user_id: 'patient-789', // Patient/metadata user ID
      userMetadata: {
        age: 25,
        gender: 'male',
        ethnicity: 'Hispanic, Latino, or Spanish Origin',
        language: true,
        sessionNotes: 'Test session notes'
      },
      prediction: {
        sessionId: 'test-session-123',
        status: 'succeeded',
        predictedScore: '75.5',
        predictedScoreDepression: '75.5',
        predictedScoreAnxiety: '68.2',
        createdAt: '2025-09-07T10:00:00.000Z',
        updatedAt: '2025-09-07T10:05:00.000Z'
      },
      analysisResults: {
        depressionScore: 75.5,
        anxietyScore: 68.2,
        riskLevel: 'moderate',
        confidence: 0.85,
        insights: ['User shows signs of mild depression', 'Recommend monitoring'],
        completedAt: '2025-09-07T10:05:00.000Z'
      },
      audioUrl: 'https://storage.example.com/audio/test.wav',
      audioFileName: 'test-audio.wav',
      status: 'completed',
      createdAt: '2025-09-07T10:00:00.000Z',
      updatedAt: '2025-09-07T10:05:00.000Z'
    };

    describe('saveSessionData', () => {
      it('should save session data successfully', async () => {
        const mockResponse = {
          success: true,
          message: 'Session data saved successfully',
          sessionId: 'test-session-123'
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await apiService.saveSessionData(mockSessionData);

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:7071/api/sessions',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mockSessionData),
          }
        );
        expect(result).toEqual(mockResponse);
      });

      it('should handle save session data error', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ message: 'Database error' }),
        });

        await expect(apiService.saveSessionData(mockSessionData)).rejects.toThrow();
      });
    });

    describe('getUserSessions', () => {
      it('should get user sessions successfully', async () => {
        const mockResponse = {
          success: true,
          count: 2,
          sessions: [mockSessionData, { ...mockSessionData, sessionId: 'test-session-456' }]
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await apiService.getUserSessions('test-user-456');

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:7071/api/sessions/users/test-user-456',
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }
        );
        expect(result).toEqual(mockResponse);
        expect(result.sessions).toHaveLength(2);
      });

      it('should handle empty user sessions', async () => {
        const mockResponse = {
          success: true,
          count: 0,
          sessions: []
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await apiService.getUserSessions('test-user-no-sessions');

        expect(result.sessions).toHaveLength(0);
        expect(result.count).toBe(0);
      });
    });

    describe('getSessionData', () => {
      it('should get session data by ID successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockSessionData,
        });

        const result = await apiService.getSessionData('test-session-123');

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:7071/api/sessions/test-session-123',
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }
        );
        expect(result).toEqual(mockSessionData);
      });
    });

    describe('updateSessionData', () => {
      it('should update session data successfully', async () => {
        const mockResponse = {
          success: true,
          message: 'Session data updated successfully'
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await apiService.updateSessionData('test-session-123', mockSessionData);

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:7071/api/sessions/test-session-123',
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mockSessionData),
          }
        );
        expect(result).toEqual(mockResponse);
      });
    });

    describe('deleteSessionData', () => {
      it('should delete session data successfully', async () => {
        const mockResponse = {
          success: true,
          message: 'Session data deleted successfully'
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await apiService.deleteSessionData('test-session-123');

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:7071/api/sessions/test-session-123',
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          }
        );
        expect(result).toEqual(mockResponse);
      });
    });
  });

  describe('Legacy API Endpoints', () => {
    describe('initiateSession', () => {
      it('should initiate a session successfully', async () => {
        const mockRequest: SessionInitiateRequest = {
          userid: 'test-user-123',
          is_initiated: true,
          metadata: {
            age: 25,
            gender: 'male',
            ethnicity: 'Hispanic, Latino, or Spanish Origin',
            race: 'white',
            language: true,
            weight: 170,
            zipcode: '12345'
          }
        };

        const mockResponse = {
          sessionId: 'test-session-123',
          status: 'initiated',
          message: 'Session initiated successfully'
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await apiService.initiateSession(mockRequest);

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:7071/api/sessions/initiate',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mockRequest),
          }
        );
        expect(result).toEqual(mockResponse);
      });
    });

    describe('submitPrediction', () => {
      it('should submit prediction successfully', async () => {
        const mockRequest: PredictionSubmitRequest = {
          sessionId: 'test-session-123',
          userId: 'test-user-456',
          audioFileUrl: 'https://storage.example.com/audio/test.wav',
          audioFileName: 'test-audio.wav'
        };

        const mockResponse = {
          sessionId: 'test-session-123',
          status: 'processing',
          message: 'Prediction submitted successfully'
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await apiService.submitPrediction(mockRequest);

        expect(result).toEqual(mockResponse);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(apiService.getUserSessions('test-user')).rejects.toThrow('Unable to connect to the server. Please check your internet connection.');
    });

    it('should handle HTTP errors with custom messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ message: 'Session not found' }),
      });

      await expect(apiService.getSessionData('non-existent')).rejects.toThrow();
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => { throw new Error('Invalid JSON'); },
      });

      await expect(apiService.getUserSessions('test-user')).rejects.toThrow();
    });
  });
});
