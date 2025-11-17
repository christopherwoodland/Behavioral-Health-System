import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { chatTranscriptService } from '../chatTranscriptService';

// Mock fetch
global.fetch = vi.fn();

describe('Chat Transcript Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
  });

  afterEach(() => {
    chatTranscriptService.endSession();
  });

  describe('Session Initialization', () => {
    it('should initialize a new chat session', () => {
      const userId = 'test-user-123';
      const transcript = chatTranscriptService.initializeSession(userId);

      expect(transcript).toBeDefined();
      expect(transcript.userId).toBe(userId);
      expect(transcript.sessionId).toBeTruthy();
      expect(transcript.isActive).toBe(true);
      expect(transcript.messages).toEqual([]);
    });

    it('should use provided session ID', () => {
      const userId = 'test-user-123';
      const sessionId = 'custom-session-id';
      const transcript = chatTranscriptService.initializeSession(userId, sessionId);

      expect(transcript.sessionId).toBe(sessionId);
    });

    it('should include metadata in session', () => {
      const userId = 'test-user-123';
      const transcript = chatTranscriptService.initializeSession(userId);

      expect(transcript.metadata).toBeDefined();
      expect(transcript.metadata?.userAgent).toBeTruthy();
      expect(transcript.metadata?.clientTimezone).toBeTruthy();
      expect(transcript.metadata?.platform).toBeTruthy();
    });

    it('should save initial transcript on initialization', async () => {
      const userId = 'test-user-123';
      chatTranscriptService.initializeSession(userId);

      // Wait for async save
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Message Management', () => {
    it('should add user message to transcript', () => {
      const userId = 'test-user';
      chatTranscriptService.initializeSession(userId);

      const message = chatTranscriptService.addMessage('user', 'Hello, how are you?');

      expect(message).toBeDefined();
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, how are you?');
      expect(message.timestamp).toBeTruthy();
      expect(message.id).toBeTruthy();
    });

    it('should add assistant message to transcript', () => {
      const userId = 'test-user';
      chatTranscriptService.initializeSession(userId);

      const message = chatTranscriptService.addMessage('assistant', 'I am doing well, thank you!');

      expect(message.role).toBe('assistant');
      expect(message.content).toBe('I am doing well, thank you!');
    });

    it('should add system message to transcript', () => {
      const userId = 'test-user';
      chatTranscriptService.initializeSession(userId);

      const message = chatTranscriptService.addMessage('system', 'Session started');

      expect(message.role).toBe('system');
    });

    it('should handle message metadata', () => {
      const userId = 'test-user';
      chatTranscriptService.initializeSession(userId);

      const metadata = { customField: 'test-value' };
      const message = chatTranscriptService.addMessage('user', 'Test', metadata);

      expect(message.additionalData).toEqual(metadata);
    });
  });

  describe('PHQ Assessment Messages', () => {
    it('should add PHQ question message', () => {
      const userId = 'test-user';
      chatTranscriptService.initializeSession(userId);

      const message = chatTranscriptService.addPhqQuestionMessage(
        'How often have you felt down?',
        2,
        1,
        'assessment-123'
      );

      expect(message.isPhqQuestion).toBe(true);
      expect(message.phqType).toBe(2);
      expect(message.phqQuestionNumber).toBe(1);
      expect(message.assessmentId).toBe('assessment-123');
    });

    it('should add PHQ answer message', () => {
      const userId = 'test-user';
      chatTranscriptService.initializeSession(userId);

      const message = chatTranscriptService.addPhqAnswerMessage(
        2,
        1,
        3,
        'assessment-123'
      );

      expect(message.isPhqAnswer).toBe(true);
      expect(message.phqType).toBe(2);
      expect(message.phqQuestionNumber).toBe(1);
      expect(message.phqAnswerValue).toBe(3);
      expect(message.assessmentId).toBe('assessment-123');
    });
  });

  describe('Session Management', () => {
    it('should return current transcript', () => {
      const userId = 'test-user';
      const transcript = chatTranscriptService.initializeSession(userId);

      const retrieved = chatTranscriptService.getCurrentTranscript();

      expect(retrieved).toEqual(transcript);
    });

    it('should end session and mark inactive', async () => {
      const userId = 'test-user';
      chatTranscriptService.initializeSession(userId);

      await chatTranscriptService.endSession();

      const transcript = chatTranscriptService.getCurrentTranscript();
      expect(transcript?.isActive).toBe(false);
      expect(transcript?.sessionEndedAt).toBeTruthy();
    });

    it('should clear transcript on end session', async () => {
      const userId = 'test-user';
      chatTranscriptService.initializeSession(userId);

      await chatTranscriptService.endSession();

      const transcript = chatTranscriptService.getCurrentTranscript();
      expect(transcript).toBeNull();
    });
  });

  describe('Auto-save Functionality', () => {
    it('should batch multiple messages before saving', async () => {
      const userId = 'test-user';
      chatTranscriptService.initializeSession(userId);

      vi.clearAllMocks();

      chatTranscriptService.addMessage('user', 'Message 1');
      chatTranscriptService.addMessage('assistant', 'Response 1');
      chatTranscriptService.addMessage('user', 'Message 2');

      // Should not have saved yet (batching delay)
      expect(global.fetch).not.toHaveBeenCalled();

      // Wait for batch save delay
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Should have saved once with all messages
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should save immediately on demand', async () => {
      const userId = 'test-user';
      chatTranscriptService.initializeSession(userId);

      vi.clearAllMocks();

      chatTranscriptService.addMessage('user', 'Important message');
      await chatTranscriptService.saveNow();

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle save errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const userId = 'test-user';
      chatTranscriptService.initializeSession(userId);

      // Should not throw
      await expect(chatTranscriptService.saveNow()).resolves.not.toThrow();
    });

    it('should not crash if no session initialized', () => {
      expect(() => {
        chatTranscriptService.addMessage('user', 'Test');
      }).not.toThrow();
    });
  });

  describe('Message Retrieval', () => {
    it('should get all messages in order', () => {
      const userId = 'test-user';
      chatTranscriptService.initializeSession(userId);

      chatTranscriptService.addMessage('user', 'Message 1');
      chatTranscriptService.addMessage('assistant', 'Response 1');
      chatTranscriptService.addMessage('user', 'Message 2');

      const messages = chatTranscriptService.getMessages();

      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('Message 1');
      expect(messages[1].content).toBe('Response 1');
      expect(messages[2].content).toBe('Message 2');
    });

    it('should return empty array if no session', () => {
      const messages = chatTranscriptService.getMessages();

      expect(messages).toEqual([]);
    });
  });
});
