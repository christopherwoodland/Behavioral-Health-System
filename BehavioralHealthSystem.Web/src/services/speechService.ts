import { EventEmitter } from 'events';

export interface SpeechConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  audioTracks: boolean;
  noiseReduction: boolean;
  echoCancellation: boolean;
}

export interface SpeechResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives?: string[];
}

export interface VoiceActivityEvent {
  isActive: boolean;
  volume: number;
  timestamp: number;
}

export class AdvancedSpeechService extends EventEmitter {
  private recognition: any = null;
  private synthesis: SpeechSynthesis | null = null;
  private audioContext: AudioContext | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private analyzer: AnalyserNode | null = null;
  private vadProcessor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  
  private isListening = false;
  private isVADActive = false;
  private silenceTimeout: NodeJS.Timeout | null = null;
  private speechTimeout: NodeJS.Timeout | null = null;
  
  private config: SpeechConfig = {
    language: 'en-US',
    continuous: true,
    interimResults: true,
    maxAlternatives: 3,
    audioTracks: true,
    noiseReduction: true,
    echoCancellation: true
  };

  constructor(config?: Partial<SpeechConfig>) {
    super();
    this.config = { ...this.config, ...config };
    this.initializeServices();
  }

  private async initializeServices(): Promise<void> {
    try {
      // Initialize Speech Recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.setupSpeechRecognition();
      }

      // Initialize Speech Synthesis
      if ('speechSynthesis' in window) {
        this.synthesis = window.speechSynthesis;
      }

      // Initialize Audio Context for VAD
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      this.emit('initialized', {
        speechRecognition: !!this.recognition,
        speechSynthesis: !!this.synthesis,
        voiceActivityDetection: !!this.audioContext
      });
    } catch (error) {
      console.error('Error initializing speech services:', error);
      this.emit('error', { type: 'initialization', error });
    }
  }

  private setupSpeechRecognition(): void {
    if (!this.recognition) return;

    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.language;
    this.recognition.maxAlternatives = this.config.maxAlternatives;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.emit('listening', { started: true });
    };

    this.recognition.onresult = (event: any) => {
      const results: SpeechResult[] = [];
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;
        const isFinal = result.isFinal;
        
        const alternatives = [];
        for (let j = 1; j < result.length && j < this.config.maxAlternatives; j++) {
          alternatives.push(result[j].transcript);
        }

        results.push({
          transcript,
          confidence,
          isFinal,
          alternatives
        });
      }

      this.emit('result', { results });
      
      // Handle final results
      const finalResults = results.filter(r => r.isFinal);
      if (finalResults.length > 0) {
        this.emit('finalResult', { results: finalResults });
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.emit('error', { type: 'recognition', error: event.error });
      
      // Auto-restart on certain errors
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        setTimeout(() => this.restartRecognition(), 1000);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.emit('listening', { started: false });
      
      // Auto-restart if continuous mode is enabled
      if (this.config.continuous && this.isVADActive) {
        setTimeout(() => this.startListening(), 100);
      }
    };
  }

  private async setupVoiceActivityDetection(): Promise<void> {
    try {
      if (!this.audioContext) {
        throw new Error('AudioContext not available');
      }

      // Request microphone access with enhanced constraints
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseReduction,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });

      // Create audio nodes
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.analyzer = this.audioContext.createAnalyser();
      this.vadProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);

      // Configure analyzer
      this.analyzer.fftSize = 256;
      this.analyzer.smoothingTimeConstant = 0.8;

      // Connect audio nodes
      this.microphone.connect(this.analyzer);
      this.analyzer.connect(this.vadProcessor);
      this.vadProcessor.connect(this.audioContext.destination);

      // Set up VAD processing
      this.vadProcessor.onaudioprocess = (event) => {
        this.processVAD(event);
      };

      this.emit('vadReady');
    } catch (error) {
      console.error('Error setting up VAD:', error);
      this.emit('error', { type: 'vad', error });
    }
  }

  private processVAD(_event: AudioProcessingEvent): void {
    if (!this.analyzer) return;

    const bufferLength = this.analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyzer.getByteFrequencyData(dataArray);

    // Calculate volume and voice activity
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const volume = sum / bufferLength;
    
    // Voice activity threshold (adjustable)
    const threshold = 30;
    const isVoiceActive = volume > threshold;

    this.emit('voiceActivity', {
      isActive: isVoiceActive,
      volume,
      timestamp: Date.now()
    } as VoiceActivityEvent);

    // Handle speech/silence timeouts
    if (isVoiceActive) {
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }
      
      if (!this.speechTimeout) {
        this.speechTimeout = setTimeout(() => {
          this.emit('speechStart');
        }, 200); // 200ms of continuous speech
      }
    } else {
      if (this.speechTimeout) {
        clearTimeout(this.speechTimeout);
        this.speechTimeout = null;
      }
      
      if (!this.silenceTimeout) {
        this.silenceTimeout = setTimeout(() => {
          this.emit('speechEnd');
        }, 1500); // 1.5s of silence
      }
    }
  }

  public async startListening(): Promise<void> {
    try {
      if (!this.recognition) {
        throw new Error('Speech recognition not available');
      }

      if (!this.isVADActive) {
        await this.setupVoiceActivityDetection();
        this.isVADActive = true;
      }

      if (!this.isListening) {
        this.recognition.start();
      }
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      this.emit('error', { type: 'start', error });
    }
  }

  public stopListening(): void {
    try {
      if (this.recognition && this.isListening) {
        this.recognition.stop();
      }

      this.isVADActive = false;
      
      // Clean up VAD resources
      if (this.vadProcessor) {
        this.vadProcessor.disconnect();
      }
      if (this.analyzer) {
        this.analyzer.disconnect();
      }
      if (this.microphone) {
        this.microphone.disconnect();
      }
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      // Clear timeouts
      if (this.silenceTimeout) {
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = null;
      }
      if (this.speechTimeout) {
        clearTimeout(this.speechTimeout);
        this.speechTimeout = null;
      }
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
      this.emit('error', { type: 'stop', error });
    }
  }

  private restartRecognition(): void {
    if (this.isVADActive) {
      this.stopListening();
      setTimeout(() => this.startListening(), 500);
    }
  }

  public async speak(text: string, options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
    voice?: SpeechSynthesisVoice;
    interrupt?: boolean;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('Speech synthesis not available'));
        return;
      }

      if (options?.interrupt) {
        this.synthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options?.rate || 0.9;
      utterance.pitch = options?.pitch || 1.0;
      utterance.volume = options?.volume || 0.8;
      
      if (options?.voice) {
        utterance.voice = options.voice;
      }

      utterance.onend = () => {
        this.emit('speechEnd', { text });
        resolve();
      };

      utterance.onerror = (event) => {
        this.emit('error', { type: 'synthesis', error: event.error });
        reject(new Error(`Speech synthesis error: ${event.error}`));
      };

      utterance.onstart = () => {
        this.emit('speechStart', { text });
      };

      this.synthesis.speak(utterance);
    });
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.synthesis) return [];
    return this.synthesis.getVoices();
  }

  public updateConfig(newConfig: Partial<SpeechConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.recognition) {
      this.recognition.continuous = this.config.continuous;
      this.recognition.interimResults = this.config.interimResults;
      this.recognition.lang = this.config.language;
      this.recognition.maxAlternatives = this.config.maxAlternatives;
    }
  }

  public isAvailable(): boolean {
    return !!(this.recognition && this.synthesis);
  }

  public isCurrentlyListening(): boolean {
    return this.isListening;
  }

  public destroy(): void {
    this.stopListening();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.removeAllListeners();
  }
}