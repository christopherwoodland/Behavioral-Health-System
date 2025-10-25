/**
 * Jekyll Voice Recording Service
 * 
 * Handles continuous recording of user voice during Jekyll agent conversations.
 * Records at highest quality possible, accumulates 45+ seconds of speech,
 * and converts to 44100Hz WAV format for upload to Azure Blob Storage.
 */

import { uploadToAzureBlob } from './azure';
import { convertAudioToWav } from './audio';
import { getUserId } from '@/utils';

export interface RecordingProgress {
  isRecording: boolean;
  duration: number; // seconds
  hasMinimumDuration: boolean; // true when >= 45 seconds
  isSaving: boolean;
  error?: string;
}

export interface RecordingResult {
  audioUrl: string;
  fileName: string;
  duration: number;
  sizeBytes: number;
}

class JekyllVoiceRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private recordingTimer: NodeJS.Timeout | null = null;
  private progressCallback: ((progress: RecordingProgress) => void) | null = null;
  private sessionId: string | null = null;
  private userId: string | null = null;

  // Minimum duration required (45 seconds)
  private readonly MIN_DURATION_SECONDS = 45;

  // Recording configuration for highest quality
  private readonly RECORDING_OPTIONS = {
    mimeType: 'audio/webm;codecs=opus', // High quality, widely supported
    audioBitsPerSecond: 128000 // 128 kbps for excellent quality
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
   * Start recording user voice
   * @param sessionId Session ID for file naming
   * @param userId User ID for file naming
   * @param onProgress Callback for recording progress updates
   */
  async startRecording(
    sessionId: string,
    userId: string,
    onProgress?: (progress: RecordingProgress) => void
  ): Promise<void> {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        console.warn('⚠️ Jekyll Recording: Already recording, stopping previous recording first');
        await this.stopRecording();
      }

      // Store session info and progress callback
      this.sessionId = sessionId;
      this.userId = userId;
      this.progressCallback = onProgress || null;

      // Reset state
      this.audioChunks = [];
      this.startTime = Date.now();

      // Request microphone access with high quality audio settings
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000, // Request highest sample rate (will be converted to 44100Hz)
          channelCount: 1 // Mono for voice recording
        }
      });

      // Determine best supported MIME type
      let mimeType = this.RECORDING_OPTIONS.mimeType;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // Fallback to other formats
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

      console.log(`🎙️ Jekyll Recording: Using MIME type: ${mimeType}`);

      // Create media recorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: this.RECORDING_OPTIONS.audioBitsPerSecond
      });

      // Handle data availability
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`🎙️ Jekyll Recording: Chunk received (${event.data.size} bytes)`);
        }
      };

      // Handle recording errors
      this.mediaRecorder.onerror = (event: Event) => {
        console.error('❌ Jekyll Recording: MediaRecorder error:', event);
        const errorMessage = 'Recording error occurred';
        this.notifyProgress({
          isRecording: false,
          duration: this.getCurrentDuration(),
          hasMinimumDuration: false,
          isSaving: false,
          error: errorMessage
        });
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        console.log('🎙️ Jekyll Recording: Recorder stopped');
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
      };

      // Start recording (request data every second for better granularity)
      this.mediaRecorder.start(1000);

      console.log(`🎙️ Jekyll Recording: Started recording for session ${sessionId}`);

      // Start progress timer
      this.startProgressTimer();

      // Initial progress notification
      this.notifyProgress({
        isRecording: true,
        duration: 0,
        hasMinimumDuration: false,
        isSaving: false
      });

    } catch (error) {
      console.error('❌ Jekyll Recording: Failed to start recording:', error);
      
      let errorMessage = 'Failed to start recording';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone.';
        } else {
          errorMessage = `Recording error: ${error.message}`;
        }
      }

      this.notifyProgress({
        isRecording: false,
        duration: 0,
        hasMinimumDuration: false,
        isSaving: false,
        error: errorMessage
      });

      throw error;
    }
  }

  /**
   * Stop recording and save the audio file
   * @param uploadToBlob Whether to upload to Azure Blob Storage (default: true)
   * @returns Recording result with URL and metadata, or null if upload skipped
   */
  async stopRecording(uploadToBlob: boolean = true): Promise<RecordingResult | null> {
    try {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        console.warn('⚠️ Jekyll Recording: No active recording to stop');
        return null;
      }

      console.log('🎙️ Jekyll Recording: Stopping recording...');

      // Stop the progress timer
      this.stopProgressTimer();

      // Stop recording
      return new Promise<RecordingResult | null>((resolve, reject) => {
        if (!this.mediaRecorder) {
          resolve(null);
          return;
        }

        // Handle the stop event
        this.mediaRecorder.onstop = async () => {
          try {
            console.log(`🎙️ Jekyll Recording: Processing ${this.audioChunks.length} audio chunks`);

            // Stop all tracks
            if (this.stream) {
              this.stream.getTracks().forEach(track => track.stop());
              this.stream = null;
            }

            // Check if we have audio data
            if (this.audioChunks.length === 0) {
              console.warn('⚠️ Jekyll Recording: No audio data recorded');
              this.notifyProgress({
                isRecording: false,
                duration: this.getCurrentDuration(),
                hasMinimumDuration: false,
                isSaving: false,
                error: 'No audio data recorded'
              });
              resolve(null);
              return;
            }

            const duration = this.getCurrentDuration();
            const hasMinimumDuration = duration >= this.MIN_DURATION_SECONDS;

            console.log(`🎙️ Jekyll Recording: Duration: ${duration.toFixed(1)}s (minimum: ${this.MIN_DURATION_SECONDS}s)`);

            if (!hasMinimumDuration) {
              console.warn(`⚠️ Jekyll Recording: Recording too short (${duration.toFixed(1)}s < ${this.MIN_DURATION_SECONDS}s)`);
            }

            // Skip upload if requested
            if (!uploadToBlob) {
              console.log('🎙️ Jekyll Recording: Skipping upload (uploadToBlob=false)');
              this.notifyProgress({
                isRecording: false,
                duration,
                hasMinimumDuration,
                isSaving: false
              });
              resolve(null);
              return;
            }

            // Notify saving state
            this.notifyProgress({
              isRecording: false,
              duration,
              hasMinimumDuration,
              isSaving: true
            });

            // Create blob from chunks
            const recordedBlob = new Blob(this.audioChunks, { 
              type: this.mediaRecorder?.mimeType || 'audio/webm' 
            });
            const sizeBytes = recordedBlob.size;

            console.log(`🎙️ Jekyll Recording: Created blob (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);

            // Convert to WAV format at 44100Hz
            console.log('🎙️ Jekyll Recording: Converting to 44100Hz WAV...');
            const wavBlob = await convertAudioToWav(
              new File([recordedBlob], 'recording.webm', { type: recordedBlob.type }),
              (progress) => {
                console.log(`🎙️ Jekyll Recording: Conversion progress: ${progress.toFixed(1)}%`);
              }
            );

            console.log(`🎙️ Jekyll Recording: Converted to WAV (${(wavBlob.size / 1024 / 1024).toFixed(2)} MB)`);

            // Generate filename following UploadAnalyze pattern: userId_sessionId_timestamp.wav
            const timestamp = Date.now();
            const fileName = `${this.userId}_${this.sessionId}_${timestamp}.wav`;

            console.log(`🎙️ Jekyll Recording: Uploading as ${fileName}...`);

            // Upload to Azure Blob Storage
            const audioUrl = await uploadToAzureBlob(
              wavBlob,
              fileName,
              (uploadProgress) => {
                console.log(`🎙️ Jekyll Recording: Upload progress: ${uploadProgress}%`);
              },
              this.userId || getUserId() // Use stored userId or fallback
            );

            console.log(`✅ Jekyll Recording: Upload complete - ${audioUrl}`);

            const result: RecordingResult = {
              audioUrl,
              fileName,
              duration,
              sizeBytes: wavBlob.size
            };

            // Final progress notification
            this.notifyProgress({
              isRecording: false,
              duration,
              hasMinimumDuration,
              isSaving: false
            });

            // Clear chunks
            this.audioChunks = [];

            resolve(result);

          } catch (error) {
            console.error('❌ Jekyll Recording: Error processing/uploading recording:', error);
            
            const errorMessage = error instanceof Error ? error.message : 'Failed to save recording';
            this.notifyProgress({
              isRecording: false,
              duration: this.getCurrentDuration(),
              hasMinimumDuration: false,
              isSaving: false,
              error: errorMessage
            });

            reject(error);
          }
        };

        // Request final data and stop
        this.mediaRecorder.stop();
      });

    } catch (error) {
      console.error('❌ Jekyll Recording: Error stopping recording:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop recording';
      this.notifyProgress({
        isRecording: false,
        duration: this.getCurrentDuration(),
        hasMinimumDuration: false,
        isSaving: false,
        error: errorMessage
      });

      throw error;
    }
  }

  /**
   * Cancel recording without saving
   */
  cancelRecording(): void {
    try {
      console.log('🎙️ Jekyll Recording: Cancelling recording...');

      this.stopProgressTimer();

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      this.audioChunks = [];

      this.notifyProgress({
        isRecording: false,
        duration: 0,
        hasMinimumDuration: false,
        isSaving: false
      });

      console.log('✅ Jekyll Recording: Recording cancelled');

    } catch (error) {
      console.error('❌ Jekyll Recording: Error cancelling recording:', error);
    }
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  /**
   * Get current recording duration in seconds
   */
  getCurrentDuration(): number {
    if (this.startTime === 0) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  /**
   * Check if recording has minimum required duration
   */
  hasMinimumDuration(): boolean {
    return this.getCurrentDuration() >= this.MIN_DURATION_SECONDS;
  }

  /**
   * Start the progress timer
   */
  private startProgressTimer(): void {
    this.stopProgressTimer(); // Clear any existing timer

    this.recordingTimer = setInterval(() => {
      const duration = this.getCurrentDuration();
      const hasMinimumDuration = duration >= this.MIN_DURATION_SECONDS;

      this.notifyProgress({
        isRecording: true,
        duration,
        hasMinimumDuration,
        isSaving: false
      });
    }, 1000); // Update every second
  }

  /**
   * Stop the progress timer
   */
  private stopProgressTimer(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  /**
   * Notify progress callback
   */
  private notifyProgress(progress: RecordingProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.cancelRecording();
    this.progressCallback = null;
    this.sessionId = null;
    this.userId = null;
  }
}

// Export singleton instance
export const jekyllVoiceRecordingService = new JekyllVoiceRecordingService();
