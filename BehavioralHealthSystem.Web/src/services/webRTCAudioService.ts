/**
 * WebRTC Audio Streaming Service for real-time audio communication
 * Handles continuous microphone input and audio output streaming
 */

export interface WebRTCAudioConfig {
  sampleRate?: number;
  channelCount?: number;
  bitDepth?: number;
  bufferSize?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface AudioStreamEvent {
  type: 'audio_data' | 'stream_started' | 'stream_stopped' | 'error';
  data?: ArrayBuffer;
  timestamp?: number;
  error?: string;
}

export class WebRTCAudioService extends EventTarget {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private gainNode: GainNode | null = null;
  private isStreaming = false;
  private config: WebRTCAudioConfig;
  private playbackQueue: ArrayBuffer[] = [];
  private isPlayingAudio = false;

  constructor(config: WebRTCAudioConfig = {}) {
    super();
    this.config = {
      sampleRate: 24000, // Matching GPT-Realtime expected sample rate
      channelCount: 1,
      bitDepth: 16,
      bufferSize: 4096,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      ...config
    };
  }

  async initialize(): Promise<void> {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channelCount,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl
        },
        video: false
      });

      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.config.sampleRate
      });

      // Create audio nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.gainNode = this.audioContext.createGain();
      this.processorNode = this.audioContext.createScriptProcessor(
        this.config.bufferSize,
        this.config.channelCount,
        this.config.channelCount
      );

      // Connect audio nodes
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      // Handle audio processing
      this.processorNode.onaudioprocess = (event) => {
        if (this.isStreaming) {
          this.processAudioData(event);
        }
      };

      console.log('WebRTC Audio Service initialized');
      this.dispatchEvent(new CustomEvent('initialized'));

    } catch (error) {
      console.error('Failed to initialize WebRTC Audio Service:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.dispatchEvent(new CustomEvent('error', { detail: { error: errorMessage } }));
      throw error;
    }
  }

  async startStreaming(): Promise<void> {
    if (!this.audioContext || !this.processorNode) {
      throw new Error('Audio service not initialized');
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.isStreaming = true;
    console.log('Audio streaming started');
    this.dispatchEvent(new CustomEvent('stream_started'));
  }

  stopStreaming(): void {
    this.isStreaming = false;
    console.log('Audio streaming stopped');
    this.dispatchEvent(new CustomEvent('stream_stopped'));
  }

  setGain(gain: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(2, gain));
    }
  }

  private processAudioData(event: AudioProcessingEvent): void {
    const inputBuffer = event.inputBuffer;
    
    // Get input audio data
    const inputData = inputBuffer.getChannelData(0);
    
    // Convert Float32Array to Int16Array (PCM16)
    const pcmData = this.float32ToPCM16(inputData);
    
    // Create ArrayBuffer
    const audioBuffer = pcmData.buffer.slice(
      pcmData.byteOffset,
      pcmData.byteOffset + pcmData.byteLength
    );

    // Emit audio data event
    this.dispatchEvent(new CustomEvent('audio_data', { 
      detail: { 
        audioData: audioBuffer,
        timestamp: Date.now(),
        sampleRate: this.config.sampleRate,
        channels: this.config.channelCount
      } 
    }));

    // Note: Playback handling is done separately via playAudio method
  }

  private float32ToPCM16(float32Array: Float32Array): Int16Array {
    const pcm16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit integer
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16Array[i] = sample * 0x7FFF;
    }
    return pcm16Array;
  }

  private pcm16ToFloat32(pcm16Array: Int16Array): Float32Array {
    const float32Array = new Float32Array(pcm16Array.length);
    for (let i = 0; i < pcm16Array.length; i++) {
      float32Array[i] = pcm16Array[i] / 0x7FFF;
    }
    return float32Array;
  }

  async playAudio(audioData: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      console.warn('Audio context not available for playback');
      return;
    }

    this.playbackQueue.push(audioData);
    
    // If not already playing, start playback
    if (!this.isPlayingAudio) {
      this.processPlaybackQueue();
    }
  }

  private async processPlaybackQueue(): Promise<void> {
    if (this.playbackQueue.length === 0 || !this.audioContext) {
      this.isPlayingAudio = false;
      return;
    }

    this.isPlayingAudio = true;

    try {
      const audioData = this.playbackQueue.shift()!;
      
      // Convert PCM16 to AudioBuffer
      const audioBuffer = await this.createAudioBuffer(audioData);
      
      // Create and play audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => {
        // Continue with next audio in queue
        this.processPlaybackQueue();
      };
      
      source.start();

    } catch (error) {
      console.error('Error playing audio:', error);
      this.isPlayingAudio = false;
    }
  }

  private async createAudioBuffer(pcmData: ArrayBuffer): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    // Convert ArrayBuffer to Int16Array
    const pcm16Array = new Int16Array(pcmData);
    
    // Convert to Float32Array
    const float32Array = this.pcm16ToFloat32(pcm16Array);
    
    // Create AudioBuffer
    const audioBuffer = this.audioContext.createBuffer(
      this.config.channelCount!,
      float32Array.length,
      this.config.sampleRate!
    );

    // Copy data to AudioBuffer
    audioBuffer.getChannelData(0).set(float32Array);

    return audioBuffer;
  }

  async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      console.error('Error getting audio devices:', error);
      return [];
    }
  }

  async switchAudioDevice(deviceId: string): Promise<void> {
    if (this.mediaStream) {
      // Stop current stream
      this.mediaStream.getTracks().forEach(track => track.stop());
    }

    try {
      // Start new stream with selected device
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channelCount,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl
        },
        video: false
      });

      // Reconnect audio source
      if (this.sourceNode && this.audioContext) {
        this.sourceNode.disconnect();
        this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.sourceNode.connect(this.gainNode!);
      }

      console.log('Switched to audio device:', deviceId);
      this.dispatchEvent(new CustomEvent('device_changed', { detail: { deviceId } }));

    } catch (error) {
      console.error('Error switching audio device:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.dispatchEvent(new CustomEvent('error', { detail: { error: errorMessage } }));
      throw error;
    }
  }

  getVoiceActivityLevel(): number {
    if (!this.audioContext || !this.sourceNode) {
      return 0;
    }

    // Simple voice activity detection based on audio level
    // In a real implementation, you might want more sophisticated VAD
    try {
      const analyser = this.audioContext.createAnalyser();
      this.sourceNode.connect(analyser);
      analyser.fftSize = 256;
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average amplitude
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      return average / 255; // Normalize to 0-1
      
    } catch (error) {
      return 0;
    }
  }

  dispose(): void {
    this.stopStreaming();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.playbackQueue = [];
    
    console.log('WebRTC Audio Service disposed');
  }

  get isInitialized(): boolean {
    return this.audioContext !== null && this.mediaStream !== null;
  }

  get isActive(): boolean {
    return this.isStreaming;
  }

  get sampleRate(): number {
    return this.config.sampleRate!;
  }
}