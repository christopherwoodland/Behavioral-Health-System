/**
 * UserInputHandler - Manages user voice input, VAD, and transcription
 * Isolated handler for all user-side audio processing
 */

import { LiveTranscript, VoiceActivity, SpeechDetectionState } from '../azureOpenAIRealtimeService';

export class UserInputHandler {
  // Voice Activity Detection state
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadInterval: NodeJS.Timeout | null = null;
  private vadStartTime: number | null = null;
  private vadEndTime: number | null = null;
  private isUserSpeaking: boolean = false;
  
  // Callbacks
  private onVoiceActivityCallback: ((activity: VoiceActivity) => void) | null = null;
  private onLiveTranscriptCallback: ((transcript: LiveTranscript) => void) | null = null;
  private onSpeechDetectionCallback: ((state: SpeechDetectionState) => void) | null = null;

  /**
   * Initialize Voice Activity Detection on the user's audio stream
   */
  async initializeVAD(stream: MediaStream): Promise<void> {
    try {
      // Create audio context for analyzing microphone input
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);
      
      // Create analyser for volume/frequency analysis
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256; // Smaller FFT for faster processing
      this.analyser.smoothingTimeConstant = 0.3; // Moderate smoothing
      
      source.connect(this.analyser);
      
      // Start monitoring voice activity
      this.startVADMonitoring();
      
      console.log('🎙️ User VAD initialized');
    } catch (error) {
      console.error('❌ Failed to initialize user VAD:', error);
      throw error;
    }
  }

  /**
   * Start monitoring voice activity (runs every 50ms)
   */
  private startVADMonitoring(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    this.vadInterval = setInterval(() => {
      if (!this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const normalizedVolume = Math.min(100, (average / 255) * 150);
      
      // Voice activity threshold (calibrated for normal speech)
      const isSpeaking = normalizedVolume > 5; // Low threshold for sensitive detection
      
      // Track speech start/end times
      if (isSpeaking && !this.isUserSpeaking) {
        this.vadStartTime = Date.now();
        this.isUserSpeaking = true;
        console.log('🗣️ User started speaking');
        this.emitSpeechDetection();
      } else if (!isSpeaking && this.isUserSpeaking) {
        this.vadEndTime = Date.now();
        this.isUserSpeaking = false;
        console.log('🤫 User stopped speaking');
        this.emitSpeechDetection();
      }
      
      // Emit voice activity data
      if (this.onVoiceActivityCallback) {
        this.onVoiceActivityCallback({
          volumeLevel: normalizedVolume,
          isSpeaking,
          timestamp: Date.now()
        });
      }
    }, 50); // 50ms intervals (20Hz monitoring rate)
  }

  /**
   * Handle user transcript events from Azure OpenAI
   */
  handleTranscriptEvent(event: any): void {
    // Handle partial transcripts (streaming)
    if (event.type === 'conversation.item.input_audio_transcription.completed' && event.transcript) {
      const transcript: LiveTranscript = {
        id: `user-transcript-${Date.now()}`,
        text: event.transcript,
        isPartial: false,
        role: 'user',
        timestamp: Date.now()
      };
      
      console.log('📝 User transcript:', event.transcript);
      
      if (this.onLiveTranscriptCallback) {
        this.onLiveTranscriptCallback(transcript);
      }
    }
  }

  /**
   * Emit speech detection state changes
   */
  private emitSpeechDetection(): void {
    if (this.onSpeechDetectionCallback) {
      this.onSpeechDetectionCallback({
        isUserSpeaking: this.isUserSpeaking,
        isAISpeaking: false, // User handler doesn't track AI state
        speechStartedAt: this.vadStartTime || undefined,
        speechStoppedAt: this.vadEndTime || undefined
      });
    }
  }

  /**
   * Get current user speaking state
   */
  isCurrentlySpeaking(): boolean {
    return this.isUserSpeaking;
  }

  /**
   * Get last speech timing
   */
  getLastSpeechTime(): number | null {
    return this.vadEndTime;
  }

  /**
   * Register callback for voice activity updates
   */
  onVoiceActivity(callback: (activity: VoiceActivity) => void): void {
    this.onVoiceActivityCallback = callback;
  }

  /**
   * Register callback for transcript updates
   */
  onLiveTranscript(callback: (transcript: LiveTranscript) => void): void {
    this.onLiveTranscriptCallback = callback;
  }

  /**
   * Register callback for speech detection state changes
   */
  onSpeechDetection(callback: (state: SpeechDetectionState) => void): void {
    this.onSpeechDetectionCallback = callback;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.isUserSpeaking = false;
    
    console.log('🧹 User input handler cleaned up');
  }
}
