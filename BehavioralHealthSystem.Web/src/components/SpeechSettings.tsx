import React, { useState, useEffect } from 'react';
import { Settings, Volume2, Info, X } from 'lucide-react';
import { AzureOpenAIRealtimeSettings } from '@/services/azureOpenAIRealtimeService';

export interface SpeechSettingsProps {
  config: AzureOpenAIRealtimeSettings;
  onConfigUpdate: (config: Partial<AzureOpenAIRealtimeSettings>) => void;
  humorLevel: number;
  onHumorLevelUpdate: (level: number) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const SpeechSettings: React.FC<SpeechSettingsProps> = ({
  config,
  onConfigUpdate,
  humorLevel,
  onHumorLevelUpdate,
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
  const [activeInfoModal, setActiveInfoModal] = useState<string | null>(null);

  // Information content for each setting
  const settingsInfo = {
    threshold: {
      title: "Turn Detection Threshold",
      content: [
        "Controls how sensitive the voice activity detection is.",
        "Lower values (0.1-0.3) detect quieter speech but may pick up background noise.",
        "Higher values (0.7-0.9) require louder speech but are more reliable in noisy environments.",
        "Recommended: 0.5 for balanced performance in typical environments."
      ]
    },
    prefixPadding: {
      title: "Prefix Padding",
      content: [
        "Amount of audio (in milliseconds) to include before the detected speech starts.",
        "This helps capture the beginning of words that might be cut off.",
        "Typical range: 100-500ms depending on speech patterns.",
        "Higher values provide better word capture but may include more background noise."
      ]
    },
    silenceDuration: {
      title: "Silence Duration",
      content: [
        "How long to wait (in milliseconds) after speech stops before considering the turn complete.",
        "Shorter values (200-400ms) make conversations faster but might cut off slow speakers.",
        "Longer values (600-1000ms) are safer for thoughtful responses.",
        "Recommended: 300-500ms for natural conversation flow."
      ]
    },
    maxResponse: {
      title: "Maximum Response Length",
      content: [
        "Maximum number of tokens (roughly words) the AI can use in a single response.",
        "Higher values allow longer responses but may increase costs and response time.",
        "1000-2000 tokens is typical for conversations.",
        "Consider your use case: shorter for quick interactions, longer for detailed explanations."
      ]
    },
    temperature: {
      title: "Temperature Setting",
      content: [
        "Controls how creative vs focused the AI responses are.",
        "Lower values (0.6-0.8) give more consistent, factual responses.",
        "Higher values (1.2-2.0) produce more creative, varied responses but may be less predictable.",
        "Azure OpenAI requires minimum temperature of 0.6."
      ]
    },
    voice: {
      title: "Voice Selection",
      content: [
        "Selects the voice characteristics for AI audio responses.",
        "Each voice has different tone, accent, and speaking style:",
        "• Alloy: Neutral, balanced tone suitable for most applications",
        "• Echo: More masculine characteristics",
        "• Shimmer: More feminine characteristics"
      ]
    },
    serverTurnDetection: {
      title: "Server Turn Detection",
      content: [
        "Server-side voice activity detection automatically detects when you start and stop speaking.",
        "Manages conversation turns without manual controls.",
        "These settings fine-tune how the system recognizes speech patterns.",
        "Proper configuration ensures smooth, natural conversation flow."
      ]
    },
    parameters: {
      title: "AI Model Parameters",
      content: [
        "Core AI model parameters that control response generation behavior.",
        "Includes response length limits and creativity levels.",
        "These settings directly impact the quality and characteristics of AI responses.",
        "Adjust based on your specific use case and requirements."
      ]
    },
    humorLevel: {
      title: "Tars Humor Level",
      content: [
        "Controls Tars' personality and humor in responses.",
        "100%: Maximum wit, sarcasm, and entertaining commentary. Addresses you as 'Hotshot', 'Chief', 'Sport', 'Slick', 'Champ', 'Ace', 'Top Gun', 'Sweetie'",
        "80%: High humor with clever quips and observations. Uses 'Hotshot', 'Chief', 'Sport'",
        "60%: Moderate humor with professional balance. Calls you 'Captain', 'Buddy', 'Cap'",
        "40%: Professional tone with minimal humor. Uses 'Friend', 'Colleague'",
        "20%: Serious mode with rare humor. Addresses you formally as 'Sir', 'Ma'am'",
        "0%: Maximum efficiency mode, direct and concise. Strictly formal 'Sir', 'Ma'am', 'Operator'"
      ]
    }
  };

  // Info button component that opens modals
  const InfoButton: React.FC<{ id: string }> = ({ id }) => (
    <button
      type="button"
      onClick={() => setActiveInfoModal(id)}
      className="ml-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
      aria-label={`Show information about ${settingsInfo[id as keyof typeof settingsInfo]?.title}`}
    >
      <Info size={14} />
    </button>
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
                <InfoButton id="serverTurnDetection" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Threshold */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Threshold
                    <InfoButton id="threshold" />
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
                    <InfoButton id="prefixPadding" />
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
                    <InfoButton id="silenceDuration" />
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
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Parameters</h3>
                <InfoButton id="parameters" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Max Response */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max response
                    <InfoButton id="maxResponse" />
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
                    <InfoButton id="temperature" />
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
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Voice & Personality</h3>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* Voice Selection */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Voice Selection
                    <InfoButton id="voice" />
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

                {/* Humor Level */}
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tars Humor Level: {humorLevel}%
                    <InfoButton id="humorLevel" />
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="10"
                      value={humorLevel}
                      onChange={(e) => onHumorLevelUpdate(parseInt(e.target.value))}
                      aria-label="Tars humor level"
                      title="Adjust Tars personality and humor level"
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0% (Efficiency)</span>
                      <span className="font-medium">
                        {humorLevel >= 80 ? 'Maximum Wit' :
                         humorLevel >= 60 ? 'Moderate' :
                         humorLevel >= 40 ? 'Professional' :
                         humorLevel >= 20 ? 'Serious' :
                         'Efficiency Mode'}
                      </span>
                      <span>100% (Maximum Wit)</span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Controls Tars' personality, humor, and communication style
                  </p>
                </div>
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

      {/* Information Modal */}
      {activeInfoModal && settingsInfo[activeInfoModal as keyof typeof settingsInfo] && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setActiveInfoModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {settingsInfo[activeInfoModal as keyof typeof settingsInfo].title}
              </h3>
              <button
                type="button"
                onClick={() => setActiveInfoModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              {settingsInfo[activeInfoModal as keyof typeof settingsInfo].content.map((paragraph, index) => (
                <div key={index} className="leading-relaxed">
                  {paragraph}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpeechSettings;