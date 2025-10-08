/**
 * Chat Transcript Service for continuously saving conversation transcripts to blob storage
 * Handles session management and real-time conversation updates
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  messageType?: string; // Optional: "phq-assessment", "general-chat", etc.
  additionalData?: Record<string, any>;
}

export interface ChatTranscript {
  userId: string;
  sessionId: string;
  createdAt: string;
  lastUpdated: string;
  sessionEndedAt?: string;
  isActive: boolean;
  messages: ChatMessage[];
  metadata?: {
    userAgent?: string;
    clientTimezone?: string;
    ipAddress?: string;
    platform?: string;
    customData?: Record<string, any>;
  };
}

export interface ChatTranscriptSaveRequest {
  transcriptData: ChatTranscript;
  metadata?: Record<string, any>;
  containerName?: string;
  fileName?: string;
}

class ChatTranscriptService {
  private currentTranscript: ChatTranscript | null = null;
  private saveQueue: ChatMessage[] = [];
  private isSaving = false;
  private saveTimer: NodeJS.Timeout | null = null;
  private readonly saveDelay = 1000; // 1 second delay to batch rapid messages

  /**
   * Initialize a new chat session
   */
  initializeSession(userId: string, sessionId?: string): ChatTranscript {
    const newSessionId = sessionId || this.generateSessionId();
    
    this.currentTranscript = {
      userId,
      sessionId: newSessionId,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isActive: true,
      messages: [],
      metadata: {
        userAgent: navigator.userAgent,
        clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform,
        customData: {}
      }
    };

    // Save initial empty transcript
    this.saveTranscriptImmediate();
    
    return this.currentTranscript;
  }

  /**
   * Add a message to the current transcript
   */
  addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): void {
    if (!this.currentTranscript) {
      console.warn('No active chat session. Initialize session first.');
      return;
    }

    const fullMessage: ChatMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: new Date().toISOString()
    };

    this.currentTranscript.messages.push(fullMessage);
    this.currentTranscript.lastUpdated = new Date().toISOString();

    // Add to save queue and schedule save
    this.saveQueue.push(fullMessage);
    this.scheduleDelayedSave();
  }

  /**
   * Add a user message
   */
  addUserMessage(content: string, messageType?: string, additionalData?: Record<string, any>): void {
    this.addMessage({
      role: 'user',
      content,
      messageType,
      additionalData
    });
  }

  /**
   * Add an assistant message
   */
  addAssistantMessage(content: string, messageType?: string, additionalData?: Record<string, any>): void {
    this.addMessage({
      role: 'assistant',
      content,
      messageType,
      additionalData
    });
  }

  /**
   * Add a system message
   */
  addSystemMessage(content: string, messageType?: string, additionalData?: Record<string, any>): void {
    this.addMessage({
      role: 'system',
      content,
      messageType,
      additionalData
    });
  }

  /**
   * End the current session
   */
  endSession(): void {
    if (!this.currentTranscript) {
      console.warn('No active chat session to end');
      return;
    }

    this.currentTranscript.isActive = false;
    this.currentTranscript.sessionEndedAt = new Date().toISOString();
    this.currentTranscript.lastUpdated = new Date().toISOString();

    // Force immediate save for session end
    this.saveTranscriptImmediate();
  }

  /**
   * Get the current transcript
   */
  getCurrentTranscript(): ChatTranscript | null {
    return this.currentTranscript;
  }

  /**
   * Get session summary
   */
  getSessionSummary(): { messageCount: number; duration: string; isActive: boolean } | null {
    if (!this.currentTranscript) return null;

    const messageCount = this.currentTranscript.messages.length;
    const startTime = new Date(this.currentTranscript.createdAt);
    const endTime = this.currentTranscript.sessionEndedAt ? 
      new Date(this.currentTranscript.sessionEndedAt) : 
      new Date();
    
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.floor(durationMs / 60000);
    const durationSeconds = Math.floor((durationMs % 60000) / 1000);
    const duration = `${durationMinutes}m ${durationSeconds}s`;

    return {
      messageCount,
      duration,
      isActive: this.currentTranscript.isActive
    };
  }

  /**
   * Schedule a delayed save to batch rapid messages
   */
  private scheduleDelayedSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveTranscriptImmediate();
    }, this.saveDelay);
  }

  /**
   * Save transcript immediately
   */
  private async saveTranscriptImmediate(): Promise<void> {
    if (!this.currentTranscript) {
      console.warn('No active transcript to save');
      return;
    }
    
    if (this.isSaving) {
      console.log('Save already in progress, skipping duplicate save');
      return;
    }

    try {
      this.isSaving = true;

      // Clear the save queue since we're saving now
      this.saveQueue = [];

      // Clear any pending timer
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }

      // Validate transcript data before sending
      if (!this.currentTranscript.userId || !this.currentTranscript.sessionId) {
        console.error('Invalid transcript data: missing userId or sessionId', {
          userId: this.currentTranscript.userId,
          sessionId: this.currentTranscript.sessionId
        });
        return;
      }

      const functionsBaseUrl = import.meta.env.VITE_FUNCTIONS_URL || 'http://localhost:7071';
      const endpoint = `${functionsBaseUrl}/api/SaveChatTranscript`;

      const request: ChatTranscriptSaveRequest = {
        transcriptData: { ...this.currentTranscript },
        metadata: {
          saveTimestamp: new Date().toISOString(),
          messageCount: this.currentTranscript.messages.length,
          sessionActive: this.currentTranscript.isActive
        },
        containerName: 'chat-transcripts'
      };

      console.log('Saving chat transcript:', {
        userId: request.transcriptData.userId,
        sessionId: request.transcriptData.sessionId,
        messageCount: request.transcriptData.messages.length,
        isActive: request.transcriptData.isActive
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save chat transcript: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Chat transcript saved successfully:', result);

    } catch (error) {
      console.error('Error saving chat transcript:', error);
      
      // Retry failed saves after a delay
      setTimeout(() => {
        if (this.currentTranscript && this.saveQueue.length === 0) {
          this.saveTranscriptImmediate();
        }
      }, 5000); // Retry after 5 seconds
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Force save without delay (for critical events)
   */
  async forceSave(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.saveTranscriptImmediate();
  }

  /**
   * Update custom metadata
   */
  updateMetadata(customData: Record<string, any>): void {
    if (!this.currentTranscript) return;

    if (!this.currentTranscript.metadata) {
      this.currentTranscript.metadata = {};
    }

    if (!this.currentTranscript.metadata.customData) {
      this.currentTranscript.metadata.customData = {};
    }

    Object.assign(this.currentTranscript.metadata.customData, customData);
    this.currentTranscript.lastUpdated = new Date().toISOString();

    // Schedule save for metadata updates
    this.scheduleDelayedSave();
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    
    // Force final save if there are pending messages
    if (this.currentTranscript && this.saveQueue.length > 0) {
      this.saveTranscriptImmediate();
    }
  }
}

// Export singleton instance
export const chatTranscriptService = new ChatTranscriptService();
export default chatTranscriptService;