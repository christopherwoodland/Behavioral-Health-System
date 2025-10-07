import React, { useState, useEffect } from 'react';
import { Settings, Volume2, Info } from 'lucide-react';
import { AzureOpenAIRealtimeSettings } from '@/services/azureOpenAIRealtimeService';

export interface SpeechSettingsProps {
  config: AzureOpenAIRealtimeSettings;
  onConfigUpdate: (config: Partial<AzureOpenAIRealtimeSettings>) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SpeechSettings: React.FC<SpeechSettingsProps> = ({
  config,
  onConfigUpdate,
  isOpen,
  onClose
}) => {
  // Ensure all values are valid numbers with proper defaults
  const sanitizeConfig = (cfg: AzureOpenAIRealtimeSettings): AzureOpenAIRealtimeSettings => ({
    turnDetectionThreshold: isNaN(cfg.turnDetectionThreshold) ? 0.5 : Math.max(0, Math.min(1, cfg.turnDetectionThreshold)),
    turnDetectionPrefixPadding: isNaN(cfg.turnDetectionPrefixPadding) ? 200 : Math.max(0, Math.min(1000, cfg.turnDetectionPrefixPadding)),
    turnDetectionSilenceDuration: isNaN(cfg.turnDetectionSilenceDuration) ? 300 : Math.max(100, Math.min(2000, cfg.turnDetectionSilenceDuration)),
    maxResponse: isNaN(cfg.maxResponse) ? 1638 : Math.max(100, Math.min(4096, cfg.maxResponse)),
    temperature: isNaN(cfg.temperature) ? 0.7 : Math.max(0.6, Math.min(2.0, cfg.temperature)), // Azure OpenAI minimum is 0.6
    voice: cfg.voice || 'alloy'
  });

  const [localConfig, setLocalConfig] = useState<AzureOpenAIRealtimeSettings>(sanitizeConfig(config));
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Tooltip content for each setting
  const tooltips = {
    threshold: "Controls how sensitive the voice activity detection is. Lower values (0.1-0.3) detect quieter speech but may pick up background noise. Higher values (0.7-0.9) require louder speech but are more reliable in noisy environments.",
    prefixPadding: "Amount of audio (in milliseconds) to include before the detected speech starts. This helps capture the beginning of words that might be cut off. Typical range: 100-500ms.",
    silenceDuration: "How long to wait (in milliseconds) after speech stops before considering the turn complete. Shorter values (200-400ms) make conversations faster but might cut off slow speakers. Longer values (600-1000ms) are safer for thoughtful responses.",
    maxResponse: "Maximum number of tokens (roughly words) the AI can use in a single response. Higher values allow longer responses but may increase costs and response time. 1000-2000 is typical for conversations.",
    temperature: "Controls how creative vs focused the AI responses are. Lower values (0.6-0.8) give more consistent, factual responses. Higher values (1.2-2.0) produce more creative, varied responses but may be less predictable.",
    voice: "Selects the voice characteristics for AI audio responses. Each voice has different tone, accent, and speaking style. Alloy is neutral, Echo is more masculine, Shimmer is more feminine."
  };

  // Tooltip component
  const InfoTooltip: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setActiveTooltip(id)}
        onMouseLeave={() => setActiveTooltip(null)}
        onFocus={() => setActiveTooltip(id)}
        onBlur={() => setActiveTooltip(null)}
        className="ml-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label={`Information about ${id}`}
      >
        <Info size={14} />
      </button>
      {activeTooltip === id && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-10">
          <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 max-w-xs shadow-lg">
            <div className="whitespace-normal">{children}</div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  );

  // Update localConfig when config prop changes
  useEffect(() => {
    setLocalConfig(sanitizeConfig(config));
  }, [config]);

  const handleConfigChange = (key: keyof AzureOpenAIRealtimeSettings, value: any) => {
    // Sanitize the incoming value
    let sanitizedValue = value;
    
    if (key === 'temperature') {
      sanitizedValue = Math.max(0.6, Math.min(2.0, parseFloat(value) || 0.7));
    } else if (key === 'turnDetectionThreshold') {
      sanitizedValue = Math.max(0, Math.min(1, parseFloat(value) || 0.5));
    } else if (key === 'turnDetectionPrefixPadding') {
      sanitizedValue = Math.max(0, Math.min(1000, parseInt(value) || 200));
    } else if (key === 'turnDetectionSilenceDuration') {
      sanitizedValue = Math.max(100, Math.min(2000, parseInt(value) || 300));
    } else if (key === 'maxResponse') {
      sanitizedValue = Math.max(100, Math.min(4096, parseInt(value) || 1638));
    }
    
    const newConfig = { ...localConfig, [key]: sanitizedValue };
    setLocalConfig(newConfig);
    onConfigUpdate({ [key]: sanitizedValue });
  };

  const voices = [
    { value: 'alloy', name: 'Alloy (Neutral)' },
    { value: 'echo', name: 'Echo (Male)' },
    { value: 'shimmer', name: 'Shimmer (Female)' }
  ] as const;

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
                Azure OpenAI Realtime Settings
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
            {/* Server Turn Detection Settings */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Server Turn Detection</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Threshold */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Threshold
                    <InfoTooltip id="threshold">
                      {tooltips.threshold}
                    </InfoTooltip>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={localConfig.turnDetectionThreshold}
                    onChange={(e) => handleConfigChange('turnDetectionThreshold', parseFloat(e.target.value))}
                    aria-label="Turn detection threshold"
                    title="Adjust turn detection threshold sensitivity"
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0.0</span>
                    <span className="font-medium">{localConfig.turnDetectionThreshold}</span>
                    <span>1.0</span>
                  </div>
                </div>

                {/* Prefix Padding */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prefix padding (ms)
                    <InfoTooltip id="prefixPadding">
                      {tooltips.prefixPadding}
                    </InfoTooltip>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    step="50"
                    value={localConfig.turnDetectionPrefixPadding}
                    onChange={(e) => handleConfigChange('turnDetectionPrefixPadding', parseInt(e.target.value))}
                    aria-label="Prefix padding in milliseconds"
                    title="Set prefix padding duration in milliseconds"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Silence Duration */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Silence duration (ms)
                    <InfoTooltip id="silenceDuration">
                      {tooltips.silenceDuration}
                    </InfoTooltip>
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="2000"
                    step="100"
                    value={localConfig.turnDetectionSilenceDuration}
                    onChange={(e) => handleConfigChange('turnDetectionSilenceDuration', parseInt(e.target.value))}
                    aria-label="Silence duration in milliseconds"
                    title="Set silence detection duration in milliseconds"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Parameters Settings */}
            <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Parameters</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Max Response */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max response
                    <InfoTooltip id="maxResponse">
                      {tooltips.maxResponse}
                    </InfoTooltip>
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="4096"
                    step="100"
                    value={localConfig.maxResponse}
                    onChange={(e) => handleConfigChange('maxResponse', parseInt(e.target.value))}
                    aria-label="Maximum response tokens"
                    title="Set maximum tokens for AI response"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Maximum tokens in response (100-4096)
                  </p>
                </div>

                {/* Temperature */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Temperature
                    <InfoTooltip id="temperature">
                      {tooltips.temperature}
                    </InfoTooltip>
                  </label>
                  <input
                    type="range"
                    min="0.6"
                    max="2.0"
                    step="0.1"
                    value={localConfig.temperature}
                    onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
                    aria-label="Temperature setting for AI responses"
                    title="Adjust response creativity (0.6=focused, 2.0=creative)"
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0.6 (Focused)</span>
                    <span className="font-medium">{localConfig.temperature}</span>
                    <span>2.0 (Creative)</span>
                  </div>
                  <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                    Azure OpenAI requires minimum temperature of 0.6
                  </p>
                </div>
              </div>
            </div>

            {/* Voice Selection */}
            <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex items-center space-x-2">
                <Volume2 className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Voice</h3>
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Voice Selection
                  <InfoTooltip id="voice">
                    {tooltips.voice}
                  </InfoTooltip>
                </label>
                <select
                  value={localConfig.voice}
                  onChange={(e) => handleConfigChange('voice', e.target.value as 'alloy' | 'echo' | 'shimmer')}
                  aria-label="Select Azure OpenAI voice"
                  title="Choose voice for AI audio responses"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                >
                  {voices.map((voice) => (
                    <option key={voice.value} value={voice.value}>
                      {voice.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Select Azure OpenAI voice for audio responses
                </p>
              </div>
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