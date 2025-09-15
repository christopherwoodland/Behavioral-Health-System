import { useState, useEffect, useRef, useCallback } from 'react';
import { AdvancedSpeechService, SpeechResult, VoiceActivityEvent, SpeechConfig } from '@/services/speechService';

export interface UseSpeechOptions {
  config?: Partial<SpeechConfig>;
  autoStart?: boolean;
  onResult?: (results: SpeechResult[]) => void;
  onFinalResult?: (results: SpeechResult[]) => void;
  onVoiceActivity?: (event: VoiceActivityEvent) => void;
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onError?: (error: any) => void;
}

export interface UseSpeechReturn {
  // State
  isListening: boolean;
  isAvailable: boolean;
  isVoiceActive: boolean;
  volume: number;
  
  // Controls
  startListening: () => Promise<void>;
  stopListening: () => void;
  speak: (text: string, options?: any) => Promise<void>;
  
  // Configuration
  updateConfig: (config: Partial<SpeechConfig>) => void;
  availableVoices: SpeechSynthesisVoice[];
  
  // Status
  error: string | null;
  isInitialized: boolean;
}

export const useSpeech = (options: UseSpeechOptions = {}): UseSpeechReturn => {
  const serviceRef = useRef<AdvancedSpeechService | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Initialize speech service
  useEffect(() => {
    serviceRef.current = new AdvancedSpeechService(options.config);
    
    const service = serviceRef.current;

    // Set up event listeners
    service.on('initialized', (capabilities) => {
      setIsAvailable(capabilities.speechRecognition && capabilities.speechSynthesis);
      setIsInitialized(true);
      setAvailableVoices(service.getAvailableVoices());
    });

    service.on('listening', ({ started }) => {
      setIsListening(started);
    });

    service.on('result', ({ results }) => {
      options.onResult?.(results);
    });

    service.on('finalResult', ({ results }) => {
      options.onFinalResult?.(results);
    });

    service.on('voiceActivity', (event: VoiceActivityEvent) => {
      setIsVoiceActive(event.isActive);
      setVolume(event.volume);
      options.onVoiceActivity?.(event);
    });

    service.on('speechStart', () => {
      options.onSpeechStart?.();
    });

    service.on('speechEnd', () => {
      options.onSpeechEnd?.();
    });

    service.on('error', ({ type, error: serviceError }) => {
      const errorMessage = `Speech ${type} error: ${serviceError}`;
      setError(errorMessage);
      options.onError?.({ type, error: serviceError });
      console.error(errorMessage);
    });

    // Auto-start if requested
    if (options.autoStart) {
      service.startListening().catch(console.error);
    }

    // Cleanup
    return () => {
      service.destroy();
    };
  }, []); // Only run once on mount

  const startListening = useCallback(async () => {
    try {
      setError(null);
      if (serviceRef.current) {
        await serviceRef.current.startListening();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start listening';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const stopListening = useCallback(() => {
    try {
      setError(null);
      if (serviceRef.current) {
        serviceRef.current.stopListening();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop listening';
      setError(errorMessage);
    }
  }, []);

  const speak = useCallback(async (text: string, speakOptions?: any) => {
    try {
      setError(null);
      if (serviceRef.current) {
        await serviceRef.current.speak(text, speakOptions);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to speak';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const updateConfig = useCallback((config: Partial<SpeechConfig>) => {
    if (serviceRef.current) {
      serviceRef.current.updateConfig(config);
    }
  }, []);

  // Update available voices when they change
  useEffect(() => {
    if (isInitialized && serviceRef.current) {
      const updateVoices = () => {
        setAvailableVoices(serviceRef.current!.getAvailableVoices());
      };

      // Update voices initially and when they change
      updateVoices();
      
      if ('speechSynthesis' in window) {
        window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
        return () => {
          window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
        };
      }
    }
  }, [isInitialized]);

  return {
    // State
    isListening,
    isAvailable,
    isVoiceActive,
    volume,
    
    // Controls
    startListening,
    stopListening,
    speak,
    
    // Configuration
    updateConfig,
    availableVoices,
    
    // Status
    error,
    isInitialized
  };
};