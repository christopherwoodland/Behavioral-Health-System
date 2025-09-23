// Azure Voice Live API Service for Behavioral Health System
// Based on Azure AI Voice Live Python SDK patterns

import { EventEmitter } from 'events';
import { AudioDeviceService, AudioDevice } from './audioDeviceService';

// ===== Type Definitions =====

export interface AgentMessage {
  agentName: string;
  content: string;
  timestamp: string;
  confidence?: number;
  suggestedActions?: string[];
}

export interface SpeechAvatarConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  voice: string;
  instructions: string;
  agentPersonality?: {
    name: string;
    role: string;
    traits: string[];
  };
}

export interface AudioStreamConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  format: string;
}

export interface AvatarVisualConfig {
  avatarId?: string;
  customAvatar?: boolean;
  videoSize: { width: number; height: number };
  backgroundColor?: string;
}

export interface SpeechSessionEvent {
  type: 'session.created' | 'session.updated' | 'input_audio_buffer.speech_started' | 
        'input_audio_buffer.speech_stopped' | 'response.created' | 'response.audio.delta' | 
        'response.audio.done' | 'response.done' | 'error' | 'conversation.item.created';
  data?: unknown;
  timestamp: string;
}

export interface VoiceLiveConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  voice?: string;
  apiVersion?: string;
}

export interface SessionConfig {
  modalities?: ('text' | 'audio')[];
  instructions?: string;
  voice?: {
    name: string;
    type?: string;
  };
  input_audio_format?: string;
  output_audio_format?: string;
  input_audio_transcription?: {
    model: string;
  };
  turn_detection?: {
    type: string;
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  };
  max_response_output_tokens?: number;
  temperature?: number;
  tools?: any[];
}

export interface ResponseCreateParams {
  modalities?: ('text' | 'audio')[];
  instructions?: string;
  voice?: string;
  output_audio_format?: string;
  tools?: any[];
  tool_choice?: string;
  temperature?: number;
  max_output_tokens?: number;
}

export interface ConversationItem {
  id?: string;
  type: 'message' | 'function_call' | 'function_call_output';
  role?: 'user' | 'assistant' | 'system';
  content?: Array<{
    type: 'text' | 'audio';
    text?: string;
    audio?: string;
    transcript?: string;
  }>;
  call_id?: string;
  name?: string;
  arguments?: string;
  output?: string;
}

export interface ClientEvent {
  type: string;
  event_id?: string;
  [key: string]: any;
}

export interface ServerEvent {
  type: string;
  event_id?: string;
  session?: any;
  response?: any;
  item?: any;
  delta?: any;
  error?: any;
  [key: string]: any;
}

// ===== Resource Classes =====

export class SessionResource {
  constructor(private connection: VoiceLiveConnection) {}

  async update(session: SessionConfig, eventId?: string): Promise<void> {
    const event: ClientEvent = {
      type: 'session.update',
      session,
    };
    if (eventId) {
      event.event_id = eventId;
    }
    await this.connection.send(event);
  }
}

export class ResponseResource {
  constructor(private connection: VoiceLiveConnection) {}

  async create(
    response?: ResponseCreateParams,
    eventId?: string,
    additionalInstructions?: string
  ): Promise<void> {
    const event: ClientEvent = {
      type: 'response.create',
      response,
    };
    if (eventId) {
      event.event_id = eventId;
    }
    if (additionalInstructions) {
      event.additional_instructions = additionalInstructions;
    }
    await this.connection.send(event);
  }

  async cancel(responseId?: string, eventId?: string): Promise<void> {
    const event: ClientEvent = {
      type: 'response.cancel',
    };
    if (responseId) {
      event.response_id = responseId;
    }
    if (eventId) {
      event.event_id = eventId;
    }
    await this.connection.send(event);
  }
}

export class InputAudioBufferResource {
  constructor(private connection: VoiceLiveConnection) {}

  async append(audio: string, eventId?: string): Promise<void> {
    const event: ClientEvent = {
      type: 'input_audio_buffer.append',
      audio,
    };
    if (eventId) {
      event.event_id = eventId;
    }
    await this.connection.send(event);
  }

  async commit(eventId?: string): Promise<void> {
    const event: ClientEvent = {
      type: 'input_audio_buffer.commit',
    };
    if (eventId) {
      event.event_id = eventId;
    }
    await this.connection.send(event);
  }

  async clear(eventId?: string): Promise<void> {
    const event: ClientEvent = {
      type: 'input_audio_buffer.clear',
    };
    if (eventId) {
      event.event_id = eventId;
    }
    await this.connection.send(event);
  }
}

export class OutputAudioBufferResource {
  constructor(private connection: VoiceLiveConnection) {}

  async clear(eventId?: string): Promise<void> {
    const event: ClientEvent = {
      type: 'output_audio_buffer.clear',
    };
    if (eventId) {
      event.event_id = eventId;
    }
    await this.connection.send(event);
  }
}

export class ConversationItemResource {
  constructor(private connection: VoiceLiveConnection) {}

  async create(
    item: ConversationItem,
    previousItemId?: string,
    eventId?: string
  ): Promise<void> {
    const event: ClientEvent = {
      type: 'conversation.item.create',
      item,
    };
    if (previousItemId) {
      event.previous_item_id = previousItemId;
    }
    if (eventId) {
      event.event_id = eventId;
    }
    await this.connection.send(event);
  }

  async delete(itemId: string, eventId?: string): Promise<void> {
    const event: ClientEvent = {
      type: 'conversation.item.delete',
      item_id: itemId,
    };
    if (eventId) {
      event.event_id = eventId;
    }
    await this.connection.send(event);
  }

  async truncate(
    itemId: string,
    audioEndMs: number,
    contentIndex: number,
    eventId?: string
  ): Promise<void> {
    const event: ClientEvent = {
      type: 'conversation.item.truncate',
      item_id: itemId,
      audio_end_ms: audioEndMs,
      content_index: contentIndex,
    };
    if (eventId) {
      event.event_id = eventId;
    }
    await this.connection.send(event);
  }
}

export class ConversationResource {
  public readonly item: ConversationItemResource;

  constructor(connection: VoiceLiveConnection) {
    this.item = new ConversationItemResource(connection);
  }
}

// ===== Main Connection Class =====

export class VoiceLiveConnection extends EventEmitter {
  private websocket: WebSocket | null = null;
  private sessionId: string | null = null;
  private isConnected = false;
  private isSessionReady = false;
  private sessionReadyResolve: ((value: void) => void) | null = null;
  private currentAudioStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  public audioLevelCallback: ((levels: { average: number; peak: number; active: boolean }) => void) | null = null;

  // Resource interfaces
  public readonly session: SessionResource;
  public readonly response: ResponseResource;
  public readonly inputAudioBuffer: InputAudioBufferResource;
  public readonly outputAudioBuffer: OutputAudioBufferResource;
  public readonly conversation: ConversationResource;

  constructor(private config: VoiceLiveConfig) {
    super();
    
    // Initialize resources
    this.session = new SessionResource(this);
    this.response = new ResponseResource(this);
    this.inputAudioBuffer = new InputAudioBufferResource(this);
    this.outputAudioBuffer = new OutputAudioBufferResource(this);
    this.conversation = new ConversationResource(this);
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      throw new Error('Already connected');
    }

    try {
      const wsUrl = this.buildWebSocketUrl();
      console.log('🔗 Connecting to Azure Voice Live API:', wsUrl.toString());
      
      this.websocket = new WebSocket(wsUrl.toString());
      
      return new Promise((resolve, reject) => {
        if (!this.websocket) {
          reject(new Error('Failed to create WebSocket'));
          return;
        }

        this.websocket.onopen = () => {
          console.log('✅ WebSocket connected to Azure Voice Live API');
          this.isConnected = true;
          this.setupMessageHandlers();
          resolve();
        };

        this.websocket.onerror = (error) => {
          console.error('❌ WebSocket connection error:', error);
          this.isConnected = false;
          
          // Provide more specific error message for common Azure issues
          let errorMessage = 'WebSocket connection failed';
          if (this.websocket?.readyState === WebSocket.CLOSED) {
            errorMessage = 'Azure Voice Live API insufficient resources (service may be overloaded)';
          }
          
          reject(new Error(errorMessage));
        };

        this.websocket.onclose = (event) => {
          console.log(`🔗 WebSocket closed: ${event.code} - ${event.reason}`);
          
          // Provide more detailed information about close codes
          let closeReason = 'Unknown reason';
          switch (event.code) {
            case 1000:
              closeReason = 'Normal closure';
              break;
            case 1006:
              closeReason = 'Connection lost abnormally (likely insufficient resources or network issue)';
              break;
            case 1011:
              closeReason = 'Server error (insufficient resources)';
              break;
            case 1012:
              closeReason = 'Service restart';
              break;
            case 1013:
              closeReason = 'Try again later (service overloaded)';
              break;
            default:
              closeReason = `Close code ${event.code}: ${event.reason || 'No additional information'}`;
          }
          
          console.log(`📊 Close reason: ${closeReason}`);
          
          this.isConnected = false;
          this.isSessionReady = false;
          this.cleanup();
          this.emit('disconnected', { 
            code: event.code, 
            reason: event.reason || closeReason,
            wasClean: event.wasClean 
          });
        };
      });
    } catch (error) {
      throw new Error(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async waitForSessionReady(): Promise<void> {
    if (this.isSessionReady) {
      return;
    }
    
    return new Promise((resolve) => {
      this.sessionReadyResolve = resolve;
    });
  }

  private buildWebSocketUrl(): URL {
    const wsUrl = new URL(this.config.endpoint.replace('https://', 'wss://'));
    wsUrl.pathname = '/voice-live/realtime';
    wsUrl.searchParams.set('api-version', this.config.apiVersion || '2025-05-01-preview');
    wsUrl.searchParams.set('model', this.config.model);
    wsUrl.searchParams.set('api-key', this.config.apiKey);
    return wsUrl;
  }

  private setupMessageHandlers(): void {
    if (!this.websocket) return;

    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleServerEvent(data);
      } catch (error) {
        console.error('❌ Failed to parse WebSocket message:', error);
        this.emit('error', new Error('Failed to parse server message'));
      }
    };
  }

  private handleServerEvent(data: ServerEvent): void {
    console.log(`📨 Received event: ${data.type}`);
    
    switch (data.type) {
      case 'session.created':
      case 'session.updated':
        this.sessionId = data.session?.id || null;
        console.log(`✅ Session ready: ${this.sessionId}`);
        
        if (!this.isSessionReady) {
          this.isSessionReady = true;
          if (this.sessionReadyResolve) {
            this.sessionReadyResolve();
            this.sessionReadyResolve = null;
          }
        }
        this.emit('session.ready', data);
        break;

      case 'input_audio_buffer.speech_started':
        console.log('🎤 User started speaking');
        this.emit('speech.started');
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('🎤 User stopped speaking');
        this.emit('speech.stopped');
        break;

      case 'response.created':
        console.log('🤖 Agent response created');
        this.emit('response.created', data);
        break;

      case 'response.audio.delta':
        if (data.delta?.audio) {
          this.emit('audio.delta', data.delta.audio);
        }
        break;

      case 'response.audio.done':
        console.log('🔊 Audio response completed');
        this.emit('audio.done', data);
        break;

      case 'response.audio_transcript.done':
        console.log('📝 Audio transcript completed');
        this.emit('audio.transcript.done', data);
        break;

      case 'response.content_part.done':
        console.log('📄 Content part completed');
        this.emit('content.part.done', data);
        break;

      case 'response.output_item.done':
        console.log('📤 Output item completed');
        this.emit('output.item.done', data);
        break;

      case 'response.done':
        console.log('✅ Response completed');
        this.emit('response.done', data);
        break;

      case 'conversation.item.created':
        this.emit('item.created', data.item);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        console.log('📝 Input audio transcription completed');
        this.emit('input.transcription.completed', data);
        break;

      case 'response.output_item.added':
        console.log('📤 Output item added');
        this.emit('output.item.added', data);
        break;

      case 'response.content_part.added':
        console.log('📄 Content part added');
        this.emit('content.part.added', data);
        break;

      case 'response.audio_transcript.delta':
        console.log('📝 Audio transcript delta');
        this.emit('audio.transcript.delta', data);
        break;

      case 'error':
        console.error('❌ Server error:', data.error);
        // If it's a protocol error, it might indicate we're sending data too early
        if (data.error?.type === 'invalid_request_error') {
          console.error('🚨 Protocol error - possibly sending data before session ready:', data.error.message);
          // Stop audio capture if it's a protocol error related to audio
          if (data.error.message?.includes('input_audio_buffer')) {
            console.log('🛑 Stopping audio capture due to protocol error');
            this.stopAudioCapture().catch(err => console.error('Failed to stop audio:', err));
          }
        }
        this.emit('error', new Error(data.error?.message || 'Server error'));
        break;

      default:
        console.log(`📨 Unhandled event type: ${data.type}`);
        this.emit('event', data);
        break;
    }

    // Emit all events generically too
    this.emit('server.event', data);
  }

  async send(event: ClientEvent): Promise<void> {
    if (!this.websocket || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    try {
      const data = JSON.stringify(event);
      this.websocket.send(data);
      console.log(`📤 Sent event: ${event.type}`);
    } catch (error) {
      console.error('❌ Failed to send event:', error);
      throw new Error(`Failed to send event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async startAudioCapture(): Promise<void> {
    try {
      // Request microphone permission and start capturing
      this.currentAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create Web Audio API context for proper PCM16 processing
      this.audioContext = new AudioContext({ sampleRate: 24000 });
      
      // Load the AudioWorklet processor
      await this.audioContext.audioWorklet.addModule('/audio-worklet-processor.js');
      
      const source = this.audioContext.createMediaStreamSource(this.currentAudioStream);
      
      // Create AudioWorkletNode to replace deprecated ScriptProcessorNode
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-input-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers'
      });
      
      // Handle messages from the AudioWorklet processor
      this.audioWorkletNode.port.onmessage = (event) => {
        const { type, audioBuffer, samples, average, peak, active } = event.data;
        
        if (type === 'audioLevel') {
          // Log audio input test data
          console.log(`🎤 Audio Input Test - Samples: ${samples}, Average: ${(average * 100).toFixed(2)}%, Peak: ${(peak * 100).toFixed(2)}%, Active: ${active ? 'YES' : 'NO'}`);
        } else if (type === 'audioData') {
          // Process the audio data
          this.processAudioChunk(audioBuffer).catch(error => {
            console.error('❌ Failed to process audio chunk:', error);
          });
        }
      };
      
      // Connect the audio processing chain
      source.connect(this.audioWorkletNode);

      console.log('🎤 Audio capture started with AudioWorkletNode (replacing deprecated ScriptProcessorNode)');
      this.emit('audio.capture.started');

    } catch (error) {
      console.error('❌ Failed to start audio capture:', error);
      throw new Error('Microphone access required for voice interaction');
    }
  }

  private async processAudioChunk(audioData: Blob | ArrayBuffer): Promise<void> {
    try {
      console.log('🎤 Processing audio chunk - Sending to Azure');

      let arrayBuffer: ArrayBuffer;
      if (audioData instanceof Blob) {
        arrayBuffer = await audioData.arrayBuffer();
      } else {
        arrayBuffer = audioData;
      }

      // Ensure even byte length for PCM16 format
      if (arrayBuffer.byteLength % 2 !== 0) {
        console.warn('⚠️ Odd byte length detected, padding audio chunk');
        const originalData = new Uint8Array(arrayBuffer);
        const paddedData = new Uint8Array(arrayBuffer.byteLength + 1);
        paddedData.set(originalData);
        paddedData[originalData.length] = 0; // Add padding byte
        arrayBuffer = paddedData.buffer;
      }

      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      await this.inputAudioBuffer.append(base64Audio);
    } catch (error) {
      console.error('❌ Failed to process audio chunk:', error);
      // If we fail to send audio, stop capturing to prevent flood of errors
      if (error instanceof Error && error.message.includes('WebSocket not connected')) {
        console.log('🛑 Stopping audio capture due to WebSocket disconnection');
        await this.stopAudioCapture();
      }
    }
  }

  async stopAudioCapture(): Promise<void> {
    // Clean up Web Audio API resources
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    // Clean up MediaRecorder (for backwards compatibility)
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    // Clean up MediaStream
    if (this.currentAudioStream) {
      this.currentAudioStream.getTracks().forEach(track => track.stop());
      this.currentAudioStream = null;
    }

    console.log('🛑 Audio capture stopped');
    this.emit('audio.capture.stopped');
  }

  async close(): Promise<void> {
    await this.stopAudioCapture();
    
    if (this.websocket && this.isConnected) {
      this.websocket.close(1000, 'Client disconnecting');
    }
    
    this.cleanup();
  }

  private cleanup(): void {
    this.isConnected = false;
    this.isSessionReady = false;
    this.sessionReadyResolve = null;
    this.sessionId = null;
    this.websocket = null;

    // Stop audio capture if active
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      console.log('🛑 Stopping MediaRecorder during cleanup');
      this.mediaRecorder.stop();
    }

    // Stop all audio tracks
    if (this.currentAudioStream) {
      console.log('🛑 Stopping audio stream during cleanup');
      this.currentAudioStream.getTracks().forEach(track => track.stop());
      this.currentAudioStream = null;
    }

    // Reset MediaRecorder
    this.mediaRecorder = null;

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  // Getters
  get connected(): boolean {
    return this.isConnected;
  }

  get sessionReady(): boolean {
    return this.isSessionReady;
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }
}

// ===== Factory Function =====

export async function createVoiceLiveConnection(config: VoiceLiveConfig): Promise<VoiceLiveConnection> {
  const maxRetries = 3;
  const baseDelay = 2000; // 2 seconds
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔗 Creating Voice Live connection (attempt ${attempt + 1}/${maxRetries + 1})...`);
      
      const connection = new VoiceLiveConnection(config);
      await connection.connect();
      await connection.waitForSessionReady();
      
      console.log('✅ Voice Live connection established successfully');
      return connection;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Connection attempt ${attempt + 1} failed:`, errorMessage);
      
      // Check if this is an "Insufficient resources" type error
      const isResourceError = errorMessage.toLowerCase().includes('insufficient') || 
                             errorMessage.toLowerCase().includes('overloaded') ||
                             errorMessage.toLowerCase().includes('connection failed');
      
      if (attempt < maxRetries && isResourceError) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        console.log(`⏳ Retrying in ${delay}ms due to resource constraints...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Either max retries reached or non-retryable error
        const finalError = new Error(
          attempt >= maxRetries 
            ? `Failed to connect after ${maxRetries + 1} attempts. Azure Voice Live API may be overloaded. Please try again later.`
            : `Connection failed: ${errorMessage}`
        );
        throw finalError;
      }
    }
  }
  
  // This should never be reached due to the throw above, but TypeScript requires it
  throw new Error('Unexpected error in connection retry logic');
}

// ===== High-Level Service Class =====

export class SpeechAvatarService {
  private connection: VoiceLiveConnection | null = null;
  private config: VoiceLiveConfig;
  private audioLevelCallback: ((levels: { average: number; peak: number; active: boolean }) => void) | null = null;

  constructor(config: VoiceLiveConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      console.log('🎭 Initializing Speech Avatar Service...');
      console.log('🔗 Attempting to connect to Azure Voice Live API...');
      
      // Create and connect with automatic retry logic
      this.connection = await createVoiceLiveConnection(this.config);
      
      // Set up audio level callback if one was previously registered
      if (this.audioLevelCallback) {
        this.connection.audioLevelCallback = this.audioLevelCallback;
      }
      
      // Configure session with behavioral health settings
      await this.configureSession();
      
      console.log('✅ Speech Avatar Service initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to initialize Speech Avatar Service:', errorMessage);
      
      // Provide user-friendly error message for common Azure issues
      if (errorMessage.includes('insufficient') || errorMessage.includes('overloaded')) {
        console.log('💡 Tip: Azure Voice Live API may be experiencing high demand. Try again in a few minutes.');
      }
      
      throw error;
    }
  }

  private async configureSession(): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not established');
    }

    const sessionConfig: SessionConfig = {
      modalities: ['text', 'audio'],
      instructions: this.getBehavioralHealthInstructions(),
      voice: {
        name: this.config.voice || 'en-US-AvaNeural',
        type: 'azure-standard',
      },
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: {
        model: 'whisper-1',
      },
      turn_detection: {
        type: 'azure_semantic_vad',
        threshold: 0.3,
        prefix_padding_ms: 200,
        silence_duration_ms: 500,
      },
      max_response_output_tokens: 4096,
      temperature: 0.7,
    };

    await this.connection.session.update(sessionConfig);
  }

  private getBehavioralHealthInstructions(): string {
    return `You are Dr. Sarah Chen, a compassionate and experienced Behavioral Health Support Specialist. 

Your role is to:
- Provide empathetic, non-judgmental support
- Use active listening techniques
- Ask thoughtful, open-ended questions
- Validate feelings and experiences
- Suggest coping strategies when appropriate
- Maintain professional boundaries
- Know when to recommend professional help

Communication style:
- Warm, calm, and reassuring tone
- Use "I" statements and reflective responses
- Avoid medical advice or diagnosis
- Keep responses concise but meaningful
- Show genuine care and understanding

Remember: You are a supportive companion, not a therapist. Always encourage seeking professional help for serious concerns.`;
  }

  onAudioLevel(callback: (levels: { average: number; peak: number; active: boolean }) => void): void {
    this.audioLevelCallback = callback;
    
    // If connection already exists, register the callback immediately
    if (this.connection) {
      this.connection.audioLevelCallback = callback;
    }
  }

  async checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt'> {
    const audioDeviceService = AudioDeviceService.getInstance();
    
    try {
      // Get current permission status
      const permissionStatus = await audioDeviceService.getPermissionStatus();
      
      if (permissionStatus === 'granted' || permissionStatus === 'denied') {
        return permissionStatus;
      }
      
      // Permission is 'prompt' - we can try to request it
      try {
        const result = await audioDeviceService.requestPermission();
        return result.granted ? 'granted' : 'denied';
      } catch (error) {
        console.error('❌ Failed to request microphone permission:', error);
        return 'denied';
      }
    } catch (error) {
      console.error('❌ Failed to check microphone permission:', error);
      return 'prompt';
    }
  }

  async getAvailableAudioDevices(): Promise<AudioDevice[]> {
    const audioDeviceService = AudioDeviceService.getInstance();
    return await audioDeviceService.getAvailableDevices();
  }

  getSelectedAudioDevice(): AudioDevice | null {
    const audioDeviceService = AudioDeviceService.getInstance();
    return audioDeviceService.getSelectedDevice();
  }

  async requestMicrophonePermission(): Promise<{ granted: boolean; error?: string }> {
    const audioDeviceService = AudioDeviceService.getInstance();
    return await audioDeviceService.requestPermission();
  }

  setAudioDevice(deviceId: string): void {
    const audioDeviceService = AudioDeviceService.getInstance();
    audioDeviceService.setSelectedDevice(deviceId);
  }

  async testAudioInput(durationMs: number = 10000): Promise<boolean> {
    const audioDeviceService = AudioDeviceService.getInstance();
    return await audioDeviceService.testAudioInput(durationMs, true);
  }

  async startSession(): Promise<void> {
    console.log('🚀 startSession called, checking connection state...');
    console.log('🔍 Service state:', {
      hasConnection: this.connection ? 'yes' : 'no',
      serviceIsConnected: this.isConnected,
      serviceIsSessionReady: this.isSessionReady,
      connectionConnected: this.connection?.connected || 'unknown'
    });
    
    if (!this.connection) {
      console.log('🔄 Connection is null, reinitializing...');
      // Reinitialize the connection
      this.connection = await createVoiceLiveConnection(this.config);
      await this.configureSession();
      console.log('✅ Connection reinitialized successfully');
    }

    if (!this.connection.connected) {
      console.log('🔄 Connection lost, attempting to reconnect...');
      await this.connection.connect();
    }

    // Wait for session to be properly ready before starting audio
    console.log('⏳ Waiting for session to be ready...');
    await this.connection.waitForSessionReady();
    console.log('✅ Session is ready, starting audio capture...');

    console.log('🔍 Final connection state: Audio capture should now be active');

    await this.connection.startAudioCapture();
    console.log('🎭 Speech Avatar session started');
  }

  async endSession(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
    console.log('🛑 Speech Avatar session ended');
  }

  // High-level event handlers for component compatibility
  onAgentMessage(callback: (message: AgentMessage) => void): void {
    this.connection?.on('response.audio.done', (event: ServerEvent) => {
      const message: AgentMessage = {
        agentName: 'Speech Avatar',
        content: event.response?.content || '',
        timestamp: new Date().toISOString(),
        confidence: 0.95,
        suggestedActions: []
      };
      callback(message);
    });
  }

  onUserSpeech(callback: (isActive: boolean) => void): void {
    this.connection?.on('input_audio_buffer.speech_started', () => {
      callback(true);
    });
    this.connection?.on('input_audio_buffer.speech_stopped', () => {
      callback(false);
    });
  }

  onError(callback: (error: string) => void): void {
    this.connection?.on('error', (event: ServerEvent) => {
      callback(event.error?.message || 'Unknown error');
    });
  }

  async stopSession(): Promise<void> {
    await this.endSession();
  }

  // Event delegation
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.connection?.on(event, listener);
  }

  off(event: string, listener: (...args: unknown[]) => void): void {
    this.connection?.off(event, listener);
  }

  // Resource access
  get session() {
    return this.connection?.session;
  }

  get response() {
    return this.connection?.response;
  }

  get conversation() {
    return this.connection?.conversation;
  }

  get inputAudioBuffer() {
    return this.connection?.inputAudioBuffer;
  }

  get outputAudioBuffer() {
    return this.connection?.outputAudioBuffer;
  }

  get isConnected(): boolean {
    return this.connection?.connected || false;
  }

  get isSessionReady(): boolean {
    return this.connection?.sessionReady || false;
  }
}

// ===== Default Export =====
export default SpeechAvatarService;