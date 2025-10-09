/**
 * AgentResponseHandler - Manages agent voice responses, microphone muting, and agent transcription
 * Isolated handler for all agent-side audio processing
 */

import { LiveTranscript, SpeechDetectionState, RealtimeMessage } from '../azureOpenAIRealtimeService';

export class AgentResponseHandler {
  // Agent state
  private isAISpeaking: boolean = false;
  private responseStartTime: number | null = null;
  private responseEndTime: number | null = null;
  private micUnmuteTimeout: NodeJS.Timeout | null = null;
  
  // Message history
  private messageHistory: RealtimeMessage[] = [];
  
  // Callbacks
  private onLiveTranscriptCallback: ((transcript: LiveTranscript) => void) | null = null;
  private onMessageCallback: ((message: RealtimeMessage) => void) | null = null;
  private onSpeechDetectionCallback: ((state: SpeechDetectionState) => void) | null = null;
  private muteMicrophoneCallback: ((mute: boolean) => void) | null = null;

  /**
   * Handle response.created event - Agent is about to speak
   */
  handleResponseCreated(event: any): void {
    console.log('🤖 Response created - Agent about to speak');
    this.isAISpeaking = true;
    this.responseStartTime = Date.now();
    
    // CRITICAL: Mute microphone BEFORE agent starts speaking
    if (this.muteMicrophoneCallback) {
      this.muteMicrophoneCallback(true);
    }
    
    this.emitSpeechDetection();
  }

  /**
   * Handle response.audio_transcript.delta - Streaming agent text
   */
  handleAudioTranscriptDelta(event: any): void {
    if (event.delta) {
      const transcript: LiveTranscript = {
        id: `agent-transcript-partial-${Date.now()}`,
        text: event.delta,
        isPartial: true,
        role: 'assistant',
        timestamp: Date.now()
      };
      
      if (this.onLiveTranscriptCallback) {
        this.onLiveTranscriptCallback(transcript);
      }
    }
  }

  /**
   * Handle response.audio_transcript.done - Agent finished speaking
   */
  handleAudioTranscriptDone(event: any): void {
    if (event.transcript) {
      // Final AI transcript
      const finalTranscript: LiveTranscript = {
        id: `agent-transcript-final-${Date.now()}`,
        text: event.transcript,
        isPartial: false,
        role: 'assistant',
        timestamp: Date.now()
      };
      
      if (this.onLiveTranscriptCallback) {
        this.onLiveTranscriptCallback(finalTranscript);
      }
      
      // Add to message history as transcript
      const transcriptMessage: RealtimeMessage = {
        id: `ai-transcript-${Date.now()}`,
        role: 'assistant',
        content: event.transcript,
        timestamp: new Date().toISOString(),
        isTranscript: true,
        isPartial: false
      };
      
      this.messageHistory.push(transcriptMessage);
      
      if (this.onMessageCallback) {
        this.onMessageCallback(transcriptMessage);
      }
      
      // Agent's audio transcript is complete - unmute microphone after 1.5s delay
      console.log('🎤 Agent utterance complete - will unmute microphone in 1.5 seconds');
      this.scheduleUnmute(1500);
    }
  }

  /**
   * Handle response.done - Response generation complete
   */
  handleResponseDone(event: any): void {
    console.log('✅ Response completed');
    this.isAISpeaking = false;
    this.responseEndTime = Date.now();
    
    // Note: Microphone unmuting is handled in handleAudioTranscriptDone
    // after the agent's utterance is complete + 1.5s delay
    
    this.emitSpeechDetection();
  }

  /**
   * Handle response.cancelled - Response was interrupted
   */
  handleResponseCancelled(event: any): void {
    console.log('⚠️ Response cancelled (interrupted)');
    this.isAISpeaking = false;
    this.responseEndTime = Date.now();
    
    // Unmute immediately if response was cancelled
    if (this.muteMicrophoneCallback) {
      this.muteMicrophoneCallback(false);
    }
    
    // Clear any pending unmute timeout
    if (this.micUnmuteTimeout) {
      clearTimeout(this.micUnmuteTimeout);
      this.micUnmuteTimeout = null;
    }
    
    this.emitSpeechDetection();
  }

  /**
   * Schedule microphone unmute with delay
   */
  private scheduleUnmute(delayMs: number): void {
    // Clear any existing timeout
    if (this.micUnmuteTimeout) {
      clearTimeout(this.micUnmuteTimeout);
    }
    
    this.micUnmuteTimeout = setTimeout(() => {
      if (this.muteMicrophoneCallback) {
        this.muteMicrophoneCallback(false);
      }
      this.micUnmuteTimeout = null;
    }, delayMs);
  }

  /**
   * Handle response.content_part.added - New content part
   */
  handleContentPartAdded(event: any): void {
    if (event.part?.type === 'text') {
      // Text response content
      console.log('📝 Agent text content:', event.part.text);
    }
  }

  /**
   * Handle response.text.delta - Streaming text response
   */
  handleTextDelta(event: any): void {
    if (event.delta) {
      const transcript: LiveTranscript = {
        id: `agent-text-partial-${Date.now()}`,
        text: event.delta,
        isPartial: true,
        role: 'assistant',
        timestamp: Date.now()
      };
      
      if (this.onLiveTranscriptCallback) {
        this.onLiveTranscriptCallback(transcript);
      }
    }
  }

  /**
   * Handle response.text.done - Final text response
   */
  handleTextDone(event: any): void {
    if (event.text) {
      const message: RealtimeMessage = {
        id: `ai-text-${Date.now()}`,
        role: 'assistant',
        content: event.text,
        timestamp: new Date().toISOString(),
        isTranscript: false,
        isPartial: false
      };
      
      this.messageHistory.push(message);
      
      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    }
  }

  /**
   * Emit speech detection state changes
   */
  private emitSpeechDetection(): void {
    if (this.onSpeechDetectionCallback) {
      this.onSpeechDetectionCallback({
        isUserSpeaking: false, // Agent handler doesn't track user state
        isAISpeaking: this.isAISpeaking,
        speechStartedAt: this.responseStartTime || undefined,
        speechStoppedAt: this.responseEndTime || undefined
      });
    }
  }

  /**
   * Get current agent speaking state
   */
  isCurrentlySpeaking(): boolean {
    return this.isAISpeaking;
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
  clearMessageHistory(): void {
    this.messageHistory = [];
  }

  /**
   * Register callback for live transcripts
   */
  onLiveTranscript(callback: (transcript: LiveTranscript) => void): void {
    this.onLiveTranscriptCallback = callback;
  }

  /**
   * Register callback for messages
   */
  onMessage(callback: (message: RealtimeMessage) => void): void {
    this.onMessageCallback = callback;
  }

  /**
   * Register callback for speech detection state changes
   */
  onSpeechDetection(callback: (state: SpeechDetectionState) => void): void {
    this.onSpeechDetectionCallback = callback;
  }

  /**
   * Register callback for microphone muting
   */
  onMuteMicrophone(callback: (mute: boolean) => void): void {
    this.muteMicrophoneCallback = callback;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.micUnmuteTimeout) {
      clearTimeout(this.micUnmuteTimeout);
      this.micUnmuteTimeout = null;
    }
    
    this.isAISpeaking = false;
    this.messageHistory = [];
    
    console.log('🧹 Agent response handler cleaned up');
  }
}
