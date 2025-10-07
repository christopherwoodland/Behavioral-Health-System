import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Settings, 
  Users,
  Activity,
  Pause,
  Play,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { announceToScreenReader } from '@/utils';
import { 
  azureOpenAIRealtimeService,
  RealtimeMessage,
  RealtimeSessionConfig,
  AzureOpenAIRealtimeSettings,
  convertSettingsToConfig,
  SpeechDetectionState,
  LiveTranscript,
  ConversationState
} from '@/services/azureOpenAIRealtimeService';
import VoiceActivityVisualizer from '@/components/VoiceActivityVisualizer';
import SpeechSettings from '@/components/SpeechSettings';

// Type alias for backward compatibility with existing UI
type ConversationMessage = RealtimeMessage;
type SessionConfig = RealtimeSessionConfig;

interface AgentStatus {
  id: string;
  name: string;
  isActive: boolean;
  isTyping: boolean;
  lastActivity?: Date;
}

interface SessionStatus {
  isActive: boolean;
  sessionId?: string;
  startTime?: Date;
  messageCount: number;
  currentAgent: string;
  hasAudioSupport: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export const RealtimeAgentExperience: React.FC = () => {
  // Core service - direct WebRTC connection to Azure OpenAI Realtime API
  const agentService = azureOpenAIRealtimeService;
  
  // UI State
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  
  // Agent State - Simplified for single GPT-Realtime agent
  const [currentAgent, setCurrentAgent] = useState<AgentStatus>({
    id: 'gpt-realtime',
    name: 'AI Assistant',
    isActive: false,
    isTyping: false
  });
  
  // Session State
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>({
    isActive: false,
    messageCount: 0,
    currentAgent: 'coordinator',
    hasAudioSupport: false,
    connectionStatus: 'disconnected'
  });
  
  // Audio State
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [voiceActivityLevel, setVoiceActivityLevel] = useState(0);
  const [isSessionPaused, setIsSessionPaused] = useState(false);
  
  // Enhanced features state
  const [speechDetection, setSpeechDetection] = useState<SpeechDetectionState>({
    isUserSpeaking: false,
    isAISpeaking: false
  });
  const [conversationState, setConversationState] = useState<ConversationState>({ state: 'idle' });
  const [liveTranscripts, setLiveTranscripts] = useState<LiveTranscript[]>([]);
  const [showLiveTranscripts, setShowLiveTranscripts] = useState(true);
  const [enableInputTranscription, setEnableInputTranscription] = useState(true);
  const [currentAITranscript, setCurrentAITranscript] = useState<string>('');
  
  // Azure OpenAI Realtime Settings
  const [azureSettings, setAzureSettings] = useState<AzureOpenAIRealtimeSettings>({
    turnDetectionThreshold: 0.5,
    turnDetectionPrefixPadding: 200,
    turnDetectionSilenceDuration: 300,
    maxResponse: 1638,
    temperature: 0.7, // Changed from 0.7 to meet Azure OpenAI minimum of 0.6
    voice: 'alloy'
  });
  
  // Assessment State (optional - can be added if needed)
  // const [currentAssessment, setCurrentAssessment] = useState<any | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceActivityIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize services and event listeners
  useEffect(() => {
    const initializeServices = async () => {
      try {
        setSessionStatus(prev => ({ ...prev, connectionStatus: 'connecting' }));
        
        // Initialize Azure OpenAI Realtime WebRTC service (browser native, no backend)
        await agentService.initialize();
        
        setupEventListeners();
        
        setSessionStatus(prev => ({
          ...prev,
          connectionStatus: 'connected',
          hasAudioSupport: true
        }));
        
        announceToScreenReader('Azure OpenAI Realtime service initialized');
        
      } catch (error) {
        console.error('Failed to initialize agent services:', error);
        setSessionStatus(prev => ({ ...prev, connectionStatus: 'error' }));
        announceToScreenReader('Failed to initialize real-time services');
      }
    };

    initializeServices();

    return () => {
      cleanup();
    };
  }, []);

  // Voice activity monitoring - handled by Web Audio API AnalyserNode in service
  useEffect(() => {
    if (sessionStatus.isActive && !isSessionPaused) {
      voiceActivityIntervalRef.current = setInterval(() => {
        // Voice activity is monitored by azureOpenAIRealtimeService
        // Updates arrive via onVoiceActivity callback at 50ms intervals
      }, 100);
    } else {
      if (voiceActivityIntervalRef.current) {
        clearInterval(voiceActivityIntervalRef.current);
        voiceActivityIntervalRef.current = null;
      }
    }

    return () => {
      if (voiceActivityIntervalRef.current) {
        clearInterval(voiceActivityIntervalRef.current);
      }
    };
  }, [sessionStatus.isActive, isSessionPaused]);

  const setupEventListeners = useCallback(() => {
    // Azure OpenAI Realtime service callbacks
    agentService.onMessage((message: RealtimeMessage) => {
      setMessages(prev => [...prev, message]);
      setSessionStatus(prev => ({ ...prev, messageCount: prev.messageCount + 1 }));
    });

    agentService.onVoiceActivity((activity) => {
      setVoiceActivityLevel(activity.volumeLevel);
    });

    agentService.onStatusChange((status) => {
      setSessionStatus(prev => ({
        ...prev,
        isActive: status.isSessionActive,
        sessionId: status.sessionId || undefined,
        connectionStatus: status.isConnected ? 'connected' : 'disconnected'
      }));
      
      setCurrentAgent(prev => ({ ...prev, isActive: status.isSessionActive }));
      
      if (status.isSessionActive) {
        announceToScreenReader('Real-time session active');
      }
    });

    // Enhanced: Speech detection events
    agentService.onSpeechDetection((detection) => {
      setSpeechDetection(detection);
      
      // Update agent typing indicator based on AI speaking state
      setCurrentAgent(prev => ({ ...prev, isTyping: detection.isAISpeaking }));
    });

    // Enhanced: Conversation state events
    agentService.onConversationState((state) => {
      setConversationState(state);
      
      // Announce state changes for accessibility
      if (state.message) {
        announceToScreenReader(state.message);
      }
    });

    // Enhanced: Live transcript events
    agentService.onLiveTranscript((transcript) => {
      setLiveTranscripts(prev => {
        // Keep only recent transcripts (last 10)
        const updated = [...prev, transcript].slice(-10);
        return updated;
      });
      
      // Update current AI transcript for live captions
      if (transcript.role === 'assistant') {
        setCurrentAITranscript(transcript.text);
        if (!transcript.isPartial) {
          // Clear when transcript is complete
          setTimeout(() => setCurrentAITranscript(''), 2000);
        }
      }
    });

    agentService.onTranscript((transcript, isFinal) => {
      if (isFinal) {
        // Add user's transcribed message to UI
        const userMessage: RealtimeMessage = {
          id: `user-transcript-${Date.now()}`,
          role: 'user',
          content: transcript,
          timestamp: new Date().toISOString(),
          isTranscript: true,
          isPartial: false
        };
        setMessages(prev => [...prev, userMessage]);
      }
    });

    agentService.onError((error) => {
      console.error('Azure OpenAI Realtime service error:', error);
      announceToScreenReader(`Service error: ${error.message}`);
      setSessionStatus(prev => ({ ...prev, connectionStatus: 'error' }));
      setConversationState({ state: 'error', message: error.message });
    });

  }, []);

  // Agent display name not needed for single agent
  // const getAgentDisplayName = () => 'AI Assistant';


  const startSession = async () => {
    try {
      setIsProcessing(true);
      
      // Convert UI settings to service config format
      const sessionConfig: SessionConfig = convertSettingsToConfig(
        azureSettings,
        isAudioEnabled,
        true, // enableVAD
        "You are a helpful behavioral health assistant. Provide supportive, empathetic responses to help users with their mental health concerns. Keep responses concise and conversational.",
        enableInputTranscription // Enable input audio transcription
      );
      
      await agentService.startSession('user', sessionConfig);
      
      // Clear previous state
      setLiveTranscripts([]);
      setCurrentAITranscript('');
      
      // Add welcome message
      const welcomeMessage: ConversationMessage = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: "Hello! I'm your AI behavioral health assistant. I'm here to provide support and help with your mental health concerns. How can I assist you today?",
        timestamp: new Date().toISOString()
      };
      
      setMessages([welcomeMessage]);
      announceToScreenReader(welcomeMessage.content);
      
    } catch (error) {
      console.error('Failed to start session:', error);
      announceToScreenReader('Failed to start real-time session');
    } finally {
      setIsProcessing(false);
    }
  };

  const endSession = async () => {
    try {
      await agentService.endSession();
      setMessages([]);
      setSessionStatus(prev => ({
        ...prev,
        isActive: false,
        sessionId: undefined,
        messageCount: 0,
        connectionStatus: 'disconnected'
      }));
      setCurrentAgent(prev => ({ ...prev, isActive: false, isTyping: false }));
      announceToScreenReader('Session ended and conversation cleared');
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  const pauseSession = () => {
    agentService.pauseSession();
    setIsSessionPaused(true);
    announceToScreenReader('Session paused');
  };

  const resumeSession = async () => {
    agentService.resumeSession();
    setIsSessionPaused(false);
    announceToScreenReader('Session resumed');
  };

  const interruptResponse = async () => {
    try {
      await agentService.interruptResponse();
      announceToScreenReader('Response interrupted');
    } catch (error) {
      console.error('Failed to interrupt response:', error);
      announceToScreenReader('Failed to interrupt response');
    }
  };

  // Agent handoff not needed for single GPT-Realtime agent
  // const manualAgentHandoff = async (targetAgent: string) => {
  //   // Not applicable for single agent model
  // };

  const cleanup = async () => {
    await agentService.destroy();
    if (voiceActivityIntervalRef.current) {
      clearInterval(voiceActivityIntervalRef.current);
    }
  };

  const getConnectionStatusColor = () => {
    switch (sessionStatus.connectionStatus) {
      case 'connected': return 'text-green-600 dark:text-green-400';
      case 'connecting': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (sessionStatus.connectionStatus) {
      case 'connected': return <CheckCircle size={16} />;
      case 'connecting': return <Activity size={16} className="animate-spin" />;
      case 'error': return <AlertTriangle size={16} />;
      default: return <div className="w-4 h-4 rounded-full bg-gray-400" />;
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          {/* Agent Avatar with Voice Activity */}
          <div className="relative">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
              currentAgent.isTyping 
                ? 'bg-primary-500 animate-pulse' 
                : currentAgent.isActive 
                  ? 'bg-green-500' 
                  : 'bg-gray-400'
            }`}>
              <span className="text-white text-xl">
                {currentAgent.id === 'phq2' ? '📋' : currentAgent.id === 'comedian' ? '😄' : '🤖'}
              </span>
            </div>
            
            {/* Voice Activity Indicator */}
            {sessionStatus.isActive && !isSessionPaused && (
              <div className="absolute -inset-1">
                <VoiceActivityVisualizer 
                  volume={voiceActivityLevel}
                  isVoiceActive={voiceActivityLevel > 0.1}
                  isListening={sessionStatus.isActive}
                  size="lg"
                />
              </div>
            )}
            
            {/* Session Status Indicator */}
            <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-900 rounded-full p-1">
              <div className={`w-3 h-3 rounded-full ${
                sessionStatus.isActive 
                  ? isSessionPaused 
                    ? 'bg-yellow-500' 
                    : 'bg-green-500' 
                  : 'bg-gray-400'
              }`} />
            </div>
          </div>
          
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Realtime Agent Experience
            </h1>
            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
              <span>Agent: {currentAgent.name}</span>
              
              {/* Connection Status */}
              <div className={`flex items-center space-x-1 ${getConnectionStatusColor()}`}>
                {getConnectionStatusIcon()}
                <span className="capitalize">{sessionStatus.connectionStatus}</span>
              </div>
              
              {/* Conversation State */}
              {sessionStatus.isActive && (
                <div className="flex items-center space-x-1">
                  <Activity size={12} className={`${
                    conversationState.state === 'listening' ? 'text-green-500 animate-pulse' :
                    conversationState.state === 'processing' ? 'text-yellow-500 animate-spin' :
                    conversationState.state === 'speaking' ? 'text-blue-500 animate-pulse' :
                    conversationState.state === 'error' ? 'text-red-500' :
                    'text-gray-400'
                  }`} />
                  <span className="capitalize">{conversationState.state}</span>
                  {conversationState.message && (
                    <span className="text-xs opacity-75">- {conversationState.message}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Interrupt Button - Show when AI is speaking */}
          {sessionStatus.isActive && speechDetection.isAISpeaking && (
            <button
              onClick={interruptResponse}
              className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Interrupt AI response"
              title="Interrupt response"
            >
              <AlertTriangle size={20} />
            </button>
          )}

          {/* Live Transcripts Toggle */}
          {sessionStatus.isActive && (
            <button
              onClick={() => setShowLiveTranscripts(!showLiveTranscripts)}
              className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                showLiveTranscripts
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
              aria-label={`${showLiveTranscripts ? 'Hide' : 'Show'} live transcripts`}
              title={`${showLiveTranscripts ? 'Hide' : 'Show'} live captions`}
            >
              <span className="text-sm font-medium">CC</span>
            </button>
          )}

          {/* Agent Panel Toggle */}
          <button
            onClick={() => setShowAgentPanel(!showAgentPanel)}
            className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              showAgentPanel
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            aria-label="Toggle agent panel"
            title="Agent controls"
          >
            <Users size={20} />
          </button>

          {/* Session Controls */}
          {sessionStatus.isActive ? (
            <>
              <button
                onClick={isSessionPaused ? resumeSession : pauseSession}
                className="p-2 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label={isSessionPaused ? 'Resume session' : 'Pause session'}
                title={isSessionPaused ? 'Resume session' : 'Pause session'}
              >
                {isSessionPaused ? <Play size={20} /> : <Pause size={20} />}
              </button>
              
              <button
                onClick={endSession}
                className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="End session"
                title="End session"
              >
                <Trash2 size={20} />
              </button>
            </>
          ) : (
            <button
              onClick={startSession}
              disabled={sessionStatus.connectionStatus !== 'connected' || isProcessing}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Start session"
            >
              {isProcessing ? 'Starting...' : 'Start Session'}
            </button>
          )}

          {/* Audio Toggle */}
          <button
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              isAudioEnabled
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
            aria-label={`${isAudioEnabled ? 'Disable' : 'Enable'} audio`}
            title={`${isAudioEnabled ? 'Disable' : 'Enable'} audio`}
          >
            {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>

          {/* Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Settings"
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Agent Control Panel - Enhanced with feature toggles */}
      {showAgentPanel && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">AI Assistant</h3>
              <div className="flex items-center space-x-2">
                <div className="px-3 py-1 text-xs rounded-full bg-primary-600 text-white">
                  {currentAgent.name}
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Powered by Azure OpenAI Realtime API
                </span>
              </div>
            </div>
            
            {/* Enhanced Features Toggles */}
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={enableInputTranscription}
                  onChange={(e) => setEnableInputTranscription(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Input Transcription</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showLiveTranscripts}
                  onChange={(e) => setShowLiveTranscripts(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Live Captions</span>
              </label>
            </div>
            
            {/* Speech Detection Status */}
            {sessionStatus.isActive && (
              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Speech Detection:</span>
                  <div className="flex space-x-2">
                    <span className={`px-2 py-1 rounded ${
                      speechDetection.isUserSpeaking 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      User {speechDetection.isUserSpeaking ? 'Speaking' : 'Silent'}
                    </span>
                    <span className={`px-2 py-1 rounded ${
                      speechDetection.isAISpeaking 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      AI {speechDetection.isAISpeaking ? 'Speaking' : 'Silent'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Live Captions Display */}
        {showLiveTranscripts && sessionStatus.isActive && currentAITranscript && (
          <div className="sticky top-0 z-10 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
            <div className="flex items-center space-x-2 mb-2">
              <Volume2 size={16} className="text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Live Caption</span>
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce delay-100"></div>
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
            <p className="text-blue-800 dark:text-blue-200 text-sm italic">
              "{currentAITranscript}"
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              } ${message.isTranscript ? 'border-l-4 border-yellow-400' : ''}`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <div className={`flex items-center justify-between text-xs mt-1 opacity-70 ${
                message.role === 'user' ? 'text-primary-200' : 'text-gray-500 dark:text-gray-400'
              }`}>
                <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                {message.isTranscript && (
                  <span className="bg-yellow-400 text-yellow-900 px-1 rounded text-xs">
                    Transcript
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {currentAgent.isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Voice-Only Input Area */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-700">
        {/* Voice Activity Indicator - Centered */}
        {sessionStatus.isActive && !isSessionPaused && (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className={`p-6 rounded-full transition-all duration-200 ${
              speechDetection.isUserSpeaking 
                ? 'bg-green-600 text-white animate-pulse scale-110' 
                : conversationState.state === 'listening'
                  ? 'bg-yellow-500 text-white scale-105'
                  : conversationState.state === 'processing'
                    ? 'bg-blue-500 text-white animate-pulse scale-105'
                    : voiceActivityLevel > 0.1 
                      ? 'bg-green-600 text-white scale-110' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}>
              <Mic size={32} />
            </div>
            
            <div className="text-center">
              <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {speechDetection.isUserSpeaking ? 'Speaking...' : 
                 conversationState.state === 'listening' ? 'Listening...' :
                 conversationState.state === 'processing' ? 'Processing...' : 
                 conversationState.state === 'speaking' ? 'AI Responding...' : 'Voice Input Active'}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {sessionStatus.isActive ? 'Speak naturally to interact with the AI assistant' : 'Start a session to begin voice conversation'}
              </div>
            </div>
          </div>
        )}

        {/* Message when session is not active */}
        {!sessionStatus.isActive && (
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <div className="p-6 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-400">
              <Mic size={32} />
            </div>
            <div className="text-center">
              <div className="text-lg font-medium text-gray-500 dark:text-gray-400">
                Audio Input Demo
              </div>
              <div className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Click "Start Session" to begin voice-only conversation
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Status Bar */}
        <div className="flex items-center justify-between mt-6 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            {sessionStatus.isActive && (
              <>
                <span>Session: {sessionStatus.sessionId?.slice(-8)}</span>
                <span>Messages: {sessionStatus.messageCount}</span>
                <span>Transcripts: {liveTranscripts.length}</span>
                {sessionStatus.startTime && (
                  <span>
                    Duration: {Math.floor((Date.now() - sessionStatus.startTime.getTime()) / 60000)}m
                  </span>
                )}
                
                {/* Feature Status */}
                <div className="flex items-center space-x-2">
                  {enableInputTranscription && (
                    <span className="px-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded text-xs">
                      Input Transcription
                    </span>
                  )}
                  {showLiveTranscripts && (
                    <span className="px-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded text-xs">
                      Live Captions
                    </span>
                  )}
                </div>
              </>
            )}
            
            {isSessionPaused && (
              <span className="text-yellow-600 dark:text-yellow-400">Session Paused</span>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <span>
              {sessionStatus.isActive ? (
                speechDetection.isAISpeaking ? 'AI responding with voice' :
                speechDetection.isUserSpeaking ? 'Listening to your voice' :
                'Voice input active'
              ) : 'Voice-only interaction mode'}
            </span>
            
            {/* Interrupt hint */}
            {sessionStatus.isActive && speechDetection.isAISpeaking && (
              <span className="text-red-500 animate-pulse">
                Speak to interrupt AI response
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <SpeechSettings
        config={azureSettings}
        onConfigUpdate={(updates) => {
          setAzureSettings(prev => ({ ...prev, ...updates }));
        }}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default RealtimeAgentExperience;