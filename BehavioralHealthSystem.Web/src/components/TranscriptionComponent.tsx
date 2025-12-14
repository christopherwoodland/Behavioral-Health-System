import React, { useState, useCallback } from 'react';
import { FileText, RefreshCw, AlertCircle, CheckCircle, Copy, Download } from 'lucide-react';
import { transcriptionService, type TranscriptionResult } from '../services/transcriptionService';
import { apiService } from '../services/api';
import { useAccessibility } from '../hooks/useAccessibility';

interface TranscriptionComponentProps {
  audioUrl?: string;
  sessionId: string;
  audioFileName?: string;
  existingTranscription?: string;
}

const TranscriptionComponent: React.FC<TranscriptionComponentProps> = ({
  audioUrl,
  sessionId,
  audioFileName,
  existingTranscription
}) => {
  const { announceToScreenReader } = useAccessibility();
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(
    existingTranscription ? { text: existingTranscription, confidence: 1 } : null
  );
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if transcription is enabled
  const isTranscriptionEnabled = transcriptionService.isTranscriptionEnabled();

  // Don't render if transcription is disabled
  if (!isTranscriptionEnabled) {
    return null;
  }

  const handleTranscribe = useCallback(async () => {
    if (!audioUrl) {
      setError('No audio URL available for transcription');
      announceToScreenReader('Cannot transcribe: No audio URL available');
      return;
    }

    setIsTranscribing(true);
    setError(null);
    announceToScreenReader('Starting transcription...');

    try {
      // Download the audio file through the backend API (handles blob storage auth)
      const audioBlob = await apiService.downloadAudioBlob(audioUrl);
      const result = await transcriptionService.transcribeAudio(audioBlob);

      if (result.error) {
        setError(result.error);
        announceToScreenReader(`Transcription failed: ${result.error}`);
      } else {
        setTranscription(result);

        // Save transcription to backend if we have text
        if (result.text && result.text.trim()) {
          try {
            await apiService.saveTranscription(sessionId, result.text);
            announceToScreenReader('Transcription completed and saved successfully');
          } catch (saveError) {
            console.error('Failed to save transcription:', saveError);
            announceToScreenReader('Transcription completed but failed to save to session');
          }
        } else {
          announceToScreenReader('Transcription completed successfully');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown transcription error';
      setError(errorMessage);
      announceToScreenReader(`Transcription failed: ${errorMessage}`);
    } finally {
      setIsTranscribing(false);
    }
  }, [audioUrl, sessionId, announceToScreenReader]);

  const copyToClipboard = useCallback(async () => {
    if (!transcription?.text) return;

    try {
      await navigator.clipboard.writeText(transcription.text);
      announceToScreenReader('Transcription copied to clipboard');
    } catch (err) {
      announceToScreenReader('Failed to copy transcription');
    }
  }, [transcription?.text, announceToScreenReader]);

  const downloadTranscription = useCallback(() => {
    if (!transcription?.text) return;

    const fileName = audioFileName ?
      `${audioFileName.replace(/\.[^/.]+$/, '')}_transcription.txt` :
      `session_${sessionId}_transcription.txt`;

    const blob = new Blob([transcription.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    announceToScreenReader('Transcription download started');
  }, [transcription?.text, audioFileName, sessionId, announceToScreenReader]);

  const formatConfidence = (confidence: number): string => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
          <FileText className="w-5 h-5 mr-2" aria-hidden="true" />
          Audio Transcription
        </h3>

        {!transcription && audioUrl && (
          <button
            onClick={handleTranscribe}
            disabled={isTranscribing}
            className="btn btn--primary"
            aria-label="Generate transcription from audio"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isTranscribing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {isTranscribing ? 'Transcribing...' : 'Generate Transcription'}
          </button>
        )}

        {transcription && (
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="btn btn--secondary"
              aria-label="Copy transcription to clipboard"
            >
              <Copy className="w-4 h-4 mr-2" aria-hidden="true" />
              Copy
            </button>
            <button
              onClick={downloadTranscription}
              className="btn btn--secondary"
              aria-label="Download transcription as text file"
            >
              <Download className="w-4 h-4 mr-2" aria-hidden="true" />
              Download
            </button>
            {audioUrl && (
              <button
                onClick={handleTranscribe}
                disabled={isTranscribing}
                className="btn btn--secondary"
                aria-label="Regenerate transcription"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isTranscribing ? 'animate-spin' : ''}`} aria-hidden="true" />
                Refresh
              </button>
            )}
          </div>
        )}
      </div>

      {/* Loading State */}
      {isTranscribing && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center">
            <RefreshCw className="w-5 h-5 text-blue-600 animate-spin mr-3" aria-hidden="true" />
            <div>
              <p className="text-blue-900 dark:text-blue-200 font-medium">
                Transcribing Audio
              </p>
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                This may take a few minutes depending on the audio length...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-red-900 dark:text-red-200 font-medium">
                Transcription Failed
              </p>
              <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No Audio Available */}
      {!audioUrl && !transcription && (
        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-gray-500 mr-3" aria-hidden="true" />
            <div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                Audio Not Available
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                No audio file is available for transcription.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transcription Result */}
      {transcription && !isTranscribing && (
        <div className="space-y-4">
          {/* Confidence Score */}
          {transcription.confidence !== undefined && transcription.confidence > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Transcription Confidence:
              </span>
              <span className={`text-sm font-medium ${getConfidenceColor(transcription.confidence)}`}>
                {formatConfidence(transcription.confidence)}
              </span>
            </div>
          )}

          {/* Success Indicator */}
          <div className="flex items-center">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" aria-hidden="true" />
            <span className="text-sm text-green-700 dark:text-green-300">
              Transcription completed successfully
            </span>
          </div>

          {/* Transcription Text */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <div className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">
              {transcription.text || 'No speech was detected in the audio file.'}
            </div>
          </div>

          {/* Language and Metadata */}
          {transcription.language && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Language: {transcription.language}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TranscriptionComponent;
