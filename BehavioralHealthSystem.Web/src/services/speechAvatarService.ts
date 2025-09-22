// Azure Speech Avatar Service for Behavioral Health System
// Implements Azure Speech Voice Live API for real-time agent interaction

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
  data?: any;
  timestamp: string;
}

export class SpeechAvatarService {
  private websocket: WebSocket | null = null;
  private sessionId: string | null = null;
  private isConnected: boolean = false;
  private isSessionReady: boolean = false;
  private sessionReadyResolve: ((value: void) => void) | null = null;
  private isRecording: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  
  private config: SpeechAvatarConfig;
  private audioConfig: AudioStreamConfig;
  
  private onMessageHandler?: (message: AgentMessage) => void;
  private onUserSpeechHandler?: (isActive: boolean) => void;
  private onErrorHandler?: (error: string) => void;

  constructor(config: SpeechAvatarConfig) {
    this.config = config;
    this.audioConfig = {
      sampleRate: 24000,
      channels: 1,
      bitDepth: 16,
      format: 'PCM16'
    };
    
    console.log('🎭 Speech Avatar Service initialized');
  }

  async initialize(): Promise<void> {
    try {
      console.log('🎭 Initializing Speech Avatar Service...');
      
      // Initialize audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Request microphone permissions
      await this.requestMicrophonePermission();
      
      console.log('✅ Speech Avatar Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Speech Avatar Service:', error);
      this.onErrorHandler?.(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async requestMicrophonePermission(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: this.audioConfig.sampleRate,
          channelCount: this.audioConfig.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Stop the stream for now - we'll create a new one when needed
      stream.getTracks().forEach(track => track.stop());
      
      console.log('✅ Microphone permission granted');
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      throw new Error('Microphone access is required for voice interaction');
    }
  }

  async startSession(agentInstructions?: string): Promise<void> {
    try {
      console.log('🎭 Starting Speech Avatar session...');
      
      if (this.isConnected) {
        console.log('⚠️ Session already active');
        return;
      }

      // Connect to Azure Speech Avatar WebSocket
      await this.connectToSpeechAvatar();
      
      // Wait for session to be ready before configuring
      await this.waitForSessionReady();
      
      // Configure session with behavioral health agent personality
      await this.configureSession(agentInstructions);
      
      // Start audio recording
      await this.startAudioRecording();
      
      console.log('✅ Speech Avatar session started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start Speech Avatar session:', error);
      this.onErrorHandler?.(`Session start failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async connectToSpeechAvatar(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL for Azure Speech Avatar Voice Live API
        const wsUrl = new URL(this.config.endpoint.replace('https://', 'wss://'));
        wsUrl.pathname = '/voice-live/realtime';
        wsUrl.searchParams.set('api-version', '2025-05-01-preview');
        wsUrl.searchParams.set('model', this.config.model);
        // Add API key for authentication (required for browser environments)
        wsUrl.searchParams.set('api-key', this.config.apiKey);
        
        console.log(`🔗 Connecting to Speech Avatar WebSocket: ${wsUrl.toString()}`);
        
        this.websocket = new WebSocket(wsUrl.toString());
        
        this.websocket.onopen = () => {
          console.log('🔗 WebSocket connected to Speech Avatar service');
          this.isConnected = true;
          resolve();
        };
        
        this.websocket.onmessage = (event) => {
          this.handleWebSocketMessage(event);
        };
        
        this.websocket.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.isConnected = false;
          reject(new Error('WebSocket connection failed'));
        };
        
        this.websocket.onclose = (event) => {
          console.log(`🔗 WebSocket closed: ${event.code} - ${event.reason}`);
          this.isConnected = false;
          this.cleanup();
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }

  private async waitForSessionReady(): Promise<void> {
    if (this.isSessionReady) {
      return;
    }
    
    return new Promise((resolve) => {
      this.sessionReadyResolve = resolve;
    });
  }

  private async configureSession(customInstructions?: string): Promise<void> {
    if (!this.websocket || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    const instructions = customInstructions || this.getBehavioralHealthInstructions();
    
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: instructions,
        voice: {
          name: this.config.voice,
          type: 'azure-standard'
        },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'azure_semantic_vad',
          threshold: 0.3,
          prefix_padding_ms: 200,
          silence_duration_ms: 500
        },
        tools: [],
        tool_choice: 'auto',
        temperature: 0.7,
        max_response_output_tokens: 4096
      },
      event_id: this.generateEventId()
    };

    this.sendWebSocketMessage(sessionConfig);
    console.log('📋 Session configuration sent');
  }

  private getBehavioralHealthInstructions(): string {
    const agentPersonality = this.config.agentPersonality;
    
    return `You are ${agentPersonality?.name || 'a compassionate behavioral health assistant'}, ${agentPersonality?.role || 'a specialized AI agent focused on mental health and wellness support'}.

Your core traits: ${agentPersonality?.traits?.join(', ') || 'empathetic, professional, supportive, and non-judgmental'}.

Guidelines:
- Speak naturally and conversationally, as if having a face-to-face conversation
- Use a warm, caring tone that makes users feel heard and understood  
- Keep responses concise but meaningful (2-3 sentences typically)
- Ask thoughtful follow-up questions to encourage deeper reflection
- Validate emotions and experiences without providing medical diagnosis
- If crisis indicators are detected, gently guide toward professional resources
- Use active listening techniques and reflect back what you hear
- Maintain appropriate boundaries while being genuinely supportive

Remember: You are providing emotional support and guidance, not medical treatment. Always encourage users to seek professional help when appropriate.

Respond as if you're sitting across from someone who needs to be heard and supported.`;
  }

  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      const speechEvent: SpeechSessionEvent = {
        type: data.type,
        data: data,
        timestamp: new Date().toISOString()
      };

      console.log(`📨 Received event: ${speechEvent.type}`);

      switch (speechEvent.type) {
        case 'session.created':
        case 'session.updated':
          this.sessionId = data.session?.id || null;
          console.log(`✅ Session ready: ${this.sessionId}`);
          
          // Mark session as ready and resolve waiting promise
          if (!this.isSessionReady) {
            this.isSessionReady = true;
            if (this.sessionReadyResolve) {
              this.sessionReadyResolve();
              this.sessionReadyResolve = null;
            }
          }
          break;

        case 'input_audio_buffer.speech_started':
          console.log('🎤 User started speaking');
          this.onUserSpeechHandler?.(true);
          break;

        case 'input_audio_buffer.speech_stopped':
          console.log('🎤 User stopped speaking');
          this.onUserSpeechHandler?.(false);
          break;

        case 'response.created':
          console.log('🤖 Agent response created');
          break;

        case 'response.audio.delta':
          // Handle streaming audio from agent
          this.handleAudioDelta(data.delta);
          break;

        case 'response.audio.done':
          console.log('🤖 Agent finished speaking');
          break;

        case 'response.done':
          console.log('✅ Response complete');
          break;

        case 'conversation.item.created':
          if (data.item?.type === 'message' && data.item?.role === 'assistant') {
            const message: AgentMessage = {
              agentName: this.config.agentPersonality?.name || 'Behavioral Health Assistant',
              content: data.item.content?.[0]?.text || '',
              timestamp: new Date().toISOString(),
              confidence: 0.9
            };
            this.onMessageHandler?.(message);
          }
          break;

        case 'error':
          console.error('❌ Speech Avatar error:', data.error);
          this.onErrorHandler?.(data.error?.message || 'Unknown error');
          break;

        default:
          console.log(`📋 Unhandled event type: ${speechEvent.type}`);
      }

    } catch (error) {
      console.error('❌ Error handling WebSocket message:', error);
    }
  }

  private handleAudioDelta(audioData: string): void {
    try {
      if (!audioData || !this.audioContext) return;

      // Decode base64 audio data
      const binaryString = atob(audioData);
      const audioBuffer = new ArrayBuffer(binaryString.length);
      const view = new Uint8Array(audioBuffer);
      
      for (let i = 0; i < binaryString.length; i++) {
        view[i] = binaryString.charCodeAt(i);
      }

      // Play audio using Web Audio API
      this.playAudioBuffer(audioBuffer);
      
    } catch (error) {
      console.error('❌ Error handling audio delta:', error);
    }
  }

  private async playAudioBuffer(audioBuffer: ArrayBuffer): Promise<void> {
    try {
      if (!this.audioContext) return;

      // Convert PCM16 data to AudioBuffer
      const audioDataBuffer = await this.audioContext.decodeAudioData(audioBuffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = audioDataBuffer;
      source.connect(this.audioContext.destination);
      source.start();
      
    } catch (error) {
      console.error('❌ Error playing audio:', error);
    }
  }

  private async startAudioRecording(): Promise<void> {
    try {
      if (this.isRecording) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.audioConfig.sampleRate,
          channelCount: this.audioConfig.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=pcm'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.sendAudioData(event.data);
        }
      };

      this.mediaRecorder.start(100); // Send data every 100ms
      this.isRecording = true;
      
      console.log('🎤 Audio recording started');
      
    } catch (error) {
      console.error('❌ Failed to start audio recording:', error);
      throw error;
    }
  }

  private async sendAudioData(audioBlob: Blob): Promise<void> {
    try {
      if (!this.websocket || !this.isConnected) return;

      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const audioMessage = {
        type: 'input_audio_buffer.append',
        audio: base64Audio,
        event_id: this.generateEventId()
      };

      this.sendWebSocketMessage(audioMessage);
      
    } catch (error) {
      console.error('❌ Error sending audio data:', error);
    }
  }

  private sendWebSocketMessage(message: any): void {
    if (this.websocket && this.isConnected) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async stopSession(): Promise<void> {
    try {
      console.log('🛑 Stopping Speech Avatar session...');
      
      this.isRecording = false;
      
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      
      if (this.websocket && this.isConnected) {
        this.websocket.close(1000, 'Session ended by user');
      }
      
      this.cleanup();
      
      console.log('✅ Speech Avatar session stopped');
      
    } catch (error) {
      console.error('❌ Error stopping session:', error);
    }
  }

  private cleanup(): void {
    this.isConnected = false;
    this.isSessionReady = false;
    this.sessionReadyResolve = null;
    this.isRecording = false;
    this.sessionId = null;
    
    if (this.mediaRecorder) {
      const stream = this.mediaRecorder.stream;
      stream.getTracks().forEach(track => track.stop());
      this.mediaRecorder = null;
    }
    
    if (this.websocket) {
      this.websocket = null;
    }
  }

  // Event handlers
  onAgentMessage(handler: (message: AgentMessage) => void): void {
    this.onMessageHandler = handler;
  }

  onUserSpeech(handler: (isActive: boolean) => void): void {
    this.onUserSpeechHandler = handler;
  }

  onError(handler: (error: string) => void): void {
    this.onErrorHandler = handler;
  }

  // Getters
  get connected(): boolean {
    return this.isConnected;
  }

  get recording(): boolean {
    return this.isRecording;
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }

  async sendTextMessage(message: string): Promise<void> {
    if (!this.websocket || !this.isConnected) {
      throw new Error('Speech Avatar session not active');
    }

    const textMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: message
          }
        ]
      },
      event_id: this.generateEventId()
    };

    this.sendWebSocketMessage(textMessage);
    
    // Trigger response generation
    const responseMessage = {
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        instructions: 'Please respond to the user message.'
      },
      event_id: this.generateEventId()
    };

    this.sendWebSocketMessage(responseMessage);
  }
}

// Factory function to create configured service
export function createBehavioralHealthSpeechAvatar(): SpeechAvatarService {
  const config: SpeechAvatarConfig = {
    endpoint: import.meta.env.VITE_AZURE_SPEECH_ENDPOINT || 'https://your-speech-resource.cognitiveservices.azure.com',
    apiKey: import.meta.env.VITE_AZURE_SPEECH_API_KEY || '',
    model: import.meta.env.VITE_AZURE_SPEECH_MODEL || 'gpt-4o-realtime-preview',
    voice: import.meta.env.VITE_AZURE_SPEECH_VOICE || 'en-US-AvaNeural',
    instructions: import.meta.env.VITE_AGENT_INSTRUCTIONS || '',
    agentPersonality: {
      name: import.meta.env.VITE_AGENT_NAME || 'Dr. Sarah Chen',
      role: import.meta.env.VITE_AGENT_ROLE || 'Behavioral Health Support Specialist',
      traits: ['empathetic', 'professional', 'supportive', 'non-judgmental', 'experienced']
    }
  };
  
  return new SpeechAvatarService(config);
}