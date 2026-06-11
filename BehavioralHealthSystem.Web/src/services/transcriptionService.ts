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
      if (!this.isTranscriptionEnabled()) {
        return {
          text: '',
          confidence: 0,
          error: 'Transcription is disabled in this environment.'
        };
      }

      let blobToSend = audioBlob;
      let contentType = audioBlob.type || 'audio/wav';

      log.debug('Transcribing audio', { originalSize: audioBlob.size, type: contentType });

      // In air-gap mode, skip frontend WAV conversion — the backend handles format
      // detection and whisper-asr supports WAV, MP3, OGG, FLAC, and WebM natively.
      // This avoids requiring FFmpeg WASM assets which may not be available locally.
      const isAirGap = env.AIR_GAP_MODE;

      if (!isAirGap && contentType !== 'audio/wav' && contentType !== 'audio/wave' && contentType !== 'audio/x-wav') {
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
      } else if (isAirGap) {
        log.debug('Air-gap mode: skipping frontend conversion, backend handles format detection');
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
          const baseError = errorData.error || errorMessage;
          const detailText = typeof errorData.details === 'string' ? errorData.details.trim() : '';
          errorMessage = detailText ? `${baseError}: ${detailText}` : baseError;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        throw new Error(`Failed to transcribe audio: ${errorMessage}`);
      }

      const result = await response.json();
      const normalizedText = typeof result.text === 'string' ? result.text : '';
      const hasText = normalizedText.trim().length > 0;
      const normalizedConfidence = !hasText
        ? 0.0
        : (typeof result.confidence === 'number' ? result.confidence : 1.0);

      return {
        text: normalizedText,
        confidence: normalizedConfidence,
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
    // Controlled by feature flag so air-gap can opt-in when local STT is available.
    return env.ENABLE_TRANSCRIPTION;
  }

}

export const transcriptionService = new TranscriptionService();
