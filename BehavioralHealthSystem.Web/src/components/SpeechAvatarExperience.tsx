import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Volume2, VolumeX, Settings, AlertTriangle, Phone } from 'lucide-react';
import { SpeechAvatarService, SpeechAvatarConfig, AgentMessage } from '../services/speechAvatarServiceV2';
import MicrophoneSettings from './MicrophoneSettings';

interface SpeechAvatarExperienceProps {
  agentType?: 'PHQ9' | 'PHQ2' | 'CRISIS' | 'COMEDIAN';
  userId: string;
  onSessionEnd?: (sessionSummary: any) => void;
  onRiskDetected?: (riskLevel: string) => void;
}

export function SpeechAvatarExperience({ 
  agentType = 'PHQ9', 
  userId, 
  onSessionEnd, 
  onRiskDetected 
}: SpeechAvatarExperienceProps) {
  // State management
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [conversationHistory, setConversationHistory] = useState<AgentMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [audioLevels, setAudioLevels] = useState<{ average: number; peak: number; active: boolean }>({ 
    average: 0, 
    peak: 0, 
    active: false 
  });
  const [showMicSettings, setShowMicSettings] = useState(false);
  
  // Services and refs
  const speechServiceRef = useRef<SpeechAvatarService | null>(null);
  const avatarVideoRef = useRef<HTMLVideoElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Configuration based on agent type
  const agentConfig = {
    PHQ9: {
      name: 'Dr. Sarah Chen',
      role: 'Depression Screening Specialist',
      voice: 'en-US-AvaNeural',
      personality: 'empathetic, professional, thorough'
    },
    PHQ2: {
      name: 'Dr. Michael Torres',
      role: 'Mental Health Screener',
      voice: 'en-US-GuyNeural',
      personality: 'supportive, gentle, efficient'
    },
    CRISIS: {
      name: 'Dr. Jennifer Walsh',
      role: 'Crisis Intervention Specialist',
      voice: 'en-US-JennyNeural',
      personality: 'calm, authoritative, compassionate'
    },
    COMEDIAN: {
      name: 'Dr. Alex Rivera',
      role: 'Therapeutic Humor Specialist',
      voice: 'en-US-AriaNeural',
      personality: 'warm, humorous, professional'
    }
  }[agentType];

  // Initialize Speech Avatar Service function
  const initializeSpeechService = useCallback(async () => {
    try {
      // Check if Azure Speech credentials are configured
      const endpoint = import.meta.env.VITE_AZURE_SPEECH_ENDPOINT;
      const apiKey = import.meta.env.VITE_AZURE_SPEECH_API_KEY;
      
      if (!endpoint || !apiKey || apiKey === 'your-azure-speech-api-key') {
        throw new Error('Azure Speech service credentials not configured. Please check your .env.local file.');
      }

      const config: SpeechAvatarConfig = {
        endpoint,
        apiKey,
        model: import.meta.env.VITE_AZURE_SPEECH_MODEL || 'gpt-4o-realtime-preview',
        voice: import.meta.env.VITE_AZURE_SPEECH_VOICE || agentConfig.voice,
        instructions: import.meta.env.VITE_AGENT_INSTRUCTIONS || `You are ${agentConfig.name}, a ${agentConfig.role}. Your personality is ${agentConfig.personality}. Conduct a compassionate, professional behavioral health interaction.`,
        agentPersonality: {
          name: import.meta.env.VITE_AGENT_NAME || agentConfig.name,
          role: import.meta.env.VITE_AGENT_ROLE || agentConfig.role,
          traits: agentConfig.personality.split(', ')
        }
      };

      const service = new SpeechAvatarService(config);
      
      // Set up event handlers
      service.onAgentMessage((message: AgentMessage) => {
        setConversationHistory(prev => [...prev, message]);
        setCurrentMessage(message.content);
        
        // Check for risk indicators
        if (message.content.toLowerCase().includes('crisis') || 
            message.content.toLowerCase().includes('emergency') ||
            message.content.toLowerCase().includes('harm')) {
          onRiskDetected?.('high');
        }
      });

      service.onUserSpeech((isActive: boolean) => {
        setIsListening(isActive);
        if (isActive) {
          setIsSpeaking(false);
          setCurrentMessage('Listening...');
        }
      });

      service.onError((error: string) => {
        setErrorMessage(error);
        setConnectionStatus('error');
      });

      await service.initialize();
      speechServiceRef.current = service;
      
      // Set up audio level callback after service is initialized
      service.onAudioLevel((levels: { average: number; peak: number; active: boolean }) => {
        setAudioLevels(levels);
      });
      
      setConnectionStatus('connected');
      
    } catch (error) {
      console.error('Failed to initialize Speech Avatar service:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      setErrorMessage(errorMsg);
      setConnectionStatus('error');
    }
  }, [agentConfig]);

  // Initialize Speech Avatar Service on mount/config change
  useEffect(() => {
    initializeSpeechService();

    return () => {
      if (speechServiceRef.current) {
        speechServiceRef.current.stopSession();
      }
    };
  }, [initializeSpeechService]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory]);

  // Start speech session
  const startSession = useCallback(async () => {
    try {
      setConnectionStatus('connecting');
      setErrorMessage('');
      
      // Check if service needs to be reinitialized
      if (!speechServiceRef.current) {
        console.log('🔄 Service not available, reinitializing...');
        await initializeSpeechService();
        
        // Wait a bit for initialization to complete
        if (!speechServiceRef.current) {
          throw new Error('Failed to reinitialize speech service');
        }
        console.log('✅ Service successfully reinitialized');
      } else {
        console.log('✅ Service already available, using existing instance');
      }
      
      // First, try to initiate session with backend
      const apiBaseUrl = import.meta.env.VITE_API_BASE || 'http://localhost:7071/api';
      let sessionData;
      
      try {
        const response = await fetch(`${apiBaseUrl}/speech-avatar/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agentType,
            userId,
            sessionConfig: {
              agentType,
              sessionId: '', // Will be generated by backend
              enableAudio: true,
              preferredVoice: agentConfig.voice
            }
          })
        });

        if (!response.ok) {
          throw new Error('Backend not available');
        }

        sessionData = await response.json();
      } catch (backendError) {
        console.warn('Backend not available, using fallback session:', backendError);
        // Create a fallback session ID when backend is not available
        sessionData = {
          sessionId: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status: 'initialized',
          agentType: agentType
        };
      }

      setSessionId(sessionData.sessionId);

      // Set session as active BEFORE starting the speech service
      setIsSessionActive(true);
      setConnectionStatus('connected');
      
      // Start the speech avatar session
      try {
        await speechServiceRef.current.startSession();
        console.log('✅ Speech Avatar session started successfully');
        
        // Force enable listening state since Azure connection isn't working
        setIsListening(true);
        console.log('🎤 Manually setting listening state to true for audio testing');
        
      } catch (speechError) {
        console.warn('⚠️ Azure Speech service connection failed, but allowing local audio testing:', speechError);
        // Don't throw here - allow session to continue for audio testing even if Azure isn't available
        setIsListening(true);
      }
      
      // Add welcome message
      const welcomeMessage: AgentMessage = {
        agentName: agentConfig.name,
        content: getWelcomeMessage(agentType),
        timestamp: new Date().toISOString(),
        confidence: 1.0
      };
      
      setConversationHistory([welcomeMessage]);
      setCurrentMessage(welcomeMessage.content);
      
    } catch (error) {
      console.error('Failed to start session:', error);
      setErrorMessage('Failed to start session. Please try again.');
      setConnectionStatus('error');
    }
  }, [userId, agentType, agentConfig, initializeSpeechService]);

  // End speech session
  const endSession = useCallback(async () => {
    if (!speechServiceRef.current || !sessionId) return;

    try {
      // End session with backend
      const apiBaseUrl = import.meta.env.VITE_API_BASE || 'http://localhost:7071/api';
      const response = await fetch(`${apiBaseUrl}/speech-avatar/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const sessionSummary = await response.json();
        onSessionEnd?.(sessionSummary);
      }

      // Stop the speech service
      await speechServiceRef.current.stopSession();
      
      setIsSessionActive(false);
      setIsListening(false);
      setIsSpeaking(false);
      setSessionId(null);
      setConnectionStatus('disconnected');
      setCurrentMessage('Session ended. Thank you for your time.');
      
    } catch (error) {
      console.error('Failed to end session:', error);
      setErrorMessage('Failed to end session properly.');
    }
  }, [sessionId, onSessionEnd]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    setIsAudioEnabled(prev => !prev);
    // Here you would implement actual audio muting
  }, []);

  const getWelcomeMessage = (type: string): string => {
    switch (type) {
      case 'PHQ9':
        return "Hello! I'm Dr. Sarah Chen. I'd like to have a conversation with you about how you've been feeling lately. This will help us understand your mental health better. Feel free to speak naturally - I'm here to listen.";
      case 'PHQ2':
        return "Hi there! I'm Dr. Michael Torres. I'd like to ask you a couple of quick questions about your mood over the past two weeks. Just speak naturally, and I'll listen carefully.";
      case 'CRISIS':
        return "Hello, I'm Dr. Jennifer Walsh, a crisis intervention specialist. I'm here to provide immediate support. Please tell me what's happening and how you're feeling right now.";
      case 'COMEDIAN':
        return "Hey there! I'm Dr. Alex Rivera. I like to bring a little light-heartedness to our conversations while still taking your mental health seriously. Ready to chat?";
      default:
        return "Hello! I'm here to provide behavioral health support. Feel free to share what's on your mind.";
    }
  };

  const getConnectionStatusDisplay = () => {
    switch (connectionStatus) {
      case 'connecting':
        return { text: 'Connecting...', color: 'text-yellow-600' };
      case 'connected':
        return { text: 'Connected', color: 'text-green-600' };
      case 'error':
        return { text: 'Connection Error', color: 'text-red-600' };
      default:
        return { text: 'Disconnected', color: 'text-gray-600' };
    }
  };

  const statusDisplay = getConnectionStatusDisplay();

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-lg">
                {agentConfig.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{agentConfig.name}</h1>
              <p className="text-sm text-gray-600">{agentConfig.role}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 ${statusDisplay.color}`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 
                connectionStatus === 'connecting' ? 'bg-yellow-500' : 
                connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
              }`}></div>
              <span className="text-sm font-medium">{statusDisplay.text}</span>
            </div>
            
            <button
              onClick={toggleAudio}
              className={`p-2 rounded-full transition-colors ${
                isAudioEnabled ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}
              title={isAudioEnabled ? 'Mute Audio' : 'Unmute Audio'}
            >
              {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>

            <button
              onClick={() => setShowMicSettings(true)}
              className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              title="Microphone Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Avatar Video Area */}
        <div className="w-1/2 bg-gray-900 relative">
          <video
            ref={avatarVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted={!isAudioEnabled}
            playsInline
          />
          
          {/* Avatar Placeholder */}
          {!avatarVideoRef.current?.srcObject && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="w-32 h-32 bg-indigo-600 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <span className="text-white font-bold text-4xl">
                    {agentConfig.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <p className="text-white text-lg">{agentConfig.name}</p>
                <p className="text-gray-300">{agentConfig.role}</p>
              </div>
            </div>
          )}

          {/* Microphone Status Indicator - Always Visible */}
          <div className="absolute bottom-4 left-4">
            {/* Persistent Microphone Icon with Audio Feedback */}
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-full transition-all duration-200 ${
              isSessionActive ? (
                isListening ? (
                  audioLevels.active 
                    ? 'bg-green-500 text-white shadow-lg' 
                    : 'bg-green-600 text-white'
                ) : isSpeaking 
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              ) : 'bg-gray-600 text-gray-400'
            }`}>
              <div className="relative">
                {isSessionActive && isListening ? (
                  <Mic 
                    size={18} 
                    className={`transition-all duration-150 ${
                      audioLevels.active 
                        ? 'scale-125 brightness-125 drop-shadow-md' 
                        : 'scale-100 brightness-100'
                    }`}
                  />
                ) : isSessionActive && isSpeaking ? (
                  <Volume2 size={18} />
                ) : (
                  <Mic size={18} />
                )}
                
                {/* Audio level pulse ring */}
                {isSessionActive && isListening && audioLevels.active && (
                  <div 
                    className={`absolute inset-0 rounded-full border-2 border-yellow-300 animate-ping ${
                      audioLevels.peak > 0.5 ? 'scale-150 opacity-75' : 'scale-125 opacity-60'
                    }`}
                  />
                )}
              </div>
              
              <span className="text-sm font-medium">
                {!isSessionActive ? 'Mic Ready' :
                 isListening ? (audioLevels.active ? 'Recording...' : 'Listening...') :
                 isSpeaking ? 'Speaking...' : 'Ready'}
              </span>
              
              {/* Audio level bars - only show when actively listening */}
              {isSessionActive && isListening && (
                <div className="flex items-center space-x-1">
                  <div 
                    className={`w-1 h-3 rounded-full transition-all duration-150 ${
                      audioLevels.average > 0.1 ? 'bg-yellow-300' : 'bg-green-800'
                    }`}
                  />
                  <div 
                    className={`w-1 h-4 rounded-full transition-all duration-150 ${
                      audioLevels.average > 0.2 ? 'bg-yellow-300' : 'bg-green-800'
                    }`}
                  />
                  <div 
                    className={`w-1 h-5 rounded-full transition-all duration-150 ${
                      audioLevels.peak > 0.3 ? 'bg-yellow-300' : 'bg-green-800'
                    }`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Conversation Panel */}
        <div className="w-1/2 bg-white flex flex-col">
          {/* Current Message Display */}
          <div className="bg-gray-50 p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Current Message</h3>
            <p className="text-gray-700 leading-relaxed">
              {currentMessage || 'Waiting for conversation to begin...'}
            </p>
          </div>

          {/* Conversation History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {conversationHistory.map((message, index) => (
              <div key={index} className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="font-semibold text-blue-900">{message.agentName}</span>
                  <span className="text-xs text-blue-600">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-blue-800">{message.content}</p>
                {message.suggestedActions && message.suggestedActions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-blue-900">Suggested Actions:</p>
                    <ul className="text-sm text-blue-700 mt-1">
                      {message.suggestedActions.map((action, actionIndex) => (
                        <li key={actionIndex} className="ml-4">• {action}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            <div ref={conversationEndRef} />
          </div>

          {/* Controls */}
          <div className="bg-gray-50 p-4 border-t border-gray-200">
            {!isSessionActive ? (
              <button
                onClick={startSession}
                disabled={connectionStatus !== 'connected'}
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-semibold 
                         hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {connectionStatus === 'connecting' ? 'Connecting...' : 'Start Conversation'}
              </button>
            ) : (
              <button
                onClick={endSession}
                className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-semibold 
                         hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Phone size={18} />
                <span>End Session</span>
              </button>
            )}

            {/* Error Display */}
            {errorMessage && (
              <div className="mt-3 p-3 bg-red-100 border border-red-400 rounded-lg flex items-center space-x-2">
                <AlertTriangle size={16} className="text-red-600" />
                <span className="text-red-700 text-sm">{errorMessage}</span>
              </div>
            )}

            {/* Audio Debug Info */}
            {isSessionActive && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Audio Debug Info</h4>
                <div className="text-xs text-blue-700 space-y-1">
                  <div>Listening: {isListening ? 'YES' : 'NO'}</div>
                  <div>Audio Active: {audioLevels.active ? 'YES' : 'NO'}</div>
                  <div>Average Level: {(audioLevels.average * 100).toFixed(1)}%</div>
                  <div>Peak Level: {(audioLevels.peak * 100).toFixed(1)}%</div>
                </div>
                
                {/* Quick Audio Test Button */}
                <button
                  onClick={async () => {
                    console.log('🎤 Starting quick audio test...');
                    const audioService = (await import('../services/audioDeviceService')).default.getInstance();
                    try {
                      const result = await audioService.testAudioInput(3000, false);
                      console.log(`🎤 Quick test result: ${result ? 'PASS' : 'FAIL'}`);
                    } catch (error) {
                      console.error('❌ Quick test failed:', error);
                    }
                  }}
                  className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                >
                  Quick Audio Test (3s)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Microphone Settings Modal */}
      <MicrophoneSettings
        speechService={speechServiceRef.current}
        isOpen={showMicSettings}
        onClose={() => setShowMicSettings(false)}
      />
    </div>
  );
}

export default SpeechAvatarExperience;