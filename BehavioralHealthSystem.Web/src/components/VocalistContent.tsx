/**
 * Vocalist Content Display Component
 * Displays reading material for 35-second voice recordings
 * Options: Song lyrics or short story
 */

import React from 'react';

interface VocalistContentProps {
  contentType: 'lyrics' | 'story';
  className?: string;
}

/**
 * VocalistContent Component
 * Displays content for user to read aloud during recording
 */
export const VocalistContent: React.FC<VocalistContentProps> = ({ contentType, className = '' }) => {
  if (contentType === 'lyrics') {
    return (
      <div className={`vocalist-content lyrics-content ${className}`}>
        <h3 className="text-xl font-bold mb-4 text-center">Reading Passage</h3>
        <div className="space-y-4 text-lg leading-relaxed">
          <p className="font-semibold">Please read the following passage aloud - approximately 35 seconds</p>

          <div className="mt-4 space-y-3">
            <p>The morning sun rises over distant mountains,</p>
            <p>Painting the sky in shades of gold and amber.</p>
            <p>Birds begin their daily chorus,</p>
            <p>While the world slowly awakens to new possibilities.</p>

            <p className="mt-4">Each day brings its own unique challenges and joys,</p>
            <p>Moments of connection and understanding,</p>
            <p>Opportunities to grow and learn,</p>
            <p>And chances to make a difference in the lives around us.</p>

            <p className="mt-4">Through it all, we find strength in community,</p>
            <p>Hope in tomorrow, and peace in the present moment.</p>
          </div>
        </div>
      </div>
    );
  }

  // Story content
  return (
    <div className={`vocalist-content story-content ${className}`}>
      <h3 className="text-xl font-bold mb-4 text-center">Short Story Excerpt</h3>
      <div className="space-y-4 text-lg leading-relaxed">
        <p>
          The old lighthouse keeper climbed the spiral stairs one last time. Each step echoed
          in the empty tower, a rhythm he'd followed for forty years. At the top, he paused
          to catch his breath and gazed out at the endless ocean. The waves rolled in their
          eternal pattern, indifferent to human concerns.
        </p>

        <p>
          Tomorrow, a younger person would take his place. The light would continue to guide
          ships safely home, just as it always had. He smiled, knowing his work had mattered.
          Some things endure beyond a single lifetime, and he had been part of something greater
          than himself.
        </p>

        <p>
          With one final look at the horizon, he descended the stairs, ready for whatever came next.
        </p>
      </div>
    </div>
  );
};

export default VocalistContent;
