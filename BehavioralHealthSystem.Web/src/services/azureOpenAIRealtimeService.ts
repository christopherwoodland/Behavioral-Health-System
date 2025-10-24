/**
 * Azure OpenAI Realtime WebRTC Service
 * Direct client-side connection to Azure OpenAI Realtime API
 * Based on Microsoft's TypeScript reference implementation:
 * https://learn.microsoft.com/en-us/azure/ai-foundry/openai/realtime-audio-quickstart
 * https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/realtime-audio-webrtc
 */

export interface RealtimeMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  audioUrl?: string;
  isTranscript?: boolean; // Marks messages that are transcripts vs full responses
  isPartial?: boolean; // For live streaming transcripts

  // Agent tracking - which agent sent this message
  agentId?: string; // 'tars', 'matron', 'phq2', 'phq9'

  // Utterance tracking - links messages to real-time speech events
  utteranceId?: string; // Links this message to a specific utterance
  speaker?: 'user' | 'agent'; // Explicit speaker identifier (redundant with role but clearer)
  speechDuration?: number; // How long the speech took in milliseconds
  wasInterrupted?: boolean; // If the speech was cut off mid-utterance

  // PHQ Assessment metadata
  isPhqQuestion?: boolean;
  isPhqAnswer?: boolean;
  phqType?: 2 | 9;
  phqQuestionNumber?: number; // 1-9
  phqAnswerValue?: number; // 0-3 (the actual answer score)
  assessmentId?: string; // Unique ID for the PHQ assessment session
}

/**
 * Utterance - Real-time speech event tracking
 * Tracks actual speech events as they happen, separate from completed messages
 */
export interface Utterance {
  id: string;
  speaker: 'user' | 'agent';
  type: 'speech-start' | 'speech-in-progress' | 'speech-complete';
  content: string; // Accumulates as speech progresses
  startTime: number;
  endTime?: number;
  duration?: number; // Milliseconds
  isInterrupted?: boolean; // True if response.cancelled or user interrupted agent
}

export interface ToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface RealtimeSessionConfig {
  enableAudio: boolean;
  enableVAD: boolean; // Voice Activity Detection
  temperature?: number;
  maxTokens?: number;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'verse' | 'aria' | 'sage' | 'lumen';
  instructions?: string;
  tools?: ToolDefinition[]; // Function calling tools
  // Server turn detection settings
  turnDetection?: {
    threshold?: number;
    prefixPaddingMs?: number;
    silenceDurationMs?: number;
  };
  // Input audio transcription settings
  inputAudioTranscription?: {
    model?: 'whisper-1' | 'gpt-4o-transcribe';
  };
}

// Settings interface for the Speech Settings modal
export interface AzureOpenAIRealtimeSettings {
  // Server turn detection
  turnDetectionThreshold: number;
  turnDetectionPrefixPadding: number;
  turnDetectionSilenceDuration: number;
  // Parameters
  maxResponse: number;
  temperature: number;
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'verse' | 'aria' | 'sage' | 'lumen';
}

/**
 * Convert UI settings to service config format
 */
export function convertSettingsToConfig(
  settings: AzureOpenAIRealtimeSettings,
  enableAudio: boolean = true,
  enableVAD: boolean = true,
  instructions?: string,
  enableInputTranscription: boolean = true
): RealtimeSessionConfig {
  return {
    enableAudio,
    enableVAD,
    temperature: Math.max(0.6, settings.temperature), // Ensure minimum 0.6 for Azure OpenAI
    maxTokens: settings.maxResponse,
    voice: settings.voice,
    instructions,
    turnDetection: {
      threshold: settings.turnDetectionThreshold,
      prefixPaddingMs: settings.turnDetectionPrefixPadding,
      silenceDurationMs: settings.turnDetectionSilenceDuration
    },
    inputAudioTranscription: enableInputTranscription ? {
      model: 'whisper-1'
    } : undefined
  };
}

export interface VoiceActivity {
  volumeLevel: number;
  isSpeaking: boolean;
  timestamp: number;
}

// New interfaces for enhanced features
export interface SpeechDetectionState {
  isUserSpeaking: boolean;
  isAISpeaking: boolean;
  speechStartedAt?: number;
  speechStoppedAt?: number;
}

export interface LiveTranscript {
  id: string;
  text: string;
  isPartial: boolean;
  role: 'user' | 'assistant';
  timestamp: number;
}

export interface ConversationState {
  state: 'idle' | 'listening' | 'processing' | 'speaking' | 'error';
  message?: string;
}

export interface SessionStatus {
  isConnected: boolean;
  isSessionActive: boolean;
  sessionId: string | null;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Standard tool definitions for PHQ assessments and session control
 * These must be registered with the Azure OpenAI Realtime API session
 */
export const REALTIME_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    name: 'invoke-phq2',
    description: 'Initiates a PHQ-2 (Patient Health Questionnaire-2) depression screening. This is a quick 2-question assessment used for initial screening. Call this when the user wants to START, BEGIN, TAKE, DO, COMMENCE, COMPLETE, or INITIATE a PHQ-2 assessment, quick mental health screening, or brief depression check. Recognize phrases like: "start PHQ-2", "begin the screening", "take a quick assessment", "do the PHQ-2", "I want to complete a mental health check".',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Brief reason for initiating the assessment (e.g., "User requested quick screening", "Follow-up check")'
        }
      },
      required: []
    }
  },
  {
    type: 'function',
    name: 'invoke-phq9',
    description: 'Initiates a PHQ-9 (Patient Health Questionnaire-9) comprehensive depression assessment. This is a detailed 9-question evaluation. Call this when the user wants to START, BEGIN, TAKE, DO, COMMENCE, COMPLETE, or INITIATE a PHQ-9 assessment, full mental health evaluation, or comprehensive depression screening. Recognize phrases like: "start the PHQ-9", "begin the full assessment", "take the comprehensive screening", "do the depression evaluation", "I want to complete the mental health assessment".',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Brief reason for initiating the assessment (e.g., "User requested full assessment", "Detailed evaluation needed")'
        }
      },
      required: []
    }
  },
  {
    type: 'function',
    name: 'pause-session',
    description: 'Temporarily pauses the current conversation session. The user can resume later. Call this when the user says "pause session" or indicates they need to pause.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    type: 'function',
    name: 'resume-session',
    description: 'Resumes a previously paused conversation session. Call this when the user says "resume session" or indicates they want to continue.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    type: 'function',
    name: 'close-session',
    description: 'Ends the current conversation session permanently. Call this when the user says "close session", "end session", "goodbye", or clearly indicates they want to end the conversation.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    type: 'function',
    name: 'set-humor-level',
    description: 'Adjusts the AI personality humor level between 0-100. Higher values make the AI more casual and friendly, lower values make it more formal and professional. Call this when the user requests a personality adjustment.',
    parameters: {
      type: 'object',
      properties: {
        level: {
          type: 'string',
          description: 'The humor level as a number between 0 and 100 (e.g., "0", "50", "100")'
        }
      },
      required: ['level']
    }
  }
];

import { UserInputHandler } from './handlers/UserInputHandler';
import { AgentResponseHandler } from './handlers/AgentResponseHandler';

/**
 * Azure OpenAI Realtime WebRTC Service
 * Handles direct browser-to-Azure OpenAI connection via WebRTC
 * Uses separated handlers for user input and agent responses
 */
export class AzureOpenAIRealtimeService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;

  private sessionId: string | null = null;
  private isConnected: boolean = false;
  private isSessionActive: boolean = false;

  // Separated handlers for independent processing
  private userInputHandler: UserInputHandler;
  private agentResponseHandler: AgentResponseHandler;

  // Note: Local VAD removed - relying on Azure server-side VAD

  private endpoint: string;
  private apiKey: string;
  private deploymentName: string;
  private apiVersion: string;
  private webrtcRegion: string;
  private ephemeralKey: string = '';

  private messageHistory: RealtimeMessage[] = [];

  // Response state tracking to prevent overlapping responses
  private isResponseInProgress: boolean = false;
  private pendingResponseQueue: Array<() => void> = [];

  // Enhanced state tracking
  private currentTranscriptBuffer: string = '';
  private speechDetectionState: SpeechDetectionState = {
    isUserSpeaking: false,
    isAISpeaking: false
  };

  // Utterance tracking - real-time speech event monitoring
  private activeUtterances: Map<string, Utterance> = new Map();
  private currentUserUtteranceId: string | null = null;
  private currentAgentUtteranceId: string | null = null;

  // Reconnection state
  private reconnectionAttempts: number = 0;
  private maxReconnectionAttempts: number = parseInt(import.meta.env.VITE_REALTIME_MAX_RECONNECTION_ATTEMPTS || '3', 10);
  private reconnectionDelay: number = parseInt(import.meta.env.VITE_REALTIME_RECONNECTION_DELAY_MS || '2000', 10); // Start with configurable delay (uses exponential backoff)
  private reconnectionTimer: NodeJS.Timeout | null = null;
  private lastConfig: RealtimeSessionConfig | null = null;
  private isReconnecting: boolean = false;
  private isConnecting: boolean = false; // Guard flag to prevent concurrent connection attempts

  // Event callbacks
  private onMessageCallback: ((message: RealtimeMessage) => void) | null = null;
  private onStatusChangeCallback: ((status: SessionStatus) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  // REMOVED: onTranscriptCallback - deprecated, use onMessage instead
  private onConnectionLostCallback: ((attempts: number, maxAttempts: number) => void) | null = null;

  // Enhanced event callbacks
  private onLiveTranscriptCallback: ((transcript: LiveTranscript) => void) | null = null;
  private onSpeechDetectionCallback: ((state: SpeechDetectionState) => void) | null = null;
  private onConversationStateCallback: ((state: ConversationState) => void) | null = null;
  private onUtteranceCallback: ((utterance: Utterance) => void) | null = null;

  // Function calling callbacks
  private onFunctionCallCallback: ((functionName: string, args: Record<string, unknown>) => Promise<unknown>) | null = null;

  constructor() {
    // Load configuration from environment variables
    // Two-step authentication: sessions endpoint + WebRTC regional endpoint
    this.endpoint = import.meta.env.VITE_AZURE_OPENAI_RESOURCE_NAME || '';
    this.apiKey = import.meta.env.VITE_AZURE_OPENAI_REALTIME_KEY || '';
    this.deploymentName = import.meta.env.VITE_AZURE_OPENAI_REALTIME_DEPLOYMENT || 'gpt-4o-realtime-preview';
    this.apiVersion = import.meta.env.VITE_AZURE_OPENAI_REALTIME_API_VERSION || '2025-04-01-preview';
    this.webrtcRegion = import.meta.env.VITE_AZURE_OPENAI_WEBRTC_REGION || 'eastus2'; // Changed default from 'eastus' to 'eastus2'

    console.log('🔧 Azure OpenAI Realtime Config:');
    console.log('  Resource:', this.endpoint);
    console.log('  Deployment:', this.deploymentName);
    console.log('  API Version:', this.apiVersion);
    console.log('  WebRTC Region:', this.webrtcRegion);
    console.log('  Env Var Loaded:', import.meta.env.VITE_AZURE_OPENAI_WEBRTC_REGION ? 'YES ✅' : 'NO ❌ (using default)');

    if (!this.endpoint || !this.apiKey) {
      console.warn('⚠️ Azure OpenAI Realtime credentials not configured');
    }

    // Initialize separated handlers
    this.userInputHandler = new UserInputHandler();
    this.agentResponseHandler = new AgentResponseHandler();

    // Connect agent handler's mute callback to this service
    this.agentResponseHandler.onMuteMicrophone((mute: boolean) => {
      this.muteMicrophone(mute);
    });

    // Forward agent handler messages/transcripts to main service callbacks
    this.agentResponseHandler.onMessage((message) => {
      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    });

    this.agentResponseHandler.onLiveTranscript((transcript) => {
      if (this.onLiveTranscriptCallback) {
        this.onLiveTranscriptCallback(transcript);
      }
    });

    this.agentResponseHandler.onSpeechDetection((state) => {
      // Merge agent state with user state
      this.speechDetectionState.isAISpeaking = state.isAISpeaking;
      if (this.onSpeechDetectionCallback) {
        this.onSpeechDetectionCallback(this.speechDetectionState);
      }
    });

    console.log('✅ Independent user/agent handlers initialized');
  }

  /**
   * Event listeners
   */
  onMessage(callback: (message: RealtimeMessage) => void): void {
    this.onMessageCallback = callback;
  }

  /**
   * Voice activity monitoring - DEPRECATED
   * Local VAD removed. This method is kept for backward compatibility but does nothing.
   * Use Azure's server-side VAD events instead (input_audio_buffer.speech_started/stopped)
   */
  onStatusChange(callback: (status: SessionStatus) => void): void {
    this.onStatusChangeCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * @deprecated onTranscript is deprecated - use onMessage callback instead
   * Messages now flow through onMessage with proper role attribution (user/assistant)
   */
  onTranscript(_callback: (transcript: string, isFinal: boolean) => void): void {
    console.warn('⚠️ onTranscript is deprecated - use onMessage callback instead for proper message handling');
    // Callback registration removed - no longer functional
  }

  // Enhanced event listeners
  onLiveTranscript(callback: (transcript: LiveTranscript) => void): void {
    this.onLiveTranscriptCallback = callback;
  }

  onSpeechDetection(callback: (state: SpeechDetectionState) => void): void {
    this.onSpeechDetectionCallback = callback;
  }

  onConversationState(callback: (state: ConversationState) => void): void {
    this.onConversationStateCallback = callback;
  }

  onConnectionLost(callback: (attempts: number, maxAttempts: number) => void): void {
    this.onConnectionLostCallback = callback;
  }

  /**
   * Register callback for utterance tracking events
   * Called when utterances are created, updated, or completed
   */
  onUtterance(callback: (utterance: Utterance) => void): void {
    this.onUtteranceCallback = callback;
  }

  /**
   * Get all tracked utterances
   */
  getUtterances(): Utterance[] {
    return Array.from(this.activeUtterances.values());
  }

  /**
   * Get utterances by speaker
   */
  getUtterancesBySpeaker(speaker: 'user' | 'agent'): Utterance[] {
    return this.getUtterances().filter(u => u.speaker === speaker);
  }

  /**
   * Clear all tracked utterances
   */
  clearUtterances(): void {
    this.activeUtterances.clear();
    this.currentUserUtteranceId = null;
    this.currentAgentUtteranceId = null;
  }

  /**
   * Track or update an utterance
   * Creates new utterance or updates existing one based on speech events
   */
  private trackUtterance(
    speaker: 'user' | 'agent',
    type: 'speech-start' | 'speech-in-progress' | 'speech-complete',
    content: string = ''
  ): string {
    const currentIdKey = speaker === 'user' ? 'currentUserUtteranceId' : 'currentAgentUtteranceId';
    let utteranceId = this[currentIdKey];

    if (type === 'speech-start') {
      // Create new utterance
      utteranceId = `${speaker}_${Date.now()}`;
      this[currentIdKey] = utteranceId;

      const utterance: Utterance = {
        id: utteranceId,
        speaker,
        type,
        content,
        startTime: Date.now(),
        isInterrupted: false
      };

      this.activeUtterances.set(utteranceId, utterance);

      // Emit callback
      if (this.onUtteranceCallback) {
        this.onUtteranceCallback(utterance);
      }

      console.log(`🎤 Speech started: ${speaker} (${utteranceId})`);
    } else if (utteranceId && this.activeUtterances.has(utteranceId)) {
      // Update existing utterance
      const utterance = this.activeUtterances.get(utteranceId)!;
      utterance.type = type;
      utterance.content = content;

      if (type === 'speech-complete') {
        utterance.endTime = Date.now();
        utterance.duration = utterance.endTime - utterance.startTime;
        this[currentIdKey] = null; // Clear current ID
        console.log(`✅ Speech completed: ${speaker} (${utteranceId}) - ${utterance.duration}ms`);
      }

      // Emit callback
      if (this.onUtteranceCallback) {
        this.onUtteranceCallback(utterance);
      }
    }

    return utteranceId || '';
  }

  /**
   * Mark an utterance as interrupted
   */
  private interruptUtterance(speaker: 'user' | 'agent'): void {
    const currentIdKey = speaker === 'user' ? 'currentUserUtteranceId' : 'currentAgentUtteranceId';
    const utteranceId = this[currentIdKey];

    if (utteranceId && this.activeUtterances.has(utteranceId)) {
      const utterance = this.activeUtterances.get(utteranceId)!;
      utterance.type = 'speech-complete';
      utterance.isInterrupted = true;
      utterance.endTime = Date.now();
      utterance.duration = utterance.endTime - utterance.startTime;

      this[currentIdKey] = null;

      // Emit callback
      if (this.onUtteranceCallback) {
        this.onUtteranceCallback(utterance);
      }

      console.log(`⚠️ Speech interrupted: ${speaker} (${utteranceId})`);
    }
  }

  /**
   * Register callback for function calls from the AI
   * This callback will be invoked when the AI calls a registered tool/function
   */
  onFunctionCall(callback: (functionName: string, args: Record<string, unknown>) => Promise<unknown>): void {
    this.onFunctionCallCallback = callback;
  }

  /**
   * Send function call result back to the API
   */
  private sendFunctionResult(callId: string, result: unknown): void {
    if (!this.dataChannel) {
      console.error('❌ Cannot send function result: data channel not connected');
      return;
    }

    const resultEvent = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(result)
      }
    };

    console.log('📤 Sending function result:', resultEvent);
    this.dataChannel.send(JSON.stringify(resultEvent));

    // Trigger the AI to generate a response based on the function result
    // Use safe method to queue if response already in progress
    this.safeCreateResponse();
  }

  /**
   * Safely create a response, queuing if one is already in progress
   */
  private safeCreateResponse(options?: { modalities?: string[], instructions?: string }): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn('⚠️ Cannot create response: data channel not open');
      return;
    }

    // If a response is already in progress, queue this request
    if (this.isResponseInProgress) {
      console.log('⏳ Response already in progress, queuing new response request');
      this.pendingResponseQueue.push(() => this.safeCreateResponse(options));
      return;
    }

    // Send response.create event
    const responseEvent: any = {
      type: 'response.create'
    };

    if (options) {
      responseEvent.response = {};
      if (options.modalities) {
        responseEvent.response.modalities = options.modalities;
      }
      if (options.instructions) {
        responseEvent.response.instructions = options.instructions;
      }
    }

    console.log('📤 Creating AI response:', responseEvent);
    this.dataChannel.send(JSON.stringify(responseEvent));
  }

  /**
   * Process the next queued response if any
   */
  private processNextQueuedResponse(): void {
    if (this.pendingResponseQueue.length > 0) {
      console.log(`🔄 Processing next queued response (${this.pendingResponseQueue.length} in queue)`);
      const nextResponse = this.pendingResponseQueue.shift();
      if (nextResponse) {
        // Small delay to ensure previous response is fully cleared
        setTimeout(() => nextResponse(), 100);
      }
    }
  }

  /**
   * Send function call error back to the API
   */
  private sendFunctionError(callId: string, errorMessage: string): void {
    if (!this.dataChannel) {
      console.error('❌ Cannot send function error: data channel not connected');
      return;
    }

    const errorEvent = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify({ error: errorMessage })
      }
    };

    console.log('📤 Sending function error:', errorEvent);
    this.dataChannel.send(JSON.stringify(errorEvent));
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    try {
      // Verify WebRTC support
      if (!('RTCPeerConnection' in window)) {
        throw new Error('WebRTC is not supported in this browser');
      }

      if (!('MediaStream' in window)) {
        throw new Error('MediaStream API is not supported in this browser');
      }

      this.isConnected = true;
      this.emitStatusChange();

      console.log('✅ Azure OpenAI Realtime service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize service:', error);
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Start a new realtime session with WebRTC
   */
  async startSession(userId: string, config: RealtimeSessionConfig): Promise<void> {
    try {
      if (!this.endpoint || !this.apiKey) {
        throw new Error('Azure OpenAI Realtime credentials not configured. Please set environment variables.');
      }

      // Guard: Prevent starting if session is already active or connecting
      if (this.isSessionActive) {
        console.log('⚠️ Session already active, skipping start');
        return;
      }

      if (this.isConnecting) {
        console.log('⚠️ Connection already in progress, skipping start');
        return;
      }

      this.isConnecting = true; // Set flag to prevent concurrent attempts
      console.log('🚀 Starting Azure OpenAI Realtime session...');

      // Save config for potential reconnection
      this.lastConfig = { ...config };

      this.sessionId = `session-${userId}-${Date.now()}`;

      // Step 1: Get ephemeral key from sessions API
      console.log('🔑 Getting ephemeral key from Azure OpenAI sessions API...');
      await this.getEphemeralKey(config);

      // Get user media (microphone) with selected device
      await this.initializeAudioStream(config.enableAudio);

      // Setup audio analysis for voice activity detection
      if (config.enableVAD && this.localStream) {
        this.setupVoiceActivityDetection();
      }

      // Create RTCPeerConnection
      await this.createPeerConnection(config);

      // Step 2: Establish WebRTC connection to Azure OpenAI with ephemeral key
      await this.connectToAzureOpenAI();

      this.isSessionActive = true;
      this.isConnecting = false; // Connection successful, reset flag
      this.emitStatusChange();

      console.log('✅ Session started successfully:', this.sessionId);
    } catch (error) {
      console.error('❌ Failed to start session:', error);
      this.isConnecting = false; // Reset flag on error
      this.handleError(error as Error);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Initialize audio stream from microphone
   */
  private async initializeAudioStream(enableAudio: boolean): Promise<void> {
    if (!enableAudio) {
      console.log('Audio disabled, skipping microphone initialization');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          // WebRTC AEC3 (Acoustic Echo Cancellation v3) - Hardware/Browser level
          echoCancellation: { ideal: true, exact: true }, // Standard WebRTC
          noiseSuppression: { ideal: true, exact: true },
          autoGainControl: { ideal: true, exact: true },
          sampleRate: { ideal: 24000 }, // Azure OpenAI recommended sample rate
          channelCount: { ideal: 1, max: 1 }, // Mono audio
          latency: { ideal: 0.01, max: 0.02 },

          // Chrome/Edge WebRTC AEC3 specific constraints
          googEchoCancellation: true,
          googEchoCancellation2: true, // AEC2 (enhanced)
          googDAEchoCancellation: true, // Drift-Aware Echo Cancellation (AEC3)
          googExperimentalEchoCancellation: true, // Experimental AEC3 features
          googAutoGainControl: true,
          googAutoGainControl2: true,
          googExperimentalAutoGainControl: true,
          googNoiseSuppression: true,
          googNoiseSuppression2: true,
          googExperimentalNoiseSuppression: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
          googAudioMirroring: false,
          googBeamforming: true,
          googArrayGeometry: true,
        } as MediaTrackConstraints,
        video: false
      };

      console.log('🎙️ WebRTC AEC3 ENABLED: Requesting microphone with hardware echo cancellation...');

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('🎤 Microphone access granted');
    } catch (error) {
      console.error('❌ Failed to access microphone:', error);
      throw new Error('Microphone access denied. Please grant microphone permissions.');
    }
  }

  /**
   * Setup voice activity detection
   */
  /**
   * Setup voice activity detection using UserInputHandler
   */
  private async setupVoiceActivityDetection(): Promise<void> {
    // LOCAL VAD REMOVED - Now relying entirely on Azure OpenAI's server-side VAD
    // Azure's `input_audio_buffer.speech_started` and `speech_stopped` events
    // provide more accurate speech detection than local audio analysis

    // Forward user transcript handler for backward compatibility
    this.userInputHandler.onLiveTranscript((transcript) => {
      if (this.onLiveTranscriptCallback) {
        this.onLiveTranscriptCallback(transcript);
      }
    });

    console.log('✅ Using Azure OpenAI server-side VAD (local VAD removed)');
  }

  /**
   * Legacy method - now delegated to UserInputHandler
   * @deprecated Use UserInputHandler directly
   */
  /**
   * Create RTCPeerConnection
   */
  private async createPeerConnection(_config: RealtimeSessionConfig): Promise<void> {
    // CRITICAL: Close existing peer connection if it exists to prevent "wrong state" errors
    if (this.peerConnection) {
      console.log('⚠️ Closing existing peer connection before creating new one');
      try {
        this.peerConnection.close();
      } catch (error) {
        console.warn('Error closing existing peer connection:', error);
      }
      this.peerConnection = null;
      this.dataChannel = null;
    }

    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };

    this.peerConnection = new RTCPeerConnection(configuration);

    // Add local audio track
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.peerConnection && this.localStream) {
          this.peerConnection.addTrack(track, this.localStream);
          console.log('➕ Added local audio track');
        }
      });
    }

    // Handle remote tracks (AI audio responses)
    this.peerConnection.ontrack = (event) => {
      console.log('📡 Received remote track');
      this.remoteStream = event.streams[0];
      this.playRemoteAudio();
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 ICE candidate:', event.candidate.candidate);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('🔌 Connection state:', state);

      // Handle connection failures and disconnections
      if (state === 'failed' || state === 'disconnected') {
        console.warn('⚠️ Connection lost:', state);
        this.handleConnectionLost();
      } else if (state === 'connected') {
        // Reset reconnection attempts on successful connection
        this.reconnectionAttempts = 0;
        this.isReconnecting = false;
      }

      this.emitStatusChange();
    };

    // Create data channel for realtime events (must be created BEFORE offer)
    // Using 'realtime-channel' name as per Azure OpenAI specification
    this.dataChannel = this.peerConnection.createDataChannel('realtime-channel', {
      ordered: true
    });

    this.dataChannel.onmessage = (event) => {
      this.handleDataChannelMessage(event.data);
    };

    this.dataChannel.onopen = () => {
      console.log('📬 Data channel is open');
      // Send session.update after data channel opens (as per working example)
      this.updateSession(_config);
    };

    this.dataChannel.onclose = () => {
      console.log('📪 Data channel is closed');
    };

    console.log('✅ RTCPeerConnection created');
  }

  /**
   * Connect to Azure OpenAI Realtime API
   */
  private async connectToAzureOpenAI(): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      // Create offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });

      await this.peerConnection.setLocalDescription(offer);
      console.log('📤 Created and set local offer');

      // Send offer to Azure OpenAI and get answer
      const answer = await this.exchangeSDPWithAzure(offer);

      // Check peer connection state before setting remote description
      const currentState = this.peerConnection.signalingState;
      console.log(`🔍 Peer connection signaling state: ${currentState}`);

      if (currentState === 'stable') {
        console.warn('⚠️ Peer connection already in stable state, skipping setRemoteDescription');
        return;
      }

      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('📥 Set remote answer from Azure OpenAI');

    } catch (error) {
      console.error('❌ Failed to connect to Azure OpenAI:', error);
      throw error;
    }
  }

  /**
   * Get ephemeral key from Azure OpenAI sessions API (Step 1 of 2-step auth)
   * Matches HTML example: only sends model and voice
   */
  private async getEphemeralKey(config: RealtimeSessionConfig): Promise<void> {
    const sessionsUrl = `https://${this.endpoint}.openai.azure.com/openai/realtimeapi/sessions?api-version=${this.apiVersion}`;

    // Match HTML example exactly: only model and voice
    // Other parameters (instructions, temperature, etc.) are sent via session.update after connection
    const payload = {
      model: this.deploymentName,
      voice: config.voice || 'alloy'
    };

    try {
      console.log('📡 Sessions API URL:', sessionsUrl);
      console.log('📤 Request payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(sessionsUrl, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sessions API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      this.ephemeralKey = data.client_secret.value;

      console.log('✅ Ephemeral key obtained successfully');
      console.log('🆔 Session ID:', data.id);
    } catch (error) {
      console.error('❌ Failed to get ephemeral key:', error);
      throw error;
    }
  }

  /**
   * Exchange SDP with Azure OpenAI Realtime API (Step 2 of 2-step auth)
   */
  private async exchangeSDPWithAzure(
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    // Use regional WebRTC endpoint with deployment as query parameter
    const webrtcUrl = `https://${this.webrtcRegion}.realtimeapi-preview.ai.azure.com/v1/realtimertc?model=${this.deploymentName}`;

    try {
      console.log('📡 WebRTC URL:', webrtcUrl);

      const response = await fetch(webrtcUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.ephemeralKey}`,
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WebRTC API error: ${response.status} - ${errorText}`);
      }

      const sdpAnswer = await response.text();

      console.log('✅ SDP answer received from Azure OpenAI');

      return {
        type: 'answer' as RTCSdpType,
        sdp: sdpAnswer
      };
    } catch (error) {
      console.error('❌ Failed to exchange SDP with Azure:', error);
      throw error;
    }
  }

  /**
   * Send session.update event to configure the session
   * Called automatically when data channel opens
   * Can also be called manually to switch agents or update configuration
   */
  public updateSession(config: RealtimeSessionConfig): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.warn('⚠️ Data channel not open, cannot send session.update');
      return;
    }

    const sessionConfig: any = {
      instructions: config.instructions || 'You are a helpful behavioral health assistant responding in natural, engaging language.',
      voice: config.voice || 'alloy',
      temperature: Math.max(0.6, config.temperature || 0.7) // Ensure temperature is at least 0.6 for Azure OpenAI
    };

    // Add max tokens if specified
    if (config.maxTokens) {
      sessionConfig.max_response_output_tokens = config.maxTokens;
    }

    // Add turn detection settings if specified
    if (config.turnDetection) {
      sessionConfig.turn_detection = {
        type: 'server_vad',
        threshold: config.turnDetection.threshold || 0.5,
        prefix_padding_ms: config.turnDetection.prefixPaddingMs || 200,
        silence_duration_ms: config.turnDetection.silenceDurationMs || 300
      };
    }

    // Add input audio transcription if specified
    if (config.inputAudioTranscription) {
      sessionConfig.input_audio_transcription = {
        model: config.inputAudioTranscription.model || 'whisper-1'
      };
    }

    // Add tools/functions if specified
    if (config.tools && config.tools.length > 0) {
      sessionConfig.tools = config.tools;
      console.log(`🔧 Registering ${config.tools.length} tools:`, config.tools.map(t => t.name).join(', '));
    }

    const event = {
      type: 'session.update',
      session: sessionConfig
    };

    try {
      this.dataChannel.send(JSON.stringify(event));
      console.log('📤 Sent client event:', JSON.stringify(event, null, 2));
    } catch (error) {
      console.error('❌ Failed to send session.update:', error);
    }
  }

  /**
   * Check if voice can be updated safely
   * Returns false if a response is currently in progress (assistant is speaking)
   */
  public canUpdateVoice(): boolean {
    return !this.isResponseInProgress;
  }

  /**
   * Play remote audio from AI
   */
  private playRemoteAudio(): void {
    if (!this.remoteStream) return;

    if (!this.audioElement) {
      this.audioElement = new Audio();
      this.audioElement.autoplay = true;
    }

    this.audioElement.srcObject = this.remoteStream;
    console.log('🔊 Playing AI audio response');
  }

  /**
   * Handle data channel messages from Azure OpenAI
   * Comprehensive event handling for all Azure OpenAI Realtime API events
   */
  private handleDataChannelMessage(data: string): void {
    try {
      const realtimeEvent = JSON.parse(data);
      console.log('📥 Received server event:', realtimeEvent.type, realtimeEvent);

      // Handle different event types from Azure OpenAI Realtime API
      switch (realtimeEvent.type) {
        // Session management
        case 'session.created':
          console.log('✅ Session created successfully');
          // Reset response flag to ensure clean state
          this.isResponseInProgress = false;
          this.updateConversationState({ state: 'idle', message: 'Session created' });
          break;

        case 'session.update':
          const instructions = realtimeEvent.session?.instructions;
          console.log('📋 Session updated. Instructions:', instructions);
          this.updateConversationState({ state: 'idle', message: 'Session configured' });
          break;

        case 'session.error':
          console.error('❌ Session error:', realtimeEvent.error?.message);
          this.updateConversationState({ state: 'error', message: realtimeEvent.error?.message });
          if (this.onErrorCallback) {
            this.onErrorCallback(new Error(realtimeEvent.error?.message || 'Session error'));
          }
          break;

        case 'session.end':
          console.log('🛑 Session ended by server');
          this.updateConversationState({ state: 'idle', message: 'Session ended' });
          this.cleanup();
          break;

        // Input audio buffer events (user speech detection)
        case 'input_audio_buffer.speech_started':
          console.log('👤 ========================================');
          console.log('👤 USER STARTED SPEAKING');
          console.log('👤 ========================================');
          this.speechDetectionState.isUserSpeaking = true;
          this.speechDetectionState.speechStartedAt = Date.now();
          this.updateConversationState({ state: 'listening', message: 'Listening...' });
          this.emitSpeechDetection();

          // Track user utterance start
          this.trackUtterance('user', 'speech-start');
          break;

        case 'input_audio_buffer.speech_stopped':
          console.log('� USER STOPPED SPEAKING');
          console.log('👤 ========================================');
          this.speechDetectionState.isUserSpeaking = false;
          this.speechDetectionState.speechStoppedAt = Date.now();
          this.updateConversationState({ state: 'processing', message: 'Processing...' });
          this.emitSpeechDetection();
          break;

        // Real-time AI audio transcripts (live captions) - DELEGATED TO AgentResponseHandler
        case 'response.audio_transcript.delta':
          this.agentResponseHandler.handleAudioTranscriptDelta(realtimeEvent);

          // Update service-level state for backward compatibility
          if (realtimeEvent.delta) {
            this.currentTranscriptBuffer += realtimeEvent.delta;
            this.updateConversationState({ state: 'speaking', message: 'AI Speaking...' });
            this.speechDetectionState.isAISpeaking = true;
            this.emitSpeechDetection();

            // Track agent utterance in progress
            this.trackUtterance('agent', 'speech-in-progress', this.currentTranscriptBuffer);

            // REMOVED: onTranscriptCallback - deprecated, messages flow through onMessage
          }
          break;

        case 'response.audio_transcript.done':
          // DELEGATED TO AgentResponseHandler
          this.agentResponseHandler.handleAudioTranscriptDone(realtimeEvent);

          // Update service-level state for backward compatibility
          if (realtimeEvent.transcript) {
            console.log('🤖 ========================================');
            console.log('🤖 AGENT SAID:');
            console.log('🤖 "' + realtimeEvent.transcript + '"');
            console.log('🤖 ========================================');

            // Complete agent utterance and link to message
            const utteranceId = this.trackUtterance('agent', 'speech-complete', realtimeEvent.transcript);

            const agentMessage: RealtimeMessage = {
              id: `ai-transcript-${Date.now()}`,
              role: 'assistant',
              content: realtimeEvent.transcript,
              timestamp: new Date().toISOString(),
              isTranscript: true,
              isPartial: false,
              utteranceId,
              speaker: 'agent',
              speechDuration: this.activeUtterances.get(utteranceId)?.duration
            };

            this.messageHistory.push(agentMessage);

            this.currentTranscriptBuffer = '';

            // REMOVED: onTranscriptCallback - deprecated, messages flow through onMessage
          }
          break;

        // Input audio transcription (user speech as text) - DELEGATED TO UserInputHandler
        case 'conversation.item.input_audio_transcription.completed':
          this.userInputHandler.handleTranscriptEvent(realtimeEvent);

          // Update service-level state for backward compatibility
          if (realtimeEvent.transcript) {
            console.log('👤 ========================================');
            console.log('👤 USER SAID:');
            console.log('👤 "' + realtimeEvent.transcript + '"');
            console.log('👤 ========================================');

            // Complete user utterance and link to message
            const utteranceId = this.trackUtterance('user', 'speech-complete', realtimeEvent.transcript);

            const userMessage: RealtimeMessage = {
              id: `user-transcript-${Date.now()}`,
              role: 'user',
              content: realtimeEvent.transcript,
              timestamp: new Date().toISOString(),
              isTranscript: true,
              isPartial: false,
              utteranceId,
              speaker: 'user',
              speechDuration: this.activeUtterances.get(utteranceId)?.duration
            };

            this.messageHistory.push(userMessage);

            if (this.onMessageCallback) {
              this.onMessageCallback(userMessage);
            }
          }
          break;

        // Response management - DELEGATED TO AgentResponseHandler
        case 'response.created':
          console.log('🤖 ========================================');
          console.log('🤖 AGENT STARTED RESPONDING');
          console.log('🤖 ========================================');
          this.isResponseInProgress = true; // Mark response as active
          this.agentResponseHandler.handleResponseCreated(realtimeEvent);
          this.updateConversationState({ state: 'processing', message: 'Generating response...' });

          // IMPORTANT: Set isAISpeaking to true IMMEDIATELY when response starts
          // Don't wait for the first audio_transcript.delta
          this.speechDetectionState.isAISpeaking = true;
          this.emitSpeechDetection();

          // Track agent utterance start
          this.trackUtterance('agent', 'speech-start');
          break;

        case 'response.done':
          this.agentResponseHandler.handleResponseDone(realtimeEvent);

          // Update service-level state for backward compatibility
          // NOTE: Don't set isAISpeaking = false here - wait for output_audio_buffer.stopped
          // because audio might still be playing in the output buffer
          this.isResponseInProgress = false; // Clear response flag
          this.updateConversationState({ state: 'idle', message: 'Ready for input' });
          // Don't emit speech detection here - let output_audio_buffer.stopped do it

          // Process any queued responses
          this.processNextQueuedResponse();
          break;

        case 'response.cancelled':
          this.agentResponseHandler.handleResponseCancelled(realtimeEvent);
          this.isResponseInProgress = false; // Clear response flag on cancellation

          // Update service-level state for backward compatibility
          this.speechDetectionState.isAISpeaking = false;
          this.updateConversationState({ state: 'idle', message: 'Response interrupted' });
          this.emitSpeechDetection();
          this.currentTranscriptBuffer = '';

          // Mark agent utterance as interrupted
          this.interruptUtterance('agent');
          break;

        // Error handling
        case 'error':
          const errorMessage = realtimeEvent.error?.message || 'Unknown error';

          // Handle known non-critical errors more gracefully
          if (errorMessage.includes('Cannot update a conversation\'s voice if assistant audio is present')) {
            console.warn('⚠️ Voice update skipped - assistant is speaking:', errorMessage);
            // Don't treat this as a critical error, just log it
            this.updateConversationState({ state: 'speaking', message: 'Voice update deferred' });
          } else if (errorMessage.includes('Cancellation failed: no active response found')) {
            console.warn('⚠️ Cancellation attempted on already-completed response:', errorMessage);
            // This happens when we try to interrupt a response that just finished - it's harmless
            // Don't treat as error, conversation is already in correct state
          } else if (errorMessage.includes('Conversation already has an active response in progress')) {
            console.warn('⚠️ Response creation skipped - response already in progress:', errorMessage);
            // This is handled by the queue system, so just log it as a warning
            // The response will be queued and processed when the current one completes
            this.updateConversationState({ state: 'speaking', message: 'Response queued' });
          } else {
            console.error('❌ Realtime API error:', errorMessage);
            this.updateConversationState({ state: 'error', message: errorMessage });
            if (this.onErrorCallback) {
              this.onErrorCallback(new Error(errorMessage));
            }
          }
          break;

        // Rate limits monitoring
        case 'rate_limits.updated':
          console.log('📊 Rate limits updated:', realtimeEvent.rate_limits);
          break;

        // Audio buffer events
        case 'output_audio_buffer.stopped':
          console.log('🔇 Audio output buffer stopped - Setting isAISpeaking to false NOW');
          // Set isAISpeaking to false when audio actually stops playing (not when response generation completes)
          this.speechDetectionState.isAISpeaking = false;
          this.emitSpeechDetection();
          // This is a normal event when audio playback completes
          break;

        // Function calling events
        case 'response.function_call_arguments.delta':
          // Function arguments streaming (accumulate if needed)
          console.log('🔧 Function call argument delta:', realtimeEvent);
          break;

        case 'response.function_call_arguments.done':
          console.log('🔧 Function call arguments complete:', realtimeEvent);
          // Extract function name and arguments
          if (realtimeEvent.name && this.onFunctionCallCallback) {
            const functionName = realtimeEvent.name;
            const args = realtimeEvent.arguments ? JSON.parse(realtimeEvent.arguments) : {};
            console.log(`🎯 Executing function: ${functionName}`, args);

            // Execute the function asynchronously
            this.onFunctionCallCallback(functionName, args)
              .then((result) => {
                console.log(`✅ Function ${functionName} completed:`, result);
                // Send function result back to the API
                this.sendFunctionResult(realtimeEvent.call_id, result);
              })
              .catch((error) => {
                console.error(`❌ Function ${functionName} failed:`, error);
                // Send error back to the API
                this.sendFunctionError(realtimeEvent.call_id, error.message);
              });
          }
          break;

        // REMOVED: Legacy 'transcript' event handling - deprecated, use onMessage instead

        case 'response':
          const realtimeMessage: RealtimeMessage = {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: realtimeEvent.text || '',
            timestamp: new Date().toISOString()
          };

          this.messageHistory.push(realtimeMessage);

          if (this.onMessageCallback) {
            this.onMessageCallback(realtimeMessage);
          }
          break;

        default:
          // These are informational events that don't require specific handling
          // Uncomment for debugging: console.log('📨 Unhandled event type:', realtimeEvent.type);
          break;
      }
    } catch (error) {
      console.error('Failed to parse data channel message:', error);
      this.updateConversationState({ state: 'error', message: 'Failed to parse server message' });
    }
  }

  /**
   * Update conversation state and notify listeners
   */
  private updateConversationState(newState: ConversationState): void {
    if (this.onConversationStateCallback) {
      this.onConversationStateCallback(newState);
    }
  }

  /**
   * Emit speech detection state to listeners
   */
  private emitSpeechDetection(): void {
    if (this.onSpeechDetectionCallback) {
      this.onSpeechDetectionCallback({ ...this.speechDetectionState });
    }
  }

  /**
   * Send text message through data channel
   */
  async sendTextMessage(text: string): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel is not open');
    }

    const message = {
      type: 'message',
      text,
      timestamp: new Date().toISOString()
    };

    this.dataChannel.send(JSON.stringify(message));

    // Add to message history
    const userMessage: RealtimeMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };

    this.messageHistory.push(userMessage);

    if (this.onMessageCallback) {
      this.onMessageCallback(userMessage);
    }
  }

  /**
   * Wait for data channel to be ready
   * Polls the data channel status with timeout
   */
  private async waitForDataChannelReady(timeoutMs: number = parseInt(import.meta.env.VITE_REALTIME_DATA_CHANNEL_TIMEOUT_MS || '5000', 10)): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        return;
      }
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Data channel did not open within ${timeoutMs}ms`);
  }

  /**
   * Speak an assistant message
   * Adds the message to conversation and triggers AI to speak it with audio output
   * Waits for data channel to be ready before attempting to speak
   */
  async speakAssistantMessage(text: string): Promise<void> {
    // Wait for data channel to be ready (with 5 second timeout)
    await this.waitForDataChannelReady(5000);

    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel is not open');
    }

    try {
      // Add assistant message to conversation
      const greetingEvent = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: text
            }
          ]
        }
      };

      this.dataChannel.send(JSON.stringify(greetingEvent));
      console.log('📤 Sent assistant message to conversation');

      // Trigger AI to speak it using safe method
      this.safeCreateResponse({
        modalities: ['text', 'audio'],
        instructions: `Speak this exact message naturally and warmly: "${text}"`
      });
      console.log('🎤 Triggered AI to speak the message');

    } catch (error) {
      console.error('Failed to speak assistant message:', error);
      throw error;
    }
  }

  /**
   * Send initial greeting after data channel is ready
   * Waits for data channel to open, then sends a system message to trigger AI greeting
   */
  async sendInitialGreeting(instructions: string): Promise<void> {
    // Wait for data channel to be open
    const waitForDataChannel = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (this.dataChannel?.readyState === 'open') {
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for data channel to open'));
        }, 10000); // 10 second timeout

        const checkInterval = setInterval(() => {
          if (this.dataChannel?.readyState === 'open') {
            clearTimeout(timeout);
            clearInterval(checkInterval);
            resolve();
          }
        }, 100); // Check every 100ms
      });
    };

    try {
      // Wait for data channel to be ready
      await waitForDataChannel();
      console.log('✅ Data channel is ready for initial greeting');

      // Wait to ensure session setup is complete (configurable via env)
      const sessionDelay = parseInt(import.meta.env.VITE_INITIAL_GREETING_SESSION_DELAY_MS || '1500', 10);
      await new Promise(resolve => setTimeout(resolve, sessionDelay));

      // Send system message to trigger greeting
      const systemMessageEvent = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: instructions
            }
          ]
        }
      };

      this.dataChannel!.send(JSON.stringify(systemMessageEvent));
      console.log('📤 Sent system message for initial greeting');

      // Wait before triggering response (configurable via env)
      const responseDelay = parseInt(import.meta.env.VITE_INITIAL_GREETING_RESPONSE_DELAY_MS || '300', 10);
      await new Promise(resolve => setTimeout(resolve, responseDelay));

      // Use safeCreateResponse to properly handle response state
      console.log('🎤 Triggering AI response for greeting via safeCreateResponse');
      this.safeCreateResponse({
        modalities: ['text', 'audio']
      });

    } catch (error) {
      console.error('Failed to send initial greeting:', error);
      throw error;
    }
  }

  /**
   * Interrupt current AI response
   * Cancels ongoing response and clears output audio buffer
   */
  async interruptResponse(): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel is not open');
    }

    try {
      // Send response.cancel event
      const cancelEvent = {
        type: 'response.cancel'
      };

      this.dataChannel.send(JSON.stringify(cancelEvent));
      console.log('📤 Sent response.cancel event');

      // For WebRTC, also clear output audio buffer
      const clearAudioEvent = {
        type: 'output_audio_buffer.clear'
      };

      this.dataChannel.send(JSON.stringify(clearAudioEvent));
      console.log('📤 Sent output_audio_buffer.clear event');

      // Update local state
      this.speechDetectionState.isAISpeaking = false;
      this.currentTranscriptBuffer = '';
      this.updateConversationState({ state: 'idle', message: 'Response interrupted' });
      this.emitSpeechDetection();

    } catch (error) {
      console.error('❌ Failed to interrupt response:', error);
      throw error;
    }
  }

  /**
   * Change microphone device
   */
  async changeMicrophone(deviceId: string): Promise<void> {
    try {
      // Stop current stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
      }

      // Get new stream with selected device (with WebRTC AEC3)
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: { exact: deviceId },
          // WebRTC AEC3 (Acoustic Echo Cancellation v3)
          echoCancellation: { ideal: true, exact: true },
          noiseSuppression: { ideal: true, exact: true },
          autoGainControl: { ideal: true, exact: true },
          sampleRate: { ideal: 24000 },
          channelCount: { ideal: 1, max: 1 },
          latency: { ideal: 0.01, max: 0.02 },

          // Chrome/Edge WebRTC AEC3 specific
          googEchoCancellation: true,
          googEchoCancellation2: true,
          googDAEchoCancellation: true, // AEC3
          googExperimentalEchoCancellation: true,
          googAutoGainControl: true,
          googAutoGainControl2: true,
          googExperimentalAutoGainControl: true,
          googNoiseSuppression: true,
          googNoiseSuppression2: true,
          googExperimentalNoiseSuppression: true,
          googHighpassFilter: true,
          googTypingNoiseDetection: true,
          googAudioMirroring: false,
          googBeamforming: true,
          googArrayGeometry: true,
        } as MediaTrackConstraints
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Update peer connection tracks
      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'audio');
        if (sender && this.localStream) {
          const audioTrack = this.localStream.getAudioTracks()[0];
          await sender.replaceTrack(audioTrack);
          console.log('🎤 Microphone changed successfully');
        }
      }

      // Voice activity detection (Azure server-side only now)
      await this.setupVoiceActivityDetection();
    } catch (error) {
      console.error('Failed to change microphone:', error);
      throw error;
    }
  }

  /**
   * Pause session (mute microphone)
   */
  pauseSession(): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
      console.log('⏸️ Session paused');
      this.emitStatusChange();
    }
  }

  /**
   * Resume session (unmute microphone)
   */
  resumeSession(): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = true;
      });
      console.log('▶️ Session resumed');
      this.emitStatusChange();
    }
  }

  /**
   * End session and cleanup
   */
  async endSession(): Promise<void> {
    console.log('🛑 Ending session...');
    await this.cleanup();
    this.isSessionActive = false;
    this.sessionId = null;
    this.emitStatusChange();
    console.log('✅ Session ended');
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    // Reset connection flags
    this.isConnecting = false;
    this.isSessionActive = false;

    // Clear response state
    this.isResponseInProgress = false;
    this.pendingResponseQueue = [];

    // Cleanup independent handlers
    this.userInputHandler.cleanup();
    this.agentResponseHandler.cleanup();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close data channel
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop remote audio
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }

    // Clear reconnection timer
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }

    this.remoteStream = null;

    console.log('🧹 All resources cleaned up (including handlers)');
  }

  /**
   * Get session status
   */
  getStatus(): SessionStatus {
    let connectionQuality: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';

    if (this.peerConnection) {
      const state = this.peerConnection.connectionState;
      if (state === 'connected') connectionQuality = 'excellent';
      else if (state === 'connecting') connectionQuality = 'good';
      else if (state === 'new') connectionQuality = 'fair';
    }

    return {
      isConnected: this.isConnected,
      isSessionActive: this.isSessionActive,
      sessionId: this.sessionId,
      connectionQuality
    };
  }

  /**
   * Get message history
   */
  getMessageHistory(): RealtimeMessage[] {
    return [...this.messageHistory];
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Emit status change event
   */
  private emitStatusChange(): void {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(this.getStatus());
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
  }

  /**
   * Handle connection lost - attempt automatic reconnection
   */
  private async handleConnectionLost(): Promise<void> {
    // Prevent multiple simultaneous reconnection attempts
    if (this.isReconnecting) {
      console.log('🔄 Reconnection already in progress...');
      return;
    }

    // Check if we've exceeded max attempts
    if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
      console.error('❌ Max reconnection attempts reached. Please refresh the page.');
      if (this.onConnectionLostCallback) {
        this.onConnectionLostCallback(this.reconnectionAttempts, this.maxReconnectionAttempts);
      }
      return;
    }

    this.isReconnecting = true;
    this.reconnectionAttempts++;

    console.log(`🔄 Attempting to reconnect (${this.reconnectionAttempts}/${this.maxReconnectionAttempts})...`);

    // Notify UI about connection loss
    if (this.onConnectionLostCallback) {
      this.onConnectionLostCallback(this.reconnectionAttempts, this.maxReconnectionAttempts);
    }

    // Cleanup current connection
    await this.cleanup();

    // Wait before reconnecting (exponential backoff)
    const delay = this.reconnectionDelay * Math.pow(2, this.reconnectionAttempts - 1);
    console.log(`⏳ Waiting ${delay}ms before reconnection...`);

    this.reconnectionTimer = setTimeout(async () => {
      try {
        if (!this.lastConfig || !this.sessionId) {
          throw new Error('Cannot reconnect: missing session configuration');
        }

        console.log('🔄 Reconnecting...');

        // Extract userId from sessionId (format: session-{userId}-{timestamp})
        const userId = this.sessionId.split('-')[1] || 'user';

        // Restart session with saved config
        await this.startSession(userId, this.lastConfig);

        console.log('✅ Reconnection successful');
        this.isReconnecting = false;

      } catch (error) {
        console.error('❌ Reconnection failed:', error);
        this.isReconnecting = false;

        // Try again if we haven't exceeded max attempts
        if (this.reconnectionAttempts < this.maxReconnectionAttempts) {
          await this.handleConnectionLost();
        }
      }
    }, delay);
  }

  /**
   * Mute or unmute the user's microphone
   * Used for preventing echo during agent speech
   */
  muteMicrophone(mute: boolean): void {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !mute;
      });
      console.log(mute ? '🔇 Microphone muted' : '🔊 Microphone unmuted', `(${audioTracks.length} tracks)`);
    } else {
      console.warn('⚠️ Cannot mute microphone - localStream not initialized yet');
    }
  }

  /**
   * Get the current media stream (for external mic control)
   */
  getMediaStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Check if microphone is currently muted
   */
  isMicrophoneMuted(): boolean {
    if (!this.localStream) return true;
    const audioTracks = this.localStream.getAudioTracks();
    return audioTracks.length === 0 || !audioTracks[0].enabled;
  }

  /**
   * Set audio output (speaker) muted/unmuted state
   */
  setAudioOutputMuted(muted: boolean): void {
    if (this.audioElement) {
      this.audioElement.muted = muted;
      console.log(muted ? '🔇 Audio output muted (speakers)' : '🔊 Audio output unmuted (speakers)');
    }
  }

  /**
   * Check if audio output is muted
   */
  isAudioOutputMuted(): boolean {
    return this.audioElement?.muted ?? false;
  }

  /**
   * Destroy service instance
   */
  async destroy(): Promise<void> {
    await this.cleanup();
    this.isConnected = false;

    // Clear all callbacks
    this.onMessageCallback = null;
    this.onStatusChangeCallback = null;
    this.onErrorCallback = null;
    // REMOVED: onTranscriptCallback - deprecated
    this.onLiveTranscriptCallback = null;
    this.onSpeechDetectionCallback = null;
    this.onConversationStateCallback = null;

    console.log('🗑️ Service destroyed');
  }
}

// Export singleton instance
export const azureOpenAIRealtimeService = new AzureOpenAIRealtimeService();
