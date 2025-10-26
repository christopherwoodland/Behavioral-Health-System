/**
 * Session Voice Recording Service
 *
 * Handles continuous recording of ALL user speech throughout the entire session
 * across all agents. Only captures audio when the user is speaking (using VAD),
 * avoiding silence/whitespace in the final recording.
 *
 * Recordings are saved to Azure Blob Storage in the audio-uploads container
 * with the naming pattern: userId_sessionId_timestamp.wav at 44100Hz.
 */

import { uploadToAzureBlob } from './azure';
import { convertAudioToWav } from './audio';
import { getUserId } from '@/utils';

export interface SessionRecordingState {
  isRecording: boolean;
  isCapturing: boolean; // Currently capturing user speech
  totalDuration: number; // Total time recording has been active (seconds)
  capturedDuration: number; // Actual audio captured (seconds, excluding silence)
  error?: string;
}

export interface SessionRecordingResult {
  audioUrl: string;
  fileName: string;
  totalDuration: number;
  capturedDuration: number;
  sizeBytes: number;
}

class SessionVoiceRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private sessionStartTime: number = 0;
  private captureStartTime: number = 0; // When current capture segment started
  private totalCapturedDuration: number = 0; // Accumulated captured audio duration
  private isCurrentlyCapturing: boolean = false;
  private sessionId: string | null = null;
  private userId: string | null = null;

  // Recording configuration for highest quality (same as Jekyll)
  private readonly RECORDING_OPTIONS = {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 128000
  };

  /**
   * Check if recording is supported in the current browser
   */
  isRecordingSupported(): boolean {
    return !!(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      'MediaRecorder' in window
    );
  }

  /**
   * Start the session recording
   * @param sessionId Session ID for file naming
   * @param userId User ID for file naming
   */
  async startSessionRecording(sessionId: string, userId: string): Promise<void> {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        console.warn('⚠️ Session Recording: Already recording');
        return;
      }

      console.log('🎙️ ========================================');
      console.log('🎙️ STARTING SESSION-WIDE VOICE RECORDING');
      console.log('🎙️ ========================================');

      this.sessionId = sessionId;
      this.userId = userId;
      this.audioChunks = [];
      this.sessionStartTime = Date.now();
      this.totalCapturedDuration = 0;
      this.isCurrentlyCapturing = false;

      // Request microphone access with high quality audio settings
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1 // Mono for voice
        }
      });

      // Determine best supported MIME type
      let mimeType = this.RECORDING_OPTIONS.mimeType;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        const fallbackTypes = [
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/mp4',
          'audio/wav'
        ];

        for (const type of fallbackTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            break;
          }
        }
      }

      console.log(`🎙️ Session Recording: Using MIME type: ${mimeType}`);

      // Create media recorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: this.RECORDING_OPTIONS.audioBitsPerSecond
      });

      // Handle data availability
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`🎙️ Session Recording: Chunk captured (${event.data.size} bytes)`);
        }
      };

      // Handle errors
      this.mediaRecorder.onerror = (event: Event) => {
        console.error('❌ Session Recording: MediaRecorder error:', event);
      };

      // Handle stop
      this.mediaRecorder.onstop = () => {
        console.log('🎙️ Session Recording: MediaRecorder stopped');
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
      };

      // Start recording - but we'll control when to actually request data
      // Request data every 100ms for fine-grained control
      this.mediaRecorder.start(100);

      console.log(`✅ Session Recording: Started for session ${sessionId}`);

    } catch (error) {
      console.error('❌ Session Recording: Failed to start:', error);

      let errorMessage = 'Failed to start session recording';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Microphone permission denied';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No microphone found';
        } else {
          errorMessage = `Recording error: ${error.message}`;
        }
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Notify that user started speaking - start capturing audio
   */
  onUserSpeechStart(): void {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
      return;
    }

    if (this.isCurrentlyCapturing) {
      return; // Already capturing
    }

    console.log('👤 Session Recording: User speech started - capturing audio');
    this.isCurrentlyCapturing = true;
    this.captureStartTime = Date.now();

    // Request data to ensure we capture from this moment
    // The MediaRecorder will continue collecting data automatically
  }

  /**
   * Notify that user stopped speaking - stop capturing audio
   */
  onUserSpeechStop(): void {
    if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
      return;
    }

    if (!this.isCurrentlyCapturing) {
      return; // Not currently capturing
    }

    console.log('👤 Session Recording: User speech stopped - pausing capture');

    // Calculate duration of this capture segment
    const segmentDuration = (Date.now() - this.captureStartTime) / 1000;
    this.totalCapturedDuration += segmentDuration;

    console.log(`🎙️ Session Recording: Captured ${segmentDuration.toFixed(1)}s (total: ${this.totalCapturedDuration.toFixed(1)}s)`);

    this.isCurrentlyCapturing = false;

    // Request data to finalize this segment
    if (this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.requestData();
    }
  }

  /**
   * Stop the session recording and save to Azure Blob Storage
   */
  async stopSessionRecording(): Promise<SessionRecordingResult | null> {
    try {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        console.warn('⚠️ Session Recording: No active recording to stop');
        return null;
      }

      console.log('🎙️ ========================================');
      console.log('🎙️ STOPPING SESSION-WIDE VOICE RECORDING');
      console.log('🎙️ ========================================');

      // If currently capturing, finalize the duration
      if (this.isCurrentlyCapturing) {
        const segmentDuration = (Date.now() - this.captureStartTime) / 1000;
        this.totalCapturedDuration += segmentDuration;
        this.isCurrentlyCapturing = false;
      }

      const totalDuration = (Date.now() - this.sessionStartTime) / 1000;

      return new Promise<SessionRecordingResult | null>((resolve, reject) => {
        if (!this.mediaRecorder) {
          resolve(null);
          return;
        }

        this.mediaRecorder.onstop = async () => {
          try {
            // Stop all tracks
            if (this.stream) {
              this.stream.getTracks().forEach(track => track.stop());
              this.stream = null;
            }

            // Check if we have audio data
            if (this.audioChunks.length === 0) {
              console.warn('⚠️ Session Recording: No audio data captured');
              resolve(null);
              return;
            }

            console.log(`🎙️ Session Recording: Processing ${this.audioChunks.length} chunks`);
            console.log(`🎙️ Session Recording: Total duration: ${totalDuration.toFixed(1)}s`);
            console.log(`🎙️ Session Recording: Captured speech: ${this.totalCapturedDuration.toFixed(1)}s`);

            // Create blob from chunks
            const recordedBlob = new Blob(this.audioChunks, {
              type: this.mediaRecorder?.mimeType || 'audio/webm'
            });
            const sizeBytes = recordedBlob.size;

            console.log(`🎙️ Session Recording: Created blob (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);

            // Convert to WAV format at 44100Hz
            console.log('🎙️ Session Recording: Converting to 44100Hz WAV...');
            const wavBlob = await convertAudioToWav(
              new File([recordedBlob], 'session-recording.webm', { type: recordedBlob.type }),
              (progress) => {
                console.log(`🎙️ Session Recording: Conversion progress: ${progress.toFixed(1)}%`);
              }
            );

            console.log(`🎙️ Session Recording: Converted to WAV (${(wavBlob.size / 1024 / 1024).toFixed(2)} MB)`);

            // Generate filename: userId_sessionId_timestamp.wav
            const timestamp = Date.now();
            const fileName = `${this.userId}_${this.sessionId}_${timestamp}.wav`;

            console.log(`🎙️ Session Recording: Uploading as ${fileName}...`);

            // Upload to Azure Blob Storage (audio-uploads container)
            const audioUrl = await uploadToAzureBlob(
              wavBlob,
              fileName,
              (uploadProgress) => {
                console.log(`🎙️ Session Recording: Upload progress: ${uploadProgress}%`);
              },
              this.userId || getUserId()
            );

            console.log(`✅ Session Recording: Upload complete - ${audioUrl}`);

            const result: SessionRecordingResult = {
              audioUrl,
              fileName,
              totalDuration,
              capturedDuration: this.totalCapturedDuration,
              sizeBytes: wavBlob.size
            };

            // Clear chunks
            this.audioChunks = [];

            resolve(result);

          } catch (error) {
            console.error('❌ Session Recording: Error processing/uploading:', error);
            reject(error);
          }
        };

        // Stop the recorder
        this.mediaRecorder.stop();
      });

    } catch (error) {
      console.error('❌ Session Recording: Error stopping recording:', error);
      throw error;
    }
  }

  /**
   * Cancel recording without saving
   */
  cancelRecording(): void {
    try {
      console.log('🎙️ Session Recording: Cancelling...');

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      this.audioChunks = [];
      this.isCurrentlyCapturing = false;
      this.totalCapturedDuration = 0;

      console.log('✅ Session Recording: Cancelled');

    } catch (error) {
      console.error('❌ Session Recording: Error cancelling:', error);
    }
  }

  /**
   * Check if currently recording the session
   */
  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  /**
   * Get current recording state
   */
  getState(): SessionRecordingState {
    const totalDuration = this.sessionStartTime > 0 
      ? (Date.now() - this.sessionStartTime) / 1000 
      : 0;

    return {
      isRecording: this.isRecording(),
      isCapturing: this.isCurrentlyCapturing,
      totalDuration,
      capturedDuration: this.totalCapturedDuration,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.cancelRecording();
    this.sessionId = null;
    this.userId = null;
  }
}

// Export singleton instance
export const sessionVoiceRecordingService = new SessionVoiceRecordingService();
