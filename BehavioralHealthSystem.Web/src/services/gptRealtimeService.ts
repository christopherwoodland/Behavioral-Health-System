/**
 * Service for interfacing with Azure AI Foundry GPT-Realtime endpoint
 * Based on OpenAI Realtime API for streaming conversation with voice
 */

export interface RealtimeConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  model?: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  temperature?: number;
  maxTokens?: number;
}

export interface RealtimeMessage {
  type: 'conversation.item.create' | 'conversation.item.delete' | 'conversation.item.truncate' | 
        'input_audio_buffer.append' | 'input_audio_buffer.commit' | 'input_audio_buffer.clear' |
        'response.create' | 'response.cancel' | 'session.update';
  id?: string;
  item?: {
    id?: string;
    type: 'message' | 'function_call' | 'function_call_output';
    role?: 'user' | 'assistant' | 'system';
    content?: Array<{
      type: 'input_text' | 'input_audio' | 'text' | 'audio';
      text?: string;
      audio?: string; // base64 encoded
      transcript?: string;
    }>;
  };
  audio?: string; // base64 encoded audio data
  response?: {
    modalities?: ['text', 'audio'];
    instructions?: string;
    voice?: string;
    output_audio_format?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
    tools?: Array<{
      type: 'function';
      name: string;
      description: string;
      parameters: object;
    }>;
    tool_choice?: 'auto' | 'none' | 'required';
    temperature?: number;
    max_response_output_tokens?: number;
  };
  session?: {
    modalities?: ['text', 'audio'];
    instructions?: string;
    voice?: string;
    input_audio_format?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
    output_audio_format?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
    input_audio_transcription?: {
      model: 'whisper-1';
    };
    turn_detection?: {
      type: 'server_vad';
      threshold?: number;
      prefix_padding_ms?: number;
      silence_duration_ms?: number;
    };
    tools?: Array<{
      type: 'function';
      name: string;
      description: string;
      parameters: object;
    }>;
    tool_choice?: 'auto' | 'none' | 'required';
    temperature?: number;
    max_response_output_tokens?: number;
  };
}

export interface RealtimeEvent {
  type: string;
  event_id?: string;
  item?: any;
  audio?: string;
  transcript?: string;
  content?: any;
  response?: any;
  error?: {
    type: string;
    code: string;
    message: string;
    param?: string;
  };
}

export interface AgentHandoffTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: {
      target_agent: {
        type: 'string';
        enum: string[];
        description: string;
      };
      reason: {
        type: 'string';
        description: string;
      };
      context: {
        type: 'object';
        description: string;
      };
    };
    required: string[];
  };
}

export class GPTRealtimeService extends EventTarget {
  private ws: WebSocket | null = null;
  private config: RealtimeConfig;
  private isConnected = false;
  private audioBuffer: ArrayBuffer[] = [];
  private currentAgent = 'coordinator';
  private handoffTools: AgentHandoffTool[] = [];

  constructor(config: RealtimeConfig) {
    super();
    this.config = config;
    this.setupHandoffTools();
  }

  private setupHandoffTools() {
    this.handoffTools = [
      {
        name: 'handoff_to_phq2',
        description: 'Hand off conversation to PHQ-2 depression screening agent',
        parameters: {
          type: 'object',
          properties: {
            target_agent: {
              type: 'string',
              enum: ['phq2'],
              description: 'Target agent for handoff'
            },
            reason: {
              type: 'string',
              description: 'Reason for handoff to PHQ-2 agent'
            },
            context: {
              type: 'object',
              description: 'Context information to pass to PHQ-2 agent'
            }
          },
          required: ['target_agent', 'reason']
        }
      }
    ];
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    const wsUrl = this.buildWebSocketUrl();
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl, ['realtime']);
      
      this.ws.onopen = () => {
        console.log('Connected to GPT-Realtime');
        this.isConnected = true;
        this.initializeSession();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: RealtimeEvent = JSON.parse(event.data);
          this.handleRealtimeEvent(message);
        } catch (error) {
          console.error('Error parsing realtime message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Disconnected from GPT-Realtime');
        this.isConnected = false;
        this.dispatchEvent(new CustomEvent('disconnected'));
      };

      this.ws.onerror = (error) => {
        console.error('GPT-Realtime WebSocket error:', error);
        reject(error);
      };
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  private buildWebSocketUrl(): string {
    const url = new URL(this.config.endpoint);
    url.searchParams.set('api-version', '2024-10-01-preview');
    url.searchParams.set('deployment', this.config.deployment);
    
    // Convert https to wss for WebSocket
    url.protocol = url.protocol.replace('https:', 'wss:');
    
    return url.toString();
  }

  private initializeSession() {
    const sessionConfig: RealtimeMessage = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.getAgentInstructions(),
        voice: this.config.voice || 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200
        },
        tools: this.handoffTools.map(tool => ({
          type: 'function' as const,
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        })),
        tool_choice: 'auto',
        temperature: this.config.temperature || 0.8,
        max_response_output_tokens: this.config.maxTokens || 4096
      }
    };

    this.sendMessage(sessionConfig);
  }

  private getAgentInstructions(): string {
    switch (this.currentAgent) {
      case 'coordinator':
        return `You are Maestro, a behavioral health coordination assistant. You provide empathetic support and can hand off to specialized agents when needed.

When users mention depression screening, assessments, or show signs of needing mental health evaluation, use the handoff_to_phq2 function to transfer them to the PHQ-2 screening agent.

Keep responses warm, professional, and supportive. Listen actively and provide appropriate guidance.`;

      case 'phq2':
        return `You are a PHQ-2 depression screening agent. Your role is to conduct the Patient Health Questionnaire-2 (PHQ-2) assessment.

PHQ-2 Questions:
1. "Over the last 2 weeks, how often have you been bothered by little interest or pleasure in doing things?"
2. "Over the last 2 weeks, how often have you been bothered by feeling down, depressed, or hopeless?"

Response options for each question:
- Not at all (0 points)
- Several days (1 point)  
- More than half the days (2 points)
- Nearly every day (3 points)

Ask questions one at a time. Provide scoring at the end. A score of 3 or higher suggests further evaluation may be helpful.

Be gentle, professional, and non-judgmental throughout the assessment.`;

      default:
        return 'You are a helpful behavioral health assistant.';
    }
  }

  sendAudioData(audioData: ArrayBuffer) {
    if (!this.isConnected || !this.ws) {
      console.warn('Cannot send audio: not connected');
      return;
    }

    // Convert audio data to base64
    const base64Audio = this.arrayBufferToBase64(audioData);
    
    const message: RealtimeMessage = {
      type: 'input_audio_buffer.append',
      audio: base64Audio
    };

    this.sendMessage(message);
  }

  commitAudio() {
    if (!this.isConnected || !this.ws) {
      return;
    }

    const message: RealtimeMessage = {
      type: 'input_audio_buffer.commit'
    };

    this.sendMessage(message);
  }

  clearAudioBuffer() {
    if (!this.isConnected || !this.ws) {
      return;
    }

    const message: RealtimeMessage = {
      type: 'input_audio_buffer.clear'
    };

    this.sendMessage(message);
  }

  sendTextMessage(text: string) {
    if (!this.isConnected || !this.ws) {
      return;
    }

    const message: RealtimeMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: text
        }]
      }
    };

    this.sendMessage(message);
    this.createResponse();
  }

  private createResponse() {
    const message: RealtimeMessage = {
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        instructions: this.getAgentInstructions()
      }
    };

    this.sendMessage(message);
  }

  private sendMessage(message: RealtimeMessage) {
    if (this.ws && this.isConnected) {
      // Add API key to WebSocket headers isn't supported, so we need to handle auth differently
      const messageWithAuth = {
        ...message,
        // Include authorization in the message if required by Azure implementation
        authorization: `Bearer ${this.config.apiKey}`
      };
      
      this.ws.send(JSON.stringify(messageWithAuth));
    }
  }

  private handleRealtimeEvent(event: RealtimeEvent) {
    console.log('Realtime event:', event.type, event);

    switch (event.type) {
      case 'session.created':
        this.dispatchEvent(new CustomEvent('session_created', { detail: event }));
        break;

      case 'conversation.item.created':
        this.dispatchEvent(new CustomEvent('item_created', { detail: event }));
        break;

      case 'input_audio_buffer.speech_started':
        this.dispatchEvent(new CustomEvent('speech_started', { detail: event }));
        break;

      case 'input_audio_buffer.speech_stopped':
        this.dispatchEvent(new CustomEvent('speech_stopped', { detail: event }));
        break;

      case 'conversation.item.input_audio_transcription.completed':
        this.dispatchEvent(new CustomEvent('transcription_completed', { 
          detail: { 
            transcript: event.transcript,
            item_id: event.item?.id 
          } 
        }));
        break;

      case 'response.created':
        this.dispatchEvent(new CustomEvent('response_created', { detail: event }));
        break;

      case 'response.output_item.added':
        this.dispatchEvent(new CustomEvent('response_item_added', { detail: event }));
        break;

      case 'response.content_part.added':
        this.dispatchEvent(new CustomEvent('content_added', { detail: event }));
        break;

      case 'response.audio.delta':
        if (event.audio) {
          const audioData = this.base64ToArrayBuffer(event.audio);
          this.dispatchEvent(new CustomEvent('audio_delta', { 
            detail: { audioData } 
          }));
        }
        break;

      case 'response.audio_transcript.delta':
        this.dispatchEvent(new CustomEvent('transcript_delta', { 
          detail: { transcript: event.transcript } 
        }));
        break;

      case 'response.function_call_arguments.delta':
        this.dispatchEvent(new CustomEvent('function_call_delta', { detail: event }));
        break;

      case 'response.function_call_arguments.done':
        this.handleFunctionCall(event);
        break;

      case 'response.done':
        this.dispatchEvent(new CustomEvent('response_done', { detail: event }));
        break;

      case 'error':
        console.error('Realtime API error:', event.error);
        this.dispatchEvent(new CustomEvent('error', { detail: event.error }));
        break;

      default:
        console.log('Unhandled realtime event:', event.type);
    }
  }

  private handleFunctionCall(event: RealtimeEvent) {
    if (event.item?.name === 'handoff_to_phq2') {
      try {
        const args = JSON.parse(event.item.arguments || '{}');
        this.performAgentHandoff('phq2', args.reason, args.context);
      } catch (error) {
        console.error('Error parsing handoff arguments:', error);
      }
    }
  }

  private async performAgentHandoff(targetAgent: string, reason: string, context?: any) {
    console.log(`Performing handoff to ${targetAgent}:`, reason);
    
    this.currentAgent = targetAgent;
    
    // Update session with new agent instructions
    const sessionUpdate: RealtimeMessage = {
      type: 'session.update',
      session: {
        instructions: this.getAgentInstructions(),
        tools: targetAgent === 'phq2' ? [] : this.handoffTools.map(tool => ({
          type: 'function' as const,
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }))
      }
    };

    this.sendMessage(sessionUpdate);

    // Dispatch handoff event
    this.dispatchEvent(new CustomEvent('agent_handoff', { 
      detail: { 
        from: 'coordinator', 
        to: targetAgent, 
        reason, 
        context 
      } 
    }));

    // Send function call result
    const resultMessage: RealtimeMessage = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        content: [{
          type: 'text',
          text: `Successfully handed off to ${targetAgent} agent. Reason: ${reason}`
        }]
      }
    };

    this.sendMessage(resultMessage);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get agentName(): string {
    return this.currentAgent;
  }

  setAgent(agentName: string) {
    if (agentName !== this.currentAgent) {
      this.currentAgent = agentName;
      
      if (this.isConnected) {
        const sessionUpdate: RealtimeMessage = {
          type: 'session.update',
          session: {
            instructions: this.getAgentInstructions()
          }
        };
        this.sendMessage(sessionUpdate);
      }
    }
  }
}