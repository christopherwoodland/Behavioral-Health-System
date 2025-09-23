import { useState, useEffect } from 'react';
import { Mic, Settings, AlertCircle, CheckCircle, RefreshCw, Volume2 } from 'lucide-react';
import type { AudioDevice } from '../services/audioDeviceService';

interface MicrophoneSettingsProps {
  speechService: any; // SpeechAvatarService instance
  onClose?: () => void;
  isOpen: boolean;
}

export function MicrophoneSettings({ speechService, onClose, isOpen }: MicrophoneSettingsProps) {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<AudioDevice | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [testingAudio, setTestingAudio] = useState(false);
  const [audioTestResult, setAudioTestResult] = useState<boolean | null>(null);

  // Load devices and check permissions
  const loadDevices = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Check permissions first
      const permission = await speechService.checkMicrophonePermission();
      setPermissionStatus(permission);

      if (permission === 'denied') {
        setError('Microphone access is denied. Please enable microphone permissions in your browser settings.');
        return;
      }

      // Get available devices
      const availableDevices = await speechService.getAvailableAudioDevices();
      setDevices(availableDevices);

      // Get current selection
      const current = speechService.getSelectedAudioDevice();
      setSelectedDevice(current);

      console.log(`🎤 Loaded ${availableDevices.length} audio devices`, availableDevices);

    } catch (err) {
      console.error('Failed to load audio devices:', err);
      setError(err instanceof Error ? err.message : 'Failed to load microphone devices');
    } finally {
      setIsLoading(false);
    }
  };

  // Request microphone permission
  const requestPermission = async () => {
    try {
      setIsLoading(true);
      setError('');

      const result = await speechService.requestMicrophonePermission();
      
      if (result.granted) {
        setPermissionStatus('granted');
        await loadDevices(); // Reload devices after permission granted
      } else {
        setPermissionStatus('denied');
        setError(result.error || 'Permission denied');
      }

    } catch (err) {
      console.error('Failed to request permission:', err);
      setError(err instanceof Error ? err.message : 'Failed to request permission');
    } finally {
      setIsLoading(false);
    }
  };

  // Select audio device
  const selectDevice = (device: AudioDevice) => {
    try {
      speechService.setAudioDevice(device.deviceId);
      setSelectedDevice(device);
      console.log(`🎤 Selected device: ${device.label}`);
    } catch (err) {
      console.error('Failed to select device:', err);
      setError('Failed to select audio device');
    }
  };

  // Test audio input
  const testAudio = async () => {
    try {
      setTestingAudio(true);
      setAudioTestResult(null);
      setError('');

      console.log('🎤 Testing audio input...');
      const hasInput = await speechService.testAudioInput(10000); // 10 seconds
      setAudioTestResult(hasInput);

      if (!hasInput) {
        setError('No audio input detected. Please check your microphone settings and try speaking.');
      }

    } catch (err) {
      console.error('Audio test failed:', err);
      setError('Audio test failed. Please check your microphone connection.');
      setAudioTestResult(false);
    } finally {
      setTestingAudio(false);
    }
  };

  // Load devices when component opens
  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Settings size={20} className="text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Microphone Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Permission Status */}
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-50">
            {permissionStatus === 'granted' ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : (
              <AlertCircle size={20} className="text-yellow-600" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">
                Permission Status: {permissionStatus === 'granted' ? 'Granted' : 'Required'}
              </p>
              {permissionStatus !== 'granted' && (
                <button
                  onClick={requestPermission}
                  disabled={isLoading}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                >
                  {isLoading ? 'Requesting...' : 'Request Permission'}
                </button>
              )}
            </div>
          </div>

          {/* Device Selection */}
          {permissionStatus === 'granted' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-900">Available Microphones</label>
                <button
                  onClick={loadDevices}
                  disabled={isLoading}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400 flex items-center space-x-1"
                >
                  <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>
              
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {devices.map((device) => (
                  <button
                    key={device.deviceId}
                    onClick={() => selectDevice(device)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedDevice?.deviceId === device.deviceId
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Mic size={16} />
                      <span className="text-sm font-medium">{device.label}</span>
                      {device.isDefault && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                          Default
                        </span>
                      )}
                      {selectedDevice?.deviceId === device.deviceId && (
                        <CheckCircle size={16} className="text-blue-600" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              {devices.length === 0 && !isLoading && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No microphones found. Please connect a microphone and refresh.
                </p>
              )}
            </div>
          )}

          {/* Audio Test */}
          {permissionStatus === 'granted' && selectedDevice && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-900">Test Audio Input</label>
                {audioTestResult !== null && (
                  <div className="flex items-center space-x-1">
                    {audioTestResult ? (
                      <CheckCircle size={16} className="text-green-600" />
                    ) : (
                      <AlertCircle size={16} className="text-red-600" />
                    )}
                    <span className={`text-xs ${audioTestResult ? 'text-green-600' : 'text-red-600'}`}>
                      {audioTestResult ? 'Audio detected' : 'No audio detected'}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="mb-2">
                <p className="text-xs text-gray-600">
                  Click test to hear your microphone input through your speakers. This helps confirm your microphone is working properly.
                </p>
              </div>
              
              <button
                onClick={testAudio}
                disabled={testingAudio || isLoading}
                className="w-full p-3 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-center space-x-2">
                  {testingAudio ? (
                    <>
                      <Volume2 size={16} className="text-blue-600 animate-pulse" />
                      <span className="text-sm text-blue-600">Testing... Speak now! (You should hear your voice)</span>
                    </>
                  ) : (
                    <>
                      <Volume2 size={16} className="text-gray-600" />
                      <span className="text-sm text-gray-700">Test Microphone with Playback (10 seconds)</span>
                    </>
                  )}
                </div>
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle size={16} className="text-red-600" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default MicrophoneSettings;