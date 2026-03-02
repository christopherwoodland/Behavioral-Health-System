import React from 'react';

export interface VoiceActivityVisualizerProps {
  volume: number;
  isVoiceActive: boolean;
  isListening: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const VoiceActivityVisualizer: React.FC<VoiceActivityVisualizerProps> = ({
  volume,
  isVoiceActive,
  isListening,
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const barCount = size === 'sm' ? 3 : size === 'md' ? 5 : 7;
  const maxHeight = size === 'sm' ? 16 : size === 'md' ? 24 : 32;

  // Normalize volume (0-100 to 0-1)
  const normalizedVolume = Math.min(volume / 100, 1);

  const statusLabel = !isListening
    ? 'Voice activity indicator: inactive'
    : isVoiceActive
      ? `Voice activity detected, volume ${Math.round(normalizedVolume * 100)}%`
      : 'Listening for voice activity';

  return (
    <div
      className={`flex items-center justify-center ${sizeClasses[size]} ${className}`}
      role="img"
      aria-label={statusLabel}
    >
      <div className="flex items-end space-x-1 h-full">
        {Array.from({ length: barCount }).map((_, index) => {
          // Calculate bar height based on volume and index
          const barThreshold = index / barCount;
          const shouldAnimate = isListening && (isVoiceActive || index === 0);
          const isActive = normalizedVolume > barThreshold;

          const barHeight = shouldAnimate && isActive
            ? Math.max(4, normalizedVolume * maxHeight)
            : 4;
          const barDelay = index * 100;

          return (
            <div
              key={index}
              className={`w-1 transition-all duration-150 rounded-sm voice-bar ${
                shouldAnimate
                  ? isActive
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-gray-300 dark:bg-gray-600'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
              data-height={barHeight}
              data-delay={barDelay}
            />
          );
        })}
      </div>
    </div>
  );
};

export default VoiceActivityVisualizer;
