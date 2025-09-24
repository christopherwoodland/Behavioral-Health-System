import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, 
  Send, 
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
import { useKeyboardNavigation } from '@/hooks/accessibility';
import { announceToScreenReader } from '@/utils';
import { 
  semanticKernelAgentService, 
  ConversationMessage, 
  Phq2Assessment,
  SessionConfig
} from '@/services/semanticKernelAgentService';
import VoiceActivityVisualizer from '@/components/VoiceActivityVisualizer';
import SpeechSettings from '@/components/SpeechSettings';

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
  const { handleEnterSpace } = useKeyboardNavigation();
  
  // Core service - single instance that manages all agents via C# backend
  const agentService = semanticKernelAgentService;
  
  // UI State
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  
  // Agent State
  const [currentAgent, setCurrentAgent] = useState<AgentStatus>({
    id: 'coordinator',
    name: 'Maestro (Coordinator)',
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
  
  // PHQ-2 State
  const [currentAssessment, setCurrentAssessment] = useState<Phq2Assessment | null>(null);
  const [assessmentProgress, setAssessmentProgress] = useState({ current: 0, total: 2, percentage: 0 });
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
        
        // Initialize connection to C# Semantic Kernel backend
        await agentService.initialize();
        
        setupEventListeners();
        
        setSessionStatus(prev => ({
          ...prev,
          connectionStatus: 'connected',
          hasAudioSupport: true
        }));
        
        announceToScreenReader('Semantic Kernel agent services initialized');
        
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

  // Voice activity monitoring - simplified since backend handles this
  useEffect(() => {
    if (sessionStatus.isActive && !isSessionPaused) {
      voiceActivityIntervalRef.current = setInterval(() => {
        // Voice activity is now handled by the backend via events
        // This interval is kept for UI updates
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
    // Backend service events
    agentService.addEventListener('connected', () => {
      setSessionStatus(prev => ({ ...prev, connectionStatus: 'connected' }));
      announceToScreenReader('Connected to agent service');
    });

    agentService.addEventListener('sessionStarted', (event: any) => {
      const { session } = event.detail;
      setSessionStatus(prev => ({
        ...prev,
        isActive: true,
        sessionId: session.sessionId,
        startTime: new Date(session.startTime)
      }));
      setCurrentAgent(prev => ({ ...prev, isActive: true }));
      announceToScreenReader('Speech session started');
    });

    agentService.addEventListener('messageReceived', (event: any) => {
      const { message } = event.detail;
      setMessages(prev => [...prev, message]);
      setSessionStatus(prev => ({ ...prev, messageCount: prev.messageCount + 1 }));
    });

    agentService.addEventListener('agentSwitched', (event: any) => {
      const { toAgent } = event.detail;
      setCurrentAgent({
        id: toAgent,
        name: getAgentDisplayName(toAgent),
        isActive: true,
        isTyping: false,
        lastActivity: new Date()
      });
      setSessionStatus(prev => ({ ...prev, currentAgent: toAgent }));
      announceToScreenReader(`Switched to ${getAgentDisplayName(toAgent)} agent`);
    });

    agentService.addEventListener('sessionEnded', () => {
      setSessionStatus(prev => ({ ...prev, isActive: false }));
      setCurrentAgent(prev => ({ ...prev, isActive: false }));
      announceToScreenReader('Speech session ended');
    });

    agentService.addEventListener('phq2QuestionAsked', (event: any) => {
      const { questionNumber } = event.detail;
      // Update progress
      setAssessmentProgress({
        current: questionNumber,
        total: 2,
        percentage: (questionNumber / 2) * 100
      });
    });

    agentService.addEventListener('phq2AssessmentCompleted', (event: any) => {
      const { assessment } = event.detail;
      setCurrentAssessment(assessment);
      announceToScreenReader('PHQ-2 assessment completed');
    });

    agentService.addEventListener('voiceActivityDetected', (event: any) => {
      const { activity } = event.detail;
      setVoiceActivityLevel(activity.volumeLevel);
    });

    agentService.addEventListener('error', (event: any) => {
      console.error('Agent service error:', event.detail);
      announceToScreenReader('Agent service error occurred');
    });

    agentService.addEventListener('disconnected', () => {
      setSessionStatus(prev => ({ ...prev, connectionStatus: 'disconnected' }));
      announceToScreenReader('Disconnected from agent service');
    });

  }, []);

  const getAgentDisplayName = (agentId: string): string => {
    switch (agentId) {
      case 'coordinator': return 'Maestro (Coordinator)';
      case 'phq2': return 'PHQ-2 Assessment Agent';
      case 'comedian': return 'Therapeutic Comedian';
      default: return agentId;
    }
  };


  const startSession = async () => {
    try {
      setIsProcessing(true);
      
      const sessionConfig: SessionConfig = {
        enableAudio: true,
        enableVAD: true,
        preferredVoice: 'alloy',
        temperature: 0.7,
        maxTokens: 2048
      };
      
      await agentService.startSession('user', sessionConfig);
      
      // Add welcome message
      const welcomeMessage: ConversationMessage = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: "Hello! I'm Maestro, your behavioral health coordinator. I can help you with depression screenings, provide support, or connect you with specialized assistance. How can I help you today?",
        timestamp: new Date().toISOString(),
        agent: 'coordinator'
      };
      
      setMessages([welcomeMessage]);
      announceToScreenReader(welcomeMessage.content);
      
    } catch (error) {
      console.error('Failed to start session:', error);
      announceToScreenReader('Failed to start speech session');
    } finally {
      setIsProcessing(false);
    }
  };

  const endSession = async () => {
    try {
      await agentService.endSession();
      setMessages([]);
      setCurrentAssessment(null);
      setAssessmentProgress({ current: 0, total: 2, percentage: 0 });
      announceToScreenReader('Session ended and conversation cleared');
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  const pauseSession = () => {
    // Pause functionality will be handled by the backend
    // For now, just update the UI state
    setIsSessionPaused(true);
    announceToScreenReader('Session paused');
  };

  const resumeSession = async () => {
    // Resume functionality will be handled by the backend
    // For now, just update the UI state
    setIsSessionPaused(false);
    announceToScreenReader('Session resumed');
  };

  const sendTextMessage = async () => {
    if (!inputText.trim() || !sessionStatus.isActive) return;

    try {
      setIsProcessing(true);
      
      // Send message to backend service
      await agentService.sendMessage(inputText.trim());
      
      setInputText('');
      textareaRef.current?.focus();
      
    } catch (error) {
      console.error('Failed to send message:', error);
      announceToScreenReader('Failed to send message');
    } finally {
      setIsProcessing(false);
    }
  };

  const manualAgentHandoff = async (targetAgent: string) => {
    try {
      await agentService.requestAgentHandoff(targetAgent, 'Manual agent selection');
      announceToScreenReader(`Switching to ${getAgentDisplayName(targetAgent)} agent`);
    } catch (error) {
      console.error('Failed to switch agent:', error);
      announceToScreenReader('Failed to switch agent');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  const cleanup = () => {
    agentService.disconnect();
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
              
              {/* PHQ-2 Progress */}
              {currentAssessment && !currentAssessment.isCompleted && (
                <span className="text-blue-600 dark:text-blue-400">
                  PHQ-2: {assessmentProgress.current}/{assessmentProgress.total} ({assessmentProgress.percentage}%)
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
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

      {/* Agent Control Panel */}
      {showAgentPanel && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Available Agents</h3>
            <div className="flex space-x-2">
              {['coordinator', 'phq2', 'comedian'].map((agentId: string) => (
                <button
                  key={agentId}
                  onClick={() => manualAgentHandoff(agentId)}
                  disabled={currentAgent.id === agentId || isProcessing}
                  className={`px-3 py-1 text-xs rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    currentAgent.id === agentId
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500 disabled:cursor-not-allowed'
                  }`}
                >
                  {getAgentDisplayName(agentId)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <div className={`flex items-center justify-between text-xs mt-1 opacity-70 ${
                message.role === 'user' ? 'text-primary-200' : 'text-gray-500 dark:text-gray-400'
              }`}>
                <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                {message.agent && message.role === 'assistant' && (
                  <span className="ml-2">{getAgentDisplayName(message.agent)}</span>
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

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-end space-x-2">
          {/* Voice Input Indicator */}
          {sessionStatus.isActive && !isSessionPaused && (
            <div className="flex flex-col items-center">
              <div className={`p-3 rounded-lg ${
                voiceActivityLevel > 0.1 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                <Mic size={20} />
              </div>
              <span className="text-xs mt-1 text-gray-500">Voice</span>
            </div>
          )}

          {/* Text Input */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={sessionStatus.isActive 
                ? "Type your message here or use voice input..."
                : "Start a session to begin conversation..."
              }
              disabled={!sessionStatus.isActive || isProcessing || isSessionPaused}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-700 min-h-[44px] max-h-[120px]"
              rows={1}
              aria-label="Message input"
            />
          </div>

          {/* Send Button */}
          <button
            onClick={sendTextMessage}
            onKeyDown={handleEnterSpace(sendTextMessage)}
            disabled={!inputText.trim() || !sessionStatus.isActive || isProcessing || isSessionPaused}
            className="p-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Send message"
            title="Send message"
          >
            <Send size={20} />
          </button>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            {sessionStatus.isActive && (
              <>
                <span>Session: {sessionStatus.sessionId?.slice(-8)}</span>
                <span>Messages: {sessionStatus.messageCount}</span>
                {sessionStatus.startTime && (
                  <span>
                    Duration: {Math.floor((Date.now() - sessionStatus.startTime.getTime()) / 60000)}m
                  </span>
                )}
              </>
            )}
            
            {isSessionPaused && (
              <span className="text-yellow-600 dark:text-yellow-400">Session Paused</span>
            )}
            
            {currentAssessment && !currentAssessment.isCompleted && (
              <span className="text-blue-600 dark:text-blue-400">
                PHQ-2 Assessment in Progress
              </span>
            )}
          </div>
          
          <span>
            {sessionStatus.isActive ? 'Voice and text input active' : 'Press "Start Session" to begin'}
          </span>
        </div>
      </div>

      {/* Settings Modal */}
      <SpeechSettings
        config={{
          language: 'en-US',
          continuous: true,
          interimResults: true,
          maxAlternatives: 2,
          audioTracks: true,
          noiseReduction: true,
          echoCancellation: true
        }}
        availableVoices={[]}
        selectedVoice={undefined}
        onConfigUpdate={() => {}}
        onVoiceSelect={() => {}}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default RealtimeAgentExperience;