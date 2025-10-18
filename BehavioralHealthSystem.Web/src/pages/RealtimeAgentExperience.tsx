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
  CheckCircle,
  Bot,
  ClipboardList,
  FileText,
  Plus
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
import phqAssessmentService from '@/services/phqAssessmentService';
import chatTranscriptService from '@/services/chatTranscriptService';
import { phqSessionService } from '@/services/phqSessionService';
// phqProgressService no longer needed - phqAssessmentService handles all PHQ tracking with single assessment ID
import { useAuth } from '@/contexts/AuthContext';
import { agentOrchestrationService } from '@/services/agentOrchestrationService';
import { phq2Agent } from '@/agents/phq2Agent';
import { phq9Agent } from '@/agents/phq9Agent';
import { matronAgent } from '@/agents/matronAgent';
import { vocalistAgent } from '@/agents/vocalistAgent';
import { VocalistRecorder } from '@/components/VocalistRecorder';

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
 * @param agentId - The agent identifier (tars, matron, phq2, phq9)
 * @returns Tailwind CSS classes for background and text colors
 */
const getAgentColor = (agentId?: string): { bg: string; text: string; border: string; outline: string } => {
  // Normalize agent ID to lowercase for comparison
  const normalizedId = agentId?.toLowerCase().replace('agent_', '');
  console.log('🎨 getAgentColor called:', { agentId, normalizedId });

  switch (normalizedId) {
    case 'tars':
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-gray-900 dark:text-gray-100',
        border: 'border-l-4 border-blue-500',
        outline: 'border-2 border-blue-500 dark:border-blue-400'
      };
    case 'matron':
      return {
        bg: 'bg-green-50 dark:bg-green-900/20',
        text: 'text-gray-900 dark:text-gray-100',
        border: 'border-l-4 border-green-500',
        outline: 'border-2 border-green-500 dark:border-green-400'
      };
    case 'phq2':
      return {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        text: 'text-gray-900 dark:text-gray-100',
        border: 'border-l-4 border-purple-500',
        outline: 'border-2 border-purple-500 dark:border-purple-400'
      };
    case 'phq9':
      return {
        bg: 'bg-indigo-50 dark:bg-indigo-900/20',
        text: 'text-gray-900 dark:text-gray-100',
        border: 'border-l-4 border-indigo-600',
        outline: 'border-2 border-indigo-600 dark:border-indigo-400'
      };
    case 'vocalist':
      return {
        bg: 'bg-pink-50 dark:bg-pink-900/20',
        text: 'text-gray-900 dark:text-gray-100',
        border: 'border-l-4 border-pink-500',
        outline: 'border-2 border-pink-500 dark:border-pink-400'
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

  // Agent State - Simplified for single GPT-Realtime agent
  const [currentAgent, setCurrentAgent] = useState<AgentStatus>({
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
  const [showLiveTranscripts, setShowLiveTranscripts] = useState(false);
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
        const closeSessionCommand = message.content.match(/(?:close|end|stop|terminate|exit|quit|finish) (?:session|conversation|chat|call|meeting)?/i);
        const pauseSessionCommand = message.content.match(/(?:pause|hold|suspend) (?:session|conversation|chat|call|meeting)?/i);
        const resumeSessionCommand = message.content.match(/(?:resume|continue|start|unpause|restart) (?:session|conversation|chat|call|meeting)?/i);
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
      setMessages(prev => [...prev, message]);
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
          // Clear when transcript is complete
          setTimeout(() => setCurrentAITranscript(''), 2000);
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

      agentOrchestrationService.registerAgent(matronAgent);

      // Conditionally register PHQ-2 agent based on feature flag
      if (import.meta.env.VITE_ENABLE_PHQ2_AGENT === 'true') {
        console.log('✅ PHQ-2 agent enabled');
        agentOrchestrationService.registerAgent(phq2Agent);
      } else {
        console.log('❌ PHQ-2 agent disabled');
      }

      // Conditionally register PHQ-9 agent based on feature flag
      if (import.meta.env.VITE_ENABLE_PHQ9_AGENT === 'true') {
        console.log('✅ PHQ-9 agent enabled');
        agentOrchestrationService.registerAgent(phq9Agent);
      } else {
        console.log('❌ PHQ-9 agent disabled');
      }

      agentOrchestrationService.registerAgent(vocalistAgent);

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
   - Reference their hobbies, or interests, or location naturally in conversation briefly
   - Example: "I see you enjoy [hobby] and are from [lastResidence]."
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
     * After get-biometric-data returns, greet them warmly with their newly set nickname and ask how they're feeling
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
2. Explain what will happen: "I'm going to connect you with our specialized [PHQ-2/PHQ-9] assessment agent"
3. Call the appropriate agent (Agent_PHQ2 or Agent_PHQ9)
4. The specialized agent will take over and conduct the assessment
5. When they complete, you'll receive control back

Available specialized agents:
- "Agent_Matron": Biometric data and personalization intake - use when user has NO biometric data (check first!)
- "Agent_PHQ2": Quick depression screening (2 questions) - use when user wants quick check or "PHQ-2"
- "Agent_PHQ9": Comprehensive depression assessment (9 questions) - use when user wants full assessment or "PHQ-9"
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
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
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
              {currentAgent.id === 'tars' ? (
                <Bot
                  className={`text-white transition-transform duration-300 ${
                    currentAgent.isTyping ? 'animate-pulse scale-110' : ''
                  }`}
                  size={24}
                />
              ) : currentAgent.id === 'matron' ? (
                <span className={`text-white text-2xl transition-transform duration-300 ${
                  currentAgent.isTyping ? 'animate-pulse scale-110' : ''
                }`}>
                  ➕
                </span>
              ) : currentAgent.id === 'phq2' ? (
                <ClipboardList
                  className={`text-white transition-transform duration-300 ${
                    currentAgent.isTyping ? 'animate-pulse scale-110' : ''
                  }`}
                  size={24}
                />
              ) : currentAgent.id === 'phq9' ? (
                <FileText
                  className={`text-white transition-transform duration-300 ${
                    currentAgent.isTyping ? 'animate-pulse scale-110' : ''
                  }`}
                  size={24}
                />
              ) : (
                <Bot
                  className={`text-white transition-transform duration-300 ${
                    currentAgent.isTyping ? 'animate-pulse scale-110' : ''
                  }`}
                  size={24}
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
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Tars</h3>
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

      {/* Messages */}
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
          if (message.role === 'assistant' && agentColors) {
            console.log('🎨 Agent color debug:', {
              messageAgentId: message.agentId,
              currentAgentId: currentAgent.id,
              isActiveAgent,
              colors: agentColors,
              appliedBorder: isActiveAgent ? agentColors.outline : agentColors.border
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
                <div className="flex items-center space-x-2 mb-2 pb-2 border-b border-gray-300 dark:border-gray-600">
                  {message.agentId === 'tars' ? (
                    <Bot size={16} className="text-gray-600 dark:text-gray-400" />
                  ) : message.agentId === 'matron' ? (
                    <Plus size={16} className="text-gray-600 dark:text-gray-400" />
                  ) : message.agentId === 'phq2' ? (
                    <ClipboardList size={16} className="text-gray-600 dark:text-gray-400" />
                  ) : message.agentId === 'phq9' ? (
                    <FileText size={16} className="text-gray-600 dark:text-gray-400" />
                  ) : message.agentId === 'vocalist' ? (
                    <Mic size={16} className="text-gray-600 dark:text-gray-400" />
                  ) : (
                    <Bot size={16} className="text-gray-600 dark:text-gray-400" />
                  )}
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                    {message.agentId ?
                      message.agentId === 'tars' ? 'Tars' :
                      message.agentId === 'matron' ? 'Matron' :
                      message.agentId === 'phq2' ? 'PHQ-2' :
                      message.agentId === 'phq9' ? 'PHQ-9' :
                      message.agentId === 'vocalist' ? 'Vocalist' :
                      currentAgent.name
                      : currentAgent.name
                    }
                  </span>
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

        {/* Live Captions Section */}
        {showLiveTranscripts && sessionStatus.isActive && currentAITranscript && (
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
        humorLevel={humorLevel}
        onHumorLevelUpdate={updateHumorLevel}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default RealtimeAgentExperience;
