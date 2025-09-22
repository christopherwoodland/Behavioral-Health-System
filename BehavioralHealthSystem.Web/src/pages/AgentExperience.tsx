import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle } from 'lucide-react';

/**
 * AgentExperience Component - Redirects to Speech Avatar Experience
 * 
 * This component now redirects users to the new Speech Avatar experience
 * which provides real-time AI agent interactions using Azure Speech services.
 */
export const AgentExperience: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-redirect after a short delay to show the user what's happening
    const timer = setTimeout(() => {
      navigate('/speech-avatar-experience');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const handleRedirectNow = () => {
    navigate('/speech-avatar-experience');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
        <div className="mb-6">
          <div className="bg-blue-100 dark:bg-blue-900 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Agent Experience Upgraded
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            We've upgraded the agent experience with our new Speech Avatar technology 
            for more natural, real-time conversations.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleRedirectNow}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            Go to Speech Avatar Experience
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            Redirecting automatically in a few seconds...
          </p>
        </div>

        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">
            What's New:
          </h3>
          <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 text-left">
            <li> Real-time speech interaction</li>
            <li> Visual avatar representation</li>
            <li> Enhanced behavioral health assessments</li>
            <li> Improved agent coordination</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AgentExperience;
