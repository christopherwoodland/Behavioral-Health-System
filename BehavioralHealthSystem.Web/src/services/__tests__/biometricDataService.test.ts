import { describe, it, expect, beforeEach, vi } from 'vitest';
import { biometricDataService } from '../biometricDataService';

// Mock fetch
global.fetch = vi.fn();

describe('Biometric Data Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    biometricDataService.clearSession();
  });

  describe('Session Initialization', () => {
    it('should initialize new biometric session', () => {
      const userId = 'test-user-123';
      const session = biometricDataService.initializeSession(userId);

      expect(session).toBeDefined();
      expect(session.userId).toBe(userId);
      expect(session.sessionId).toBeTruthy();
      expect(session.nickname).toBeUndefined();
      expect(session.weight).toBeUndefined();
      expect(session.height).toBeUndefined();
    });

    it('should use custom session ID when provided', () => {
      const userId = 'test-user-123';
      const sessionId = 'custom-session-id';
      const session = biometricDataService.initializeSession(userId, sessionId);

      expect(session.sessionId).toBe(sessionId);
    });

    it('should include metadata in session', () => {
      const userId = 'test-user-123';
      const session = biometricDataService.initializeSession(userId);

      expect(session.metadata).toBeDefined();
      expect(session.metadata?.createdAt).toBeTruthy();
      expect(session.metadata?.version).toBe('1.0');
    });
  });

  describe('Field Updates', () => {
    it('should update nickname field', () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      biometricDataService.updateField('nickname', 'Johnny');

      const session = biometricDataService.getCurrentSession();
      expect(session?.nickname).toBe('Johnny');
    });

    it('should update weight field', () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      biometricDataService.updateField('weight', 170);

      const session = biometricDataService.getCurrentSession();
      expect(session?.weight).toBe(170);
    });

    it('should update height field', () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      biometricDataService.updateField('height', 68);

      const session = biometricDataService.getCurrentSession();
      expect(session?.height).toBe(68);
    });

    it('should update gender field', () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      biometricDataService.updateField('gender', 'male');

      const session = biometricDataService.getCurrentSession();
      expect(session?.gender).toBe('male');
    });

    it('should update ethnicity field', () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      biometricDataService.updateField('ethnicity', 'hispanic');

      const session = biometricDataService.getCurrentSession();
      expect(session?.ethnicity).toBe('hispanic');
    });

    it('should update hobbies field', () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      biometricDataService.updateField('hobbies', 'reading, gaming');

      const session = biometricDataService.getCurrentSession();
      expect(session?.hobbies).toBe('reading, gaming');
    });

    it('should handle multiple field updates', () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      biometricDataService.updateField('nickname', 'John');
      biometricDataService.updateField('weight', 180);
      biometricDataService.updateField('height', 72);

      const session = biometricDataService.getCurrentSession();
      expect(session?.nickname).toBe('John');
      expect(session?.weight).toBe(180);
      expect(session?.height).toBe(72);
    });
  });

  describe('Progressive Saving', () => {
    it('should delay save after field update', async () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      vi.clearAllMocks();
      biometricDataService.updateField('nickname', 'Test');

      // Should not save immediately
      expect(global.fetch).not.toHaveBeenCalled();

      // Wait for save delay (2 seconds default)
      vi.advanceTimersByTime(2000);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should batch multiple updates into single save', async () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      vi.clearAllMocks();

      biometricDataService.updateField('nickname', 'John');
      biometricDataService.updateField('weight', 170);
      biometricDataService.updateField('height', 68);

      // Advance timer
      vi.advanceTimersByTime(2000);

      // Should only save once with all updates
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on subsequent updates', async () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      vi.clearAllMocks();

      biometricDataService.updateField('nickname', 'John');
      vi.advanceTimersByTime(1000);

      biometricDataService.updateField('weight', 170);
      vi.advanceTimersByTime(1000);

      // Should not have saved yet (timer reset)
      expect(global.fetch).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);

      // Now should save
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Immediate Save', () => {
    it('should save immediately when requested', async () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      biometricDataService.updateField('nickname', 'John');

      vi.clearAllMocks();
      await biometricDataService.saveNow();

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should cancel pending delayed save on immediate save', async () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      biometricDataService.updateField('nickname', 'John');
      await biometricDataService.saveNow();

      vi.clearAllMocks();

      // Advance timer - should not trigger another save
      vi.advanceTimersByTime(2000);

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Session Management', () => {
    it('should return current session data', () => {
      const userId = 'test-user';
      const session = biometricDataService.initializeSession(userId);

      const retrieved = biometricDataService.getCurrentSession();

      expect(retrieved).toEqual(session);
    });

    it('should clear session', () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      biometricDataService.clearSession();

      const session = biometricDataService.getCurrentSession();
      expect(session).toBeNull();
    });

    it('should return null when no session exists', () => {
      const session = biometricDataService.getCurrentSession();

      expect(session).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle save errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const userId = 'test-user';
      biometricDataService.initializeSession(userId);
      biometricDataService.updateField('nickname', 'Test');

      // Should not throw
      await expect(biometricDataService.saveNow()).resolves.not.toThrow();
    });

    it('should handle API error responses', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Server Error'
      });

      const userId = 'test-user';
      biometricDataService.initializeSession(userId);
      biometricDataService.updateField('nickname', 'Test');

      await expect(biometricDataService.saveNow()).resolves.not.toThrow();
    });

    it('should not crash on field update without session', () => {
      expect(() => {
        biometricDataService.updateField('nickname', 'Test');
      }).not.toThrow();
    });
  });

  describe('Data Validation', () => {
    it('should handle invalid field names', () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      expect(() => {
        biometricDataService.updateField('invalidField' as any, 'test');
      }).not.toThrow();
    });

    it('should accept valid weight values', () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      biometricDataService.updateField('weight', 150);

      const session = biometricDataService.getCurrentSession();
      expect(session?.weight).toBe(150);
    });

    it('should accept valid height values', () => {
      const userId = 'test-user';
      biometricDataService.initializeSession(userId);

      biometricDataService.updateField('height', 65);

      const session = biometricDataService.getCurrentSession();
      expect(session?.height).toBe(65);
    });
  });
});
