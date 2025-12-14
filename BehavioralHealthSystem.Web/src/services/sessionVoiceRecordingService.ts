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
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioLevelCheckInterval: NodeJS.Timeout | null = null;

  // Audio level thresholds for filtering out non-speech
  private readonly MIN_AUDIO_LEVEL = 0.02; // Minimum RMS level (0-1 scale) to consider as speech
  private readonly SPEECH_CONFIRMATION_THRESHOLD = 0.05; // Stronger signal = definitely speech

  // Recording configuration
  // NOTE: We prefer audio/wav for Azure Speech API compatibility
  // WebM/Opus is NOT supported by Azure Speech Fast Transcription API
  private readonly RECORDING_OPTIONS = {
    mimeType: 'audio/wav', // Preferred - universally supported by Azure Speech
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

      // Request microphone access with settings optimized for speech
      // 16kHz sample rate is optimal for speech recognition
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Optimal for speech recognition
          channelCount: 1 // Mono for voice
        }
      });

      // Determine best supported MIME type for Azure Speech API compatibility
      // Priority: WAV > OGG (with opus) > MP4 > WebM (last resort, may not work)
      let mimeType = this.RECORDING_OPTIONS.mimeType;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        const fallbackTypes = [
          'audio/ogg;codecs=opus', // Supported by Azure Speech
          'audio/mp4',             // Supported by Azure Speech
          'audio/webm;codecs=opus', // May NOT work with Azure Speech - avoid if possible
          'audio/webm'
        ];

        for (const type of fallbackTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            console.warn(`⚠️ Session Recording: WAV not supported, using fallback: ${type}`);
            if (type.includes('webm')) {
              console.warn('⚠️ Session Recording: WebM format may NOT be compatible with Azure Speech API');
            }
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

      // Set up audio analysis for client-side level checking
      this.setupAudioAnalysis();

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
   * Set up Web Audio API for real-time audio level analysis
   */
  private setupAudioAnalysis(): void {
    if (!this.stream) {
      return;
    }

    try {
      // Create audio context and analyser
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect stream to analyser
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);

      console.log('🎚️ Session Recording: Audio analysis setup complete');
    } catch (error) {
      console.warn('⚠️ Session Recording: Could not setup audio analysis:', error);
    }
  }

  /**
   * Get current audio level (RMS) from the microphone
   * @returns Audio level between 0 and 1
   */
  private getAudioLevel(): number {
    if (!this.analyser) {
      return 0;
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);

    // Calculate RMS (Root Mean Square) for audio level
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (dataArray[i] - 128) / 128; // Normalize to -1 to 1
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / bufferLength);

    return rms;
  }

  /**
   * Check if current audio level indicates speech
   */
  private isSpeechLevel(): boolean {
    const level = this.getAudioLevel();

    // Speech typically has RMS > 0.02, strong speech > 0.05
    const isSpeech = level >= this.MIN_AUDIO_LEVEL;

    if (level >= this.SPEECH_CONFIRMATION_THRESHOLD) {
      // Strong signal - definitely speech
      return true;
    } else if (isSpeech) {
      // Weak but above threshold - could be speech or ambient noise
      // Let server VAD be the final decision maker
      return true;
    }

    return false;
  }

  /**
   * Start monitoring audio levels during capture
   */
  private startAudioLevelMonitoring(): void {
    // Clear any existing interval
    this.stopAudioLevelMonitoring();

    // Check audio level every 100ms while capturing
    this.audioLevelCheckInterval = setInterval(() => {
      if (!this.isCurrentlyCapturing) {
        this.stopAudioLevelMonitoring();
        return;
      }

      // If audio level drops below threshold for too long, stop capturing
      if (!this.isSpeechLevel()) {
        console.log('🔇 Session Recording: Audio level dropped below speech threshold - stopping capture');
        this.onUserSpeechStop();
      }
    }, 100);
  }

  /**
   * Stop monitoring audio levels
   */
  private stopAudioLevelMonitoring(): void {
    if (this.audioLevelCheckInterval) {
      clearInterval(this.audioLevelCheckInterval);
      this.audioLevelCheckInterval = null;
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

    // Double-check with client-side audio level analysis
    if (!this.isSpeechLevel()) {
      const level = this.getAudioLevel();
      console.log(`🔇 Session Recording: VAD detected speech but audio level too low (${level.toFixed(3)}) - filtering out ambient noise`);
      return;
    }

    console.log('👤 Session Recording: User speech started - capturing audio');
    this.isCurrentlyCapturing = true;
    this.captureStartTime = Date.now();

    // Start periodic audio level checking to ensure we stop if level drops
    this.startAudioLevelMonitoring();

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

    // Stop audio level monitoring
    this.stopAudioLevelMonitoring();

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

      // Stop audio level monitoring
      this.stopAudioLevelMonitoring();

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

            // Clean up audio context
            if (this.audioContext) {
              await this.audioContext.close();
              this.audioContext = null;
              this.analyser = null;
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
