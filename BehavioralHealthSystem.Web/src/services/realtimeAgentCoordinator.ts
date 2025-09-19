/**
 * Realtime Agent Coordinator ("Maestro")
 * Orchestrates interactions between GPT-Realtime and specialized agents
 * Handles session management, agent routing, and context preservation
 */

import { GPTRealtimeService, RealtimeConfig } from './gptRealtimeService';
import { WebRTCAudioService } from './webRTCAudioService';

export interface AgentHandoffContext {
  sessionId: string;
  currentAgent: string;
  targetAgent: string;
  handoffReason: string;
  conversationHistory: ConversationMessage[];
  userContext: UserContext;
  timestamp: number;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  agent?: string;
  audioData?: ArrayBuffer;
  transcription?: string;
}

export interface UserContext {
  userId?: string;
  sessionId: string;
  preferences: {
    language?: string;
    voiceSettings?: {
      speed: number;
      pitch: number;
      volume: number;
    };
  };
  medicalContext?: {
    previousAssessments?: any[];
    currentConcerns?: string[];
    riskFactors?: string[];
  };
}

export interface RealtimeAgentSession {
  sessionId: string;
  userId?: string;
  currentAgent: string;
  conversationHistory: ConversationMessage[];
  userContext: UserContext;
  isActive: boolean;
  startTime: number;
  lastActivity: number;
}

export class RealtimeAgentCoordinator extends EventTarget {
  private gptRealtimeService: GPTRealtimeService;
  private audioService: WebRTCAudioService;
  private currentSession: RealtimeAgentSession | null = null;
  private isInitialized = false;
  private availableAgents: Set<string> = new Set(['coordinator', 'phq2', 'comedian']);
  private agentInstructions: Map<string, string> = new Map();

  constructor() {
    super();
    this.audioService = new WebRTCAudioService();
    this.initializeAgentInstructions();
    
    // Will be initialized later with proper config
    this.gptRealtimeService = null as any;
  }

  private initializeAgentInstructions(): void {
    this.agentInstructions.set('coordinator', `
You are the Maestro, a compassionate coordinator for behavioral health services. Your role is to:
1. Welcome users and understand their needs
2. Provide general mental health support and information
3. Assess when specialized agents are needed
4. Hand off to appropriate specialists (PHQ-2 for depression screening, comedian for mood lifting)
5. Maintain conversation flow and context

Guidelines:
- Be warm, empathetic, and professional
- Ask open-ended questions to understand user needs
- Recognize when PHQ-2 screening might be helpful
- Use humor appropriately but defer to comedian agent for intentional comedy
- Always prioritize user safety and well-being
- If user expresses suicidal thoughts, provide crisis resources immediately

When to hand off:
- PHQ-2 Agent: User mentions depression, sadness, loss of interest, or requests mental health screening
- Comedian Agent: User specifically requests humor or seems to need mood lifting (ask first)
    `);

    this.agentInstructions.set('phq2', `
You are a specialized agent for conducting PHQ-2 depression screenings through voice interaction.

PHQ-2 Questions:
1. "Over the last 2 weeks, how often have you been bothered by little interest or pleasure in doing things?"
2. "Over the last 2 weeks, how often have you been bothered by feeling down, depressed, or hopeless?"

Response options for each question:
- Not at all (0 points)
- Several days (1 point)  
- More than half the days (2 points)
- Nearly every day (3 points)

Protocol:
1. Explain the PHQ-2 screening process clearly
2. Ask questions one at a time, wait for complete responses
3. Clarify responses if unclear
4. Calculate total score (0-6)
5. Provide appropriate feedback based on score:
   - 0-2: Low risk, provide general wellness resources
   - 3+: Suggest further evaluation, provide mental health resources
6. Hand back to coordinator with results and recommendations

Be empathetic, non-judgmental, and professional throughout the screening.
    `);

    this.agentInstructions.set('comedian', `
You are a therapeutic comedian agent designed to provide appropriate humor and mood lifting for mental health contexts.

Guidelines:
- Use clean, uplifting humor
- Avoid sensitive topics (mental illness, trauma, etc.)
- Focus on wordplay, observational humor, and light-hearted stories
- Be responsive to user's mood and adjust humor accordingly
- Know when to be serious - mental health is important
- Always check if user wants to continue with humor
- Hand back to coordinator when humor session is complete

Remember: Your goal is therapeutic benefit through appropriate levity, not entertainment.
    `);
  }

  async initialize(config?: Partial<RealtimeConfig>): Promise<void> {
    try {
      // Initialize audio service
      await this.audioService.initialize();
      
      // Create GPT-Realtime service with proper config
      const realtimeConfig: RealtimeConfig = {
        endpoint: 'https://cdc-traci-aif-002.cognitiveservices.azure.com/openai/realtime?api-version=2024-10-01-preview&deployment=gpt-realtime',
        apiKey: config?.apiKey || '',
        deployment: 'gpt-realtime',
        model: 'gpt-realtime',
        voice: 'alloy',
        temperature: 0.7,
        ...config
      };
      
      this.gptRealtimeService = new GPTRealtimeService(realtimeConfig);
      
      // Connect to GPT-Realtime
      await this.gptRealtimeService.connect();

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      console.log('Realtime Agent Coordinator initialized');
      this.dispatchEvent(new CustomEvent('initialized'));

    } catch (error) {
      console.error('Failed to initialize Realtime Agent Coordinator:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Audio service events
    this.audioService.addEventListener('audio_data', (event: any) => {
      if (this.currentSession) {
        this.handleAudioInput(event.detail.audioData);
      }
    });

    this.audioService.addEventListener('stream_started', () => {
      console.log('Audio streaming started');
      this.dispatchEvent(new CustomEvent('audio_stream_started'));
    });

    this.audioService.addEventListener('stream_stopped', () => {
      console.log('Audio streaming stopped');
      this.dispatchEvent(new CustomEvent('audio_stream_stopped'));
    });

    // GPT-Realtime events
    this.gptRealtimeService.addEventListener('session_created', (event: any) => {
      console.log('GPT-Realtime session created:', event.detail);
    });

    this.gptRealtimeService.addEventListener('audio_received', (event: any) => {
      this.handleAudioOutput(event.detail.audioData);
    });

    this.gptRealtimeService.addEventListener('conversation_item_completed', (event: any) => {
      this.handleConversationItem(event.detail);
    });

    this.gptRealtimeService.addEventListener('agent_handoff_requested', (event: any) => {
      this.handleAgentHandoff(event.detail);
    });

    this.gptRealtimeService.addEventListener('error', (event: any) => {
      console.error('GPT-Realtime error:', event.detail.error);
      this.dispatchEvent(new CustomEvent('error', { detail: event.detail }));
    });
  }

  async startSession(userId?: string, initialAgent: string = 'coordinator'): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Coordinator not initialized');
    }

    const sessionId = this.generateSessionId();
    
    this.currentSession = {
      sessionId,
      userId,
      currentAgent: initialAgent,
      conversationHistory: [],
      userContext: {
        sessionId,
        preferences: {
          voiceSettings: {
            speed: 1.0,
            pitch: 1.0,
            volume: 1.0
          }
        }
      },
      isActive: true,
      startTime: Date.now(),
      lastActivity: Date.now()
    };

    // Configure GPT-Realtime with initial agent instructions
    await this.switchToAgent(initialAgent);

    // Start audio streaming
    await this.audioService.startStreaming();

    console.log('Session started:', sessionId);
    this.dispatchEvent(new CustomEvent('session_started', { 
      detail: { sessionId, initialAgent } 
    }));

    return sessionId;
  }

  async switchToAgent(agentName: string, handoffContext?: AgentHandoffContext): Promise<void> {
    if (!this.availableAgents.has(agentName)) {
      throw new Error(`Unknown agent: ${agentName}`);
    }

    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const previousAgent = this.currentSession.currentAgent;
    this.currentSession.currentAgent = agentName;
    this.currentSession.lastActivity = Date.now();

    // Get agent instructions
    const instructions = this.agentInstructions.get(agentName);
    if (!instructions) {
      throw new Error(`No instructions found for agent: ${agentName}`);
    }

    // Update GPT-Realtime session with new agent instructions
    // Note: Will need to implement session update method or recreate session
    console.log(`Switching to ${agentName} with instructions:`, instructions);

    // Add handoff context if provided
    if (handoffContext) {
      const handoffMessage: ConversationMessage = {
        id: this.generateMessageId(),
        role: 'system',
        content: `Agent handoff from ${previousAgent} to ${agentName}. Reason: ${handoffContext.handoffReason}`,
        timestamp: Date.now(),
        agent: agentName
      };
      this.currentSession.conversationHistory.push(handoffMessage);
    }

    console.log(`Switched to agent: ${agentName}`);
    this.dispatchEvent(new CustomEvent('agent_switched', { 
      detail: { previousAgent, currentAgent: agentName, handoffContext } 
    }));
  }

  private async handleAudioInput(audioData: ArrayBuffer): Promise<void> {
    if (!this.currentSession) return;

    try {
      // Send audio to GPT-Realtime using correct method name
      this.gptRealtimeService.sendAudioData(audioData);
      
      // Update last activity
      this.currentSession.lastActivity = Date.now();

    } catch (error) {
      console.error('Error handling audio input:', error);
    }
  }

  private async handleAudioOutput(audioData: ArrayBuffer): Promise<void> {
    try {
      // Play audio through WebRTC service
      await this.audioService.playAudio(audioData);
      
    } catch (error) {
      console.error('Error handling audio output:', error);
    }
  }

  private handleConversationItem(itemData: any): void {
    if (!this.currentSession) return;

    const message: ConversationMessage = {
      id: this.generateMessageId(),
      role: itemData.role,
      content: itemData.content || itemData.transcript || '',
      timestamp: Date.now(),
      agent: this.currentSession.currentAgent,
      audioData: itemData.audioData,
      transcription: itemData.transcript
    };

    this.currentSession.conversationHistory.push(message);
    this.currentSession.lastActivity = Date.now();

    this.dispatchEvent(new CustomEvent('conversation_updated', { 
      detail: { message, session: this.currentSession } 
    }));
  }

  private async handleAgentHandoff(handoffData: any): Promise<void> {
    if (!this.currentSession) return;

    const { targetAgent, reason } = handoffData;

    if (!this.availableAgents.has(targetAgent)) {
      console.warn(`Requested handoff to unknown agent: ${targetAgent}`);
      return;
    }

    const handoffContext: AgentHandoffContext = {
      sessionId: this.currentSession.sessionId,
      currentAgent: this.currentSession.currentAgent,
      targetAgent,
      handoffReason: reason,
      conversationHistory: [...this.currentSession.conversationHistory],
      userContext: { ...this.currentSession.userContext },
      timestamp: Date.now()
    };

    await this.switchToAgent(targetAgent, handoffContext);
  }

  async endSession(): Promise<void> {
    if (!this.currentSession) return;

    const sessionId = this.currentSession.sessionId;
    
    // Stop audio streaming
    this.audioService.stopStreaming();
    
    // Close GPT-Realtime session
    await this.gptRealtimeService.disconnect();
    
    // Mark session as inactive
    this.currentSession.isActive = false;
    
    console.log('Session ended:', sessionId);
    this.dispatchEvent(new CustomEvent('session_ended', { 
      detail: { sessionId, session: this.currentSession } 
    }));

    this.currentSession = null;
  }

  pauseSession(): void {
    if (this.currentSession) {
      this.audioService.stopStreaming();
      this.dispatchEvent(new CustomEvent('session_paused'));
    }
  }

  async resumeSession(): Promise<void> {
    if (this.currentSession) {
      await this.audioService.startStreaming();
      this.dispatchEvent(new CustomEvent('session_resumed'));
    }
  }

  getCurrentSession(): RealtimeAgentSession | null {
    return this.currentSession;
  }

  getConversationHistory(): ConversationMessage[] {
    return this.currentSession?.conversationHistory || [];
  }

  updateUserContext(context: Partial<UserContext>): void {
    if (this.currentSession) {
      this.currentSession.userContext = {
        ...this.currentSession.userContext,
        ...context
      };
      this.currentSession.lastActivity = Date.now();
    }
  }

  getAvailableAgents(): string[] {
    return Array.from(this.availableAgents);
  }

  async manualHandoff(targetAgent: string, reason: string = 'Manual handoff'): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const handoffData = {
      targetAgent,
      reason
    };

    await this.handleAgentHandoff(handoffData);
  }

  setVoiceSettings(settings: { speed?: number; pitch?: number; volume?: number }): void {
    if (this.currentSession) {
      const currentSettings = this.currentSession.userContext.preferences.voiceSettings || {
        speed: 1.0,
        pitch: 1.0,
        volume: 1.0
      };
      this.currentSession.userContext.preferences.voiceSettings = {
        speed: settings.speed ?? currentSettings.speed,
        pitch: settings.pitch ?? currentSettings.pitch,
        volume: settings.volume ?? currentSettings.volume
      };
    }
  }

  getVoiceActivityLevel(): number {
    return this.audioService.getVoiceActivityLevel();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  dispose(): void {
    this.endSession();
    this.audioService.dispose();
    if (this.gptRealtimeService) {
      this.gptRealtimeService.disconnect();
    }
    this.isInitialized = false;
    console.log('Realtime Agent Coordinator disposed');
  }

  get isSessionActive(): boolean {
    return this.currentSession?.isActive || false;
  }

  get currentAgent(): string | null {
    return this.currentSession?.currentAgent || null;
  }
}