import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Trash2, Volume2, VolumeX, Settings } from 'lucide-react';
import { useKeyboardNavigation } from '@/hooks/accessibility';
import { announceToScreenReader } from '@/utils';
import { useSpeech } from '@/hooks/useSpeech';
import { useSignalR } from '@/hooks/useSignalR';
import { SpeechResult, VoiceActivityEvent } from '@/services/speechService';
import { UserMessage } from '@/services/signalRService';
import VoiceActivityVisualizer from '@/components/VoiceActivityVisualizer';
import SpeechSettings from '@/components/SpeechSettings';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  isTyping?: boolean;
}

interface AgentState {
  id: string;
  name: string;
  isActive: boolean;
  isTyping: boolean;
}

export const AgentExperience: React.FC = () => {
  const { handleEnterSpace } = useKeyboardNavigation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AgentState>({
    id: 'coordinator',
    name: 'Coordinator Agent',
    isActive: true,
    isTyping: false
  });
  const [isAudioOutputEnabled, setIsAudioOutputEnabled] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | undefined>();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // SignalR integration for real-time communication
  const signalR = useSignalR();

  // Use the advanced speech service
  const speech = useSpeech({
    config: {
      continuous: true,
      interimResults: true,
      language: 'en-US',
      maxAlternatives: 2
    },
    onFinalResult: (results: SpeechResult[]) => {
      if (results.length > 0 && results[0].transcript.trim()) {
        setInputText(results[0].transcript.trim());
        announceToScreenReader(`Voice input captured: ${results[0].transcript}`);
      }
    },
    onVoiceActivity: (_event: VoiceActivityEvent) => {
      // Voice activity is handled by the visualizer
    },
    onError: (error) => {
      console.error('Advanced speech error:', error);
      announceToScreenReader('Voice input error occurred');
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize SignalR connection and session
  useEffect(() => {
    const initializeSignalR = async () => {
      try {
        console.log('Attempting to connect to SignalR...');
        
        if (!signalR.isConnected) {
          await signalR.connect();
          console.log('SignalR connected successfully');
          announceToScreenReader('Connected to real-time communication');
        }
        
        // TODO: Re-enable after fixing session joining
        // Generate a session ID and join
        // const sessionId = `session-${Date.now()}`;
        // await signalR.joinSession(sessionId);
        // console.log('Joined SignalR session:', sessionId);
        // announceToScreenReader('Joined communication session');
      } catch (error) {
        console.error('Failed to initialize SignalR:', error);
        console.log('SignalR connection failed - using fallback mode');
        announceToScreenReader('Using offline mode - real-time features unavailable');
        
        // The UI will continue to work with the fallback mock responses
        // when signalR.isConnected is false
      }
    };

    initializeSignalR();

    // Cleanup on unmount
    return () => {
      signalR.disconnect();
    };
  }, [signalR]);

  // Handle real-time agent messages
  useEffect(() => {
    if (signalR.agentMessages.length > 0) {
      const latestMessage = signalR.agentMessages[signalR.agentMessages.length - 1];
      
      // Convert SignalR message to local message format
      const message: Message = {
        id: `signalr-${Date.now()}`,
        content: latestMessage.content,
        role: 'assistant',
        timestamp: new Date(latestMessage.timestamp)
      };

      setMessages(prev => {
        // Avoid duplicates by checking if message already exists
        const exists = prev.some(m => 
          m.content === message.content && 
          Math.abs(m.timestamp.getTime() - message.timestamp.getTime()) < 1000
        );
        
        if (!exists) {
          return [...prev, message];
        }
        return prev;
      });

      // Update current agent based on message
      setCurrentAgent(prev => ({
        ...prev,
        name: latestMessage.agentName,
        id: latestMessage.agentName.toLowerCase().replace(/\s+/g, '-'),
        isTyping: false
      }));

      // Speak the response if audio output is enabled
      speakMessage(latestMessage.content);
      
      announceToScreenReader(`Message from ${latestMessage.agentName}: ${latestMessage.content}`);
    }
  }, [signalR.agentMessages]);

  // Handle agent handoff notifications
  useEffect(() => {
    if (signalR.handoffNotifications.length > 0) {
      const latestHandoff = signalR.handoffNotifications[signalR.handoffNotifications.length - 1];
      
      // Update current agent
      setCurrentAgent(prev => ({
        ...prev,
        name: latestHandoff.toAgent,
        id: latestHandoff.toAgent.toLowerCase().replace(/\s+/g, '-'),
        isTyping: false
      }));

      // Add system message about handoff
      const handoffMessage: Message = {
        id: `handoff-${Date.now()}`,
        content: `Agent handoff: ${latestHandoff.reason}. You are now speaking with ${latestHandoff.toAgent}.`,
        role: 'assistant',
        timestamp: new Date(latestHandoff.timestamp)
      };

      setMessages(prev => [...prev, handoffMessage]);
      announceToScreenReader(`Agent handoff: You are now speaking with ${latestHandoff.toAgent}`);
    }
  }, [signalR.handoffNotifications]);

  // Handle agent typing indicators
  useEffect(() => {
    const typingAgents = Object.keys(signalR.agentTyping).filter(agent => signalR.agentTyping[agent]);
    
    if (typingAgents.length > 0) {
      setCurrentAgent(prev => ({ ...prev, isTyping: true }));
    } else {
      setCurrentAgent(prev => ({ ...prev, isTyping: false }));
    }
  }, [signalR.agentTyping]);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: '1',
      content: "Hello! I'm your behavioral health assistant. I can help you with depression screenings, provide support, or just have a friendly conversation. What would you like to explore today?",
      role: 'assistant',
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  }, []);

  const toggleListening = async () => {
    try {
      if (speech.isListening) {
        speech.stopListening();
        announceToScreenReader('Voice input stopped');
      } else {
        await speech.startListening();
        announceToScreenReader('Voice input started');
      }
    } catch (error) {
      console.error('Error toggling speech:', error);
      announceToScreenReader('Error with voice input');
    }
  };

  const speakMessage = async (text: string) => {
    if (isAudioOutputEnabled && speech.isAvailable) {
      try {
        await speech.speak(text, {
          rate: 0.9,
          pitch: 1.0,
          volume: 0.8,
          voice: selectedVoice,
          interrupt: true
        });
      } catch (error) {
        console.error('Error speaking message:', error);
      }
    }
  };

  const toggleAudioOutput = () => {
    setIsAudioOutputEnabled(!isAudioOutputEnabled);
    if (!isAudioOutputEnabled) {
      announceToScreenReader('Audio output enabled');
    } else {
      announceToScreenReader('Audio output disabled');
      // Cancel any ongoing speech using the advanced speech service
      if (speech.isAvailable && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputText.trim(),
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputText.trim();
    setInputText('');
    setIsProcessing(true);
    setCurrentAgent(prev => ({ ...prev, isTyping: true }));

    try {
      // Send message through SignalR for real-time processing
      if (signalR.isConnected) {
        const signalRMessage: UserMessage = {
          content: messageText,
          timestamp: new Date().toISOString(),
          metadata: {
            speechConfidence: 1.0, // Default confidence
            voiceActivityLevel: speech.volume,
            processingTime: 0
          }
        };

        await signalR.sendMessage(signalRMessage);
        announceToScreenReader('Message sent to agent');
      } else {
        // Fallback to mock behavior if SignalR is not connected
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        let responseContent = "I understand what you're saying. Let me help you with that.";
        let newAgentId = currentAgent.id;
        let newAgentName = currentAgent.name;

        const lowerInput = messageText.toLowerCase();
        
        if (lowerInput.includes('phq') || lowerInput.includes('depression') || lowerInput.includes('screening')) {
          responseContent = "I can help you with a depression screening. I'll start with the PHQ-2, which is a quick 2-question assessment. This will help determine if a more comprehensive evaluation might be helpful. Shall we begin?";
          newAgentId = 'phq2';
          newAgentName = 'PHQ-2 Agent';
        } else if (lowerInput.includes('joke') || lowerInput.includes('funny') || lowerInput.includes('humor')) {
          responseContent = "Hey there! 😄 I'm here to brighten your day with some wholesome humor! I can share clean jokes, funny stories, or just have some playful banter. What sounds good to you?";
          newAgentId = 'comedian';
          newAgentName = 'Comedy Agent';
        } else if (lowerInput.includes('crisis') || lowerInput.includes('emergency') || lowerInput.includes('help')) {
          responseContent = "I'm here to help. If you're experiencing a mental health crisis, please reach out for immediate support: Call 988 (Suicide & Crisis Lifeline) or contact your local emergency services. I'm also here to provide support and connect you with appropriate resources.";
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: responseContent,
          role: 'assistant',
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        // Update current agent if it changed
        if (newAgentId !== currentAgent.id) {
          setCurrentAgent({
            id: newAgentId,
            name: newAgentName,
            isActive: true,
            isTyping: false
          });
          announceToScreenReader(`Agent changed to ${newAgentName}`);
        }

        // Speak the response if audio output is enabled
        speakMessage(responseContent);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I encountered an error processing your message. Please try again.",
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      announceToScreenReader('Error sending message');
    } finally {
      setIsProcessing(false);
      if (!signalR.isConnected) {
        // Only set typing to false for fallback mode; SignalR handles this via events
        setCurrentAgent(prev => ({ ...prev, isTyping: false }));
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setCurrentAgent({
      id: 'coordinator',
      name: 'Coordinator Agent',
      isActive: true,
      isTyping: false
    });
    announceToScreenReader('Conversation cleared');
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          {/* Animated Bot Visualization with Voice Activity */}
          <div className="relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
              currentAgent.isTyping 
                ? 'bg-primary-500 animate-pulse' 
                : currentAgent.isActive 
                  ? 'bg-green-500' 
                  : 'bg-gray-400'
            }`}>
              <span className="text-white text-lg">🤖</span>
            </div>
            {/* Pulsing indicator when agent is active */}
            {currentAgent.isActive && (
              <div className="absolute -inset-1 rounded-full bg-green-400 opacity-30 animate-ping"></div>
            )}
            {/* Voice activity indicator */}
            {speech.isListening && (
              <div className="absolute -bottom-1 -right-1">
                <VoiceActivityVisualizer 
                  volume={speech.volume}
                  isVoiceActive={speech.isVoiceActive}
                  isListening={speech.isListening}
                  size="sm"
                />
              </div>
            )}
          </div>
          
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Agent Experience
            </h1>
            <div className="flex items-center space-x-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Current Agent: {currentAgent.name}
                {currentAgent.isTyping && (
                  <span className="ml-2 text-primary-600 dark:text-primary-400">
                    <span className="animate-pulse">Typing...</span>
                  </span>
                )}
              </p>
              
              {/* Connection Status */}
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${
                  signalR.isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className={`text-xs ${
                  signalR.isConnected 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {signalR.isConnected ? 'Connected' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Speech Settings */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            onKeyDown={handleEnterSpace(() => setIsSettingsOpen(true))}
            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Open speech settings"
            title="Speech settings"
          >
            <Settings size={20} />
          </button>

          {/* Audio Output Toggle */}
          <button
            onClick={toggleAudioOutput}
            onKeyDown={handleEnterSpace(toggleAudioOutput)}
            className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              isAudioOutputEnabled
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
            aria-label={`${isAudioOutputEnabled ? 'Disable' : 'Enable'} audio output`}
            title={`${isAudioOutputEnabled ? 'Disable' : 'Enable'} audio output`}
          >
            {isAudioOutputEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>

          {/* Clear Conversation */}
          <button
            onClick={clearConversation}
            onKeyDown={handleEnterSpace(clearConversation)}
            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Clear conversation"
            title="Clear conversation"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

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
              <p className="text-sm">{message.content}</p>
              <p className={`text-xs mt-1 opacity-70 ${
                message.role === 'user' ? 'text-primary-200' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        
        {/* Typing indicator */}
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
          {/* Voice Input Button - Always show for debugging */}
          <button
            onClick={toggleListening}
            onKeyDown={handleEnterSpace(toggleListening)}
            disabled={isProcessing || !speech.isAvailable}
            className={`p-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              !speech.isAvailable
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : speech.isListening
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-400'
            }`}
            aria-label={
              !speech.isAvailable 
                ? 'Voice input not available' 
                : speech.isListening 
                  ? 'Stop voice input' 
                  : 'Start voice input'
            }
            title={
              !speech.isAvailable 
                ? `Voice input not available. Available: ${speech.isAvailable}, Initialized: ${speech.isInitialized}, Error: ${speech.error || 'None'}` 
                : speech.isListening 
                  ? 'Stop voice input' 
                  : 'Start voice input'
            }
          >
            {speech.isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Text Input */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message here or use voice input..."
              disabled={isProcessing}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-gray-100 disabled:bg-gray-100 dark:disabled:bg-gray-700 min-h-[44px] max-h-[120px]"
              rows={1}
              aria-label="Message input"
            />
          </div>

          {/* Send Button */}
          <button
            onClick={sendMessage}
            onKeyDown={handleEnterSpace(sendMessage)}
            disabled={!inputText.trim() || isProcessing}
            className="p-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Send message"
            title="Send message"
          >
            <Send size={20} />
          </button>
        </div>

        {/* Status indicators */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            {speech.isListening && (
              <span className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                <span>Listening...</span>
              </span>
            )}
            
            {speech.isVoiceActive && (
              <span className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                <span>Voice detected</span>
              </span>
            )}
            
            {/* Speech Service Debug Info */}
            <span className={`text-xs ${speech.isAvailable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              Speech: {speech.isAvailable ? 'Available' : 'Unavailable'} | Init: {speech.isInitialized ? 'Yes' : 'No'}
            </span>
            
            {speech.error && (
              <span className="text-red-600 dark:text-red-400">Speech error: {speech.error}</span>
            )}
            
            {signalR.error && (
              <span className="text-red-600 dark:text-red-400">Connection error: {signalR.error}</span>
            )}
            
            {isAudioOutputEnabled && (
              <span className="text-blue-600 dark:text-blue-400">Audio output enabled</span>
            )}
            
            {signalR.sessionId && (
              <span className="text-gray-600 dark:text-gray-400">
                Session: {signalR.sessionId.slice(-8)}
              </span>
            )}
          </div>
          
          <span>Press Enter to send, Shift+Enter for new line</span>
        </div>
      </div>

      {/* Speech Settings Modal */}
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
        availableVoices={speech.availableVoices}
        selectedVoice={selectedVoice}
        onConfigUpdate={(config) => speech.updateConfig(config)}
        onVoiceSelect={(voice) => setSelectedVoice(voice)}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default AgentExperience;