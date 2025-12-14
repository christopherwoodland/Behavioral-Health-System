import React from 'react';
import { Loader2, Check, X, Sparkles } from 'lucide-react';

interface GrammarCorrectionModalProps {
  isOpen: boolean;
  isLoading: boolean;
  originalText: string;
  correctedText: string | null;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}

/**
 * Modal component for displaying grammar correction results with accept/reject options
 */
export const GrammarCorrectionModal: React.FC<GrammarCorrectionModalProps> = ({
  isOpen,
  isLoading,
  originalText,
  correctedText,
  onAccept,
  onReject,
  onClose,
}) => {
  if (!isOpen) return null;

  // Check if there are actual changes
  const hasChanges = correctedText !== null && correctedText !== originalText;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Background overlay */}
      <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" onClick={onClose}></div>

      {/* Modal panel */}
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Sparkles className="w-5 h-5 text-white mr-2" />
                <h3 className="text-lg font-semibold text-white" id="modal-title">
                  AI Grammar Correction
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-600 dark:text-gray-400 text-center">
                  Analyzing text with AI agent...
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  This may take a few seconds
                </p>
              </div>
            ) : correctedText === null ? (
              <div className="text-center py-8">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                  <X className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Unable to process text. Please try again.
                </p>
              </div>
            ) : !hasChanges ? (
              <div className="text-center py-8">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
                  <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Your text looks great! No corrections needed.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Original Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Original Text
                  </label>
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                      {originalText}
                    </p>
                  </div>
                </div>

                {/* Corrected Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Corrected Text
                  </label>
                  <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">
                      {correctedText}
                    </p>
                  </div>
                </div>

                {/* Changes indicator */}
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center italic">
                  Review the changes above and choose to accept or reject them
                </p>
              </div>
            )}
          </div>

          {/* Footer with actions */}
          <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 flex justify-end gap-3">
            {isLoading ? (
              <button
                onClick={onClose}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Cancel
              </button>
            ) : hasChanges ? (
              <>
                <button
                  onClick={onReject}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                >
                  <X className="w-4 h-4 mr-1.5" />
                  Reject Changes
                </button>
                <button
                  onClick={onAccept}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  Accept Changes
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GrammarCorrectionModal;
