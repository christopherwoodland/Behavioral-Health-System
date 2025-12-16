import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Trash2,
  Volume2,
  VolumeX,
  Settings,
  Users,
  Activity,
  Pause,
  Play,
  AlertTriangle,
  CheckCircle,
  Bot,
  Plus,
  Menu,
  X,
  MessageSquare
} from 'lucide-react';
import { config } from '@/config/constants';
import { env } from '@/utils/env';
import { announceToScreenReader, getUserId } from '@/utils';
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
import { AudioVisualizerBlob, ClosedCaptions } from '@/components/FloatingOrb';
import phqAssessmentService from '@/services/phqAssessmentService';
import chatTranscriptService from '@/services/chatTranscriptService';
import { phqSessionService } from '@/services/phqSessionService';
// phqProgressService no longer needed - phqAssessmentService handles all PHQ tracking with single assessment ID
import { useAuth } from '@/contexts/AuthContext';
import { agentOrchestrationService } from '@/services/agentOrchestrationService';
import { createTarsAgent } from '@/agents/tarsAgent';
import { jekyllAgent } from '@/agents/jekyllAgent';
import { matronAgent } from '@/agents/matronAgent';
import { sessionVoiceRecordingService } from '@/services/sessionVoiceRecordingService';
import './RealtimeAgentExperience.css';

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

// Debug logging flag - controlled via VITE_ENABLE_DEBUG_LOGGING environment variable
// When enabled, provides granular debugging (every message render, transcript event, etc.)
const ENABLE_DEBUG_LOGGING = env.ENABLE_DEBUG_LOGGING;

/**
 * Get agent-specific color classes for visual differentiation
 * @param agentId - The agent identifier (tars, matron, jekyll)
 * @returns Tailwind CSS classes for background and text colors
 */
const getAgentColor = (agentId?: string): { bg: string; text: string; border: string; outline: string } => {
  // Normalize agent ID to lowercase for comparison
  const normalizedId = agentId?.toLowerCase().replace('agent_', '');
  console.log('🎨 getAgentColor called:', { agentId, normalizedId });

  switch (normalizedId) {
    case 'tars':
      return {
        bg: 'bg-blue-100 dark:bg-blue-800',
        text: 'text-blue-900 dark:text-blue-100',
        border: 'border-l-4 border-blue-500',
        outline: 'border-2 border-blue-500 dark:border-blue-400'
      };
    case 'matron':
      return {
        bg: 'bg-green-100 dark:bg-green-800',
        text: 'text-green-900 dark:text-green-100',
        border: 'border-l-4 border-green-500',
        outline: 'border-2 border-green-500 dark:border-green-400'
      };
    case 'jekyll':
      return {
        bg: 'bg-teal-100 dark:bg-teal-800',
        text: 'text-teal-900 dark:text-teal-100',
        border: 'border-l-4 border-teal-600',
        outline: 'border-2 border-teal-600 dark:border-teal-400'
      };
    default:
      return {
        bg: 'bg-gray-100 dark:bg-gray-800',
        text: 'text-gray-900 dark:text-gray-100',
        border: '',
        outline: ''
      };
  }
};

// Voice type definition for Azure OpenAI Realtime API
type VoiceType = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'verse' | 'aria' | 'sage' | 'lumen';

/**
 * Maps agent IDs to their appropriate voices based on role and personality
 * Each agent has a voice optimized for their specific function:
 * - TARS: echo (robotic, command-oriented)
 * - Jekyll: shimmer (warm, conversational)
 * - Matron: nova (caring, professional)
 * @param agentId The agent identifier (e.g., 'Agent_Jekyll', 'Agent_Tars')
 * @param fallbackVoice Default voice to use if agent not found
 * @returns Voice string for Azure OpenAI Realtime API
 */
const getAgentVoice = (agentId: string, fallbackVoice: VoiceType = 'alloy'): VoiceType => {
  // Normalize agent ID to lowercase for comparison
  const normalizedId = agentId?.toLowerCase().replace('agent_', '');
  console.log('🎤 getAgentVoice called:', { agentId, normalizedId });

  switch (normalizedId) {
    case 'tars':
      return (env.TARS_VOICE as VoiceType) || 'echo';
    case 'jekyll':
      return (env.JEKYLL_VOICE as VoiceType) || 'shimmer';
    case 'matron':
      return (env.MATRON_VOICE as VoiceType) || 'nova';
    default:
      console.warn(`⚠️ Unknown agent '${agentId}', using fallback voice: ${fallbackVoice}`);
      return fallbackVoice;
  }
};

export const RealtimeAgentExperience: React.FC = () => {
  // Authentication context
  const { user } = useAuth();

  // Get authenticated user ID with fallback
  const authenticatedUserId = user?.id || getUserId();

  // Extract first name from full name
  const getFirstName = useCallback(() => {
    if (!user?.name || user.name === 'Sir') return 'Sir';
    return user.name.split(' ')[0];
  }, [user?.name]);

  // Get pet names for high humor levels
  const getPetName = useCallback(() => {
    const petNames = ['Champ', 'Slick', 'Ace', 'Hotshot', 'Chief'];

    // Try to create abbreviated last name if available
    if (user?.name && user.name.includes(' ')) {
      const nameParts = user.name.split(' ');
      if (nameParts.length > 1) {
        const lastName = nameParts[nameParts.length - 1];
        if (lastName.length > 2) {
          petNames.push(lastName.slice(0, 3).toUpperCase());
        }
      }
    }

    return petNames[Math.floor(Math.random() * petNames.length)];
  }, [user?.name]);

  // Get appropriate name based on humor level and randomness
  const getAppropiateName = useCallback((humorLevel: number, forceFirstName: boolean = false) => {
    const firstName = getFirstName();

    // Always use first name unless humor is 80%+ and random chance for pet name
    if (forceFirstName || humorLevel < 80) {
      return firstName;
    }

    // At 80%+ humor, 30% chance to use pet name
    if (Math.random() < 0.3) {
      return getPetName();
    }

    return firstName;
  }, [getFirstName, getPetName]);

  // Core service - direct WebRTC connection to Azure OpenAI Realtime API
  const agentService = azureOpenAIRealtimeService;

  // UI State
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [viewMode, setViewMode] = useState<'orb' | 'traditional'>(() => {
    const saved = localStorage.getItem('agent-view-mode');
    return (saved as 'orb' | 'traditional') || 'orb';
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [showCaptions, setShowCaptions] = useState(() => {
    const saved = localStorage.getItem('agent-show-captions');
    return saved === null ? true : saved === 'true';
  });

  // Agent State - Simplified for single GPT-Realtime agent
  const [currentAgent, setCurrentAgent] = useState<AgentStatus>({
    id: 'tars',
    name: 'Tars',
    isActive: false,
    isTyping: false
  });

  // Agent transition state for smooth animations
  const [isAgentTransitioning, setIsAgentTransitioning] = useState(false);
  const [previousAgent, setPreviousAgent] = useState<string>('');

  // Ref to track current agent in callbacks (so setupEventListeners can access latest agent)
  const currentAgentRef = useRef<AgentStatus>({
    id: 'tars',
    name: 'Tars',
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
  const [isMicInputEnabled, setIsMicInputEnabled] = useState(true);
  const [voiceActivityLevel] = useState(0);
  const [isSessionPaused, setIsSessionPaused] = useState(false);

  // Enhanced features state
  const [speechDetection, setSpeechDetection] = useState<SpeechDetectionState>({
    isUserSpeaking: false,
    isAISpeaking: false
  });
  const [conversationState, setConversationState] = useState<ConversationState>({ state: 'idle' });
  const [liveTranscripts, setLiveTranscripts] = useState<LiveTranscript[]>([]);

  const [enableInputTranscription, setEnableInputTranscription] = useState(true);
  const [currentAITranscript, setCurrentAITranscript] = useState<string>('');

  // Connection notification state
  const [connectionNotification, setConnectionNotification] = useState<{
    show: boolean;
    message: string;
    type: 'warning' | 'error' | 'info';
  }>({ show: false, message: '', type: 'info' });

  // Humor level state - starts at 100% and persists in localStorage
  const [humorLevel, setHumorLevel] = useState<number>(() => {
    const saved = localStorage.getItem('tars-flight-ops-mode');
    return saved ? parseInt(saved, 10) : 100;
  });

  // Function to update humor level with localStorage persistence
  const updateHumorLevel = useCallback((newLevel: number) => {
    const clampedLevel = Math.max(0, Math.min(100, newLevel));
    setHumorLevel(clampedLevel);
    localStorage.setItem('tars-flight-ops-mode', clampedLevel.toString());

    // Announce the change
    announceToScreenReader(`Humor level set to ${clampedLevel} percent`);

    // Get appropriate name for the message
    const firstName = getFirstName();
    const messageName = getAppropiateName(clampedLevel, false);

    // Add a message to show the change
    const humorMessage: ConversationMessage = {
      id: `humor-${Date.now()}`,
      role: 'assistant',
      agentId: currentAgent.id,
      content: `Humor level adjusted to ${clampedLevel}%. ${
        clampedLevel >= 80 ? `Got it, ${messageName}! I'm feeling pretty relaxed and friendly now.` :
        clampedLevel >= 60 ? `Understood, ${firstName}. I'll be professional but warm and supportive.` :
        clampedLevel >= 40 ? `Acknowledged, ${firstName}. I'll maintain a professional and helpful tone.` :
        clampedLevel >= 20 ? `Confirmed, ${firstName}. I'll use formal and structured communication.` :
        `Understood, ${firstName}. I'll communicate with maximum formality and precision.`
      }`,
      timestamp: new Date().toISOString()
    };

    if (sessionStatus.isActive) {
      setMessages(prev => [...prev, humorMessage]);
    }
  }, [sessionStatus.isActive, getFirstName, getAppropiateName]);

  // Azure OpenAI Realtime Settings
  const [azureSettings, setAzureSettings] = useState<AzureOpenAIRealtimeSettings>({
    turnDetectionThreshold: 0.5,
    turnDetectionPrefixPadding: 200,
    turnDetectionSilenceDuration: 300,
    maxResponse: 1638,
    temperature: 0.7, // Changed from 0.7 to meet Azure OpenAI minimum of 0.6
    voice: (env.TARS_VOICE || 'echo') as VoiceType
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

        // Auto-start session after initialization (controlled by environment variable)
        const autoStartEnabled = env.AUTO_START_SESSION;
        if (autoStartEnabled) {
          console.log('🚀 Auto-starting session...');
          await startSession();
        } else {
          console.log('ℹ️ Auto-start disabled. Click "Start Session" to begin.');
        }

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

  // Sync currentAgent to ref so callbacks always have access to latest agent
  useEffect(() => {
    currentAgentRef.current = currentAgent;
  }, [currentAgent]);

  // PHQ Assessment Handlers - DEPRECATED: Now handled by PHQ agents
  const setupEventListeners = useCallback(() => {
    // Azure OpenAI Realtime service callbacks
    agentService.onMessage((message: RealtimeMessage) => {
      // Verbose logging - only when debugging
      if (ENABLE_DEBUG_LOGGING) {
        console.log('🎭 ========================================');
        console.log('🎭 UI RECEIVED MESSAGE CALLBACK');
        console.log('🎭 Role:', message.role);
        console.log('🎭 Content:', message.content?.substring(0, 100));
        console.log('🎭 Message ID:', message.id);
        console.log('🎭 ========================================');
      }

      // NO LEXICAL/WORD-BASED ECHO PREVENTION
      // Relying 100% on WebRTC AEC3 + Mic Muting Strategy
      // Mic muting is now handled automatically in azureOpenAIRealtimeService.ts:
      //   - Mutes on 'response.created' (before agent speaks)
      //   - Unmutes on 'response.done' (after 2.5s delay)

      // IMPORTANT: User messages come through this callback for processing (voice commands, etc)
      // but should NOT be added to the message display since they're already added
      // via the transcript event in the service. Only add assistant messages to chat bubbles.

      // Check for humor level voice commands in user messages
      if (message.role === 'user' && message.content) {
        const humorCommand = message.content.match(/set (?:humor|flight ops|ops) (?:level )?to (\d+)/i);
        if (humorCommand) {
          const newLevel = parseInt(humorCommand[1], 10);
          if (newLevel >= 0 && newLevel <= 100) {
            updateHumorLevel(newLevel);
            return; // Don't add the command message to chat
          }
        }

        // Check for session control commands
        // CRITICAL: Only match explicit user commands, not agent responses
        // Users say things like "close session", "end conversation", "quit" (in context of the session)
        // NOT "I'm finishing data collection" or "returning to Tars"
        const closeSessionCommand = message.content.match(/^(?:close|end|stop|terminate|exit|quit) (?:the )?(?:session|conversation|chat|call|meeting|app|application)?\.?$/i) ||
                                    message.content.match(/(?:close|end|stop|exit) (?:session|conversation|chat|call)/i);
        const pauseSessionCommand = message.content.match(/^(?:pause|hold|suspend) (?:the )?(?:session|conversation|chat|call|meeting)?\.?$/i) ||
                                    message.content.match(/(?:pause|hold|suspend) (?:session|conversation|chat)/i);
        const resumeSessionCommand = message.content.match(/^(?:resume|continue|restart|unpause) (?:the )?(?:session|conversation|chat|call|meeting)?\.?$/i) ||
                                    message.content.match(/(?:resume|continue|restart) (?:session|conversation|chat)/i);
        const helpCommand = message.content.match(/(?:help|commands|what can you do|show commands|voice commands)/i);

        if (closeSessionCommand) {
          // Add confirmation message
          const confirmMessage: ConversationMessage = {
            id: `session-close-${Date.now()}`,
            role: 'assistant',
            agentId: currentAgent.id,
            content: `Thank you for our conversation today, ${getFirstName()}. Your session is ending now. Take care and remember - support is always available when you need it.`,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, confirmMessage]);

          // Save confirmation to transcript
          if (authenticatedUserId) {
            chatTranscriptService.addAssistantMessage(
              confirmMessage.content,
              'session-close',
              { triggeredByVoiceCommand: true, command: message.content }
            );
          }

          // Announce to screen reader
          announceToScreenReader('Session ending');

          // End the session after a brief delay
          setTimeout(() => {
            endSession();
          }, 2000);

          return; // Don't add the command message to chat
        }

        if (pauseSessionCommand) {
          if (!isSessionPaused) {
            pauseSession();

            const pauseMessage: ConversationMessage = {
              id: `session-pause-${Date.now()}`,
              role: 'assistant',
              agentId: currentAgent.id,
              content: `Session paused, ${getFirstName()}. I'll be here waiting when you're ready. Just say "resume session" to continue our conversation.`,
              timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, pauseMessage]);

            // Save pause message to transcript
            if (authenticatedUserId) {
              chatTranscriptService.addAssistantMessage(
                pauseMessage.content,
                'session-pause',
                { triggeredByVoiceCommand: true, command: message.content }
              );
            }

            // Announce to screen reader
            announceToScreenReader('Session paused');
          } else {
            const alreadyPausedMessage: ConversationMessage = {
              id: `session-already-paused-${Date.now()}`,
              role: 'assistant',
              agentId: currentAgent.id,
              content: `The session is already paused, ${getFirstName()}. Say "resume session" to continue.`,
              timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, alreadyPausedMessage]);
          }
          return; // Don't add the command message to chat
        }

        if (resumeSessionCommand) {
          if (isSessionPaused) {
            resumeSession();

            const resumeMessage: ConversationMessage = {
              id: `session-resume-${Date.now()}`,
              role: 'assistant',
              agentId: currentAgent.id,
              content: `Welcome back, ${getFirstName()}! Session resumed. How can I help you today?`,
              timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, resumeMessage]);

            // Save resume message to transcript
            if (authenticatedUserId) {
              chatTranscriptService.addAssistantMessage(
                resumeMessage.content,
                'session-resume',
                { triggeredByVoiceCommand: true, command: message.content }
              );
            }

            // Announce to screen reader
            announceToScreenReader('Session resumed');
          } else {
            const notPausedMessage: ConversationMessage = {
              id: `session-not-paused-${Date.now()}`,
              role: 'assistant',
              agentId: currentAgent.id,
              content: `The session is already active, ${getFirstName()}. How can I help you?`,
              timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, notPausedMessage]);
          }
          return; // Don't add the command message to chat
        }

        if (helpCommand) {
          const helpMessage: ConversationMessage = {
            id: `help-${Date.now()}`,
            role: 'assistant',
            agentId: currentAgent.id,
            content: `Here are the voice commands you can use, ${getFirstName()}:

🎭 **Humor Settings:**
• "Set humor level to [0-100]" - Adjust my personality from formal (0) to casual (100)

🗣️ **Session Control:**
• "Pause session" - Temporarily pause our conversation
• "Resume session" - Continue after pausing
• "Close session" or "End session" - End our conversation

💬 **General:**
• "Help" or "Commands" - Show this help message

Just speak naturally - I understand variations of these commands!`,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, helpMessage]);

          // Save help message to transcript
          if (authenticatedUserId) {
            chatTranscriptService.addAssistantMessage(
              helpMessage.content,
              'help-command',
              { triggeredByVoiceCommand: true, command: message.content }
            );
          }

          // Announce to screen reader
          announceToScreenReader('Voice commands help displayed');

          return; // Don't add the command message to chat
        }

        // NOTE: PHQ assessments are now initiated ONLY through function calls
        // Voice command detection removed to prevent duplicate starts

        // PHQ assessment handling now done by PHQ agents - no manual processing needed
        // const currentAssessment = phqAssessmentService.getCurrentAssessment();
        // if (currentAssessment && !currentAssessment.isCompleted) {
        //   handlePhqAssessmentResponse(message.content);
        //   return;
        // }
      }

      // Add ALL messages to the chat display (both user and assistant)
      if (ENABLE_DEBUG_LOGGING) {
        console.log(`✅ Adding ${message.role} message to chat display`);
      }

      // CRITICAL: Ensure message has agentId set to current agent
      // This prevents messages from showing wrong agent color when agent switches
      const messageWithAgent: RealtimeMessage = {
        ...message,
        agentId: message.agentId || currentAgentRef.current.id
      };

      setMessages(prev => [...prev, messageWithAgent]);
      setSessionStatus(prev => ({ ...prev, messageCount: prev.messageCount + 1 }));

      // Save message to chat transcript
      if (authenticatedUserId) {
        if (message.role === 'user') {
          // Check if this is a PHQ answer
          const currentAssessment = phqAssessmentService.getCurrentAssessment();
          const isPhqAnswer = currentAssessment && !currentAssessment.isCompleted;

          const metadata: any = { isTranscript: message.isTranscript, messageId: message.id, inputMethod: 'voice' };

          if (isPhqAnswer) {
            // Add PHQ answer metadata
            const answer = phqAssessmentService.parseAnswer(message.content);
            if (answer !== null) {
              const nextQuestion = phqAssessmentService.getNextQuestion();
              metadata.isPhqAnswer = true;
              metadata.phqType = currentAssessment.assessmentType === 'PHQ-2' ? 2 : 9;
              metadata.phqQuestionNumber = nextQuestion?.questionNumber;
              metadata.phqAnswerValue = answer;
              metadata.assessmentId = currentAssessment.assessmentId;
            }
          }

          if (ENABLE_DEBUG_LOGGING) {
            console.log('✅ Saving user message to transcript:', message.content.substring(0, 50) + '...');
          }

          chatTranscriptService.addUserMessage(
            message.content,
            'voice-input',
            metadata
          );

          // If this is during a PHQ assessment, also add to PHQ session messages
          if (isPhqAnswer && currentAssessment) {
            phqSessionService.addMessage('user', message.content, 'voice-input', metadata);
          }
        } else if (message.role === 'assistant') {
          // Check for PHQ question marker [PHQ-Q#]
          const phqMarkerMatch = message.content.match(/\[PHQ-Q(\d+)\]/);
          const metadata: any = { messageId: message.id };

          if (phqMarkerMatch) {
            const questionNumber = parseInt(phqMarkerMatch[1], 10);
            const currentAssessment = phqAssessmentService.getCurrentAssessment();

            if (currentAssessment) {
              // Add PHQ question metadata
              metadata.isPhqQuestion = true;
              metadata.phqType = currentAssessment.assessmentType === 'PHQ-2' ? 2 : 9;
              metadata.phqQuestionNumber = questionNumber;
              metadata.assessmentId = currentAssessment.assessmentId;

              // Extract the question text from the AI's message
              // Look for "Question X: [question text]" pattern
              const questionTextMatch = message.content.match(/Question \d+:\s*([^?]+\?)/);
              if (questionTextMatch && questionTextMatch[1]) {
                const questionText = questionTextMatch[1].trim();
                if (ENABLE_DEBUG_LOGGING) {
                  console.log(`📝 Extracted question text for Q${questionNumber}:`, questionText);
                }

                // Save question text to PHQ session
                phqSessionService.setQuestionText(questionNumber, questionText);
              }

              if (ENABLE_DEBUG_LOGGING) {
                console.log(`🏷️ PHQ Question detected with marker: Q${questionNumber}`, metadata);
              }

              // Add to PHQ session messages
              phqSessionService.addMessage('assistant', message.content, 'phq-question', metadata);
            }

            // Remove the marker from the displayed message
            message.content = message.content.replace(/\[PHQ-Q\d+\]\s*/g, '').trim();
          }

          // Check if AI is acknowledging a PHQ answer or skipping a question
          const currentAssessment = phqAssessmentService.getCurrentAssessment();
          if (currentAssessment && !currentAssessment.isCompleted) {
            // Look for answer acknowledgment patterns (e.g., "I've noted your response as 0")
            const answerAckMatch = message.content.match(/(?:noted|recorded|noted down|captured|registered|logged)\s+(?:your\s+)?(?:response|answer)?\s+(?:as|of)?\s*(\d)/i);

            if (answerAckMatch) {
              const acknowledgedAnswer = parseInt(answerAckMatch[1], 10);
              const currentQuestion = phqAssessmentService.getNextQuestion();

              if (currentQuestion && acknowledgedAnswer >= 0 && acknowledgedAnswer <= 3) {
                if (ENABLE_DEBUG_LOGGING) {
                  console.log(`🎯 AI acknowledged answer ${acknowledgedAnswer} for Q${currentQuestion.questionNumber}`);
                }

                // Record the answer in both services
                phqAssessmentService.recordAnswer(currentQuestion.questionNumber, acknowledgedAnswer);
                phqSessionService.recordAnswer(currentQuestion.questionNumber, acknowledgedAnswer);

                // Check if assessment is now complete
                const updatedAssessment = phqAssessmentService.getCurrentAssessment();
                if (updatedAssessment?.isCompleted) {
                  // Calculate final score and complete
                  const score = phqAssessmentService.calculateScore();
                  const severity = phqAssessmentService.determineSeverity(score, updatedAssessment.assessmentType);
                  phqSessionService.completeAssessment(score, severity);
                  if (ENABLE_DEBUG_LOGGING) {
                    console.log(`✅ PHQ Assessment completed! Score: ${score}, Severity: ${severity}`);
                  }
                }
              }
            }

            // Look for skip/completion patterns (e.g., "We'll skip this question", "That completes the PHQ-2")
            const skipMatch = message.content.match(/(?:skip|skipping|skipped)\s+(?:this\s+)?(?:question|item)/i);
            const completeMatch = message.content.match(/(?:completes?|completed|finished)\s+(?:the\s+)?(?:PHQ-2|PHQ-9|assessment|screening)/i);

            if (skipMatch) {
              if (ENABLE_DEBUG_LOGGING) {
                console.log('⏭️ AI indicated question will be skipped');
              }
              // Question is already marked as skipped by recordInvalidAttempt, just log it
            }

            if (completeMatch) {
              if (ENABLE_DEBUG_LOGGING) {
                console.log('🏁 AI indicated assessment is complete');
              }
              // Check if we need to force completion (in case some questions were skipped)
              const updatedAssessment = phqAssessmentService.getCurrentAssessment();
              if (updatedAssessment && !updatedAssessment.isCompleted) {
                // Force completion even with null answers (skipped questions)
                const score = phqAssessmentService.calculateScore();
                const severity = phqAssessmentService.determineSeverity(score, updatedAssessment.assessmentType);
                phqSessionService.completeAssessment(score, severity);
                if (ENABLE_DEBUG_LOGGING) {
                  console.log(`✅ PHQ Assessment force-completed! Score: ${score}, Severity: ${severity}`);
                }
              }
            }
          }

          chatTranscriptService.addAssistantMessage(
            message.content,
            'agent-response',
            metadata
          );
        }
      }
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
          // Keep transcript visible for 8 seconds to handle agent speaking at variable speeds
          // Only clear if agent is no longer speaking, otherwise let it display
          setTimeout(() => {
            setCurrentAITranscript(prevText => {
              // Only clear if this was the same transcript (hasn't been updated)
              // This ensures we keep showing new utterances as they arrive
              if (prevText === transcript.text) {
                return '';
              }
              return prevText;
            });
          }, 8000);
        }
      }
    });

    // Connection lost handler - show notification and attempt reconnection
    agentService.onConnectionLost((attempts, maxAttempts) => {
      if (attempts >= maxAttempts) {
        // Max reconnection attempts reached
        setConnectionNotification({
          show: true,
          message: `Connection lost. Unable to reconnect after ${maxAttempts} attempts. Please refresh the page.`,
          type: 'error'
        });
        announceToScreenReader('Connection lost. Please refresh the page.');
      } else {
        // Attempting to reconnect
        setConnectionNotification({
          show: true,
          message: `Connection lost. Reconnecting... (Attempt ${attempts}/${maxAttempts})`,
          type: 'warning'
        });
        announceToScreenReader(`Connection lost. Attempting to reconnect. Attempt ${attempts} of ${maxAttempts}.`);

        // Auto-hide notification after 5 seconds if reconnection succeeds
        setTimeout(() => {
          setConnectionNotification(prev => ({ ...prev, show: false }));
        }, 5000);
      }
    });

    // NOTE: onTranscript callback removed - messages now handled via onMessage callback
    // This prevents duplicate messages since onMessage receives both user and assistant messages

    agentService.onError((error) => {
      console.error('Azure OpenAI Realtime service error:', error);
      announceToScreenReader(`Service error: ${error.message}`);
      setSessionStatus(prev => ({ ...prev, connectionStatus: 'error' }));
      setConversationState({ state: 'error', message: error.message });
    });

  }, []);

  // Handle audio output muting/unmuting
  useEffect(() => {
    agentService.setAudioOutputMuted(!isAudioEnabled);
  }, [isAudioEnabled]);

  // Handle mic input muting/unmuting
  useEffect(() => {
    agentService.muteMicrophone(!isMicInputEnabled);
  }, [isMicInputEnabled]);

  // Handle session-wide voice recording based on user speech detection
  useEffect(() => {
    if (speechDetection.isUserSpeaking) {
      // User started speaking - start capturing audio for session recording (if enabled)
      if (env.ENABLE_SESSION_VOICE_RECORDING) {
        sessionVoiceRecordingService.onUserSpeechStart();
      }
    } else {
      // User stopped speaking - stop capturing audio
      if (env.ENABLE_SESSION_VOICE_RECORDING) {
        sessionVoiceRecordingService.onUserSpeechStop();
      }

      // Session recording is managed by sessionVoiceRecordingService
      // State updates happen automatically via the service
    }
  }, [speechDetection.isUserSpeaking]);

  // Close header menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isHeaderMenuOpen && !target.closest('[data-header-menu]')) {
        setIsHeaderMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isHeaderMenuOpen]);

  // Agent display name not needed for single agent
  // const getAgentDisplayName = () => 'AI Assistant';

  // NOTE: Initial greeting is now handled by Tars through Realtime API
  // Greeting generation logic removed as it's no longer needed


  const startSession = async () => {
    // Guard: Don't start if already active or connecting
    if (sessionStatus.isActive || sessionStatus.connectionStatus === 'connecting') {
      console.log('⚠️ Session already active or connecting, skipping start');
      return;
    }

    try {
      setIsProcessing(true);

      // CRITICAL: Set connection status to 'connecting' IMMEDIATELY to prevent double-start
      setSessionStatus(prev => ({ ...prev, connectionStatus: 'connecting' }));

      // =============================================================================
      // MULTI-AGENT SETUP: Register specialized agents with orchestration service
      // =============================================================================

      // Register specialized agents
      console.log('🤖 ========================================');
      console.log('🤖 REGISTERING AGENTS');
      console.log('🤖 ========================================');

      // Register Matron with humor level context
      const humorAwareMatronAgent = {
        ...matronAgent,
        systemMessage: matronAgent.systemMessage.replace(
          /High humor \(80-100%\):|Medium humor \(40-79%\):|Low humor \(0-39%\):/g,
          ''
        ) + `\n\nCURRENT HUMOR LEVEL: ${humorLevel}%`
      };
      agentOrchestrationService.registerAgent(humorAwareMatronAgent);

      // Conditionally register Jekyll agent based on feature flag
      if (env.ENABLE_JEKYLL_AGENT) {
        console.log('✅ Jekyll agent enabled');
        const humorAwareJekyllAgent = {
          ...jekyllAgent,
          systemMessage: jekyllAgent.systemMessage.replace(
            /High humor \(80-100%\):|Medium humor \(40-79%\):|Low humor \(0-39%\):/g,
            ''
          ) + `\n\nCURRENT HUMOR LEVEL: ${humorLevel}%`
        };
        agentOrchestrationService.registerAgent(humorAwareJekyllAgent);
      } else {
        console.log('❌ Jekyll agent disabled');
      }

      // Register Tars as the root orchestration agent using abstracted configuration
      const tarsRootAgent = createTarsAgent({
        firstName: getFirstName(),
        humorLevel: humorLevel,
        functionsBaseUrl: config.api.baseUrl
      });

      // Add session control and UI-specific tool handlers that need access to component state
      tarsRootAgent.tools.push(
        {
          name: 'pause-session',
          description: 'Temporarily pauses the conversation session. The user can resume later.',
          parameters: {
            type: 'object' as const,
            properties: {},
            required: []
          },
          handler: async () => {
            console.log('⏸️ Pausing session...');
            pauseSession();
            return { success: true, status: 'paused' };
          }
        },
        {
          name: 'resume-session',
          description: 'Resumes a previously paused conversation session.',
          parameters: {
            type: 'object' as const,
            properties: {},
            required: []
          },
          handler: async () => {
            console.log('▶️ Resuming session...');
            resumeSession();
            return { success: true, status: 'resumed' };
          }
        },
        {
          name: 'close-session',
          description: 'Ends the conversation session permanently.',
          parameters: {
            type: 'object' as const,
            properties: {},
            required: []
          },
          handler: async () => {
            console.log('🛑 Closing session...');
            await endSession();
            return { success: true, status: 'closed' };
          }
        },
        {
          name: 'set-humor-level',
          description: 'Adjusts the AI personality humor level between 0-100. Higher values make the AI more casual and friendly, lower values make it more formal and professional.',
          parameters: {
            type: 'object' as const,
            properties: {
              level: {
                type: 'string',
                description: 'The humor level as a number between 0 and 100'
              }
            },
            required: ['level']
          },
          handler: async (params: any) => {
            const level = parseInt(params.level, 10);
            if (isNaN(level) || level < 0 || level > 100) {
              return { success: false, error: 'Invalid humor level. Must be between 0 and 100.' };
            }
            console.log(`🎭 Setting humor level to ${level}%...`);
            updateHumorLevel(level);
            return { success: true, humorLevel: level, message: `Humor level updated to ${level}%` };
          }
        }
      );

      agentOrchestrationService.registerRootAgent(tarsRootAgent);

      // Get root agent configuration
      const rootConfig = agentOrchestrationService.getRootAgentConfig();
      const rootTools = agentOrchestrationService.convertToRealtimeTools(rootConfig.tools);

      console.log('🤖 Root agent tools:', rootTools.map(t => t.name));
      console.log('🤖 ========================================');

      // Convert UI settings to service config format
      const sessionConfig: SessionConfig = {
        ...convertSettingsToConfig(
          azureSettings,
          isAudioEnabled,
          true, // enableVAD
          rootConfig.systemMessage,
          enableInputTranscription // Enable input audio transcription
        ),
        tools: rootTools // Enable function calling with orchestrated agent tools
      };

      // =============================================================================
      // MULTI-AGENT FUNCTION CALL HANDLER: Routes calls through orchestration service
      // =============================================================================
      agentService.onFunctionCall(async (functionName, args) => {
        console.log('🎯 ========================================');
        console.log(`🎯 FUNCTION CALLED: ${functionName}`);
        console.log('🎯 Arguments:', JSON.stringify(args, null, 2));
        console.log('🎯 ========================================');

        try {
          // Route through orchestration service
          const result = await agentOrchestrationService.handleToolCall(
            functionName,
            { ...args, userId: authenticatedUserId },
            `call-${Date.now()}`
          );

          console.log('🎯 Tool result:', JSON.stringify(result, null, 2));

          if (result.isAgentSwitch) {
            // This is an agent switch - update the session
            console.log('🔄 ========================================');
            console.log('🔄 AGENT SWITCH DETECTED');
            console.log('🔄 Target agent:', result.targetAgentId);
            console.log('🔄 ========================================');

            if (result.switchConfig && result.targetAgentId) {
              // Helper function to perform the actual agent switch
              const performAgentSwitch = async () => {
                // Convert tools to Realtime API format
                const realtimeTools = agentOrchestrationService.convertToRealtimeTools(result.switchConfig!.tools);

                console.log('🔄 New agent tools:', realtimeTools.map(t => t.name));

                // Update UI to show the new agent
                const targetAgentId = result.targetAgentId!;
                const agentDisplayName =
                  targetAgentId === 'Agent_Matron' ? 'Matron' :
                  targetAgentId === 'Agent_Jekyll' ? 'Jekyll' :
                  targetAgentId === 'Agent_Tars' ? 'Tars' :
                  'Agent';

                // Start transition animation - fade out current agent
                setPreviousAgent(currentAgent.name);
                setIsAgentTransitioning(true);

                // Wait for fade out animation
                await new Promise(resolve => setTimeout(resolve, 300));

                // Update UI to show the new agent
                setCurrentAgent({
                  id: targetAgentId.toLowerCase().replace('agent_', ''),
                  name: agentDisplayName,
                  isActive: true,
                  isTyping: false
                });

                setSessionStatus(prev => ({
                  ...prev,
                  currentAgent: targetAgentId
                }));

                // Announce agent switch for accessibility
                announceToScreenReader(`Switched to ${agentDisplayName} agent`);

                // End transition after fade in completes
                setTimeout(() => {
                  setIsAgentTransitioning(false);
                }, 400);

                // Determine agent voice using role-based mapping
                const agentVoice = getAgentVoice(targetAgentId, azureSettings.voice);

                // Build updated session config
                const updatedConfig: SessionConfig = {
                  ...convertSettingsToConfig(
                    azureSettings,
                    isAudioEnabled,
                    true,
                    result.switchConfig!.systemMessage,
                    enableInputTranscription
                  ),
                  tools: realtimeTools
                };

                // Update voice if it's safe to do so
                const shouldUpdateVoice = agentService.canUpdateVoice();

                if (shouldUpdateVoice) {
                  updatedConfig.voice = agentVoice;
                  console.log(`🎤 Updating session with voice: ${agentVoice}`);
                } else {
                  console.log('⚠️ Skipping voice update - assistant audio is active');
                }

                agentService.updateSession(updatedConfig);

                console.log('✅ Session updated for new agent');
                console.log('🔄 ========================================');
              };

              // Add delay when switching from Tars to any other agent
              // This allows Tars's handoff announcement to be heard before the switch
              const HANDOFF_DELAY_MS = env.AGENT_HANDOFF_DELAY_MS;

              if (currentAgent.id === 'tars' && result.targetAgentId !== 'Agent_Tars') {
                const targetAgentName =
                  result.targetAgentId === 'Agent_Matron' ? 'Matron' :
                  result.targetAgentId === 'Agent_Jekyll' ? 'Jekyll' :
                  'agent';
                console.log(`⏱️ Delaying ${targetAgentName} handoff by ${HANDOFF_DELAY_MS}ms to allow announcement...`);
                setTimeout(() => {
                  performAgentSwitch();
                }, HANDOFF_DELAY_MS);
              } else {
                // Switch immediately for other agent transitions (e.g., returning to Tars)
                await performAgentSwitch();
              }

              // Return acknowledgment that agent switch is complete
              return {
                success: true,
                agentSwitched: true,
                newAgentId: result.targetAgentId,
                message: `Control transferred to ${result.targetAgentId}`
              };
            }
          }

          // Not an agent switch - return the tool result
          return result.result;

        } catch (error) {
          console.error('❌ Function call error:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }

        // OLD CODE BELOW - Now handled by orchestration service, can be removed
        /*
        const conversationSessionId = sessionStorage.getItem('chat-session-id') || undefined;

        switch (functionName) {
          case 'pause-session':
            console.log('Pausing session...');
            pauseSession();
            return { success: true, status: 'paused' };

          case 'resume-session':
            console.log('Resuming session...');
            resumeSession();
            return { success: true, status: 'resumed' };

          case 'close-session':
            console.log('Closing session...');
            await endSession();
            return { success: true, status: 'closed' };

          case 'set-humor-level':
            const level = parseInt(args.level as string, 10);
            if (isNaN(level) || level < 0 || level > 100) {
              return { success: false, error: 'Invalid humor level. Must be between 0 and 100.' };
            }
            console.log(`Setting humor level to ${level}%...`);
            setHumorLevel(level);
            return { success: true, humorLevel: level };

          default:
            return { success: false, error: `Unknown function: ${functionName}` };
        }
        */
      });

      await agentService.startSession('user', sessionConfig);

      // Initialize chat transcript session
      if (authenticatedUserId) {
        const existingSessionId = sessionStorage.getItem('chat-session-id') || undefined;
        const transcript = chatTranscriptService.initializeSession(authenticatedUserId, existingSessionId);
        // Store the session ID for PHQ assessments to use the same ID
        sessionStorage.setItem('chat-session-id', transcript.sessionId);
        console.log('📎 Chat session initialized:', transcript.sessionId);
      }

      // Start session-wide voice recording (captures all user speech)
      // Only if enabled via environment variable
      if (env.ENABLE_SESSION_VOICE_RECORDING) {
        const sessionId = sessionStorage.getItem('chat-session-id') || `session_${Date.now()}`;
        const userId = authenticatedUserId || getUserId();
        try {
          await sessionVoiceRecordingService.startSessionRecording(sessionId, userId);
          console.log('✅ Session voice recording started');
        } catch (error) {
          console.error('❌ Failed to start session voice recording:', error);
          // Continue with session even if recording fails
        }
      } else {
        console.log('ℹ️ Session voice recording disabled (VITE_ENABLE_SESSION_VOICE_RECORDING=false)');
      }

      // Clear previous state
      setLiveTranscripts([]);
      setCurrentAITranscript('');
      setMessages([]); // Start with empty messages - let Tars greet naturally

      // Trigger Tars to speak first after data channel is ready
      // This tells Tars to greet the user and check for biometric data
      agentService.sendInitialGreeting(
        'Session started. Please greet the user warmly and then check if they have biometric data saved.'
      ).catch((error: Error) => {
        console.error('Failed to send initial greeting prompt:', error);
      });

      announceToScreenReader('Session started. Tars will greet you shortly.');

    } catch (error) {
      console.error('Failed to start session:', error);
      announceToScreenReader('Failed to start real-time session');
      // Reset connection status on error so user can try again
      setSessionStatus(prev => ({ ...prev, connectionStatus: 'error' }));
    } finally {
      setIsProcessing(false);
    }
  };

  const endSession = async () => {
    try {
      // Wait 3.5 seconds to allow agent to finish speaking its final utterance
      console.log('⏳ Waiting for agent to complete final response before ending session...');
      await new Promise(resolve => setTimeout(resolve, 3500));

      // Stop and save session-wide voice recording
      if (sessionVoiceRecordingService.isRecording()) {
        try {
          console.log('🎙️ Stopping session voice recording...');
          const result = await sessionVoiceRecordingService.stopSessionRecording();
          if (result) {
            console.log(`✅ Session recording saved: ${result.audioUrl}`);
            console.log(`   Total duration: ${result.totalDuration.toFixed(1)}s`);
            console.log(`   Captured speech: ${result.capturedDuration.toFixed(1)}s`);
          }
        } catch (error) {
          console.error('❌ Failed to save session recording:', error);
        }
      }

      // End chat transcript session
      if (authenticatedUserId) {
        chatTranscriptService.endSession();
      }

      await agentService.endSession();

      // Clear all messages
      setMessages([]);

      // Reset session status completely
      setSessionStatus({
        isActive: false,
        sessionId: undefined,
        messageCount: 0,
        currentAgent: 'coordinator',
        hasAudioSupport: false,
        connectionStatus: 'connected'
      });

      // Reset to Tars agent (root agent)
      setCurrentAgent({
        id: 'tars',
        name: 'Tars',
        isActive: false,
        isTyping: false
      });

      // Clear current AI transcript
      setCurrentAITranscript('');

      // Reset session paused state
      setIsSessionPaused(false);

      announceToScreenReader('Session ended. All state cleared. Ready to start fresh with Tars.');
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

  // Trigger agent to vocalize (hum, la la la, etc) during idle time
  const handleAgentVocalization = () => {
    // Array of random vocalizations the agent might say
    const vocalizations = [
      'Hmmmm...',
      'La la la',
      'Mmm hmm',
      'Hmm interesting',
      'Yeah, uh huh',
      'Ooh la la'
    ];

    // Pick a random vocalization
    const randomVocalization = vocalizations[Math.floor(Math.random() * vocalizations.length)];

    // Send it as a user message to the agent
    // This will be picked up by the agent as a prompt and responded to naturally
    console.log(`🎤 Agent vocalization trigger: ${randomVocalization}`);

    // We'll send this as a subtle system prompt rather than a visible message
    // by using the agent service's ability to send conversation items
    try {
      // Note: This would need a method on agentService to send text input
      // For now, we'll just log it. The real implementation would send this
      // through the WebRTC data channel as a conversation.item.create event
    } catch (error) {
      console.warn('Failed to trigger vocalization:', error);
    }
  };

  // Agent handoff not needed for single GPT-Realtime agent
  // const manualAgentHandoff = async (targetAgent: string) => {
  //   // Not applicable for single agent model
  // };

  const cleanup = async () => {
    // Cleanup transcript service
    chatTranscriptService.cleanup();
    // Note: phqProgressService no longer used - phqAssessmentService handles all PHQ tracking

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
    <div className={`h-[calc(100vh-8rem)] flex flex-col rounded-lg border ${
      sessionStatus.isActive
        ? 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'
        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
    }`}>
      {/* Connection Notification Toast */}
      {connectionNotification.show && (
        <div className={`absolute top-4 right-4 z-50 max-w-md rounded-lg shadow-lg p-4 animate-slide-in-right ${
          connectionNotification.type === 'error'
            ? 'bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700'
            : connectionNotification.type === 'warning'
              ? 'bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700'
              : 'bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700'
        }`}>
          <div className="flex items-start space-x-3">
            <div className={`flex-shrink-0 ${
              connectionNotification.type === 'error'
                ? 'text-red-600 dark:text-red-400'
                : connectionNotification.type === 'warning'
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-blue-600 dark:text-blue-400'
            }`}>
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                connectionNotification.type === 'error'
                  ? 'text-red-900 dark:text-red-100'
                  : connectionNotification.type === 'warning'
                    ? 'text-yellow-900 dark:text-yellow-100'
                    : 'text-blue-900 dark:text-blue-100'
              }`}>
                {connectionNotification.message}
              </p>
            </div>
            <button
              onClick={() => setConnectionNotification(prev => ({ ...prev, show: false }))}
              className={`flex-shrink-0 ${
                connectionNotification.type === 'error'
                  ? 'text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200'
                  : connectionNotification.type === 'warning'
                    ? 'text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200'
                    : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200'
              }`}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Hamburger Menu - Only visible in 3D mode */}
      {viewMode === 'orb' && (
        <div className="fixed top-4 right-4 z-[9998]">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-lg bg-white/20 dark:bg-gray-900/20 hover:bg-white/30 dark:hover:bg-gray-900/30 backdrop-blur-sm transition-all"
          >
            {isMenuOpen ? (
              <X size={24} className="text-white" />
            ) : (
              <Menu size={24} className="text-white" />
            )}
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute top-12 right-0 mt-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden w-48">
              <button
                onClick={() => {
                  setIsSettingsOpen(true);
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Settings size={16} />
                <span>Settings</span>
              </button>
              <button
                onClick={() => {
                  setMessages([]);
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-red-600 dark:text-red-400"
              >
                <Trash2 size={16} />
                <span>Clear Chat</span>
              </button>
              <button
                onClick={() => {
                  const newMode: 'orb' | 'traditional' = viewMode === 'orb' ? 'traditional' : 'orb';
                  setViewMode(newMode);
                  localStorage.setItem('agent-view-mode', newMode);
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Users size={16} />
                <span>Switch View</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Header - Visible in all modes, responsive layout */}
      <div className={`flex items-center justify-between p-2 md:p-4 border-b gap-2 md:gap-3 bg-white dark:bg-gray-900 ${
        sessionStatus.isActive ? 'border-gray-300 dark:border-gray-600' : 'border-gray-200 dark:border-gray-700'
      }`}>
        <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
          {/* Agent Avatar with Voice Activity */}
          <div className="relative flex-shrink-0">
            <div className={`w-10 md:w-12 h-10 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
              currentAgent.isTyping
                ? 'bg-primary-600 animate-pulse'
                : currentAgent.id === 'tars'
                  ? 'bg-blue-600'
                  : currentAgent.id === 'matron'
                  ? 'bg-green-600'
                  : currentAgent.id === 'jekyll'
                  ? 'bg-teal-600'
                  : 'bg-gray-400'
            }`}>
              {currentAgent.id === 'tars' ? (
                <Bot
                  className={`text-white transition-transform duration-300 ${
                    currentAgent.isTyping ? 'animate-pulse scale-110' : ''
                  }`}
                  size={20}
                />
              ) : currentAgent.id === 'matron' ? (
                <span className={`text-white text-xl md:text-2xl transition-transform duration-300 ${
                  currentAgent.isTyping ? 'animate-pulse scale-110' : ''
                }`}>
                  ➕
                </span>
              ) : (
                <Bot
                  className={`text-white transition-transform duration-300 ${
                    currentAgent.isTyping ? 'animate-pulse scale-110' : ''
                  }`}
                  size={20}
                />
              )}
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
              {currentAgent.name}
            </h1>
            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
              <span>Active Agent</span>

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

        <div className="flex items-center gap-2">
          {/* Desktop buttons - Hidden on small screens */}
          <div className="hidden md:flex items-center space-x-1 md:space-x-2">
            {/* Interrupt Button - Show when AI is speaking */}
            {sessionStatus.isActive && speechDetection.isAISpeaking && (
              <button
                onClick={interruptResponse}
                className="p-1.5 md:p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Interrupt AI response"
                title="Interrupt response"
              >
                <AlertTriangle size={18} />
              </button>
            )}

            {/* Live Transcripts Toggle */}
            {sessionStatus.isActive && (
              <button
                onClick={() => {
                  setShowCaptions(!showCaptions);
                  localStorage.setItem('agent-show-captions', (!showCaptions).toString());
                }}
                className={`p-1.5 md:p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  showCaptions
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}
                aria-label={`${showCaptions ? 'Hide' : 'Show'} live transcripts`}
                title={`${showCaptions ? 'Hide' : 'Show'} live captions`}
              >
                <span className="text-xs md:text-sm font-medium">CC</span>
              </button>
            )}

            {/* View Mode Toggle - Orb vs Traditional */}
            <button
              onClick={() => {
                const newMode = ((viewMode as any) === 'orb' ? 'traditional' : 'orb') as 'orb' | 'traditional';
                setViewMode(newMode);
                localStorage.setItem('agent-view-mode', newMode);
              }}
              className={`p-1.5 md:p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 text-xs md:text-base ${
                (viewMode as any) === 'orb'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-label={`Switch to ${(viewMode as any) === 'orb' ? 'traditional' : 'orb'} view`}
              title={`View: ${(viewMode as any) === 'orb' ? 'Orb (3D)' : 'Traditional (List)'}`}
            >
              {(viewMode as any) === 'orb' ? '3D' : '📋'}
            </button>

            {/* Agent Panel Toggle */}
            <button
              onClick={() => setShowAgentPanel(!showAgentPanel)}
              className={`p-1.5 md:p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                showAgentPanel
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              aria-label="Toggle agent panel"
              title="Agent controls"
            >
              <Users size={18} />
            </button>

            {/* Session Controls */}
            {sessionStatus.isActive ? (
              <>
                <button
                  onClick={isSessionPaused ? resumeSession : pauseSession}
                  className="p-1.5 md:p-2 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label={isSessionPaused ? 'Resume session' : 'Pause session'}
                  title={isSessionPaused ? 'Resume session' : 'Pause session'}
                >
                  {isSessionPaused ? <Play size={18} /> : <Pause size={18} />}
                </button>

                <button
                  onClick={endSession}
                  className="p-1.5 md:p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label="End session"
                  title="End session"
                >
                  <Trash2 size={18} />
                </button>
              </>
            ) : (
              <button
                onClick={startSession}
                disabled={sessionStatus.connectionStatus !== 'connected' || isProcessing}
                className="px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-base bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 whitespace-nowrap"
                aria-label="Start session"
              >
                {isProcessing ? 'Starting...' : 'Start Session'}
              </button>
            )}

            {/* Audio Toggle */}
            <button
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              className={`p-1.5 md:p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                isAudioEnabled
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
              aria-label={`${isAudioEnabled ? 'Disable' : 'Enable'} audio output`}
              title={`${isAudioEnabled ? 'Disable' : 'Enable'} audio output (speakers)`}
            >
              {isAudioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            {/* Microphone Input Toggle */}
            <button
              onClick={() => setIsMicInputEnabled(!isMicInputEnabled)}
              className={`p-1.5 md:p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                isMicInputEnabled
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}
              aria-label={`${isMicInputEnabled ? 'Disable' : 'Enable'} microphone input`}
              title={`${isMicInputEnabled ? 'Disable' : 'Enable'} microphone input`}
            >
              {isMicInputEnabled ? <Mic size={18} /> : <MicOff size={18} />}
            </button>

            {/* Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 md:p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Settings"
              title="Settings"
            >
              <Settings size={18} />
            </button>
          </div>

          {/* Mobile hamburger menu */}
          <div className="md:hidden relative" data-header-menu>
            <button
              onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Open menu"
              title="Menu"
            >
              {isHeaderMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Mobile dropdown menu */}
            {isHeaderMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <div className="p-2 space-y-1">
                  {/* Interrupt Button - Show when AI is speaking */}
                  {sessionStatus.isActive && speechDetection.isAISpeaking && (
                    <button
                      onClick={() => {
                        interruptResponse();
                        setIsHeaderMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-md text-red-600 dark:text-red-400"
                    >
                      <AlertTriangle size={16} />
                      <span>Interrupt Response</span>
                    </button>
                  )}

                  {/* Live Transcripts Toggle */}
                  {sessionStatus.isActive && (
                    <button
                      onClick={() => {
                        setShowCaptions(!showCaptions);
                        localStorage.setItem('agent-show-captions', (!showCaptions).toString());
                        setIsHeaderMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-md ${
                        showCaptions ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <MessageSquare size={16} />
                      <span>{showCaptions ? 'Hide' : 'Show'} Live Captions</span>
                    </button>
                  )}

                  {/* View Mode Toggle */}
                  <button
                    onClick={() => {
                      const newMode = ((viewMode as any) === 'orb' ? 'traditional' : 'orb') as 'orb' | 'traditional';
                      setViewMode(newMode);
                      localStorage.setItem('agent-view-mode', newMode);
                      setIsHeaderMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-md ${
                      (viewMode as any) === 'orb' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span className="text-base">{(viewMode as any) === 'orb' ? '📋' : '🔮'}</span>
                    <span>Switch to {(viewMode as any) === 'orb' ? 'Traditional' : '3D Orb'} View</span>
                  </button>

                  {/* Agent Panel Toggle */}
                  <button
                    onClick={() => {
                      setShowAgentPanel(!showAgentPanel);
                      setIsHeaderMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-md ${
                      showAgentPanel ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Users size={16} />
                    <span>{showAgentPanel ? 'Hide' : 'Show'} Agent Controls</span>
                  </button>

                  {/* Session Controls */}
                  {sessionStatus.isActive ? (
                    <>
                      <button
                        onClick={() => {
                          isSessionPaused ? resumeSession() : pauseSession();
                          setIsHeaderMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-md text-yellow-600 dark:text-yellow-400"
                      >
                        {isSessionPaused ? <Play size={16} /> : <Pause size={16} />}
                        <span>{isSessionPaused ? 'Resume' : 'Pause'} Session</span>
                      </button>

                      <button
                        onClick={() => {
                          endSession();
                          setIsHeaderMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-md text-red-600 dark:text-red-400"
                      >
                        <Trash2 size={16} />
                        <span>End Session</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        startSession();
                        setIsHeaderMenuOpen(false);
                      }}
                      disabled={sessionStatus.connectionStatus !== 'connected' || isProcessing}
                      className="w-full text-left px-3 py-2 flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-md text-primary-600 dark:text-primary-400 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      <Play size={16} />
                      <span>{isProcessing ? 'Starting...' : 'Start Session'}</span>
                    </button>
                  )}

                  {/* Audio Toggle */}
                  <button
                    onClick={() => {
                      setIsAudioEnabled(!isAudioEnabled);
                      setIsHeaderMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-md ${
                      isAudioEnabled ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {isAudioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    <span>{isAudioEnabled ? 'Disable' : 'Enable'} Audio Output</span>
                  </button>

                  {/* Microphone Input Toggle */}
                  <button
                    onClick={() => {
                      setIsMicInputEnabled(!isMicInputEnabled);
                      setIsHeaderMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-md ${
                      isMicInputEnabled ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {isMicInputEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                    <span>{isMicInputEnabled ? 'Disable' : 'Enable'} Microphone</span>
                  </button>

                  {/* Settings */}
                  <button
                    onClick={() => {
                      setIsSettingsOpen(true);
                      setIsHeaderMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-md text-gray-700 dark:text-gray-300"
                  >
                    <Settings size={16} />
                    <span>Settings</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agent Control Panel - Enhanced with feature toggles */}
      {showAgentPanel && (
        <div className={`p-4 border-b bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-medium text-gray-900 dark:text-white ${isAgentTransitioning ? 'agent-switching-in' : ''}`}>{currentAgent.name}</h3>
              <div className="flex items-center space-x-2">
                <div className="px-3 py-1 text-xs rounded-full bg-primary-600 text-white">
                  {currentAgent.name}
                </div>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Powered by Azure OpenAI Realtime API
                </span>
              </div>
            </div>

            {/* Humor Level Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Humor Mode: {humorLevel}%
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {humorLevel >= 80 ? 'Friendly & Casual' :
                   humorLevel >= 60 ? 'Warm & Supportive' :
                   humorLevel >= 40 ? 'Professional' :
                   humorLevel >= 20 ? 'Formal' :
                   'Very Formal'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={humorLevel}
                  onChange={(e) => updateHumorLevel(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  aria-label="Humor level"
                />
                <div className="flex space-x-1">
                  <button
                    onClick={() => updateHumorLevel(Math.max(0, humorLevel - 10))}
                    className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
                    disabled={humorLevel <= 0}
                  >
                    -
                  </button>
                  <button
                    onClick={() => updateHumorLevel(Math.min(100, humorLevel + 10))}
                    className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
                    disabled={humorLevel >= 100}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Say "Set humor to [number]" to adjust via voice command
                <br />
                Higher modes: friendly pet names • Lower modes: formal address
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
                  checked={showCaptions}
                  onChange={(e) => {
                    setShowCaptions(e.target.checked);
                    localStorage.setItem('agent-show-captions', e.target.checked.toString());
                  }}
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

      {/* Content Area - Toggle between Orb View and Traditional Message View */}
      {viewMode === 'orb' ? (
        // 3D Orb View
        <div className="flex-1 overflow-hidden relative border-none orb-view-container">
          <AudioVisualizerBlob
            isAgentSpeaking={speechDetection.isAISpeaking}
            agentId={currentAgent.id}
            onVocalize={handleAgentVocalization}
          />
          {showCaptions && (
            <ClosedCaptions
              captions={messages
                .filter(msg => msg.role === 'assistant' || msg.role === 'user')
                .map((message, idx) => ({
                  id: message.id || `msg-${idx}`,
                  text: message.content,
                  speaker: message.role === 'user' ? 'user' : 'agent' as const,
                  agentId: message.agentId || currentAgent.id,
                  timestamp: new Date(message.timestamp).getTime()
                }))}
              maxCaptions={3}
            />
          )}
        </div>
      ) : (
        // Traditional Message List View
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => {
            // Verbose logging - only when debugging
            if (ENABLE_DEBUG_LOGGING) {
              console.log('💬 Rendering message:', { id: message.id, role: message.role, content: message.content?.substring(0, 50) });
            }
            const agentColors = message.role === 'assistant' ? getAgentColor(message.agentId) : null;
            // Check if this message is from the currently active agent
            const isActiveAgent = message.role === 'assistant' && message.agentId &&
              message.agentId.toLowerCase() === currentAgent.id.toLowerCase();

            // Debug logging for colors
            if (message.role === 'assistant') {
              console.log('🎨 Message header color debug:', {
                messageAgentId: message.agentId,
                agentColors,
                isAssistant: message.role === 'assistant'
              });
            }

            return (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : agentColors ? `${agentColors.bg} ${agentColors.text} ${isActiveAgent ? agentColors.outline : agentColors.border}` : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                } ${message.isTranscript && message.role === 'user' ? 'border-l-4 border-yellow-400' : ''}`}
              >
                {message.role === 'assistant' && (
                  <div className={`flex items-center space-x-2 mb-2 pb-2 border-b ${
                    agentColors ? `${agentColors.bg}` : 'bg-gray-100 dark:bg-gray-700'
                  } border-gray-300 dark:border-gray-600 ${isActiveAgent && isAgentTransitioning ? 'agent-badge-switching' : ''} ${isActiveAgent && !isAgentTransitioning && previousAgent !== currentAgent.name ? 'agent-glow-pulse' : ''}`}>
                    {message.agentId === 'tars' ? (
                      <Bot size={16} className={agentColors ? agentColors.text : 'text-gray-600 dark:text-gray-400'} />
                    ) : message.agentId === 'matron' ? (
                      <Plus size={16} className={agentColors ? agentColors.text : 'text-gray-600 dark:text-gray-400'} />
                  ) : message.agentId === 'jekyll' ? (
                    <MessageSquare size={16} className={agentColors ? agentColors.text : 'text-gray-600 dark:text-gray-400'} />
                  ) : (
                    <Bot size={16} className={agentColors ? agentColors.text : 'text-gray-600 dark:text-gray-400'} />
                  )}
                  <span className={`text-xs font-semibold ${agentColors ? agentColors.text : 'text-gray-600 dark:text-gray-400'}`}>
                    {message.agentId ?
                      message.agentId === 'tars' ? 'Tars' :
                      message.agentId === 'matron' ? 'Matron' :
                      message.agentId === 'jekyll' ? 'Jekyll' :
                      currentAgent.name
                      : currentAgent.name
                    }
                  </span>
                </div>
              )}
              {message.role === 'user' && (
                <div className="flex items-center space-x-2 mb-2 pb-2 border-b border-primary-400">
                  <Users size={16} className="text-primary-100" />
                  <span className="text-xs font-semibold text-primary-100">You</span>
                </div>
              )}
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
          );
        })}

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
      )}

      {/* Voice-Only Input Area - Hidden in Orb Mode */}
      {viewMode === 'traditional' && (
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

        {/* Live Captions Section */}
        {showCaptions && sessionStatus.isActive && currentAITranscript && (
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
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
                  {showCaptions && (
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
      )}

      {/* Settings Modal */}
      <SpeechSettings
        config={azureSettings}
        onConfigUpdate={(updates) => {
          setAzureSettings(prev => ({ ...prev, ...updates }));
        }}
        humorLevel={humorLevel}
        onHumorLevelUpdate={updateHumorLevel}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default RealtimeAgentExperience;
