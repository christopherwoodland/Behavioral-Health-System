import { getUserId, formatRelativeTime, formatDateTime, createAppError, isNetworkError } from '../index';
import type { AppError } from '../../types';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';

// Mock the uuid module
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-12345'),
}));

// Mock the config/constants module
vi.mock('@/config/constants', () => ({
  STORAGE_KEYS: {
    USER_ID: 'bh_user_id',
    THEME: 'bh_theme',
    UPLOAD_SESSIONS: 'bh_upload_sessions',
    PROCESSING_MODE: 'bh_processing_mode',
    USER_ID_CUSTOM: 'bh_user_id_custom',
  },
  VALIDATION: {
    MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024,
  },
  config: {
    api: { baseUrl: 'http://localhost:7071/api' },
    features: { enableFFmpegWorker: false, enableDebugLogging: false },
    audio: {
      silenceRemoval: { enabled: false, thresholdDb: -40, minDuration: 0.5 },
    },
  },
}));

describe('Utility Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(localStorage.getItem).mockReset();
    vi.mocked(localStorage.setItem).mockReset();
  });

  describe('getUserId', () => {
    it('should return existing user ID from localStorage', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('existing-user-id');

      const userId = getUserId();

      expect(userId).toBe('existing-user-id');
      expect(localStorage.getItem).toHaveBeenCalledWith('bh_user_id');
    });

    it('should generate and store new user ID when none exists', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const userId = getUserId();

      expect(userId).toBe('mock-uuid-12345');
      expect(localStorage.setItem).toHaveBeenCalledWith('bh_user_id', 'mock-uuid-12345');
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-09-07T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should format "Just now" for recent times', () => {
      const now = new Date().toISOString();
      expect(formatRelativeTime(now)).toBe('Just now');
    });

    it('should format minutes ago with abbreviated form', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
    });

    it('should format hours ago with abbreviated form', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
    });

    it('should format days ago with abbreviated form', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
    });

    it('should fall back to locale date string for older dates', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const result = formatRelativeTime(twoWeeksAgo);
      expect(result).not.toContain('ago');
      expect(result).not.toBe('Just now');
    });

    it('should handle invalid dates', () => {
      expect(formatRelativeTime('invalid-date')).toBe('Invalid Date');
    });

    it('should handle empty string', () => {
      expect(formatRelativeTime('')).toBe('Invalid Date');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time correctly', () => {
      const date = '2025-09-07T15:30:45.000Z';
      const formatted = formatDateTime(date);
      expect(formatted).toMatch(/2025/);
    });

    it('should handle different date formats', () => {
      const date = '2025-12-25T09:15:30Z';
      const formatted = formatDateTime(date);
      expect(formatted).toMatch(/2025/);
      expect(formatted).toMatch(/12|Dec/);
    });

    it('should handle invalid dates', () => {
      expect(formatDateTime('invalid-date')).toBe('Invalid Date');
    });

    it('should handle edge cases', () => {
      expect(formatDateTime('')).toBe('Invalid Date');
      expect(formatDateTime('not-a-date')).toBe('Invalid Date');
    });
  });

  describe('createAppError', () => {
    it('should create an app error with all properties', () => {
      const error = createAppError(
        'VALIDATION_ERROR',
        'Invalid input provided',
        { field: 'email', value: 'invalid-email' }
      );

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input provided');
      expect(error.details).toEqual({ field: 'email', value: 'invalid-email' });
      expect(error.timestamp).toBeDefined();
    });

    it('should create an app error without details', () => {
      const error = createAppError('NETWORK_ERROR', 'Connection failed');

      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.message).toBe('Connection failed');
      expect(error.details).toBeUndefined();
      expect(error.timestamp).toBeDefined();
    });

    it('should include timestamp in ISO format', () => {
      const error = createAppError('TEST_ERROR', 'Test message');
      expect(() => new Date(error.timestamp)).not.toThrow();
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('isNetworkError', () => {
    it('should identify TypeError with fetch message', () => {
      const fetchTypeError = new TypeError('fetch failed');
      expect(isNetworkError(fetchTypeError)).toBe(true);
    });

    it('should identify Error with Network in message', () => {
      const networkError = new Error('Network request failed');
      expect(isNetworkError(networkError)).toBe(true);
    });

    it('should identify Error with connection in message (lowercase)', () => {
      const connectionError = new Error('Lost connection to server');
      expect(isNetworkError(connectionError)).toBe(true);
    });

    it('should identify Error with timeout in message', () => {
      const timeoutError = new Error('Request timeout exceeded');
      expect(isNetworkError(timeoutError)).toBe(true);
    });

    it('should reject non-network errors', () => {
      const validationError = new Error('Validation failed');
      expect(isNetworkError(validationError)).toBe(false);
    });

    it('should reject regular Error with only fetch (not TypeError)', () => {
      const fetchError = new Error('fetch failed');
      expect(isNetworkError(fetchError)).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(isNetworkError(null)).toBe(false);
      expect(isNetworkError(undefined)).toBe(false);
    });

    it('should handle non-error objects', () => {
      expect(isNetworkError('string error')).toBe(false);
      expect(isNetworkError({ message: 'error object' })).toBe(false);
      expect(isNetworkError(123)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle timezone differences in date formatting', () => {
      const utcDate = '2025-09-07T12:00:00.000Z';
      const formatted = formatDateTime(utcDate);
      expect(formatted).not.toBe('Invalid Date');
      expect(formatted).toContain('2025');
    });
  });

  describe('Performance', () => {
    it('should format dates efficiently', () => {
      vi.useRealTimers();
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        formatRelativeTime('2025-09-07T12:00:00.000Z');
        formatDateTime('2025-09-07T12:00:00.000Z');
      }

      const end = performance.now();
      expect(end - start).toBeLessThan(500);
    });
  });
});
