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
      <div className={`vocalist-content lyrics-content text-gray-900 dark:text-gray-100 ${className}`}>
        <h3 className="text-xl font-bold mb-4 text-center text-gray-900 dark:text-white">Reading Passage</h3>
        <div className="space-y-4 text-lg leading-relaxed">
          <p className="font-semibold text-gray-800 dark:text-gray-200">Please read the following passage aloud - approximately 40 seconds</p>

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

  // Story content - Extended to approximately 800 words for 40 seconds of reading
  return (
    <div className={`vocalist-content story-content text-gray-900 dark:text-gray-100 ${className}`}>
      <h3 className="text-xl font-bold mb-4 text-center text-gray-900 dark:text-white">Short Story Excerpt</h3>
      <div className="space-y-4 text-lg leading-relaxed">
        <p>
          The old lighthouse keeper climbed the spiral stairs one last time. Each step echoed
          in the empty tower, a rhythm he'd followed for forty years. The morning sun streamed
          through the narrow windows, casting long shadows across the worn stone steps. His hand
          traced the familiar groove in the iron railing, polished smooth by decades of his own
          touch. At the top, he paused to catch his breath and gazed out at the endless ocean.
          The waves rolled in their eternal pattern, indifferent to human concerns, yet somehow
          comforting in their consistency.
        </p>

        <p>
          He remembered his first day here, young and eager, barely twenty-five years old, full
          of dreams about the important work he would do. The lighthouse had seemed impossibly
          tall then, the responsibility overwhelming. His predecessor, old Captain Morrison, had
          shown him the ropes with patient hands and kind eyes. "The light never goes out," the
          captain had said. "No matter what. That's the keeper's promise." Those words had stayed
          with him through every storm, every lonely night, every moment of doubt.
        </p>

        <p>
          Over the decades, he had guided countless ships safely through stormy nights and
          treacherous fog. He could still recall specific vessels—the merchant ship caught in
          that terrible nor'easter of '82, the fishing boat that had lost its radio during the
          blizzard, the cruise liner that had strayed too close to the rocks in the dense morning
          mist. Each successful passage had filled him with quiet pride, knowing that families
          would be reunited, cargo would reach its destination, and sailors would see another dawn.
          He kept a journal of every ship he'd helped guide home, filling twenty-three leather-bound
          volumes now sitting on the shelf in his cottage.
        </p>

        <p>
          The lighthouse itself had become his companion. He knew every stone, every timber, every
          crack in the plaster. He'd repaired the light mechanism more times than he could count,
          his hands learning its intricacies as intimately as a musician knows their instrument.
          During the worst storms, when the tower swayed and groaned, he would place his hand on
          the wall and feel it standing firm, defying the wind and waves. The lighthouse was more
          than a structure—it was a promise kept, a beacon of hope in the darkness.
        </p>

        <p>
          Tomorrow, a younger person would take his place. Sarah Chen, bright and capable, with
          new ideas about automation and modern systems. He'd trained her these past three months,
          passing on everything Captain Morrison had taught him and everything he'd learned since.
          She reminded him of himself at that age—respectful of tradition but not bound by it,
          understanding that the core mission remained the same even as the methods evolved.
          The light would continue to guide ships safely home, just as it always had.
        </p>

        <p>
          He smiled, knowing his work had mattered. Some things endure beyond a single lifetime,
          and he had been part of something greater than himself. The lighthouse would stand,
          the light would shine, and the ocean would continue its timeless dance with the shore.
          His name would join the list of keepers carved into the bronze plaque downstairs,
          a simple record of forty years of service. It was enough. More than enough.
        </p>

        <p>
          With one final look at the horizon where sea met sky, where the morning sun painted
          the water in shades of gold and silver, he descended the stairs. His footsteps echoed
          differently now—not the steady rhythm of duty, but the lighter step of someone walking
          toward rest, toward new beginnings, toward whatever came next in life's journey. The
          sea would still be there, the lighthouse would still stand, and tonight, someone else
          would climb these stairs to ensure the light never went out.
        </p>
      </div>
    </div>
  );
};

export default VocalistContent;
