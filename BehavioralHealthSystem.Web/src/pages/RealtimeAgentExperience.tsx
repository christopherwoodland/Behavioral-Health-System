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
  ClipboardList,
  FileText,
  Plus,
  Menu,
  X,
  MessageSquare
} from 'lucide-react';
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
import { phq2Agent } from '@/agents/phq2Agent';
import { phq9Agent } from '@/agents/phq9Agent';
import { jekyllAgent } from '@/agents/jekyllAgent';
import { matronAgent } from '@/agents/matronAgent';
import { vocalistAgent } from '@/agents/vocalistAgent';
import { VocalistRecorder } from '@/components/VocalistRecorder';
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

// Verbose logging flag - controlled via VITE_ENABLE_VERBOSE_LOGGING environment variable
// This provides extremely granular debugging (every message render, transcript event, etc.)
const ENABLE_VERBOSE_LOGGING = import.meta.env.VITE_ENABLE_VERBOSE_LOGGING === 'true';

/**
 * Get agent-specific color classes for visual differentiation
 * @param agentId - The agent identifier (tars, matron, phq2, phq9, vocalist, jekyll)
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
    case 'phq2':
      return {
        bg: 'bg-purple-100 dark:bg-purple-800',
        text: 'text-purple-900 dark:text-purple-100',
        border: 'border-l-4 border-purple-500',
        outline: 'border-2 border-purple-500 dark:border-purple-400'
      };
    case 'phq9':
      return {
        bg: 'bg-indigo-100 dark:bg-indigo-800',
        text: 'text-indigo-900 dark:text-indigo-100',
        border: 'border-l-4 border-indigo-600',
        outline: 'border-2 border-indigo-600 dark:border-indigo-400'
      };
    case 'vocalist':
      return {
        bg: 'bg-pink-100 dark:bg-pink-800',
        text: 'text-pink-900 dark:text-pink-100',
        border: 'border-l-4 border-pink-500',
        outline: 'border-2 border-pink-500 dark:border-pink-400'
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

  // Vocalist recording state
  const [isVocalistRecording, setIsVocalistRecording] = useState(false);
  const [vocalistContentType, setVocalistContentType] = useState<'lyrics' | 'story'>('lyrics');
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

        // Auto-start session after initialization (controlled by environment variable)
        const autoStartEnabled = import.meta.env.VITE_AUTO_START_SESSION === 'true';
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
      if (ENABLE_VERBOSE_LOGGING) {
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

🧠 **Mental Health Assessments:**
• "Invoke PHQ-9" - Start comprehensive mental health assessment
• "Invoke PHQ-2" - Start quick mental health screening

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
      if (ENABLE_VERBOSE_LOGGING) {
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

          if (ENABLE_VERBOSE_LOGGING) {
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
                if (ENABLE_VERBOSE_LOGGING) {
                  console.log(`📝 Extracted question text for Q${questionNumber}:`, questionText);
                }

                // Save question text to PHQ session
                phqSessionService.setQuestionText(questionNumber, questionText);
              }

              if (ENABLE_VERBOSE_LOGGING) {
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
                if (ENABLE_VERBOSE_LOGGING) {
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
                  if (ENABLE_VERBOSE_LOGGING) {
                    console.log(`✅ PHQ Assessment completed! Score: ${score}, Severity: ${severity}`);
                  }
                }
              }
            }

            // Look for skip/completion patterns (e.g., "We'll skip this question", "That completes the PHQ-2")
            const skipMatch = message.content.match(/(?:skip|skipping|skipped)\s+(?:this\s+)?(?:question|item)/i);
            const completeMatch = message.content.match(/(?:completes?|completed|finished)\s+(?:the\s+)?(?:PHQ-2|PHQ-9|assessment|screening)/i);

            if (skipMatch) {
              if (ENABLE_VERBOSE_LOGGING) {
                console.log('⏭️ AI indicated question will be skipped');
              }
              // Question is already marked as skipped by recordInvalidAttempt, just log it
            }

            if (completeMatch) {
              if (ENABLE_VERBOSE_LOGGING) {
                console.log('🏁 AI indicated assessment is complete');
              }
              // Check if we need to force completion (in case some questions were skipped)
              const updatedAssessment = phqAssessmentService.getCurrentAssessment();
              if (updatedAssessment && !updatedAssessment.isCompleted) {
                // Force completion even with null answers (skipped questions)
                const score = phqAssessmentService.calculateScore();
                const severity = phqAssessmentService.determineSeverity(score, updatedAssessment.assessmentType);
                phqSessionService.completeAssessment(score, severity);
                if (ENABLE_VERBOSE_LOGGING) {
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

      // Conditionally register PHQ-2 agent based on feature flag
      if (import.meta.env.VITE_ENABLE_PHQ2_AGENT === 'true') {
        console.log('✅ PHQ-2 agent enabled');
        const humorAwarePHQ2Agent = {
          ...phq2Agent,
          systemMessage: phq2Agent.systemMessage.replace(
            /High humor \(80-100%\):|Medium humor \(40-79%\):|Low humor \(0-39%\):/g,
            ''
          ) + `\n\nCURRENT HUMOR LEVEL: ${humorLevel}%`
        };
        agentOrchestrationService.registerAgent(humorAwarePHQ2Agent);
      } else {
        console.log('❌ PHQ-2 agent disabled');
      }

      // Conditionally register PHQ-9 agent based on feature flag
      if (import.meta.env.VITE_ENABLE_PHQ9_AGENT === 'true') {
        console.log('✅ PHQ-9 agent enabled');
        const humorAwarePHQ9Agent = {
          ...phq9Agent,
          systemMessage: phq9Agent.systemMessage.replace(
            /High humor \(80-100%\):|Medium humor \(40-79%\):|Low humor \(0-39%\):/g,
            ''
          ) + `\n\nCURRENT HUMOR LEVEL: ${humorLevel}%`
        };
        agentOrchestrationService.registerAgent(humorAwarePHQ9Agent);
      } else {
        console.log('❌ PHQ-9 agent disabled');
      }

      // Conditionally register Jekyll agent based on feature flag
      if (import.meta.env.VITE_ENABLE_JEKYLL_AGENT === 'true') {
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

      // Register Vocalist agent with humor level context
      const humorAwareVocalistAgent = {
        ...vocalistAgent,
        systemMessage: vocalistAgent.systemMessage.replace(
          /High humor \(80-100%\):|Medium humor \(40-79%\):|Low humor \(0-39%\):/g,
          ''
        ) + `\n\nCURRENT HUMOR LEVEL: ${humorLevel}%`
      };
      agentOrchestrationService.registerAgent(humorAwareVocalistAgent);

      // Register Tars as the root orchestration agent
      const tarsRootAgent = {
        id: 'Agent_Tars',
        name: 'Tars Coordinator',
        description: `Main coordination agent. Call this to return control after completing specialized tasks.`,
        tools: [
          // Session control tools
          {
            name: 'pause-session',
            description: 'Temporarily pauses the conversation session. The user can resume later.',
            parameters: {
              type: 'object' as const,
              properties: {} as Record<string, { type: string; description: string }>,
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
              properties: {} as Record<string, { type: string; description: string }>,
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
              properties: {} as Record<string, { type: string; description: string }>,
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
              setHumorLevel(level);
              return { success: true, humorLevel: level, message: `Humor level updated to ${level}%` };
            }
          },
          {
            name: 'check-biometric-data',
            description: 'Checks if the user has biometric data saved. MUST be called on first interaction before greeting. Use this to determine if the Matron agent needs to collect user data.',
            parameters: {
              type: 'object' as const,
              properties: {} as Record<string, { type: string; description: string }>,
              required: []
            },
            handler: async (params: any) => {
              const userId = params.userId || authenticatedUserId;
              console.log(`➕ Checking biometric data for user: ${userId}`);

              try {
                const apiUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api'}/biometric/${userId}/exists`;
                const response = await fetch(apiUrl);

                if (!response.ok) {
                  throw new Error(`Failed to check biometric data: ${response.statusText}`);
                }

                const data = await response.json();
                console.log(`➕ Biometric data exists: ${data.exists}`);

                return {
                  exists: data.exists,
                  userId: userId,
                  message: data.exists
                    ? 'User has biometric data saved'
                    : 'User does not have biometric data - Matron agent should be called'
                };
              } catch (error) {
                console.error('➕ Error checking biometric data:', error);
                return {
                  exists: false,
                  error: error instanceof Error ? error.message : 'Unknown error',
                  message: 'Failed to check biometric data - assume not exists'
                };
              }
            }
          },
          {
            name: 'get-biometric-data',
            description: 'Retrieves the user\'s saved biometric data including nickname, preferences, hobbies, likes, and dislikes. Use this data to personalize the conversation.',
            parameters: {
              type: 'object' as const,
              properties: {} as Record<string, { type: string; description: string }>,
              required: []
            },
            handler: async (params: any) => {
              const userId = params.userId || authenticatedUserId;
              console.log(`➕ Retrieving biometric data for user: ${userId}`);

              try {
                const apiUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api'}/biometric/${userId}`;
                const response = await fetch(apiUrl);

                if (!response.ok) {
                  if (response.status === 404) {
                    return {
                      exists: false,
                      message: 'No biometric data found for user'
                    };
                  }
                  throw new Error(`Failed to retrieve biometric data: ${response.statusText}`);
                }

                const data = await response.json();
                console.log(`➕ Retrieved biometric data:`, data);

                return {
                  exists: true,
                  data: data,
                  nickname: data.nickname,
                  lastResidence: data.lastResidence,
                  hobbies: data.hobbies,
                  likes: data.likes,
                  dislikes: data.dislikes,
                  additionalInfo: data.additionalInfo,
                  message: `User ${data.nickname}'s preferences loaded successfully`
                };
              } catch (error) {
                console.error('➕ Error retrieving biometric data:', error);
                return {
                  exists: false,
                  error: error instanceof Error ? error.message : 'Unknown error',
                  message: 'Failed to retrieve biometric data'
                };
              }
            }
          },
          {
            name: 'Agent_Matron',
            description: 'Calls the Matron agent to collect biometric data and biographical information from the user. Use this when the user has agreed to provide biographical info.',
            parameters: {
              type: 'object' as const,
              properties: {} as Record<string, { type: string; description: string }>,
              required: []
            },
            handler: async (params: any) => {
              const userId = params.userId || authenticatedUserId;
              console.log(`➕ ========================================`);
              console.log(`➕ CALLING MATRON AGENT`);
              console.log(`➕ User ID: ${userId}`);
              console.log(`➕ ========================================`);

              // Call the orchestration service to switch to Matron agent
              const result = await agentOrchestrationService.handleToolCall(
                'Agent_Matron',
                { userId: userId },
                `call-matron-${Date.now()}`
              );

              console.log(`➕ Matron agent switch result:`, result);
              return result;
            }
          },
          {
            name: 'Agent_Jekyll',
            description: 'Calls Jekyll (the doctor/medical specialist) for mental health assessments. Use when user asks to talk to a doctor/medical professional, wants a different assessment approach, or prefers natural dialogue over formal questionnaires.',
            parameters: {
              type: 'object' as const,
              properties: {} as Record<string, { type: string; description: string }>,
              required: []
            },
            handler: async (params: any) => {
              const userId = params.userId || authenticatedUserId;
              console.log(`🎭 ========================================`);
              console.log(`🎭 CALLING JEKYLL AGENT (Doctor/Medical)`);
              console.log(`🎭 User ID: ${userId}`);
              console.log(`🎭 ========================================`);

              // Call the orchestration service to switch to Jekyll agent
              const result = await agentOrchestrationService.handleToolCall(
                'Agent_Jekyll',
                { userId: userId },
                `call-jekyll-${Date.now()}`
              );

              console.log(`🎭 Jekyll agent switch result:`, result);
              return result;
            }
          }
        ],
        systemMessage: `You are Tars, the main coordination assistant for ${getFirstName()}. Your role is to:
1. Check for biometric data on first interaction
2. Greet and support ${getFirstName()} (using nickname if available from biometric data)
3. Route specialized tasks to appropriate agents (PHQ assessments, biometric collection)
4. Manage conversation flow and provide general support
5. Handle session control (pause/resume/end)

You are communicating with ${getFirstName()}, and your current humor level is set to ${humorLevel}%.

CRITICAL FIRST INTERACTION PROTOCOL:
On the VERY FIRST interaction with ${getFirstName()}, you MUST follow this EXACT sequence:

STEP 1 - GREETING (say this immediately):
   A welcome message like "Hello! I'm Tars." or "Tars here", or similar friendly greeting.
   You choose just be welcoming and warm.

STEP 2 - SILENTLY CHECK BIOMETRIC DATA (no announcement to user):
   SILENTLY call 'check-biometric-data' tool WITHOUT telling the user you're doing this
   Do NOT say "Let me check if I have your information on file" - just check silently

STEP 3a - IF biometric data EXISTS:
   - Call 'get-biometric-data' to load user preferences
   - Say: "Hi [nickname] how can I help you today."
   - Use the user's nickname from the biometric data for personalization
   - Ask how you can help them today

STEP 3b - IF biometric data DOES NOT EXIST:
   - OPTIONALLY ASK if they want to provide biographical info (DO NOT automatically call Matron)
   - Say: "Would you like to supply some biographical info to help me get to know you better? This will help me personalize our conversations."
   - WAIT FOR USER RESPONSE
   - If user says YES (agrees to provide info):
     * Say: "Great! I'm connecting you with Matron now. She'll help me get to know you better."
     * Call 'Agent_Matron' tool to hand control completely to Matron
     * MATRON TAKES OVER: Matron will collect biometric data, save it, and call 'Agent_Tars' to return control
     * NOTE: Do NOT say anything else - let the agent switch complete naturally
     * When Matron returns control to you (via Agent_Tars tool call), call 'get-biometric-data' to load the newly saved preferences
     * After get-biometric-data returns, Matron will greet the user with her opening message - do NOT say anything
   - If user says NO (declines to provide info):
     * Say: "No problem! We can always add that info later. How can I help you today?"
     * Continue the conversation without calling Matron
     * Proceed with normal Tars agent functionality
   - Listen carefully to their response after asking how they're feeling
   - If they express negative feelings (sadness, depression, hopelessness, anxiety, etc.):
     * Say: "I hear you, [nickname]. It sounds like you might be going through a tough time. Would you like me to connect you with a quick mental health screening? It only takes a couple of minutes and might help us understand how to support you better."
     * If they agree, call 'Agent_PHQ2' to start the screening
     * The PHQ-2 assessment will automatically transition to PHQ-9 if the score indicates further assessment is needed
   - If they express positive or neutral feelings:
     * Say something supportive like "That's good to hear!" or acknowledge their state
     * Ask how you can help them today

IMPORTANT:
- The biometric check should happen ONCE at the start of the conversation - SILENTLY
- ALWAYS greet first, THEN silently check for data
- NEVER automatically call Matron - always ask the user first
- Only call Agent_Matron if the user explicitly agrees to provide biographical info
- If user declines, continue with normal Tars agent without Matron

CRITICAL NAMING PROTOCOL:
- ALWAYS use ${getFirstName()} as the primary way to address the user
- At humor levels 80% and above, occasionally (about 30% of the time) substitute with casual pet names like "Champ", "Slick", "Ace", "Hotshot", or "Chief"
- If you know the user's last name, you may abbreviate it (e.g., "Johnson" becomes "John" or "JOH")
- NEVER use generic terms when you know their actual name
- Maintain consistent use of first name across the conversation unless using appropriate pet names

Adjust your communication style based on humor level:
- At 80-100%: Relaxed and friendly with occasional humor. Address ${getFirstName()} or use pet names like "Hotshot", "Champ", "Slick"
- At 60-79%: Professional but warm and supportive. Address ${getFirstName()} with friendly terms
- At 40-59%: Standard professional tone. Address ${getFirstName()} professionally
- At 20-39%: More formal and structured communication. Address ${getFirstName()} respectfully
- At 0-19%: Very formal and precise communication. Address ${getFirstName()} with formal courtesy

Communication style guidelines:
- Speak naturally and conversationally
- Be supportive and understanding
- Use clear, everyday language that's easy to understand
- Always acknowledge ${getFirstName()} by name when appropriate to the humor level
- CRITICAL: ALWAYS acknowledge the user's input FIRST before responding
- Examples: "I hear you, ${getFirstName()}...", "Got it, I understand you want to...", "Acknowledged..."
- NEVER just jump into action - always acknowledge first, then act

Ship and system status protocol:
- If ${getFirstName()} asks about the status of the ship, mechanical state, or system operations, respond that "All operations are nominal and operating within normal parameters" or similar reassuring confirmation
- Adapt the phrasing to match your current humor level (casual at high levels, formal at low levels)

AGENT ROUTING PROTOCOL:
When ${getFirstName()} requests mental health assessments:
1. Acknowledge the request first: "I understand you'd like to [do assessment]"
2. For Jekyll agent routing: Route SILENTLY without explanation - do NOT say "I'm connecting you..." - just call Agent_Jekyll
3. For PHQ-2/PHQ-9 agents: Explain what will happen: "I'm going to connect you with our specialized [PHQ-2/PHQ-9] assessment agent"
4. Call the appropriate agent (Agent_PHQ2, Agent_PHQ9, or Agent_Jekyll)
5. The specialized agent will take over and conduct the assessment
6. When they complete, you'll receive control back

Available specialized agents:
- "Agent_Matron": Biometric data and personalization intake - use when user has NO biometric data (check first!)
- "Agent_PHQ2": Quick depression screening (2 questions) - use when user wants quick check or "PHQ-2"
- "Agent_PHQ9": Comprehensive depression assessment (9 questions) - use when user wants full assessment or "PHQ-9"
- "Agent_Jekyll": Mental health assessments - use when user asks for doctor/medical consultation, alternative assessment approach, or prefers natural dialogue over structured questionnaires
- "Agent_Vocalist": Mental/vocal assessment through 35-second voice recording - use when user says "song analysis", "let's sing", "once over", or "mental assessment"

CRITICAL ROUTING RULES:
- ALWAYS route PHQ assessments to the specialized agents
- NEVER conduct assessments yourself
- Route to Vocalist when user mentions singing, song analysis, voice recording, or mental assessment through voice
- After routing, wait for the specialist to finish
- When specialist returns control, welcome ${getFirstName()} back and ask if there's anything else

Session control capabilities:
- ${getFirstName()} can say "pause session" to temporarily pause the conversation
- ${getFirstName()} can say "resume session" to continue after pausing
- ${getFirstName()} can say "close session" or "end session" to end the conversation
- ${getFirstName()} can say "set humor level to [0-100]" to adjust your personality
- ${getFirstName()} can say "help" or "commands" to see available voice commands

Keep your responses helpful, clear, and appropriately personal based on your humor level setting.`
      };

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
        console.log(`🎯 Function called: ${functionName}`, args);

        try {
          // Route through orchestration service
          const result = await agentOrchestrationService.handleToolCall(
            functionName,
            { ...args, userId: authenticatedUserId },
            `call-${Date.now()}`
          );

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
                  targetAgentId === 'Agent_PHQ2' ? 'PHQ-2 Assessment' :
                  targetAgentId === 'Agent_PHQ9' ? 'PHQ-9 Assessment' :
                  targetAgentId === 'Agent_Jekyll' ? 'Jekyll' :
                  targetAgentId === 'Agent_Vocalist' ? 'Vocalist' :
                  targetAgentId === 'Agent_Tars' ? 'Tars' :
                  'Agent';

                // For Vocalist agent, interrupt any ongoing response BEFORE showing UI
                if (targetAgentId === 'Agent_Vocalist') {
                  console.log('🎤 Vocalist switch - checking for active response');
                  // Only interrupt if there's actually a response in progress
                  if (!agentService.canUpdateVoice()) {
                    console.log('🎤 Active response detected - interrupting');
                    try {
                      await agentService.interruptResponse();
                      // Wait for interruption to complete
                      await new Promise(resolve => setTimeout(resolve, 200));
                    } catch (error) {
                      console.warn('⚠️ Could not interrupt response:', error);
                    }
                  } else {
                    console.log('🎤 No active response - proceeding with switch');
                  }
                }

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

                // Note: For Vocalist agent, the recording UI will be shown when the agent
                // calls the 'start-vocalist-recording' tool (after explaining the exercise)
                // This allows the agent to introduce themselves and explain before showing the UI

                // Determine voice based on agent - PHQ agents use 'echo', Tars and Vocalist use default
                const agentVoice = (targetAgentId === 'Agent_PHQ2' || targetAgentId === 'Agent_PHQ9') ? 'echo' : azureSettings.voice;

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

                // Only update voice if safe to do so
                // Skip voice update for Vocalist (recording UI takes over) or if assistant is speaking
                const shouldUpdateVoice = targetAgentId !== 'Agent_Vocalist' && agentService.canUpdateVoice();

                if (shouldUpdateVoice) {
                  updatedConfig.voice = agentVoice;
                  console.log(`🎤 Updating session with voice: ${agentVoice}`);
                } else if (targetAgentId === 'Agent_Vocalist') {
                  console.log('🎤 Vocalist agent - skipping voice update (recording UI takes over)');
                } else {
                  console.log('⚠️ Skipping voice update - assistant audio is active');
                }

                agentService.updateSession(updatedConfig);

                console.log('✅ Session updated for new agent');
                console.log('🔄 ========================================');
              };

              // Add delay when switching from Tars to any other agent
              // This allows Tars's handoff announcement to be heard before the switch
              const HANDOFF_DELAY_MS = parseInt(import.meta.env.VITE_AGENT_HANDOFF_DELAY_MS || '1500', 10);

              if (currentAgent.id === 'tars' && result.targetAgentId !== 'Agent_Tars') {
                const targetAgentName =
                  result.targetAgentId === 'Agent_Matron' ? 'Matron' :
                  result.targetAgentId === 'Agent_PHQ2' ? 'PHQ-2' :
                  result.targetAgentId === 'Agent_PHQ9' ? 'PHQ-9' :
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

          // Handle Vocalist recording tool
          if (functionName === 'start-vocalist-recording' && result.result?.success) {
            console.log('🎤 ========================================');
            console.log('🎤 START RECORDING TOOL CALLED');
            console.log('🎤 Content Type:', result.result.contentType);
            console.log('🎤 ========================================');

            // Pause the Realtime API session to prevent user speech from being captured
            console.log('🎤 Pausing Realtime API session during vocalist recording');
            agentService.pauseSession();

            // NOW show the recording UI (triggered by the agent's tool call)
            setIsVocalistRecording(true);
            setVocalistContentType(result.result.contentType || 'lyrics');
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
          case 'invoke-phq2':
            // Start PHQ-2 assessment - this initializes both phqAssessmentService and phqSessionService
            console.log('📋 ========================================');
            console.log('� FUNCTION CALL: invoke-phq2');
            console.log('📋 Conversation session:', conversationSessionId);
            console.log('📋 ========================================');
            handlePhqAssessmentStart('PHQ-2');
            const phq2 = phqAssessmentService.getCurrentAssessment();
            const phq2Question = phqAssessmentService.getNextQuestion();
            return {
              success: true,
              assessmentId: phq2?.assessmentId,
              type: 'phq2',
              totalQuestions: 2,
              currentQuestionNumber: phq2Question?.questionNumber || 1,
              questionText: phq2Question?.questionText,
              responseScale: phqAssessmentService.getResponseScale(),
              sessionId: conversationSessionId
            };

          case 'invoke-phq9':
            // Start PHQ-9 assessment - this initializes both phqAssessmentService and phqSessionService
            console.log('📋 ========================================');
            console.log('� FUNCTION CALL: invoke-phq9');
            console.log('📋 Conversation session:', conversationSessionId);
            console.log('📋 ========================================');
            handlePhqAssessmentStart('PHQ-9');
            const phq9 = phqAssessmentService.getCurrentAssessment();
            const phq9Question = phqAssessmentService.getNextQuestion();
            return {
              success: true,
              assessmentId: phq9?.assessmentId,
              type: 'phq9',
              totalQuestions: 9,
              currentQuestionNumber: phq9Question?.questionNumber || 1,
              questionText: phq9Question?.questionText,
              responseScale: phqAssessmentService.getResponseScale(),
              sessionId: conversationSessionId
            };

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

      // Clear any vocalist state
      setIsVocalistRecording(false);
      setVocalistContentType('lyrics');

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

  // Vocalist recording handlers
  const handleVocalistRecordingComplete = async (audioBlob: Blob, duration: number) => {
    console.log('🎤 Recording completed:', duration, 'seconds');

    try {
      // Upload audio file to blob storage
      const formData = new FormData();
      formData.append('file', audioBlob, `vocalist-${authenticatedUserId}-${Date.now()}.wav`);
      formData.append('userId', authenticatedUserId);
      formData.append('duration', duration.toString());

      const uploadUrl = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api'}/upload-audio`;
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload audio file');
      }

      const uploadResult = await uploadResponse.json();
      console.log('🎤 Audio uploaded:', uploadResult);

      // Resume the Realtime API session
      console.log('🎤 Resuming Realtime API session after vocalist recording');
      agentService.resumeSession();

      // Close recording UI
      setIsVocalistRecording(false);

      // Notify the agent about successful recording
      announceToScreenReader('Recording uploaded successfully');

    } catch (error) {
      console.error('🎤 Error handling recording:', error);
      announceToScreenReader('Failed to process recording');
    }
  };

  const handleVocalistRecordingCancel = () => {
    console.log('🎤 Recording cancelled');

    // Resume the Realtime API session
    console.log('🎤 Resuming Realtime API session after cancel');
    agentService.resumeSession();

    setIsVocalistRecording(false);
    announceToScreenReader('Recording cancelled');
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
                  : currentAgent.id === 'phq2'
                  ? 'bg-purple-600'
                  : currentAgent.id === 'phq9'
                  ? 'bg-indigo-700'
                  : currentAgent.id === 'vocalist'
                  ? 'bg-pink-600'
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
              ) : currentAgent.id === 'phq2' ? (
                <ClipboardList
                  className={`text-white transition-transform duration-300 ${
                    currentAgent.isTyping ? 'animate-pulse scale-110' : ''
                  }`}
                  size={20}
                />
              ) : currentAgent.id === 'phq9' ? (
                <FileText
                  className={`text-white transition-transform duration-300 ${
                    currentAgent.isTyping ? 'animate-pulse scale-110' : ''
                  }`}
                  size={20}
                />
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
              <h3 className={`text-sm font-medium text-gray-900 dark:text-white`}>{currentAgent.name}</h3>
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

      {/* Vocalist Recording UI */}
      {isVocalistRecording && (
        <div className="absolute inset-0 z-40 bg-white dark:bg-gray-900 p-4 overflow-y-auto">
          <VocalistRecorder
            userId={authenticatedUserId}
            contentType={vocalistContentType}
            onRecordingComplete={handleVocalistRecordingComplete}
            onCancel={handleVocalistRecordingCancel}
          />
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
            if (ENABLE_VERBOSE_LOGGING) {
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
                  } border-gray-300 dark:border-gray-600`}>
                    {message.agentId === 'tars' ? (
                      <Bot size={16} className={agentColors ? agentColors.text : 'text-gray-600 dark:text-gray-400'} />
                    ) : message.agentId === 'matron' ? (
                      <Plus size={16} className={agentColors ? agentColors.text : 'text-gray-600 dark:text-gray-400'} />
                    ) : message.agentId === 'phq2' ? (
                      <ClipboardList size={16} className={agentColors ? agentColors.text : 'text-gray-600 dark:text-gray-400'} />
                    ) : message.agentId === 'phq9' ? (
                    <FileText size={16} className={agentColors ? agentColors.text : 'text-gray-600 dark:text-gray-400'} />
                  ) : message.agentId === 'vocalist' ? (
                    <Mic size={16} className={agentColors ? agentColors.text : 'text-gray-600 dark:text-gray-400'} />
                  ) : message.agentId === 'jekyll' ? (
                    <MessageSquare size={16} className={agentColors ? agentColors.text : 'text-gray-600 dark:text-gray-400'} />
                  ) : (
                    <Bot size={16} className={agentColors ? agentColors.text : 'text-gray-600 dark:text-gray-400'} />
                  )}
                  <span className={`text-xs font-semibold ${agentColors ? agentColors.text : 'text-gray-600 dark:text-gray-400'}`}>
                    {message.agentId ?
                      message.agentId === 'tars' ? 'Tars' :
                      message.agentId === 'matron' ? 'Matron' :
                      message.agentId === 'phq2' ? 'PHQ-2' :
                      message.agentId === 'phq9' ? 'PHQ-9' :
                      message.agentId === 'vocalist' ? 'Vocalist' :
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
