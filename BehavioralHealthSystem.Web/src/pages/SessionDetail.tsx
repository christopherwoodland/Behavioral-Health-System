import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  RefreshCw, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  XCircle,
  Eye,
  EyeOff,
  Play,
  Pause,
  Calendar,
  User,
  FileAudio,
  Activity,
  TrendingUp,
  Brain,
  Heart,
  Info
} from 'lucide-react';
import { useAccessibility } from '../hooks/useAccessibility';
import { apiService } from '../services/api';
import { formatDateTime, formatRelativeTime } from '../utils';
import RiskAssessmentComponent from '../components/RiskAssessment';
import type { SessionData, AppError } from '../types';

// Status configuration for consistent styling
const statusConfig = {
  queued: { color: 'yellow', icon: Clock, label: 'Queued', description: 'Waiting to be processed' },
  initiated: { color: 'blue', icon: Clock, label: 'Initiated', description: 'Session has been created' },
  running: { color: 'blue', icon: RefreshCw, label: 'Processing', description: 'Audio is being analyzed' },
  processing: { color: 'blue', icon: RefreshCw, label: 'Processing', description: 'Analysis in progress' },
  succeeded: { color: 'green', icon: CheckCircle, label: 'Completed', description: 'Analysis completed successfully' },
  success: { color: 'green', icon: CheckCircle, label: 'Completed', description: 'Analysis completed successfully' },
  failed: { color: 'red', icon: XCircle, label: 'Failed', description: 'Analysis encountered an error' },
  error: { color: 'red', icon: XCircle, label: 'Error', description: 'An error occurred during processing' },
} as const;

const SessionDetail: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { announceToScreenReader } = useAccessibility();

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load session data
  const loadSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      setError(null);
      
      const sessionData = await apiService.getSessionData(sessionId);
      setSession(sessionData);
      announceToScreenReader(`Session ${sessionId} loaded successfully`);
    } catch (err) {
      const appError = err as AppError;
      setError(appError);
      announceToScreenReader(`Error loading session: ${appError.message}`);
    } finally {
      setLoading(false);
    }
  }, [sessionId, announceToScreenReader]);

  // Refresh session data
  const refreshSession = useCallback(async () => {
    setIsRefreshing(true);
    await loadSession();
    setIsRefreshing(false);
    announceToScreenReader('Session data refreshed');
  }, [loadSession, announceToScreenReader]);

  // Load session on component mount
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Handle JSON view toggle
  const toggleRawJson = useCallback(() => {
    setShowRawJson(prev => {
      const newState = !prev;
      announceToScreenReader(`Raw JSON view ${newState ? 'enabled' : 'disabled'}`);
      return newState;
    });
  }, [announceToScreenReader]);

  // Audio controls
  const toggleAudioPlayback = useCallback(() => {
    if (!audioRef.current) return;
    
    if (audioPlaying) {
      audioRef.current.pause();
      setAudioPlaying(false);
      announceToScreenReader('Audio paused');
    } else {
      audioRef.current.play().catch(() => {
        announceToScreenReader('Failed to play audio');
      });
      setAudioPlaying(true);
      announceToScreenReader('Audio playing');
    }
  }, [audioPlaying, announceToScreenReader]);

  // Download session data
  const downloadSessionData = useCallback(() => {
    if (!session) return;

    const dataStr = JSON.stringify(session, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `session-${session.sessionId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    announceToScreenReader('Session data download started');
  }, [session, announceToScreenReader]);

  // Status badge component
  const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    // For any unknown status that contains "error" or "fail", treat as error
    const normalizedStatus = status.toLowerCase();
    let config = statusConfig[status as keyof typeof statusConfig];
    
    if (!config) {
      if (normalizedStatus.includes('error') || normalizedStatus.includes('fail')) {
        config = statusConfig.error;
      } else {
        config = statusConfig.failed; // Default fallback
      }
    }
    
    const Icon = config.icon;
    
    return (
      <div className="flex items-center space-x-2">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            config.color === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
            config.color === 'blue' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
            config.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}
          role="status"
          aria-label={`Status: ${config.label}`}
        >
          <Icon className={`w-4 h-4 mr-2 ${config.color === 'blue' && status === 'processing' ? 'animate-spin' : ''}`} aria-hidden="true" />
          {config.label}
        </span>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {config.description}
        </span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mr-3" aria-hidden="true" />
          <span className="text-lg text-gray-900 dark:text-white">Loading session details...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3" aria-hidden="true" />
            <div>
              <h3 className="text-lg font-medium text-red-900 dark:text-red-200">
                Error Loading Session
              </h3>
              <p className="text-red-700 dark:text-red-300 mt-1">{error.message}</p>
              <div className="mt-4 space-x-3">
                <button type="button"
                  onClick={loadSession}
                  className="btn btn--primary"
                  aria-label="Retry loading session"
                >
                  Try Again
                </button>
                <Link to="/sessions" className="btn btn--secondary">
                  Back to Sessions
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Session Not Found
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            The requested session could not be found.
          </p>
          <Link to="/sessions" className="btn btn--primary">
            Back to Sessions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button type="button"
            onClick={() => navigate('/sessions')}
            className="btn btn--secondary"
            aria-label="Back to sessions list"
          >
            <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
            Back to Sessions
          </button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Session Details
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              ID: {session.sessionId}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={toggleRawJson}
            className="btn btn--secondary"
            aria-label={`${showRawJson ? 'Hide' : 'Show'} raw JSON data`}
          >
            {showRawJson ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {showRawJson ? 'Hide JSON' : 'Show JSON'}
          </button>
          
          <button type="button"
            onClick={refreshSession}
            disabled={isRefreshing}
            className="btn btn--secondary"
            aria-label="Refresh session data"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
          
          <button type="button"
            onClick={downloadSessionData}
            className="btn btn--primary"
            aria-label="Download session data as JSON"
          >
            <Download className="w-4 h-4 mr-2" aria-hidden="true" />
            Download
          </button>
        </div>
      </div>

      {/* Raw JSON View */}
      {showRawJson && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Info className="w-5 h-5 mr-2" aria-hidden="true" />
            Raw Session Data
          </h2>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto">
            <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-all">
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Session Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Info className="w-5 h-5 mr-2" aria-hidden="true" />
            Basic Information
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <StatusBadge status={session.status} />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  Created
                </label>
                <div className="text-sm">
                  <div className="text-gray-900 dark:text-white">
                    {formatRelativeTime(session.createdAt)}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">
                    {formatDateTime(session.createdAt)}
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  Last Updated
                </label>
                <div className="text-sm">
                  <div className="text-gray-900 dark:text-white">
                    {formatRelativeTime(session.updatedAt)}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">
                    {formatDateTime(session.updatedAt)}
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <User className="w-4 h-4 inline mr-1" aria-hidden="true" />
                User ID
              </label>
              <div className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded border break-all">
                {session.userId}
              </div>
            </div>
          </div>
        </div>

        {/* Audio Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <FileAudio className="w-5 h-5 mr-2" aria-hidden="true" />
            Audio Information
          </h2>
          
          <div className="space-y-4">
            {session.audioFileName && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  File Name
                </label>
                <div className="text-sm text-gray-900 dark:text-white font-medium">
                  {session.audioFileName}
                </div>
              </div>
            )}
            
            {session.audioUrl && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Audio File
                </label>
                <div className="flex items-center space-x-3">
                  <button type="button"
                    onClick={toggleAudioPlayback}
                    className="btn btn--secondary"
                    aria-label={`${audioPlaying ? 'Pause' : 'Play'} audio`}
                  >
                    {audioPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {audioPlaying ? 'Playing audio...' : 'Audio playback available'}
                  </span>
                </div>
                <audio
                  ref={audioRef}
                  src={session.audioUrl}
                  onPlay={() => setAudioPlaying(true)}
                  onPause={() => setAudioPlaying(false)}
                  onEnded={() => setAudioPlaying(false)}
                  onError={() => {
                    setAudioPlaying(false);
                    announceToScreenReader('Audio playback failed - file may not be accessible');
                  }}
                  className="hidden"
                  preload="metadata"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Metadata */}
      {session.userMetadata && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <User className="w-5 h-5 mr-2" aria-hidden="true" />
            Patient Information
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {session.userMetadata.age && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Age
                </label>
                <div className="text-sm text-gray-900 dark:text-white">
                  {session.userMetadata.age} years
                </div>
              </div>
            )}
            
            {session.userMetadata.gender && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Gender
                </label>
                <div className="text-sm text-gray-900 dark:text-white capitalize">
                  {session.userMetadata.gender.replace(/[_-]/g, ' ')}
                </div>
              </div>
            )}
            
            {session.userMetadata.weight && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Weight
                </label>
                <div className="text-sm text-gray-900 dark:text-white">
                  {session.userMetadata.weight} lbs
                </div>
              </div>
            )}
            
            {session.userMetadata.race && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Race
                </label>
                <div className="text-sm text-gray-900 dark:text-white capitalize">
                  {session.userMetadata.race}
                </div>
              </div>
            )}
            
            {session.userMetadata.ethnicity && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ethnicity
                </label>
                <div className="text-sm text-gray-900 dark:text-white">
                  {session.userMetadata.ethnicity}
                </div>
              </div>
            )}
            
            {session.userMetadata.zipcode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ZIP Code
                </label>
                <div className="text-sm text-gray-900 dark:text-white font-mono">
                  {session.userMetadata.zipcode}
                </div>
              </div>
            )}
            
            {session.userMetadata.language !== undefined && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Primary Language English
                </label>
                <div className="text-sm text-gray-900 dark:text-white">
                  {session.userMetadata.language ? 'Yes' : 'No'}
                </div>
              </div>
            )}
            
            {session.userMetadata.sessionNotes && (
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Session Notes
                </label>
                <div className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded border">
                  {session.userMetadata.sessionNotes}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {(session.analysisResults || session.prediction) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Activity className="w-5 h-5 mr-2" aria-hidden="true" />
            Analysis Results
          </h2>
          
          <div className="space-y-6">
            {/* Mental Health Scores */}
            {(session.analysisResults || session.prediction) && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                  <Brain className="w-5 h-5 mr-2" aria-hidden="true" />
                  Mental Health Scores
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Depression Score */}
                  {(session.analysisResults?.depressionScore || (session.prediction as any)?.predicted_score_depression) && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          Depression Score
                        </span>
                        <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                      </div>
                      <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {session.analysisResults?.depressionScore?.toFixed(2) || 
                         ((session.prediction as any)?.predicted_score_depression ? 
                           (session.prediction as any).predicted_score_depression.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 
                           'N/A')}
                      </div>
                    </div>
                  )}
                  
                  {/* Anxiety Score */}
                  {(session.analysisResults?.anxietyScore || (session.prediction as any)?.predicted_score_anxiety) && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                          Anxiety Score
                        </span>
                        <Heart className="w-4 h-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                      </div>
                      <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {session.analysisResults?.anxietyScore?.toFixed(2) || 
                         ((session.prediction as any)?.predicted_score_anxiety ? 
                           (session.prediction as any).predicted_score_anxiety.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : 
                           'N/A')}
                      </div>
                    </div>
                  )}
                  
                  {/* Risk Level */}
                  {session.analysisResults?.riskLevel && (
                    <div className={`p-4 rounded-lg border ${
                      session.analysisResults.riskLevel === 'high' 
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        : session.analysisResults.riskLevel === 'medium'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                        : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${
                          session.analysisResults.riskLevel === 'high' 
                            ? 'text-red-700 dark:text-red-300'
                            : session.analysisResults.riskLevel === 'medium'
                            ? 'text-yellow-700 dark:text-yellow-300'
                            : 'text-green-700 dark:text-green-300'
                        }`}>
                          Risk Level
                        </span>
                        <AlertCircle className={`w-4 h-4 ${
                          session.analysisResults.riskLevel === 'high' 
                            ? 'text-red-600 dark:text-red-400'
                            : session.analysisResults.riskLevel === 'medium'
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-green-600 dark:text-green-400'
                        }`} aria-hidden="true" />
                      </div>
                      <div className={`text-2xl font-bold ${
                        session.analysisResults.riskLevel === 'high' 
                          ? 'text-red-900 dark:text-red-100'
                          : session.analysisResults.riskLevel === 'medium'
                          ? 'text-yellow-900 dark:text-yellow-100'
                          : 'text-green-900 dark:text-green-100'
                      }`}>
                        {session.analysisResults.riskLevel.charAt(0).toUpperCase() + session.analysisResults.riskLevel.slice(1)}
                      </div>
                    </div>
                  )}

                  {/* Confidence Score */}
                  {session.analysisResults?.confidence && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Confidence
                        </span>
                        <TrendingUp className="w-4 h-4 text-gray-600 dark:text-gray-400" aria-hidden="true" />
                      </div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {(session.analysisResults.confidence * 100).toFixed(1)}%
                      </div>
                    </div>
                  )}
                  
                  {/* Note: Overall Score (predicted_score) is deprecated and no longer displayed */}
                </div>
              </div>
            )}

            {/* Clinical Insights */}
            {session.analysisResults?.insights && session.analysisResults.insights.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Clinical Insights
                </h3>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <ul className="space-y-2">
                    {session.analysisResults.insights.map((insight, index) => (
                      <li key={index} className="text-sm text-yellow-800 dark:text-yellow-200 flex items-start">
                        <span className="inline-block w-2 h-2 bg-yellow-600 dark:bg-yellow-400 rounded-full mt-2 mr-2 flex-shrink-0" aria-hidden="true"></span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Completion Information */}
            {session.analysisResults?.completedAt && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Analysis Completion
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="flex items-center text-sm">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-2" aria-hidden="true" />
                    <span className="text-gray-700 dark:text-gray-300 mr-2">
                      Completed:
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatDateTime(session.analysisResults.completedAt)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Risk Assessment */}
      <RiskAssessmentComponent 
        sessionId={session.sessionId}
        existingAssessment={session.riskAssessment || null}
        onAssessmentUpdated={(assessment) => {
          setSession(prev => prev ? { ...prev, riskAssessment: assessment } : null);
        }}
      />
    </div>
  );
};

export default SessionDetail;
