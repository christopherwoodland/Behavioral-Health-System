import { config } from '@/config/constants';
import { env } from '@/utils/env';
import { Logger } from '@/utils/logger';
import { convertAudioToWav } from './audio';

const log = Logger.create('Transcription');

export interface TranscriptionResult {
  text: string;
  confidence: number;
  duration?: number;
  language?: string;
  error?: string;
}

export interface TranscriptionStatus {
  status: 'notStarted' | 'running' | 'succeeded' | 'failed';
  result?: TranscriptionResult;
  error?: string;
}

class TranscriptionService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.api.baseUrl;
  }

  /**
   * Transcribe audio using backend API (which calls Azure Speech Fast Transcription)
   * Audio is automatically converted to WAV format for Azure Speech API compatibility.
   * @param audioBlob The audio blob to transcribe
   * @returns Promise<TranscriptionResult>
   */
  async transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
    try {
      let blobToSend = audioBlob;
      let contentType = audioBlob.type || 'audio/wav';

      log.debug('Transcribing audio', { originalSize: audioBlob.size, type: contentType });

      // If the audio is not WAV, convert it to WAV for Azure Speech API compatibility
      // Azure Speech Fast Transcription API does NOT support WebM/Opus format
      if (contentType !== 'audio/wav' && contentType !== 'audio/wave' && contentType !== 'audio/x-wav') {
        log.debug('Converting audio to WAV for Azure Speech API compatibility...');
        try {
          const wavBlob = await convertAudioToWav(
            new File([audioBlob], 'audio.tmp', { type: contentType }),
            (progress) => log.debug(`WAV conversion: ${progress.toFixed(0)}%`)
          );
          blobToSend = wavBlob;
          contentType = 'audio/wav';
          log.debug('Converted to WAV', { newSize: wavBlob.size });
        } catch (conversionError) {
          log.error('WAV conversion failed', conversionError);
          // If conversion fails for WAV types that are mislabeled, try anyway
          if (contentType.includes('wav')) {
            log.debug('Proceeding with original blob (appears to be WAV despite error)');
          } else {
            throw new Error(`Audio format not supported. Please use WAV, MP3, or OGG format. (Original type: ${contentType})`);
          }
        }
      }

      log.debug('Sending to transcription API', { size: blobToSend.size, type: contentType });

      const response = await fetch(`${this.baseUrl}/transcribe-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
        },
        body: blobToSend
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        throw new Error(`Failed to transcribe audio: ${errorMessage}`);
      }

      const result = await response.json();

      return {
        text: result.text || '',
        confidence: result.confidence || 1.0,
        duration: result.duration || 0,
        language: result.language || 'en'
      };

    } catch (error) {
      log.error('Transcription error', error);
      return {
        text: '',
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown transcription error'
      };
    }
  }

  /**
   * Check if transcription is enabled via feature flag
   * @returns boolean
   */
  isTranscriptionEnabled(): boolean {
    // Enable transcription by default unless explicitly disabled
    return env.ENABLE_TRANSCRIPTION;
  }

}

export const transcriptionService = new TranscriptionService();
