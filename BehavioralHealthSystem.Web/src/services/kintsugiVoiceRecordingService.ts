/**
 * Kintsugi Voice Recording Service
 *
 * Specialized recording service for capturing user speech for Kintsugi analysis.
 * Ensures a minimum of 30 seconds of continuous speech is captured.
 *
 * Key Features:
 * - Minimum 30 second recording requirement
 * - High-quality audio (128kbps, 48kHz → 44.1kHz WAV)
 * - Real-time duration tracking
 * - Automatic save to Azure Blob Storage
 * - Kintsugi-ready metadata tagging
 */

import { uploadToAzureBlob } from './azure';
import { convertAudioToWav } from './audio';

export interface KintsugiRecordingProgress {
  isRecording: boolean;
  duration: number; // Seconds
  hasMinimumDuration: boolean; // True when >= 30 seconds
  isSaving: boolean;
  error?: string;
}

export interface KintsugiRecordingResult {
  audioUrl: string;
  fileName: string;
  duration: number;
  sizeBytes: number;
  timestamp: number;
  assessmentId?: string;
}

class KintsugiVoiceRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private durationInterval: NodeJS.Timeout | null = null;
  private progressCallback: ((progress: KintsugiRecordingProgress) => void) | null = null;
  
  // Configuration
  private readonly MIN_DURATION_SECONDS = 30; // Minimum required duration
  private readonly RECORDING_OPTIONS = {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 128000 // High quality for Kintsugi analysis
  };

  /**
   * Check if recording is supported
   */
  isSupported(): boolean {
    return !!(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      'MediaRecorder' in window
    );
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
    if (!this.isRecording()) return 0;
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Check if minimum duration has been reached
   */
  hasMinimumDuration(): boolean {
    return this.getCurrentDuration() >= this.MIN_DURATION_SECONDS;
  }

  /**
   * Start recording for Kintsugi analysis
   * @param sessionId Current session ID
   * @param assessmentId Optional PHQ assessment ID to link recording
   * @param onProgress Optional callback for progress updates
   */
  async startRecording(
    sessionId: string,
    assessmentId?: string,
    onProgress?: (progress: KintsugiRecordingProgress) => void
  ): Promise<void> {
    try {
      if (this.isRecording()) {
        console.warn('⚠️ Kintsugi Recording: Already recording');
        return;
      }

      console.log('🎙️ ========================================');
      console.log('🎙️ KINTSUGI: Starting voice recording');
      console.log('🎙️ Minimum duration: 30 seconds');
      console.log('🎙️ Session ID:', sessionId);
      console.log('🎙️ Assessment ID:', assessmentId || 'N/A');
      console.log('🎙️ ========================================');

      this.progressCallback = onProgress || null;
      this.audioChunks = [];
      this.startTime = Date.now();

      // Request microphone access with high-quality settings
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

      console.log(`🎙️ Kintsugi Recording: Using MIME type: ${mimeType}`);

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: this.RECORDING_OPTIONS.audioBitsPerSecond
      });

      // Handle data availability
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`🎙️ Kintsugi: Chunk captured (${event.data.size} bytes)`);
        }
      };

      // Handle errors
      this.mediaRecorder.onerror = (event: Event) => {
        console.error('❌ Kintsugi Recording: MediaRecorder error:', event);
        this.notifyProgress({
          isRecording: false,
          duration: this.getCurrentDuration(),
          hasMinimumDuration: false,
          isSaving: false,
          error: 'Recording error occurred'
        });
      };

      // Handle stop
      this.mediaRecorder.onstop = () => {
        console.log('🎙️ Kintsugi Recording: MediaRecorder stopped');
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
      };

      // Start recording
      this.mediaRecorder.start(1000); // Capture data every second

      // Start progress tracking
      this.startProgressTracking();

      console.log('✅ Kintsugi Recording: Started successfully');

    } catch (error) {
      console.error('❌ Kintsugi Recording: Failed to start:', error);

      let errorMessage = 'Failed to start recording';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Microphone permission denied';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No microphone found';
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

      throw new Error(errorMessage);
    }
  }

  /**
   * Stop recording and save to Azure Blob Storage
   * @param sessionId Session ID for file naming
   * @param userId User ID for file naming
   * @param assessmentId Optional assessment ID for metadata
   * @param uploadToBlob Whether to upload to Azure (default: true)
   */
  async stopRecording(
    sessionId: string,
    userId: string,
    assessmentId?: string,
    uploadToBlob: boolean = true
  ): Promise<KintsugiRecordingResult | null> {
    try {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        console.warn('⚠️ Kintsugi Recording: No active recording to stop');
        return null;
      }

      const duration = this.getCurrentDuration();

      // Check minimum duration
      if (duration < this.MIN_DURATION_SECONDS) {
        console.warn(`⚠️ Kintsugi Recording: Only ${duration}s recorded (minimum: ${this.MIN_DURATION_SECONDS}s)`);
        this.notifyProgress({
          isRecording: false,
          duration,
          hasMinimumDuration: false,
          isSaving: false,
          error: `Recording too short (${duration}s). Need at least ${this.MIN_DURATION_SECONDS} seconds.`
        });
        this.cleanup();
        return null;
      }

      console.log('🎙️ ========================================');
      console.log('🎙️ KINTSUGI: Stopping recording');
      console.log(`🎙️ Duration: ${duration} seconds`);
      console.log('🎙️ ========================================');

      // Stop progress tracking
      this.stopProgressTracking();

      // Notify saving state
      this.notifyProgress({
        isRecording: false,
        duration,
        hasMinimumDuration: true,
        isSaving: true
      });

      // Stop recording
      return new Promise<KintsugiRecordingResult | null>((resolve) => {
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
              console.warn('⚠️ Kintsugi Recording: No audio data captured');
              this.notifyProgress({
                isRecording: false,
                duration: 0,
                hasMinimumDuration: false,
                isSaving: false,
                error: 'No audio data captured'
              });
              resolve(null);
              return;
            }

            console.log(`🎙️ Kintsugi: Processing ${this.audioChunks.length} chunks`);

            // Create blob from chunks
            const recordedBlob = new Blob(this.audioChunks, {
              type: this.mediaRecorder?.mimeType || 'audio/webm'
            });
            const sizeBytes = recordedBlob.size;

            console.log(`🎙️ Kintsugi: Created blob (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);

            if (!uploadToBlob) {
              console.log('🎙️ Kintsugi: Skipping upload (uploadToBlob=false)');
              this.notifyProgress({
                isRecording: false,
                duration,
                hasMinimumDuration: true,
                isSaving: false
              });
              resolve(null);
              return;
            }

            // Convert to WAV format at 44100Hz (Kintsugi-ready format)
            console.log('🎙️ Kintsugi: Converting to 44100Hz WAV...');
            const wavBlob = await convertAudioToWav(
              new File([recordedBlob], 'kintsugi-recording.webm', { type: recordedBlob.type }),
              (progress) => {
                console.log(`🎙️ Kintsugi: Conversion progress: ${progress.toFixed(1)}%`);
              }
            );

            console.log(`🎙️ Kintsugi: Converted to WAV (${(wavBlob.size / 1024 / 1024).toFixed(2)} MB)`);

            // Generate filename with Kintsugi prefix
            const timestamp = Date.now();
            const fileName = `kintsugi_${userId}_${sessionId}_${timestamp}.wav`;

            console.log(`🎙️ Kintsugi: Uploading as ${fileName}...`);

            // Upload to Azure Blob Storage
            // Note: Metadata must be added via separate API call after upload
            const audioUrl = await uploadToAzureBlob(
              wavBlob,
              fileName,
              (uploadProgress) => {
                console.log(`🎙️ Kintsugi: Upload progress: ${uploadProgress}%`);
              },
              userId
            );

            console.log('✅ Kintsugi: Recording saved successfully');
            console.log('   URL:', audioUrl);
            console.log('   Duration:', duration + 's');
            console.log('   Size:', (wavBlob.size / 1024 / 1024).toFixed(2) + ' MB');
            console.log('   Purpose: kintsugi-analysis');
            console.log('   Assessment ID:', assessmentId || 'N/A');

            const result: KintsugiRecordingResult = {
              audioUrl,
              fileName,
              duration,
              sizeBytes: wavBlob.size,
              timestamp,
              assessmentId
            };

            this.notifyProgress({
              isRecording: false,
              duration,
              hasMinimumDuration: true,
              isSaving: false
            });

            this.cleanup();
            resolve(result);

          } catch (error) {
            console.error('❌ Kintsugi: Failed to process/upload recording:', error);
            this.notifyProgress({
              isRecording: false,
              duration,
              hasMinimumDuration: true,
              isSaving: false,
              error: error instanceof Error ? error.message : 'Failed to save recording'
            });
            this.cleanup();
            resolve(null);
          }
        };

        this.mediaRecorder!.stop();
      });

    } catch (error) {
      console.error('❌ Kintsugi: Error stopping recording:', error);
      this.notifyProgress({
        isRecording: false,
        duration: this.getCurrentDuration(),
        hasMinimumDuration: false,
        isSaving: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.cleanup();
      return null;
    }
  }

  /**
   * Cancel recording without saving
   */
  cancelRecording(): void {
    console.log('🎙️ Kintsugi: Cancelling recording');

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    this.notifyProgress({
      isRecording: false,
      duration: this.getCurrentDuration(),
      hasMinimumDuration: false,
      isSaving: false
    });

    this.cleanup();
  }

  /**
   * Start progress tracking (updates every second)
   */
  private startProgressTracking(): void {
    this.stopProgressTracking(); // Clear any existing interval

    this.durationInterval = setInterval(() => {
      const duration = this.getCurrentDuration();
      this.notifyProgress({
        isRecording: true,
        duration,
        hasMinimumDuration: duration >= this.MIN_DURATION_SECONDS,
        isSaving: false
      });
    }, 1000); // Update every second
  }

  /**
   * Stop progress tracking
   */
  private stopProgressTracking(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  /**
   * Notify progress callback
   */
  private notifyProgress(progress: KintsugiRecordingProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.stopProgressTracking();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.mediaRecorder = null;
    this.audioChunks = [];
    this.progressCallback = null;
  }
}

// Export singleton instance
export const kintsugiVoiceRecordingService = new KintsugiVoiceRecordingService();
