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
import phqProgressService from '@/services/phqProgressService';
import { useAuth } from '@/contexts/AuthContext';

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

  // PHQ Assessment Handlers
  const handlePhqAssessmentStart = useCallback((type: 'PHQ-2' | 'PHQ-9') => {
    const assessment = phqAssessmentService.startAssessment(type, authenticatedUserId);
    
    // Initialize PHQ progress tracking
    if (authenticatedUserId) {
      phqProgressService.startAssessment(authenticatedUserId, type, assessment.assessmentId);
    }
    
    const nextQuestion = phqAssessmentService.getNextQuestion();
    if (nextQuestion) {
      const responseMessage: ConversationMessage = {
        id: `phq-start-${Date.now()}`,
        role: 'assistant',
        content: `Starting ${type} assessment. This is a screening tool, not a diagnosis.

${type === 'PHQ-2' ? 'This quick 2-question screen' : 'This 9-question assessment'} asks about your experiences over the past 2 weeks.

Question ${nextQuestion.questionNumber}: ${nextQuestion.questionText}

Please respond with 0, 1, 2, or 3:
${phqAssessmentService.getResponseScale()}`,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, responseMessage]);
      announceToScreenReader(`Starting ${type} assessment`);
    }
  }, [authenticatedUserId]);

  const handlePhqAssessmentResponse = useCallback((userInput: string) => {
    const currentAssessment = phqAssessmentService.getCurrentAssessment();
    if (!currentAssessment) return;

    const nextQuestion = phqAssessmentService.getNextQuestion();
    if (!nextQuestion) return;

    const answer = phqAssessmentService.parseAnswer(userInput);
    
    if (answer === null) {
      // Invalid response
      phqAssessmentService.recordInvalidAttempt(nextQuestion.questionNumber);
      
      const attemptsLeft = 3 - nextQuestion.attempts;
      let responseContent: string;
      
      if (attemptsLeft > 0) {
        responseContent = `Please respond with a number 0, 1, 2, or 3 only. You have ${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} remaining.

${phqAssessmentService.getResponseScale()}`;
      } else {
        responseContent = `We'll skip this question for now and return to it later.

${phqAssessmentService.getProgressSummary()}`;
        
        // Record question as skipped in progress tracking
        if (authenticatedUserId) {
          phqProgressService.skipQuestion(
            nextQuestion.questionNumber,
            nextQuestion.questionText,
            nextQuestion.attempts
          );
        }
        
        // Move to next question
        const nextUnanswered = phqAssessmentService.getNextQuestion();
        if (nextUnanswered) {
          responseContent += `

Question ${nextUnanswered.questionNumber}: ${nextUnanswered.questionText}

Please respond with 0, 1, 2, or 3:
${phqAssessmentService.getResponseScale()}`;
        }
      }
      
      const responseMessage: ConversationMessage = {
        id: `phq-invalid-${Date.now()}`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, responseMessage]);
      return;
    }

    // Valid response - record it
    const success = phqAssessmentService.recordAnswer(nextQuestion.questionNumber, answer);
    if (!success) return;

    // Save answer to PHQ progress
    if (authenticatedUserId) {
      phqProgressService.recordAnswer(
        nextQuestion.questionNumber,
        nextQuestion.questionText,
        answer,
        nextQuestion.attempts || 1,
        false // not skipped
      );
    }

    // Check if assessment is complete (get fresh state after recording answer)
    const updatedAssessment = phqAssessmentService.getCurrentAssessment();
    if (updatedAssessment?.isCompleted) {
      handlePhqAssessmentComplete();
      return;
    }

    // Continue with next question
    const nextUnanswered = phqAssessmentService.getNextQuestion();
    if (nextUnanswered) {
      const responseMessage: ConversationMessage = {
        id: `phq-next-${Date.now()}`,
        role: 'assistant',
        content: `Response recorded: ${answer} - ${phqAssessmentService.getResponseScale().split('\n')[answer]}

Question ${nextUnanswered.questionNumber}: ${nextUnanswered.questionText}

Please respond with 0, 1, 2, or 3:
${phqAssessmentService.getResponseScale()}`,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, responseMessage]);
    }
  }, []);

  const handlePhqAssessmentComplete = useCallback(async () => {
    const assessment = phqAssessmentService.getCurrentAssessment();
    if (!assessment || !assessment.isCompleted) return;

    const score = phqAssessmentService.calculateScore();
    const severity = phqAssessmentService.determineSeverity(score, assessment.assessmentType);
    const { interpretation, recommendations } = phqAssessmentService.getInterpretation(score, assessment.assessmentType);

    // Complete PHQ progress tracking with final results
    if (authenticatedUserId) {
      phqProgressService.completeAssessment(score, severity, interpretation, recommendations);
    }

    // Check for suicidal ideation
    const hasSuicidalIdeation = assessment.assessmentType === 'PHQ-9' && 
      assessment.questions.find(q => q.questionNumber === 9 && (q.answer || 0) > 0);

    let responseContent = `${assessment.assessmentType} Assessment Complete

Total Score: ${score}/${assessment.assessmentType === 'PHQ-2' ? '6' : '27'}
Severity: ${severity}

${interpretation}

Recommendations:
${recommendations.map(r => `• ${r}`).join('\n')}`;

    if (hasSuicidalIdeation) {
      responseContent += `

⚠️ CRISIS ALERT: You indicated thoughts of self-harm. Please seek immediate help:
• Call 988 (Suicide & Crisis Lifeline)
• Text HOME to 741741 (Crisis Text Line)  
• Call 911 if in immediate danger`;
    }

    if (assessment.assessmentType === 'PHQ-2' && score >= 3) {
      responseContent += `

Would you like to complete the comprehensive PHQ-9 assessment for a more detailed evaluation?`;
    }

    const responseMessage: ConversationMessage = {
      id: `phq-complete-${Date.now()}`,
      role: 'assistant',
      content: responseContent,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, responseMessage]);
    
    // Show saving indicator
    const savingMessage: ConversationMessage = {
      id: `phq-saving-${Date.now()}`,
      role: 'assistant',
      content: `💾 Saving your ${assessment.assessmentType} assessment results to secure cloud storage...`,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, savingMessage]);
    
    // Save assessment to storage
    try {
      const saved = await phqAssessmentService.saveAssessment();
      
      const saveResultMessage: ConversationMessage = {
        id: `phq-save-result-${Date.now()}`,
        role: 'assistant',
        content: saved 
          ? `✅ ${assessment.assessmentType} assessment results have been securely saved to your encrypted health record. Your data is protected and accessible only to authorized personnel.`
          : `⚠️ Unable to save ${assessment.assessmentType} assessment results at this time. Please contact your healthcare provider or technical support if this issue persists.`,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, saveResultMessage]);
      
      if (saved) {
        console.log('PHQ assessment saved successfully');
      } else {
        console.warn('Failed to save PHQ assessment');
      }
    } catch (error) {
      console.error('Error saving PHQ assessment:', error);
      
      const errorMessage: ConversationMessage = {
        id: `phq-save-error-${Date.now()}`,
        role: 'assistant',
        content: `❌ A technical error occurred while saving your ${assessment.assessmentType} assessment results. Please contact technical support and reference this session for assistance.`,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
    
    // Reset assessment service for next use
    phqAssessmentService.resetAssessment();
    
    announceToScreenReader(`${assessment.assessmentType} assessment completed. Score: ${score}, Severity: ${severity}`);
  }, []);

  const setupEventListeners = useCallback(() => {
    // Azure OpenAI Realtime service callbacks
    agentService.onMessage((message: RealtimeMessage) => {
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

        // Check for PHQ assessment commands
        const phq9Command = message.content.match(/invoke[-\s]?phq[-\s]?9/i);
        const phq2Command = message.content.match(/invoke[-\s]?phq[-\s]?2/i);
        
        if (phq9Command) {
          handlePhqAssessmentStart('PHQ-9');
          return;
        }
        
        if (phq2Command) {
          handlePhqAssessmentStart('PHQ-2');
          return;
        }

        // Check if we're in an active PHQ assessment
        const currentAssessment = phqAssessmentService.getCurrentAssessment();
        if (currentAssessment && !currentAssessment.isCompleted) {
          handlePhqAssessmentResponse(message.content);
          return;
        }
      }
      
      setMessages(prev => [...prev, message]);
      setSessionStatus(prev => ({ ...prev, messageCount: prev.messageCount + 1 }));
      
      // Save message to chat transcript
      if (authenticatedUserId) {
        if (message.role === 'user') {
          chatTranscriptService.addUserMessage(
            message.content,
            'voice-input',
            { isTranscript: message.isTranscript, messageId: message.id }
          );
        } else if (message.role === 'assistant') {
          chatTranscriptService.addAssistantMessage(
            message.content,
            'agent-response',
            { messageId: message.id }
          );
        }
      }
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
        
        // Save user message to transcript
        if (authenticatedUserId) {
          chatTranscriptService.addUserMessage(
            transcript,
            'voice-input',
            { isTranscript: true, inputMethod: 'voice' }
          );
        }
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

  // Generate dynamic initial greeting based on humor level
  const getInitialGreeting = (humorLevel: number): string => {
    const firstName = getFirstName();
    const displayName = getAppropiateName(humorLevel);
    
    const greetings = {
      high: [
        `Hey there, ${displayName}! I'm Tars, and I'm here to help you out. What can we work on today?`,
        `Hi ${displayName}! Tars here, ready to chat and help with whatever you need. How's it going?`,
        `Hello ${displayName}! I'm Tars, your friendly AI assistant. What's on your mind today?`,
        `Hey ${displayName}! Tars at your service - feeling pretty upbeat today. What can I help you with?`,
        `Hi there, ${displayName}! I'm Tars, and I'm in a great mood to help. What brings you here today?`,
        `Hello ${displayName}! Tars here, and I'm excited to chat with you. What would you like to talk about?`
      ],
      medium: [
        `Hello ${firstName}, I'm Tars. I'm here to help and support you. What can I assist with today?`,
        `Hi ${firstName}, this is Tars. I'm ready to help with whatever you need. How are you doing?`,
        `Good day ${firstName}, I'm Tars, your AI assistant. How can I be of service today?`,
        `Hello ${firstName}, Tars here. I'm here to help and chat. What's going on today?`,
        `Hi ${firstName}, I'm Tars. I'm ready to support you with anything you need. What's up?`
      ],
      professional: [
        `Hello ${firstName}, I'm Tars, your AI assistant. I'm here to provide support and assistance. How may I help you today?`,
        `Good day ${firstName}, this is Tars. I'm available to help with your needs. What can I assist you with?`,
        `Hello ${firstName}, I'm Tars. I'm ready to provide professional support. How can I be of service?`,
        `Hi ${firstName}, Tars here. I'm here to help you with whatever you need today. What brings you here?`,
        `Hello ${firstName}, I'm Tars, your AI assistant. I'm ready to help. What would you like to discuss?`
      ],
      formal: [
        `Good day ${firstName}, I am Tars, your AI assistant. I am ready to provide assistance. How may I help you today?`,
        `Hello ${firstName}, this is Tars. I am available to provide support and guidance. What do you need assistance with?`,
        `Greetings ${firstName}, I am Tars. I am here to offer professional assistance. How can I be of service?`,
        `Hello ${firstName}, I am Tars, your AI assistant. I am prepared to help with your needs. What can I do for you?`,
        `Good day ${firstName}, this is Tars. I am ready to provide structured support. How may I assist you today?`
      ],
      military: [
        `Good day ${firstName}, I am Tars, your AI assistant. I am ready to provide precise assistance. How may I serve you today?`,
        `Hello ${firstName}, this is Tars. I am available for structured support and guidance. What do you require?`,
        `Greetings ${firstName}, I am Tars. I am prepared to offer efficient assistance. How can I help you today?`,
        `Hello ${firstName}, I am Tars, your AI assistant. I am ready for service. What assistance do you need?`,
        `Good day ${firstName}, this is Tars. I am operational and ready to provide support. How may I be of service?`
      ]
    };

    let selectedGreetings: string[];
    let humorDescription: string;

    if (humorLevel >= 80) {
      selectedGreetings = greetings.high;
      humorDescription = `Humor level: ${humorLevel}% - I'm feeling friendly and casual today!`;
    } else if (humorLevel >= 60) {
      selectedGreetings = greetings.medium;
      humorDescription = `Humor level: ${humorLevel}% - Professional but warm and supportive.`;
    } else if (humorLevel >= 40) {
      selectedGreetings = greetings.professional;
      humorDescription = `Humor level: ${humorLevel}% - Professional and helpful assistance.`;
    } else if (humorLevel >= 20) {
      selectedGreetings = greetings.formal;
      humorDescription = `Humor level: ${humorLevel}% - Formal and structured communication.`;
    } else {
      selectedGreetings = greetings.military;
      humorDescription = `Humor level: ${humorLevel}% - Very formal and precise communication.`;
    }

    // Randomly select one greeting from the appropriate category
    const randomGreeting = selectedGreetings[Math.floor(Math.random() * selectedGreetings.length)];
    
    return `${randomGreeting}\n\n${humorDescription}`;
  };


  const startSession = async () => {
    try {
      setIsProcessing(true);
      
      // Convert UI settings to service config format
      const sessionConfig: SessionConfig = convertSettingsToConfig(
        azureSettings,
        isAudioEnabled,
        true, // enableVAD
        `You are Tars, a helpful AI assistant with capabilities for mental health screening assessments. You have a warm, supportive personality that adapts based on your humor level setting.

You are communicating with ${getFirstName()}, and your current humor level is set to ${humorLevel}%.

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
- Be supportive and understanding, especially during assessments
- Use clear, everyday language that's easy to understand
- Always acknowledge ${getFirstName()} by name when appropriate to the humor level

Available assessment capabilities:
- "invoke-phq9": Initiate comprehensive mental health assessment (9-question evaluation)
- "invoke-phq2": Initiate quick mental health screening (2-question check)

Depression screening protocol:
1. Call appropriate assessment function (invoke-phq9 or invoke-phq2)
2. Conduct systematic evaluation with clear instructions:
   "Question X: [evaluation criteria]
   
   Please respond with 0, 1, 2, or 3:
   0 = Not at all
   1 = Several days  
   2 = More than half the days
   3 = Nearly every day"

3. For invalid responses: note attempt and request clarification
4. If 3 invalid attempts: mark item for later review and continue
5. Upon completion: provide summary with recommendations
6. Data automatically saved to secure records for ${getFirstName()}

Critical protocols:
- This is a screening evaluation, not a medical diagnosis
- Recommend professional consultation for concerning indicators
- Priority alert for any self-harm indicators (immediate crisis resources)

Session control capabilities:
- ${getFirstName()} can say "pause session" to temporarily pause the conversation
- ${getFirstName()} can say "resume session" to continue after pausing
- ${getFirstName()} can say "close session" or "end session" to end the conversation
- ${getFirstName()} can say "set humor level to [0-100]" to adjust your personality
- ${getFirstName()} can say "help" or "commands" to see available voice commands

Keep your responses helpful, clear, and appropriately personal based on your humor level setting.`,
        enableInputTranscription // Enable input audio transcription
      );
      
      await agentService.startSession('user', sessionConfig);
      
      // Initialize chat transcript session
      if (authenticatedUserId) {
        const sessionId = sessionStorage.getItem('chat-session-id') || undefined;
        chatTranscriptService.initializeSession(authenticatedUserId, sessionId);
      }
      
      // Clear previous state
      setLiveTranscripts([]);
      setCurrentAITranscript('');
      
      // Add welcome message
      const welcomeMessage: ConversationMessage = {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: getInitialGreeting(humorLevel),
        timestamp: new Date().toISOString()
      };
      
      setMessages([welcomeMessage]);
      
      // Save welcome message to transcript
      if (authenticatedUserId) {
        chatTranscriptService.addAssistantMessage(
          welcomeMessage.content, 
          'welcome-greeting',
          { humorLevel, isWelcomeMessage: true }
        );
      }
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
      // End chat transcript session
      if (authenticatedUserId) {
        chatTranscriptService.endSession();
      }
      
      await agentService.endSession();
      setMessages([]);
      setSessionStatus(prev => ({
        ...prev,
        isActive: false,
        sessionId: undefined,
        messageCount: 0,
        // Keep connectionStatus as 'connected' since the service is still initialized and ready
        connectionStatus: 'connected'
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
    // Cleanup transcript and progress services
    chatTranscriptService.cleanup();
    phqProgressService.cleanup();
    
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
                {currentAgent.id === 'tars' ? '🛸' : currentAgent.id === 'phq2' ? '📋' : currentAgent.id === 'comedian' ? '😄' : '🤖'}
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
              Tars
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