import { useEffect, useRef, useState, useCallback } from 'react';
import { HubConnectionState } from '@microsoft/signalr';
import { 
  signalRService, 
  AgentMessage, 
  AgentHandoffNotification, 
  AgentTypingNotification, 
  UserMessage, 
  SessionStatus 
} from '../services/signalRService';

export interface UseSignalRReturn {
  // Connection state
  connectionState: HubConnectionState;
  isConnected: boolean;
  error: string | null;
  
  // Session management
  sessionId: string | null;
  sessionStatus: SessionStatus | null;
  
  // Real-time data
  agentMessages: AgentMessage[];
  handoffNotifications: AgentHandoffNotification[];
  agentTyping: Record<string, boolean>;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  joinSession: (sessionId: string) => Promise<void>;
  sendMessage: (message: UserMessage) => Promise<void>;
  clearMessages: () => void;
  refreshSessionStatus: () => Promise<void>;
}

export const useSignalR = (): UseSignalRReturn => {
  // Connection state
  const [connectionState, setConnectionState] = useState<HubConnectionState>(HubConnectionState.Disconnected);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  
  // Real-time data
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [handoffNotifications, setHandoffNotifications] = useState<AgentHandoffNotification[]>([]);
  const [agentTyping, setAgentTyping] = useState<Record<string, boolean>>({});
  
  // Refs for cleanup
  const isInitialized = useRef(false);

  // Initialize SignalR service and event handlers
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Set up event handlers
    signalRService.onAgentMessage((message: AgentMessage) => {
      setAgentMessages(prev => [...prev, message]);
    });

    signalRService.onAgentHandoff((notification: AgentHandoffNotification) => {
      setHandoffNotifications(prev => [...prev, notification]);
    });

    signalRService.onAgentTyping((notification: AgentTypingNotification) => {
      setAgentTyping(prev => ({
        ...prev,
        [notification.agentName]: notification.isTyping
      }));
    });

    signalRService.onSessionStatus((status: SessionStatus) => {
      setSessionStatus(status);
    });

    signalRService.onError((errorMessage: string) => {
      setError(errorMessage);
    });

    // Update connection state periodically
    const interval = setInterval(() => {
      const state = signalRService.connectionState;
      setConnectionState(state);
      setIsConnected(state === HubConnectionState.Connected);
    }, 1000);

    return () => {
      clearInterval(interval);
      signalRService.dispose();
    };
  }, []);

  // Actions
  const connect = useCallback(async () => {
    try {
      setError(null);
      await signalRService.start();
      setIsConnected(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await signalRService.stop();
      setIsConnected(false);
      setSessionId(null);
      setSessionStatus(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const joinSession = useCallback(async (newSessionId: string) => {
    try {
      setError(null);
      await signalRService.joinSession(newSessionId);
      setSessionId(newSessionId);
      
      // Get initial session status
      const status = await signalRService.getSessionStatus();
      setSessionStatus(status);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join session';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const sendMessage = useCallback(async (message: UserMessage) => {
    try {
      setError(null);
      await signalRService.sendUserMessage(message);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const clearMessages = useCallback(() => {
    setAgentMessages([]);
    setHandoffNotifications([]);
    setAgentTyping({});
  }, []);

  const refreshSessionStatus = useCallback(async () => {
    try {
      const status = await signalRService.getSessionStatus();
      setSessionStatus(status);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh session status';
      setError(errorMessage);
      throw err;
    }
  }, []);

  return {
    // Connection state
    connectionState,
    isConnected,
    error,
    
    // Session management
    sessionId,
    sessionStatus,
    
    // Real-time data
    agentMessages,
    handoffNotifications,
    agentTyping,
    
    // Actions
    connect,
    disconnect,
    joinSession,
    sendMessage,
    clearMessages,
    refreshSessionStatus
  };
};