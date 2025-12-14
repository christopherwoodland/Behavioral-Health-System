import { config } from '@/config/constants';

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
   * Transcribe audio using backend API (which calls Azure OpenAI gpt-4o-transcribe)
   * @param audioBlob The audio blob to transcribe
   * @returns Promise<TranscriptionResult>
   */
  async transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
    try {
      const contentType = audioBlob.type || 'audio/wav';
      console.log('🎤 Transcribing audio - size:', audioBlob.size, 'type:', contentType);

      const response = await fetch(`${this.baseUrl}/transcribe-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
        },
        body: audioBlob
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
      console.error('Transcription error:', error);
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
    const enableFlag = import.meta.env.VITE_ENABLE_TRANSCRIPTION;
    return enableFlag !== 'false' && enableFlag !== '0';
  }

  /**
   * Check if Kintsugi assessment is enabled via feature flag
   * @returns boolean
   */
  isKintsugiEnabled(): boolean {
    // Enable Kintsugi by default unless explicitly disabled
    const enableFlag = import.meta.env.VITE_ENABLE_KINTSUGI;
    return enableFlag !== 'false' && enableFlag !== '0';
  }
}

export const transcriptionService = new TranscriptionService();
