export interface SpeechDiagnostics {
  browserSupport: {
    speechRecognition: boolean;
    speechSynthesis: boolean;
    audioContext: boolean;
    mediaDevices: boolean;
  };
  permissions: {
    microphone: string; // 'granted', 'denied', 'prompt', 'unknown'
  };
  environment: {
    isSecureContext: boolean;
    isLocalhost: boolean;
    protocol: string;
    userAgent: string;
  };
  errors: string[];
}

export async function runSpeechDiagnostics(): Promise<SpeechDiagnostics> {
  const diagnostics: SpeechDiagnostics = {
    browserSupport: {
      speechRecognition: false,
      speechSynthesis: false,
      audioContext: false,
      mediaDevices: false,
    },
    permissions: {
      microphone: 'unknown'
    },
    environment: {
      isSecureContext: false,
      isLocalhost: false,
      protocol: '',
      userAgent: ''
    },
    errors: []
  };

  try {
    // Check environment
    diagnostics.environment.isSecureContext = window.isSecureContext;
    diagnostics.environment.isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    diagnostics.environment.protocol = window.location.protocol;
    diagnostics.environment.userAgent = navigator.userAgent;

    // Check browser API support
    diagnostics.browserSupport.speechRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    diagnostics.browserSupport.speechSynthesis = 'speechSynthesis' in window;
    diagnostics.browserSupport.audioContext = 'AudioContext' in window || 'webkitAudioContext' in window;
    diagnostics.browserSupport.mediaDevices = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;

    // Check microphone permissions
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        diagnostics.permissions.microphone = permissionStatus.state;
      } catch (error) {
        diagnostics.errors.push(`Permission query failed: ${error}`);
        diagnostics.permissions.microphone = 'query-failed';
      }
    }

    // Test Speech Recognition creation
    if (diagnostics.browserSupport.speechRecognition) {
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        // Don't start it, just test creation
      } catch (error) {
        diagnostics.errors.push(`Speech Recognition creation failed: ${error}`);
        diagnostics.browserSupport.speechRecognition = false;
      }
    }

    // Test Speech Synthesis
    if (diagnostics.browserSupport.speechSynthesis) {
      try {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
          diagnostics.errors.push('No speech synthesis voices available');
        }
      } catch (error) {
        diagnostics.errors.push(`Speech Synthesis test failed: ${error}`);
        diagnostics.browserSupport.speechSynthesis = false;
      }
    }

    // Test Audio Context
    if (diagnostics.browserSupport.audioContext) {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContext();
        await audioContext.close();
      } catch (error) {
        diagnostics.errors.push(`Audio Context test failed: ${error}`);
        diagnostics.browserSupport.audioContext = false;
      }
    }

  } catch (error) {
    diagnostics.errors.push(`Diagnostics failed: ${error}`);
  }

  return diagnostics;
}

export function formatDiagnosticsReport(diagnostics: SpeechDiagnostics): string {
  const lines: string[] = [];
  
  lines.push('=== SPEECH DIAGNOSTICS REPORT ===');
  lines.push('');
  
  lines.push('Environment:');
  lines.push(`  - Secure Context: ${diagnostics.environment.isSecureContext}`);
  lines.push(`  - Localhost: ${diagnostics.environment.isLocalhost}`);
  lines.push(`  - Protocol: ${diagnostics.environment.protocol}`);
  lines.push(`  - User Agent: ${diagnostics.environment.userAgent}`);
  lines.push('');
  
  lines.push('Browser Support:');
  lines.push(`  - Speech Recognition: ${diagnostics.browserSupport.speechRecognition}`);
  lines.push(`  - Speech Synthesis: ${diagnostics.browserSupport.speechSynthesis}`);
  lines.push(`  - Audio Context: ${diagnostics.browserSupport.audioContext}`);
  lines.push(`  - Media Devices: ${diagnostics.browserSupport.mediaDevices}`);
  lines.push('');
  
  lines.push('Permissions:');
  lines.push(`  - Microphone: ${diagnostics.permissions.microphone}`);
  lines.push('');
  
  if (diagnostics.errors.length > 0) {
    lines.push('Errors:');
    diagnostics.errors.forEach(error => {
      lines.push(`  - ${error}`);
    });
    lines.push('');
  }
  
  lines.push('Recommendations:');
  if (!diagnostics.environment.isSecureContext && !diagnostics.environment.isLocalhost) {
    lines.push('  - ⚠️  Use HTTPS or localhost for speech recognition');
  }
  if (!diagnostics.browserSupport.speechRecognition) {
    lines.push('  - ⚠️  Browser does not support Speech Recognition API');
    lines.push('  - Try Chrome, Edge, or Safari');
  }
  if (!diagnostics.browserSupport.speechSynthesis) {
    lines.push('  - ⚠️  Browser does not support Speech Synthesis API');
  }
  if (diagnostics.permissions.microphone === 'denied') {
    lines.push('  - ⚠️  Microphone permission denied - check browser settings');
  }
  if (diagnostics.permissions.microphone === 'prompt') {
    lines.push('  - ℹ️  Microphone permission will be requested when needed');
  }
  
  return lines.join('\n');
}