import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel, HttpTransportType } from '@microsoft/signalr';

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

  private async getNegotiationInfo(): Promise<any> {
    try {
      console.log(`Attempting to negotiate with: ${this.baseUrl}/api/negotiate`);
      
      const response = await fetch(`${this.baseUrl}/api/negotiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`Negotiate response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Negotiate failed: ${response.status} ${response.statusText} - ${errorText}`);
        throw new Error(`Negotiate failed: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('Negotiation successful:', result);
      return result;
    } catch (error) {
      console.error('Error getting negotiation info:', error);
      throw error;
    }
  }

  private setupConnection(): void {
    // Initialize as null - we'll set it up in start()
    this.connection = null;
  }

  async start(): Promise<void> {
    try {
      // Get negotiation info from Azure Functions
      const negotiateInfo = await this.getNegotiationInfo();
      console.log('Negotiation info:', negotiateInfo);
      
      // Handle both possible response formats (url/Url and accessToken/AccessToken)
      const signalRUrl = negotiateInfo.url || negotiateInfo.Url;
      const accessToken = negotiateInfo.accessToken || negotiateInfo.AccessToken;
      
      if (!signalRUrl) {
        throw new Error('No SignalR URL received from negotiation');
      }
      
      if (!accessToken) {
        throw new Error('No access token received from negotiation');
      }
      
      console.log('Using SignalR URL:', signalRUrl);
      console.log('Access token length:', accessToken.length);
      
      // Create connection with the negotiated URL and access token
      this.connection = new HubConnectionBuilder()
        .withUrl(signalRUrl, {
          accessTokenFactory: () => accessToken,
          transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Information)
        .build();

      // Set up event listeners
      this.setupEventListeners();

      console.log('Starting SignalR connection...');
      await this.connection.start();
      console.log('SignalR connection started successfully');
      console.log('Connection ID:', this.connection.connectionId);
      console.log('Connection State:', this.connection.state);
    } catch (error) {
      console.error('Error starting SignalR connection:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.connection) return;

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
      // Note: We don't automatically rejoin session here since the connectionId changes
      // The UI should handle rejoining if needed
    });

    this.connection.onclose((error?: Error) => {
      console.error('SignalR connection closed:', error);
      this.onErrorHandler?.(`Connection closed: ${error?.message || 'Unknown error'}`);
    });
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
      
      // Use HTTP API to join session group instead of hub method
      const joinResponse = await fetch(`${this.baseUrl}/api/session/${sessionId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          connectionId: this.connection.connectionId
        }),
      });

      if (!joinResponse.ok) {
        const errorText = await joinResponse.text();
        throw new Error(`Failed to join session: ${joinResponse.status} ${errorText}`);
      }

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
      // Use HTTP API to send user message
      const response = await fetch(`${this.baseUrl}/api/sendusermessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          content: message.content,
          timestamp: message.timestamp,
          audioData: message.audioData,
          metadata: message.metadata
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${response.status} ${errorText}`);
      }

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
      // For now, return a mock status since we haven't implemented the backend yet
      // TODO: Implement session status endpoint
      const status: SessionStatus = {
        sessionId: this.sessionId,
        currentAgent: 'CoordinatorAgent',
        status: 'active',
        timestamp: new Date().toISOString(),
        participants: ['user', 'CoordinatorAgent']
      };
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