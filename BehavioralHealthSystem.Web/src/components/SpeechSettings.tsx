import React, { useState } from 'react';
import { Settings, Volume2, Mic, Languages, RefreshCw } from 'lucide-react';
import { SpeechConfig } from '@/services/speechService';

export interface SpeechSettingsProps {
  config: SpeechConfig;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoice?: SpeechSynthesisVoice;
  onConfigUpdate: (config: Partial<SpeechConfig>) => void;
  onVoiceSelect: (voice: SpeechSynthesisVoice) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SpeechSettings: React.FC<SpeechSettingsProps> = ({
  config,
  availableVoices,
  selectedVoice,
  onConfigUpdate,
  onVoiceSelect,
  isOpen,
  onClose
}) => {
  const [localConfig, setLocalConfig] = useState<SpeechConfig>(config);

  const handleConfigChange = (key: keyof SpeechConfig, value: any) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    onConfigUpdate({ [key]: value });
  };

  const languages = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es-ES', name: 'Spanish (Spain)' },
    { code: 'es-MX', name: 'Spanish (Mexico)' },
    { code: 'fr-FR', name: 'French (France)' },
    { code: 'de-DE', name: 'German (Germany)' },
    { code: 'it-IT', name: 'Italian (Italy)' },
    { code: 'pt-BR', name: 'Portuguese (Brazil)' },
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'ja-JP', name: 'Japanese' },
    { code: 'ko-KR', name: 'Korean' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="speech-settings-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-full p-4">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <Settings className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              <h2 id="speech-settings-title" className="text-xl font-semibold text-gray-900 dark:text-white">
                Speech Settings
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Close settings"
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Speech Recognition Settings */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Mic className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Speech Recognition</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Language Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Languages className="inline h-4 w-4 mr-1" />
                    Language
                  </label>
                  <select
                    value={localConfig.language}
                    onChange={(e) => handleConfigChange('language', e.target.value)}
                    title="Select language for speech recognition"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  >
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Max Alternatives */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Recognition Alternatives
                  </label>
                  <select
                    value={localConfig.maxAlternatives}
                    onChange={(e) => handleConfigChange('maxAlternatives', parseInt(e.target.value))}
                    title="Select number of recognition alternatives"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value={1}>1 (fastest)</option>
                    <option value={2}>2 (balanced)</option>
                    <option value={3}>3 (best accuracy)</option>
                  </select>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={localConfig.continuous}
                    onChange={(e) => handleConfigChange('continuous', e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Continuous listening (auto-restart)
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={localConfig.interimResults}
                    onChange={(e) => handleConfigChange('interimResults', e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Show interim results (real-time transcription)
                  </span>
                </label>
              </div>
            </div>

            {/* Audio Processing Settings */}
            <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Audio Processing</h3>

              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={localConfig.noiseReduction}
                    onChange={(e) => handleConfigChange('noiseReduction', e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Noise reduction
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={localConfig.echoCancellation}
                    onChange={(e) => handleConfigChange('echoCancellation', e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Echo cancellation
                  </span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={localConfig.audioTracks}
                    onChange={(e) => handleConfigChange('audioTracks', e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Enhanced audio processing
                  </span>
                </label>
              </div>
            </div>

            {/* Voice Selection */}
            <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Volume2 className="h-5 w-5 text-gray-500" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Speech Synthesis</h3>
                </div>
                <button
                  onClick={() => window.speechSynthesis.getVoices()}
                  className="flex items-center space-x-1 px-3 py-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                  title="Refresh available voices"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Refresh</span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Voice Selection
                </label>
                <select
                  value={selectedVoice?.name || ''}
                  onChange={(e) => {
                    const voice = availableVoices.find(v => v.name === e.target.value);
                    if (voice) onVoiceSelect(voice);
                  }}
                  title="Select voice for speech synthesis"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Default system voice</option>
                  {availableVoices.map((voice, index) => (
                    <option key={index} value={voice.name}>
                      {voice.name} ({voice.lang}) {voice.default ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {availableVoices.length} voices available
                </p>
              </div>

              {/* Voice Test */}
              {selectedVoice && (
                <div>
                  <button
                    onClick={() => {
                      const utterance = new SpeechSynthesisUtterance('Hello! This is a test of the selected voice.');
                      utterance.voice = selectedVoice;
                      window.speechSynthesis.speak(utterance);
                    }}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:bg-primary-800 dark:text-primary-200 dark:hover:bg-primary-700"
                  >
                    <Volume2 className="h-4 w-4 mr-1" />
                    Test Voice
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeechSettings;