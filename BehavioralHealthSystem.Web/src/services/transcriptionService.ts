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
  private apiKey: string;
  private endpoint: string;
  private model: string;
  private apiVersion: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_TRANSCRIPTION_API_KEY || '';
    this.endpoint = import.meta.env.VITE_OPENAI_TRANSCRIPTION_ENDPOINT || '';
    this.model = import.meta.env.VITE_OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-transcribe';
    this.apiVersion = import.meta.env.VITE_OPENAI_TRANSCRIPTION_API_VERSION || '2025-03-01-preview';
  }

  /**
   * Transcribe audio using OpenAI gpt-4o-transcribe model
   * @param audioBlob The audio blob to transcribe
   * @returns Promise<TranscriptionResult>
   */
  async transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
    if (!this.apiKey || !this.endpoint) {
      throw new Error('OpenAI Transcription Service credentials not configured');
    }

    try {
      const formData = new FormData();
      // Ensure the file is named as .wav for the API
      const file = new File([audioBlob], 'audio.wav', { type: 'audio/wav' });
      formData.append('file', file);
      formData.append('model', this.model);
      formData.append('response_format', 'json');
      formData.append('language', 'en');

      const url = `${this.endpoint}?api-version=${this.apiVersion}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(`Failed to transcribe audio: ${errorMessage}`);
      }

      const result = await response.json();
      
      return {
        text: result.text || '',
        confidence: 1.0, // OpenAI doesn't provide confidence scores, assume high confidence
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