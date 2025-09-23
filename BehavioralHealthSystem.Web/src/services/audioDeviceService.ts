// Audio Device Management Service
// Handles microphone device selection and permissions

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
  groupId: string;
  isDefault?: boolean;
}

export interface AudioPermissionStatus {
  granted: boolean;
  error?: string;
  needsUserGesture?: boolean;
}

export class AudioDeviceService {
  private static instance: AudioDeviceService;
  private availableDevices: AudioDevice[] = [];
  private selectedDeviceId: string = '';
  private hasPermission: boolean = false;

  private constructor() {}

  static getInstance(): AudioDeviceService {
    if (!AudioDeviceService.instance) {
      AudioDeviceService.instance = new AudioDeviceService();
    }
    return AudioDeviceService.instance;
  }

  // Check if browser supports necessary APIs
  static isSupported(): boolean {
    return !!(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof navigator.mediaDevices.enumerateDevices === 'function' &&
      window.AudioContext
    );
  }

  // Request microphone permission
  async requestPermission(): Promise<AudioPermissionStatus> {
    try {
      if (!AudioDeviceService.isSupported()) {
        return {
          granted: false,
          error: 'Browser does not support required audio APIs'
        };
      }

      // Request access to get device labels (requires user gesture)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true 
      });
      
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      this.hasPermission = true;
      console.log('🎤 Microphone permission granted');
      
      return { granted: true };

    } catch (error) {
      console.error('❌ Failed to get microphone permission:', error);
      
      let errorMessage = 'Failed to access microphone';
      let needsUserGesture = false;

      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone and try again.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Microphone is already in use by another application.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Microphone does not meet the required constraints.';
        } else if (error.name === 'SecurityError') {
          errorMessage = 'Microphone access blocked by security policy.';
        } else if (error.name === 'AbortError') {
          errorMessage = 'Microphone access request was interrupted.';
          needsUserGesture = true;
        }
      }

      return {
        granted: false,
        error: errorMessage,
        needsUserGesture
      };
    }
  }

  // Get available audio input devices
  async getAvailableDevices(): Promise<AudioDevice[]> {
    try {
      if (!this.hasPermission) {
        const permission = await this.requestPermission();
        if (!permission.granted) {
          throw new Error(permission.error || 'Permission required to list devices');
        }
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      
      this.availableDevices = devices
        .filter(device => device.kind === 'audioinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
          kind: device.kind,
          groupId: device.groupId,
          isDefault: device.deviceId === 'default'
        }));

      console.log(`🎤 Found ${this.availableDevices.length} audio input devices:`, this.availableDevices);
      
      // Auto-select default device if none selected
      if (!this.selectedDeviceId && this.availableDevices.length > 0) {
        const defaultDevice = this.availableDevices.find(d => d.isDefault) || this.availableDevices[0];
        this.selectedDeviceId = defaultDevice.deviceId;
      }

      return this.availableDevices;

    } catch (error) {
      console.error('❌ Failed to enumerate audio devices:', error);
      throw new Error('Failed to get available microphones');
    }
  }

  // Select a specific audio device
  setSelectedDevice(deviceId: string): void {
    const device = this.availableDevices.find(d => d.deviceId === deviceId);
    if (device) {
      this.selectedDeviceId = deviceId;
      console.log(`🎤 Selected audio device: ${device.label} (${deviceId})`);
    } else {
      console.warn(`⚠️ Audio device not found: ${deviceId}`);
    }
  }

  // Get currently selected device
  getSelectedDevice(): AudioDevice | null {
    return this.availableDevices.find(d => d.deviceId === this.selectedDeviceId) || null;
  }

  // Create MediaStream with selected device
  async createAudioStream(constraints?: MediaTrackConstraints): Promise<MediaStream> {
    try {
      if (!this.hasPermission) {
        const permission = await this.requestPermission();
        if (!permission.granted) {
          throw new Error(permission.error || 'Microphone permission required');
        }
      }

      const audioConstraints: MediaTrackConstraints = {
        deviceId: this.selectedDeviceId ? { exact: this.selectedDeviceId } : undefined,
        sampleRate: 24000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        ...constraints
      };

      console.log('🎤 Creating audio stream with constraints:', audioConstraints);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });

      const track = stream.getAudioTracks()[0];
      if (track) {
        console.log(`🎤 Audio stream created successfully using: ${track.label}`);
        console.log('🎤 Track settings:', track.getSettings());
      }

      return stream;

    } catch (error) {
      console.error('❌ Failed to create audio stream:', error);
      
      // If specific device fails, try with default
      if (this.selectedDeviceId) {
        console.log('🔄 Trying with default audio device...');
        this.selectedDeviceId = '';
        return this.createAudioStream(constraints);
      }
      
      throw error;
    }
  }

  // Test audio input levels
  async testAudioInput(durationMs: number = 10000, enablePlayback: boolean = true): Promise<boolean> {
    try {
      const stream = await this.createAudioStream();
      
      return new Promise((resolve) => {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        
        // Create gain node for playback volume control
        let gainNode: GainNode | null = null;
        
        if (enablePlayback) {
          gainNode = audioContext.createGain();
          gainNode.gain.value = 0.3; // 30% volume to prevent feedback
          
          // Connect to speakers for playback (user can hear what mic picks up)
          source.connect(gainNode);
          gainNode.connect(audioContext.destination);
          console.log('🎤 Audio test started - You should hear your microphone input through speakers at 30% volume');
        } else {
          console.log('🎤 Audio test started - Playback disabled');
        }
        
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let hasAudioInput = false;
        
        const checkAudio = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          
          // Much lower threshold for more sensitive audio detection - baseline noise is around 0.1-1
          if (average > 0.5) { // Very sensitive threshold for detecting any audio input
            hasAudioInput = true;
          }
          
          console.log(`🎤 Audio test - Frequency average: ${average.toFixed(3)}, Input detected: ${hasAudioInput}`);
        };
        
        const interval = setInterval(checkAudio, 100);
        
        setTimeout(() => {
          clearInterval(interval);
          
          // Disconnect playback before stopping
          if (enablePlayback && gainNode) {
            source.disconnect(gainNode);
            gainNode.disconnect(audioContext.destination);
          }
          
          stream.getTracks().forEach(track => track.stop());
          audioContext.close();
          
          console.log(`🎤 Audio test completed - Input detected: ${hasAudioInput ? 'YES' : 'NO'}`);
          resolve(hasAudioInput);
        }, durationMs);
      });

    } catch (error) {
      console.error('❌ Audio test failed:', error);
      return false;
    }
  }

  // Get permission status without requesting
  async getPermissionStatus(): Promise<'granted' | 'denied' | 'prompt'> {
    try {
      // Check if we can enumerate devices (indicates permission)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasLabeledDevices = devices.some(device => device.label !== '');
      
      if (hasLabeledDevices) {
        return 'granted';
      }

      // Try to check permission API if available
      if ('permissions' in navigator) {
        const result = await (navigator.permissions as any).query({ name: 'microphone' });
        return result.state;
      }

      return 'prompt';
    } catch (error) {
      console.warn('Could not determine permission status:', error);
      return 'prompt';
    }
  }

  // Reset service state
  reset(): void {
    this.availableDevices = [];
    this.selectedDeviceId = '';
    this.hasPermission = false;
  }
}

export default AudioDeviceService;