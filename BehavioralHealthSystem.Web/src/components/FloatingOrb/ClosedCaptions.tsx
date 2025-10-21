import React, { useEffect, useState } from 'react';
import './ClosedCaptions.css';

export interface CaptionItem {
  id: string;
  text: string;
  speaker: 'user' | 'agent';
  agentId?: string;
  timestamp: number;
}

interface ClosedCaptionsProps {
  captions: CaptionItem[];
  maxCaptions?: number;
}

/**
 * ClosedCaptions Component
 * Displays floating, stylized captions that animate in from bottom and fade out
 * Captions are color-coded by speaker (user=white, agents=color-coded)
 */
export const ClosedCaptions: React.FC<ClosedCaptionsProps> = ({
  captions,
  maxCaptions = 3
}) => {
  const [displayCaptions, setDisplayCaptions] = useState<CaptionItem[]>([]);

  useEffect(() => {
    setDisplayCaptions(captions.slice(-maxCaptions));
  }, [captions, maxCaptions]);

  const getSpeakerLabel = (speaker: string, agentId?: string): string => {
    if (speaker === 'user') return 'You';
    switch (agentId) {
      case 'tars':
        return 'Tars';
      case 'matron':
        return 'Matron';
      case 'phq2':
        return 'PHQ-2';
      case 'phq9':
        return 'PHQ-9';
      case 'vocalist':
        return 'Vocalist';
      default:
        return 'Agent';
    }
  };

  const getAgentClass = (agentId?: string): string => {
    switch (agentId) {
      case 'tars':
        return 'speaker-tars';
      case 'matron':
        return 'speaker-matron';
      case 'phq2':
        return 'speaker-phq2';
      case 'phq9':
        return 'speaker-phq9';
      case 'vocalist':
        return 'speaker-vocalist';
      default:
        return 'speaker-default';
    }
  };

  return (
    <div className="closed-captions-container">
      {displayCaptions.map((caption, index) => (
        <div
          key={caption.id}
          className={`caption-item caption-${caption.speaker} ${getAgentClass(caption.agentId)}`}
          style={{
            '--animation-delay': `${index * 0.1}s`,
          } as React.CSSProperties & { '--animation-delay': string }}
        >
          <div className="caption-speaker">{getSpeakerLabel(caption.speaker, caption.agentId)}</div>
          <div className="caption-text">{caption.text}</div>
        </div>
      ))}
    </div>
  );
};

export default ClosedCaptions;
