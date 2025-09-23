/**
 * Semantic Kernel Agent Service
 * TypeScript service that communicates with C# Semantic Kernel backend
 * Replaces the TypeScript agent implementations with backend integration
 */

import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

// Types matching C# backend models
export interface RealtimeSession {
  sessionId: string;
  userId: string;
  startTime: string;
  state: 'Idle' | 'Listening' | 'Processing' | 'Speaking' | 'Error';
  currentAgentType?: string;
  context: Record<string, any>;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  agent?: string;
  audioData?: ArrayBuffer;
  transcription?: string;
}

export interface Phq2Assessment {
  userId: string;
  startDate: string;
  completedDate?: string;
  responses: Phq2Response[];
  isCompleted: boolean;
  totalScore?: number;
  severity?: Phq2Severity;
}

export interface Phq2Response {
  questionNumber: number;
  score: Phq2ResponseScale;
  responseDate: string;
  numericScore: number;
}

export enum Phq2ResponseScale {
  NotAtAll = 0,
  SeveralDays = 1,
  MoreThanHalfTheDays = 2,
  NearlyEveryDay = 3
}

export enum Phq2Severity {
  Minimal = 0,    // 0-2: Minimal depression likelihood
  Positive = 1    // 3-6: Positive screen - further evaluation recommended
}

export interface AgentResponse {
  text: string;
  audioData?: ArrayBuffer;
  agentType: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface VoiceActivityResult {
  hasVoice: boolean;
  confidence: number;
  duration: number;
  volumeLevel: number;
}

export interface SessionConfig {
  enableAudio: boolean;
  enableVAD: boolean;
  preferredVoice: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Main service class for communicating with C# Semantic Kernel backend
 */
export class SemanticKernelAgentService extends EventTarget {
  private hubConnection: HubConnection | null = null;
  private baseUrl: string;
  private currentSession: RealtimeSession | null = null;
  private conversationHistory: ConversationMessage[] = [];
  private isConnected = false;

  constructor(baseUrl: string = 'http://localhost:7071') {
    super();
    this.baseUrl = baseUrl;
  }

  /**
   * Initialize SignalR connection to C# backend
   */
  async initialize(): Promise<void> {
    try {
      this.hubConnection = new HubConnectionBuilder()
        .withUrl(`${this.baseUrl}/api`)
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Information)
        .build();

      // Set up event handlers
      this.setupEventHandlers();

      // Start connection
      await this.hubConnection.start();
      this.isConnected = true;
      
      this.dispatchEvent(new CustomEvent('connected', { 
        detail: { connectionId: this.hubConnection.connectionId } 
      }));

      console.log('Connected to Semantic Kernel Agent Hub');
    } catch (error) {
      console.error('Failed to connect to agent hub:', error);
      this.dispatchEvent(new CustomEvent('connectionError', { detail: { error } }));
      throw error;
    }
  }

  /**
   * Set up SignalR event handlers
   */
  private setupEventHandlers(): void {
    if (!this.hubConnection) return;

    // Session events
    this.hubConnection.on('SessionStarted', (session: RealtimeSession) => {
      this.currentSession = session;
      this.dispatchEvent(new CustomEvent('sessionStarted', { detail: { session } }));
    });

    this.hubConnection.on('SessionEnded', (sessionId: string) => {
      if (this.currentSession?.sessionId === sessionId) {
        this.currentSession = null;
      }
      this.dispatchEvent(new CustomEvent('sessionEnded', { detail: { sessionId } }));
    });

    // Agent events
    this.hubConnection.on('AgentSwitched', (data: { fromAgent: string; toAgent: string; reason: string }) => {
      this.dispatchEvent(new CustomEvent('agentSwitched', { detail: data }));
    });

    this.hubConnection.on('AgentResponse', (response: AgentResponse) => {
      // Add to conversation history
      const message: ConversationMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: response.text,
        timestamp: response.timestamp,
        agent: response.agentType,
        audioData: response.audioData
      };
      
      this.conversationHistory.push(message);
      this.dispatchEvent(new CustomEvent('messageReceived', { detail: { message, response } }));
    });

    // PHQ-2 specific events
    this.hubConnection.on('Phq2QuestionAsked', (data: { questionNumber: number; questionText: string }) => {
      this.dispatchEvent(new CustomEvent('phq2QuestionAsked', { detail: data }));
    });

    this.hubConnection.on('Phq2AssessmentCompleted', (assessment: Phq2Assessment) => {
      this.dispatchEvent(new CustomEvent('phq2AssessmentCompleted', { detail: { assessment } }));
    });

    // Audio events
    this.hubConnection.on('VoiceActivityDetected', (activity: VoiceActivityResult) => {
      this.dispatchEvent(new CustomEvent('voiceActivityDetected', { detail: { activity } }));
    });

    this.hubConnection.on('AudioPlaybackStarted', () => {
      this.dispatchEvent(new CustomEvent('audioPlaybackStarted'));
    });

    this.hubConnection.on('AudioPlaybackEnded', () => {
      this.dispatchEvent(new CustomEvent('audioPlaybackEnded'));
    });

    // Error handling
    this.hubConnection.on('ErrorOccurred', (error: { message: string; details?: string }) => {
      console.error('Agent service error:', error);
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
    });

    // Connection events
    this.hubConnection.onreconnecting(() => {
      this.isConnected = false;
      this.dispatchEvent(new CustomEvent('reconnecting'));
    });

    this.hubConnection.onreconnected(() => {
      this.isConnected = true;
      this.dispatchEvent(new CustomEvent('reconnected'));
    });

    this.hubConnection.onclose(() => {
      this.isConnected = false;
      this.dispatchEvent(new CustomEvent('disconnected'));
    });
  }

  /**
   * Start a new agent session
   */
  async startSession(userId: string, config: SessionConfig): Promise<string> {
    if (!this.hubConnection || !this.isConnected) {
      throw new Error('Not connected to agent service');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/speech-agent/start-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, config })
      });

      if (!response.ok) {
        throw new Error(`Failed to start session: ${response.statusText}`);
      }

      const result = await response.json();
      return result.sessionId;
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    }
  }

  /**
   * End the current session
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      await fetch(`${this.baseUrl}/api/speech-agent/end-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: this.currentSession.sessionId })
      });

      this.currentSession = null;
      this.conversationHistory = [];
    } catch (error) {
      console.error('Failed to end session:', error);
      throw error;
    }
  }

  /**
   * Send a text message to the agent
   */
  async sendMessage(message: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    try {
      // Add user message to history
      const userMessage: ConversationMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      };
      
      this.conversationHistory.push(userMessage);

      // Send to backend
      await fetch(`${this.baseUrl}/api/speech-agent/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.currentSession.sessionId,
          message,
          timestamp: userMessage.timestamp
        })
      });

      this.dispatchEvent(new CustomEvent('messageSent', { detail: { message: userMessage } }));
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Send audio data to the agent
   */
  async sendAudio(audioData: ArrayBuffer): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    try {
      // Convert audio data to base64 for transmission
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioData)));

      await fetch(`${this.baseUrl}/api/speech-agent/send-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.currentSession.sessionId,
          audioData: base64Audio,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to send audio:', error);
      throw error;
    }
  }

  /**
   * Request agent handoff
   */
  async requestAgentHandoff(targetAgent: string, reason: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    try {
      await fetch(`${this.baseUrl}/api/speech-agent/handoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.currentSession.sessionId,
          targetAgent,
          reason,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to request agent handoff:', error);
      throw error;
    }
  }

  /**
   * Start PHQ-2 assessment
   */
  async startPhq2Assessment(): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    try {
      await fetch(`${this.baseUrl}/api/speech-agent/start-phq2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.currentSession.sessionId,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to start PHQ-2 assessment:', error);
      throw error;
    }
  }

  /**
   * Answer PHQ-2 question
   */
  async answerPhq2Question(questionNumber: number, score: Phq2ResponseScale): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    try {
      await fetch(`${this.baseUrl}/api/speech-agent/answer-phq2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.currentSession.sessionId,
          questionNumber,
          score,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to answer PHQ-2 question:', error);
      throw error;
    }
  }

  /**
   * Get current session info
   */
  getCurrentSession(): RealtimeSession | null {
    return this.currentSession;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Check connection status
   */
  isServiceConnected(): boolean {
    return this.isConnected && this.hubConnection?.state === 'Connected';
  }

  /**
   * Disconnect from the service
   */
  async disconnect(): Promise<void> {
    if (this.currentSession) {
      await this.endSession();
    }

    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = null;
    }

    this.isConnected = false;
    this.dispatchEvent(new CustomEvent('disconnected'));
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: string; version: string; timestamp: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const semanticKernelAgentService = new SemanticKernelAgentService();