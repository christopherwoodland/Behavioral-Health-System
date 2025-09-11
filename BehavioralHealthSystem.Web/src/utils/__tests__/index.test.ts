import { getUserId, formatRelativeTime, formatDateTime, createAppError, isNetworkError } from '../index';
import type { AppError } from '@/types';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: jest.fn(() => 'mock-uuid-12345'),
  },
  writable: true,
});

describe('Utility Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserId', () => {
    it('should return existing user ID from localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue('existing-user-id');
      
      const userId = getUserId();
      
      expect(userId).toBe('existing-user-id');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('bh_user_id');
    });

    it('should generate and store new user ID when none exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const userId = getUserId();
      
      expect(userId).toBe('mock-uuid-12345');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('bh_user_id', 'mock-uuid-12345');
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });
      
      const userId = getUserId();
      
      expect(userId).toBe('mock-uuid-12345');
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      // Mock current time to a fixed date for consistent testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-09-07T12:00:00.000Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should format "just now" for recent times', () => {
      const now = new Date().toISOString();
      expect(formatRelativeTime(now)).toBe('just now');
    });

    it('should format minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatRelativeTime(fiveMinutesAgo)).toBe('5 minutes ago');
    });

    it('should format hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(twoHoursAgo)).toBe('2 hours ago');
    });

    it('should format days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
    });

    it('should handle invalid dates', () => {
      expect(formatRelativeTime('invalid-date')).toBe('Invalid date');
    });

    it('should handle empty string', () => {
      expect(formatRelativeTime('')).toBe('Invalid date');
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time correctly', () => {
      const date = '2025-09-07T15:30:45.000Z';
      const formatted = formatDateTime(date);
      
      // The exact format depends on locale, but should contain date and time
      expect(formatted).toMatch(/2025/);
      expect(formatted).toMatch(/Sep|09|9/); // Month representation
      expect(formatted).toMatch(/07|7/); // Day
    });

    it('should handle different date formats', () => {
      const date = '2025-12-25T09:15:30Z';
      const formatted = formatDateTime(date);
      
      expect(formatted).toMatch(/2025/);
      expect(formatted).toMatch(/Dec|12/);
      expect(formatted).toMatch(/25/);
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
      
      // Timestamp should be a valid ISO string
      expect(() => new Date(error.timestamp)).not.toThrow();
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('isNetworkError', () => {
    it('should identify network errors', () => {
      const networkError = new Error('Network request failed');
      expect(isNetworkError(networkError)).toBe(true);

      const fetchError = new Error('fetch failed');
      expect(isNetworkError(fetchError)).toBe(true);

      const connectionError = new Error('Connection refused');
      expect(isNetworkError(connectionError)).toBe(true);
    });

    it('should identify app errors with network codes', () => {
      const appError: AppError = {
        code: 'NETWORK_ERROR',
        message: 'Network failed',
        timestamp: new Date().toISOString()
      };
      
      expect(isNetworkError(appError)).toBe(true);
    });

    it('should reject non-network errors', () => {
      const validationError = new Error('Validation failed');
      expect(isNetworkError(validationError)).toBe(false);

      const appError: AppError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        timestamp: new Date().toISOString()
      };
      
      expect(isNetworkError(appError)).toBe(false);
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

  describe('Edge Cases and Error Handling', () => {
    it('should handle localStorage quota exceeded', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      mockLocalStorage.getItem.mockReturnValue(null);
      
      // Should still generate a user ID even if storage fails
      const userId = getUserId();
      expect(userId).toBe('mock-uuid-12345');
    });

    it('should handle missing crypto API', () => {
      const originalCrypto = global.crypto;
      delete (global as any).crypto;
      
      // Mock Math.random for fallback
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      
      try {
        const userId = getUserId();
        expect(userId).toBeDefined();
        expect(typeof userId).toBe('string');
      } finally {
        global.crypto = originalCrypto;
        jest.restoreAllMocks();
      }
    });

    it('should handle timezone differences in date formatting', () => {
      const utcDate = '2025-09-07T12:00:00.000Z';
      const formatted = formatDateTime(utcDate);
      
      // Should format successfully regardless of local timezone
      expect(formatted).not.toBe('Invalid Date');
      expect(formatted).toContain('2025');
    });
  });

  describe('Performance', () => {
    it('should format dates efficiently', () => {
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        formatRelativeTime('2025-09-07T12:00:00.000Z');
        formatDateTime('2025-09-07T12:00:00.000Z');
      }
      
      const end = performance.now();
      
      // Should complete 1000 operations in reasonable time (less than 100ms)
      expect(end - start).toBeLessThan(100);
    });

    it('should cache user ID after first generation', () => {
      mockLocalStorage.getItem.mockReturnValueOnce(null).mockReturnValue('cached-id');
      
      // First call should generate
      getUserId();
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
      
      // Subsequent calls should use cached value
      getUserId();
      getUserId();
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
    });
  });
});
