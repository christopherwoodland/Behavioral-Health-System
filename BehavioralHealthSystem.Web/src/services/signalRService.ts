import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';

export interface AgentMessage {
  agentName: string;
  content: string;
  timestamp: string;
  confidence?: number;
  suggestedActions?: string[];
}

export interface AgentHandoffNotification {
  fromAgent: string;
  toAgent: string;
  reason: string;
  timestamp: string;
  userContext?: any;
}

export interface AgentTypingNotification {
  agentName: string;
  isTyping: boolean;
  timestamp: string;
}

export interface UserMessage {
  content: string;
  timestamp: string;
  audioData?: string;
  metadata?: {
    speechConfidence?: number;
    voiceActivityLevel?: number;
    processingTime?: number;
  };
}

export interface SessionStatus {
  sessionId: string;
  currentAgent: string;
  status: 'active' | 'handoff' | 'crisis' | 'complete';
  timestamp: string;
  participants: string[];
}

export class SignalRService {
  private connection: HubConnection | null = null;
  private sessionId: string | null = null;
  
  // Event handlers
  private onAgentMessageHandler?: (message: AgentMessage) => void;
  private onHandoffHandler?: (notification: AgentHandoffNotification) => void;
  private onAgentTypingHandler?: (notification: AgentTypingNotification) => void;
  private onSessionStatusHandler?: (status: SessionStatus) => void;
  private onErrorHandler?: (error: string) => void;

  constructor(private baseUrl: string = 'http://localhost:7071') {
    this.setupConnection();
  }

  private setupConnection(): void {
    this.connection = new HubConnectionBuilder()
      .withUrl(`${this.baseUrl}/api`)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    // Set up event listeners
    this.connection.on('AgentMessage', (message: AgentMessage) => {
      console.log('Received agent message:', message);
      this.onAgentMessageHandler?.(message);
    });

    this.connection.on('AgentHandoff', (notification: AgentHandoffNotification) => {
      console.log('Received handoff notification:', notification);
      this.onHandoffHandler?.(notification);
    });

    this.connection.on('AgentTyping', (notification: AgentTypingNotification) => {
      console.log('Received typing notification:', notification);
      this.onAgentTypingHandler?.(notification);
    });

    this.connection.on('SessionStatus', (status: SessionStatus) => {
      console.log('Received session status:', status);
      this.onSessionStatusHandler?.(status);
    });

    // Handle connection events
    this.connection.onreconnecting(() => {
      console.log('SignalR reconnecting...');
    });

    this.connection.onreconnected(() => {
      console.log('SignalR reconnected');
      // Rejoin session if we have one
      if (this.sessionId) {
        this.joinSession(this.sessionId);
      }
    });

    this.connection.onclose((error?: Error) => {
      console.error('SignalR connection closed:', error);
      this.onErrorHandler?.(`Connection closed: ${error?.message || 'Unknown error'}`);
    });
  }

  async start(): Promise<void> {
    if (!this.connection) {
      throw new Error('SignalR connection not initialized');
    }

    try {
      await this.connection.start();
      console.log('SignalR connection started');
    } catch (error) {
      console.error('Error starting SignalR connection:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.connection && this.connection.state === HubConnectionState.Connected) {
      await this.connection.stop();
      console.log('SignalR connection stopped');
    }
  }

  async joinSession(sessionId: string): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('SignalR connection is not active');
    }

    try {
      this.sessionId = sessionId;
      await this.connection.invoke('JoinSession', sessionId);
      console.log(`Joined session: ${sessionId}`);
    } catch (error) {
      console.error('Error joining session:', error);
      throw error;
    }
  }

  async sendUserMessage(message: UserMessage): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('SignalR connection is not active');
    }

    if (!this.sessionId) {
      throw new Error('No active session');
    }

    try {
      await this.connection.invoke('SendUserMessage', this.sessionId, message);
      console.log('User message sent:', message);
    } catch (error) {
      console.error('Error sending user message:', error);
      throw error;
    }
  }

  async getSessionStatus(): Promise<SessionStatus | null> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) {
      throw new Error('SignalR connection is not active');
    }

    if (!this.sessionId) {
      return null;
    }

    try {
      const status = await this.connection.invoke('GetSessionStatus', this.sessionId);
      return status;
    } catch (error) {
      console.error('Error getting session status:', error);
      throw error;
    }
  }

  // Event handler setters
  onAgentMessage(handler: (message: AgentMessage) => void): void {
    this.onAgentMessageHandler = handler;
  }

  onAgentHandoff(handler: (notification: AgentHandoffNotification) => void): void {
    this.onHandoffHandler = handler;
  }

  onAgentTyping(handler: (notification: AgentTypingNotification) => void): void {
    this.onAgentTypingHandler = handler;
  }

  onSessionStatus(handler: (status: SessionStatus) => void): void {
    this.onSessionStatusHandler = handler;
  }

  onError(handler: (error: string) => void): void {
    this.onErrorHandler = handler;
  }

  // Utility methods
  get connectionState(): HubConnectionState {
    return this.connection?.state || HubConnectionState.Disconnected;
  }

  get isConnected(): boolean {
    return this.connection?.state === HubConnectionState.Connected;
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }

  // Clean up
  dispose(): void {
    this.stop();
    this.connection = null;
    this.sessionId = null;
    this.onAgentMessageHandler = undefined;
    this.onHandoffHandler = undefined;
    this.onAgentTypingHandler = undefined;
    this.onSessionStatusHandler = undefined;
    this.onErrorHandler = undefined;
  }
}

// Singleton instance
export const signalRService = new SignalRService();