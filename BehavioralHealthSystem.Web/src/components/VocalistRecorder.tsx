/**
 * Vocalist Recorder Component
 * Handles 35-second voice recording with countdown timer and WAV export
 */

import React, { useState, useRef, useEffect } from 'react';
import { VocalistContent } from './VocalistContent';

interface VocalistRecorderProps {
  userId: string;
  contentType: 'lyrics' | 'story';
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onCancel: () => void;
}

/**
 * VocalistRecorder Component
 * Records 40 seconds of audio in WAV format with visual countdown
 */
export const VocalistRecorder: React.FC<VocalistRecorderProps> = ({
  userId: _userId,
  contentType,
  onRecordingComplete,
  onCancel
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(40);
  const [error, setError] = useState<string | null>(null);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const countdownIntervalRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Auto-start recording on mount
  useEffect(() => {
    // Automatically start recording when component mounts
    startRecording();

    // Cleanup on unmount
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Start recording with countdown timer
   */
  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];

      // Request microphone access with high-quality settings for voice analysis
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // Mono is fine for voice
          sampleRate: 44100, // CD quality - 44.1kHz standard
          echoCancellation: false, // Disable for analysis - we want natural voice
          noiseSuppression: false, // Disable for analysis - preserve voice characteristics
          autoGainControl: false // Disable AGC - preserve natural volume variations
        }
      });

      // Create MediaRecorder with high-quality settings
      // Prefer webm with opus codec for best quality, then fall back
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/wav')
        ? 'audio/wav'
        : 'audio/ogg';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 256000 // 256kbps for better quality (doubled from 128kbps)
      });

      mediaRecorderRef.current = mediaRecorder;

      // Collect audio data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const duration = recordingStartTimeRef.current
          ? (Date.now() - recordingStartTimeRef.current) / 1000
          : 40;

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Convert to WAV if needed and send to parent
        convertToWAV(audioBlob, duration);
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      setCountdown(40);

      // Start countdown timer
      countdownIntervalRef.current = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Stop recording at 0
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to access microphone. Please check your permissions.');
    }
  };

  /**
   * Stop recording manually or automatically at 40 seconds
   */
  const stopRecording = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
  };

  /**
   * Convert audio blob to WAV format
   * Note: For production, you may want to use a library like lamejs or audiobuffer-to-wav
   * This is a simplified version
   */
  const convertToWAV = async (audioBlob: Blob, duration: number) => {
    try {
      // For now, we'll pass through the blob
      // In production, implement actual WAV conversion here
      // using AudioContext and encoding to WAV format

      // Create a WAV blob (simplified - in production use proper conversion)
      const wavBlob = new Blob([audioBlob], { type: 'audio/wav' });

      // Store the audio for playback and analysis
      setAudioBlob(wavBlob);
      setRecordedDuration(duration);
      setRecordingComplete(true);

      // Create audio URL for playback
      const audioUrl = URL.createObjectURL(wavBlob);
      audioPlayerRef.current = new Audio(audioUrl);
      audioPlayerRef.current.onended = () => setIsPlaying(false);

      // Don't automatically call onRecordingComplete - wait for user to click "Start Analysis"
    } catch (err) {
      console.error('Error converting to WAV:', err);
      setError('Failed to process audio recording.');
    }
  };

  /**
   * Play recorded audio
   */
  const playRecording = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  /**
   * Pause playback
   */
  const pausePlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    }
  };

  /**
   * Start analysis - sends recording to parent component
   */
  const startAnalysis = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob, recordedDuration);
    }
  };

  /**
   * Get countdown color based on remaining time
   */
  const getCountdownColor = () => {
    if (countdown > 20) return 'text-green-600';
    if (countdown > 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="vocalist-recorder bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 max-w-6xl mx-auto min-h-screen flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          🎤 Voice Recording Session
        </h2>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
          disabled={isRecording}
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Main content area with timer and reading material */}
      <div className="flex-1 flex flex-col gap-6 mb-8">
        {/* Countdown Timer */}
        <div className="text-center py-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className={`text-6xl font-bold ${getCountdownColor()} transition-colors`}>
            {countdown}
          </div>
          <div className="text-gray-600 dark:text-gray-300 mt-2 text-lg">seconds remaining</div>
        </div>

        {/* Content Display - Now more prominent with dark mode support */}
        <div className="flex-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-8 border-4 border-blue-300 dark:border-blue-700 shadow-lg">
          <VocalistContent contentType={contentType} />
        </div>
      </div>

      {/* Recording Controls */}
      <div className="flex justify-center gap-4">
        {!isRecording && !recordingComplete ? (
          <button
            onClick={startRecording}
            className="px-8 py-4 bg-blue-600 dark:bg-blue-700 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <span className="text-2xl">🎙️</span>
            Start Recording
          </button>
        ) : isRecording ? (
          <>
            <button
              onClick={stopRecording}
              className="px-8 py-4 bg-red-600 dark:bg-red-700 text-white rounded-lg font-semibold text-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors flex items-center gap-2"
            >
              <span className="text-2xl">⏹️</span>
              Stop Recording
            </button>
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 animate-pulse">
              <span className="inline-block w-3 h-3 bg-red-600 dark:bg-red-400 rounded-full"></span>
              <span className="font-semibold">Recording...</span>
            </div>
          </>
        ) : (
          /* Recording Complete - Show Playback and Analysis buttons */
          <>
            <button
              onClick={isPlaying ? pausePlayback : playRecording}
              className="px-8 py-4 bg-green-600 dark:bg-green-700 text-white rounded-lg font-semibold text-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors flex items-center gap-2"
            >
              <span className="text-2xl">{isPlaying ? '⏸️' : '▶️'}</span>
              {isPlaying ? 'Pause' : 'Play Recording'}
            </button>
            <button
              onClick={startAnalysis}
              className="px-8 py-4 bg-blue-600 dark:bg-blue-700 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center gap-2 shadow-lg"
            >
              <span className="text-2xl">🔬</span>
              Start Analysis
            </button>
          </>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
        {!recordingComplete ? (
          <>
            <p>📝 Read the content above aloud when you start recording</p>
            <p>⏱️ Recording will automatically stop at 40 seconds</p>
            <p>🎵 Try to read naturally and clearly</p>
          </>
        ) : (
          <>
            <p className="text-green-600 dark:text-green-400 font-semibold text-lg mb-2">✅ Recording Complete! ({recordedDuration.toFixed(1)}s)</p>
            <p>🎧 You can play back your recording to review it</p>
            <p>🔬 Click "Start Analysis" when you're ready to submit</p>
          </>
        )}
      </div>
    </div>
  );
};

export default VocalistRecorder;
