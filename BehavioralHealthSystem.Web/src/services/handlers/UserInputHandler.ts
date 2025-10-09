/**
 * UserInputHandler - Manages user voice input and transcription
 * Relies on Azure OpenAI's server-side VAD for speech detection
 * Local VAD removed - Azure handles all speech detection
 */

import { LiveTranscript } from '../azureOpenAIRealtimeService';

export class UserInputHandler {
  // Callbacks
  private onLiveTranscriptCallback: ((transcript: LiveTranscript) => void) | null = null;

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
   * Register callback for transcript updates
   */
  onLiveTranscript(callback: (transcript: LiveTranscript) => void): void {
    this.onLiveTranscriptCallback = callback;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    console.log('🧹 User input handler cleaned up');
  }
}
