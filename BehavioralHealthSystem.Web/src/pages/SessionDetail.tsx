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
  Users,
  FileAudio,
  Activity,
  TrendingUp,
  Brain,
  Heart,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  Trash2
} from 'lucide-react';
import { config } from '@/config/constants';
import { env } from '@/utils/env';
import { useAccessibility } from '../hooks/useAccessibility';
import { apiService } from '../services/api';
import { fileGroupService } from '../services/fileGroupService';
import { formatDateTime, formatRelativeTime, formatQuantizedScoreLabel } from '../utils';
import RiskAssessmentComponent from '../components/RiskAssessment';
import TranscriptionComponent from '../components/TranscriptionComponent';
import { ExtendedRiskAssessmentButton } from '../components/ExtendedRiskAssessmentButton';
import { DSM5ConditionSelector } from '../components/DSM5ConditionSelector';
import type { SessionData, AppError, FileGroup } from '../types';

// Status configuration for consistent styling
const statusConfig = {
  queued: { color: 'yellow', icon: Clock, label: 'Queued', description: 'Waiting to be processed' },
  initiated: { color: 'blue', icon: Clock, label: 'Initiated', description: 'Session has been created' },
  running: { color: 'blue', icon: RefreshCw, label: 'Processing', description: 'Audio is being analyzed' },
  processing: { color: 'blue', icon: RefreshCw, label: 'Processing', description: 'Analysis in progress' },
  succeeded: { color: 'green', icon: CheckCircle, label: 'Completed', description: 'Analysis completed successfully' },
  success: { color: 'green', icon: CheckCircle, label: 'Completed', description: 'Analysis completed successfully' },
  completed: { color: 'green', icon: CheckCircle, label: 'Completed', description: 'Analysis completed successfully' },
  failed: { color: 'red', icon: XCircle, label: 'Failed', description: 'Analysis encountered an error' },
  error: { color: 'red', icon: XCircle, label: 'Error', description: 'An error occurred during processing' },
} as const;

const SessionDetail: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { announceToScreenReader } = useAccessibility();

  const [session, setSession] = useState<SessionData | null>(null);
  const [fileGroup, setFileGroup] = useState<FileGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [playableAudioUrl, setPlayableAudioUrl] = useState<string | null>(null); // For audio element src (blob URL)
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioFileSize, setAudioFileSize] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Feature flags
  const isAIRiskAssessmentEnabled = env.ENABLE_AI_RISK_ASSESSMENT;

  // DSM-5 condition selection state
  const [selectedDSM5Conditions, setSelectedDSM5Conditions] = useState<string[]>([]);

  // Collapsible section states
  const [isTranscriptionExpanded, setIsTranscriptionExpanded] = useState(true);
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(true);
  const [isRiskAssessmentExpanded, setIsRiskAssessmentExpanded] = useState(true);
  const [isExtendedRiskExpanded, setIsExtendedRiskExpanded] = useState(true);

  // Toast notifications state
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
    timestamp: number;
  }>>([]);

  // Toast notification functions
  const addToast = useCallback((type: 'error' | 'warning' | 'info' | 'success', title: string, message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newToast = {
      id,
      type,
      title,
      message,
      timestamp: Date.now()
    };
    setToasts(prev => [...prev, newToast]);

    // Auto-remove toast after 8 seconds for errors, 5 seconds for others
    const duration = type === 'error' ? 8000 : 5000;
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Load group data when session has a groupId
  const loadGroupData = useCallback(async (groupId: string) => {
    try {
      setLoadingGroup(true);
      const groupData = await fileGroupService.getFileGroup(groupId);
      setFileGroup(groupData);
    } catch (err) {
      console.error('Error loading group data:', err);
      // Don't show error to user for group loading failure, just log it
    } finally {
      setLoadingGroup(false);
    }
  }, []);

  // Load session data
  const loadSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      setError(null);

      const sessionData = await apiService.getSessionData(sessionId);
      setSession(sessionData);

      // Load group data if session belongs to a group
      if (sessionData.groupId) {
        loadGroupData(sessionData.groupId);
      } else {
        setFileGroup(null);
      }

      announceToScreenReader(`Session ${sessionId} loaded successfully`);
    } catch (err) {
      const appError = err as AppError;
      setError(appError);
      announceToScreenReader(`Error loading session: ${appError.message}`);
    } finally {
      setLoading(false);
    }
  }, [sessionId, announceToScreenReader, loadGroupData]);

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

  // Effect to load playable audio URL for audio element (handles blob storage auth)
  useEffect(() => {
    let isCancelled = false;

    const loadPlayableUrl = async () => {
      const audioUrl = session?.audioUrl;
      if (!audioUrl) {
        setPlayableAudioUrl(null);
        setAudioFileSize(null);
        return;
      }

      // If it's already a blob: URL (local file), use it directly
      if (audioUrl.startsWith('blob:')) {
        setPlayableAudioUrl(audioUrl);
        return;
      }

      // For remote URLs (Azurite/Azure Blob Storage), fetch through backend API
      try {
        console.log('🎵 SessionDetail: Loading playable audio URL from:', audioUrl);
        const audioBlob = await apiService.downloadAudioBlob(audioUrl);
        if (!isCancelled) {
          const blobUrl = URL.createObjectURL(audioBlob);
          setPlayableAudioUrl(blobUrl);
          setAudioFileSize(audioBlob.size);
          console.log('🎵 SessionDetail: Created playable blob URL:', blobUrl, 'size:', audioBlob.size);
        }
      } catch (error) {
        console.error('🎵 SessionDetail: Failed to load playable audio URL:', error);
        if (!isCancelled) {
          setPlayableAudioUrl(null);
          setAudioFileSize(null);
        }
      }
    };

    loadPlayableUrl();

    return () => {
      isCancelled = true;
      // Clean up old blob URL when session changes
      if (playableAudioUrl && playableAudioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(playableAudioUrl);
      }
    };
  }, [session?.audioUrl]);

  // Delete session
  const handleDeleteSession = useCallback(async () => {
    if (!sessionId || !session) return;

    const confirmed = window.confirm('Are you sure you want to delete this session? This action cannot be undone.');
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await apiService.deleteSessionData(sessionId);
      addToast('success', 'Session Deleted', 'The session has been successfully deleted.');
      announceToScreenReader('Session deleted successfully');

      // Navigate back to sessions list after successful deletion
      setTimeout(() => {
        navigate('/sessions');
      }, 1000);
    } catch (err) {
      const appError = err as AppError;
      addToast('error', 'Delete Failed', appError.message || 'Failed to delete session');
      announceToScreenReader(`Error deleting session: ${appError.message}`);
    } finally {
      setIsDeleting(false);
    }
  }, [sessionId, session, navigate, addToast, announceToScreenReader]);

  // Handle JSON view toggle
  const toggleRawJson = useCallback(() => {
    setShowRawJson(prev => {
      const newState = !prev;
      announceToScreenReader(`Raw JSON view ${newState ? 'enabled' : 'disabled'}`);
      return newState;
    });
  }, [announceToScreenReader]);

  // Format duration in mm:ss format
  const formatDuration = useCallback((seconds: number): string => {
    if (isNaN(seconds) || !isFinite(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Format file size in human-readable format
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }, []);

  // Get file extension from filename
  const getFileExtension = useCallback((filename: string): string => {
    const ext = filename.split('.').pop()?.toUpperCase() || 'Unknown';
    return ext;
  }, []);

  const formatInsightScoreText = useCallback((insight: string): string => {
    const depressionMatch = insight.match(/^Depression score:\s*(.+)$/i);
    if (depressionMatch) {
      return `Depression score: ${formatQuantizedScoreLabel(depressionMatch[1], 'depression')}`;
    }

    const anxietyMatch = insight.match(/^Anxiety score:\s*(.+)$/i);
    if (anxietyMatch) {
      return `Anxiety score: ${formatQuantizedScoreLabel(anxietyMatch[1], 'anxiety')}`;
    }

    return insight;
  }, []);

  // Audio controls
  const toggleAudioPlayback = useCallback(() => {
    if (!audioRef.current || !playableAudioUrl) return;

    if (audioPlaying) {
      audioRef.current.pause();
      setAudioPlaying(false);
      announceToScreenReader('Audio paused');
    } else {
      audioRef.current.play().catch((err) => {
        console.error('🎵 Audio playback error:', err);
        announceToScreenReader('Failed to play audio');
      });
      setAudioPlaying(true);
      announceToScreenReader('Audio playing');
    }
  }, [audioPlaying, playableAudioUrl, announceToScreenReader]);

  // Seek audio to specific position
  const seekAudio = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = percent * audioDuration;
  }, [audioDuration]);

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

  // Re-run session analysis
  const handleRerunSession = useCallback(() => {
    if (!session) return;

    const confirmed = window.confirm('Are you sure you want to re-run the analysis for this session? You will be redirected to the upload page with the session data pre-filled.');
    if (!confirmed) return;

    announceToScreenReader('Redirecting to upload page for re-run...');

    // Navigate to upload page with session data
    navigate('/upload', {
      state: {
        originalSessionId: session.sessionId,
        audioFileName: session.audioFileName,
        audioUrl: session.audioUrl,
        userMetadata: session.userMetadata
      }
    });
  }, [session, navigate, announceToScreenReader]);

  // Status badge component
  const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    // For any unknown status that contains "error" or "fail", treat as error
    const normalizedStatus = status.toLowerCase();
    let config = statusConfig[status as keyof typeof statusConfig];

    if (!config) {
      if (normalizedStatus.includes('error') || normalizedStatus.includes('fail')) {
        config = statusConfig.error;
      } else {
        // Default to initiated for unknown statuses instead of failed
        config = statusConfig.initiated;
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

        <div className="flex items-center gap-2">
          <button type="button"
            onClick={toggleRawJson}
            className="btn btn--secondary min-w-[100px] h-10 justify-center"
            aria-label={`${showRawJson ? 'Hide' : 'Show'} raw JSON data`}
          >
            {showRawJson ? <EyeOff className="w-4 h-4 mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
            {showRawJson ? 'Hide' : 'Show'}
          </button>

          <button type="button"
            onClick={refreshSession}
            disabled={isRefreshing}
            className="btn btn--secondary min-w-[100px] h-10 justify-center"
            aria-label="Refresh session data"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>

          <button type="button"
            onClick={handleRerunSession}
            className="btn btn--secondary min-w-[100px] h-10 justify-center"
            aria-label="Re-run analysis for this session"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Re-run
          </button>

          <button type="button"
            onClick={downloadSessionData}
            className="btn btn--primary min-w-[100px] h-10 justify-center"
            aria-label="Download session data as JSON"
          >
            <Download className="w-4 h-4 mr-1.5" aria-hidden="true" />
            Download
          </button>

          <button type="button"
            onClick={handleDeleteSession}
            disabled={isDeleting}
            className="btn btn--danger min-w-[100px] h-10 justify-center"
            aria-label="Delete this session"
          >
            <Trash2 className={`w-4 h-4 mr-1.5 ${isDeleting ? 'animate-pulse' : ''}`} aria-hidden="true" />
            {isDeleting ? 'Deleting...' : 'Delete'}
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

            {session.metadata_user_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <User className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  Metadata User ID
                </label>
                <div className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded border break-all">
                  {session.metadata_user_id}
                </div>
              </div>
            )}

            {session.groupId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Activity className="w-4 h-4 inline mr-1" aria-hidden="true" />
                  File Group
                </label>

                {/* Group Name (if available) */}
                {fileGroup ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-blue-900 dark:text-blue-100 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 rounded">
                      {fileGroup.groupName}
                      {fileGroup.description && (
                        <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          {fileGroup.description}
                        </div>
                      )}
                    </div>
                    <div className="font-mono text-xs bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded border text-gray-600 dark:text-gray-400">
                      ID: {session.groupId}
                    </div>
                    <Link
                      to={`/groups/${session.groupId}/sessions`}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      aria-label={`View all sessions in group ${fileGroup.groupName}`}
                    >
                      <Users className="w-4 h-4 mr-2" aria-hidden="true" />
                      View All Sessions in Group
                    </Link>
                  </div>
                ) : loadingGroup ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded border">
                    Loading group information...
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded border">
                      Group information not available
                    </div>
                    <div className="font-mono text-xs bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded border text-gray-600 dark:text-gray-400">
                      ID: {session.groupId}
                    </div>
                    <Link
                      to={`/groups/${session.groupId}/sessions`}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      aria-label={`View all sessions in this group`}
                    >
                      <Users className="w-4 h-4 mr-2" aria-hidden="true" />
                      View All Sessions in Group
                    </Link>
                  </div>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  This session belongs to a file group. Click above to see all related sessions.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Audio Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <FileAudio className="w-5 h-5 mr-2" aria-hidden="true" />
            Audio Information
          </h2>

          <div className="space-y-4">
            {/* File Details Grid */}
            {session.audioFileName && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    File Name
                  </label>
                  <span className="text-sm text-gray-900 dark:text-white font-medium">
                    {session.audioFileName}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                    Format
                  </label>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {getFileExtension(session.audioFileName)}
                  </span>
                </div>
                {audioFileSize && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      File Size
                    </label>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {formatFileSize(audioFileSize)}
                    </span>
                  </div>
                )}
                {audioDuration !== null && audioDuration > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                      Duration
                    </label>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {formatDuration(audioDuration)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Audio Player */}
            {session.audioUrl && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Audio Playback
                </label>

                {!playableAudioUrl ? (
                  <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Loading audio...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Custom Audio Player */}
                    <div className="flex items-center space-x-3">
                      <button
                        type="button"
                        onClick={toggleAudioPlayback}
                        className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                        aria-label={audioPlaying ? 'Pause audio' : 'Play audio'}
                      >
                        {audioPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                      </button>

                      {/* Progress Bar */}
                      <div className="flex-1">
                        <div
                          className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer overflow-hidden"
                          onClick={seekAudio}
                          role="slider"
                          aria-label="Audio progress"
                          aria-valuemin={0}
                          aria-valuemax={audioDuration || 100}
                          aria-valuenow={audioCurrentTime}
                        >
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-100"
                            style={{ width: audioDuration ? `${(audioCurrentTime / audioDuration) * 100}%` : '0%' }}
                          />
                        </div>
                      </div>

                      {/* Time Display */}
                      <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 font-mono min-w-[80px] text-right">
                        {formatDuration(audioCurrentTime)} / {formatDuration(audioDuration || 0)}
                      </div>
                    </div>

                    {/* Hidden Audio Element */}
                    <audio
                      ref={audioRef}
                      src={playableAudioUrl}
                      onPlay={() => setAudioPlaying(true)}
                      onPause={() => setAudioPlaying(false)}
                      onEnded={() => {
                        setAudioPlaying(false);
                        setAudioCurrentTime(0);
                      }}
                      onTimeUpdate={(e) => setAudioCurrentTime(e.currentTarget.currentTime)}
                      onLoadedMetadata={(e) => {
                        setAudioDuration(e.currentTarget.duration);
                        console.log('🎵 Audio metadata loaded, duration:', e.currentTarget.duration);
                      }}
                      onError={(e) => {
                        console.error('🎵 Audio error:', e);
                        setAudioPlaying(false);
                        announceToScreenReader('Audio playback failed - file may not be accessible');
                      }}
                      className="hidden"
                      preload="metadata"
                      controlsList="nodownload"
                    />
                  </div>
                )}
              </div>
            )}

            {/* No Audio Available */}
            {!session.audioUrl && !session.audioFileName && (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                No audio file associated with this session.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audio Transcription */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsTranscriptionExpanded(!isTranscriptionExpanded)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          aria-expanded={isTranscriptionExpanded}
          aria-controls="transcription-content"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <FileAudio className="w-5 h-5 mr-2" aria-hidden="true" />
            Audio Transcription
          </h2>
          {isTranscriptionExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" aria-hidden="true" />
          )}
        </button>
        {isTranscriptionExpanded && (
          <div id="transcription-content" className="border-t border-gray-200 dark:border-gray-700">
            <TranscriptionComponent
              audioUrl={session.audioUrl}
              sessionId={session.sessionId}
              audioFileName={session.audioFileName}
              existingTranscription={session.transcription}
            />
          </div>
        )}
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            aria-expanded={isAnalysisExpanded}
            aria-controls="analysis-content"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
              <Activity className="w-5 h-5 mr-2" aria-hidden="true" />
              Analysis Results
            </h2>
            {isAnalysisExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" aria-hidden="true" />
            )}
          </button>
          {isAnalysisExpanded && (
            <div id="analysis-content" className="p-6 border-t border-gray-200 dark:border-gray-700">

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
                  {(((session.prediction as any)?.predicted_score_depression !== undefined && (session.prediction as any)?.predicted_score_depression !== null && (session.prediction as any)?.predicted_score_depression !== '') || (session.prediction?.predictedScoreDepression !== undefined && session.prediction?.predictedScoreDepression !== null && session.prediction?.predictedScoreDepression !== '') || session.analysisResults?.depressionScore !== undefined) && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          Depression Score
                        </span>
                        <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                      </div>
                      <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {/* Prioritize descriptive string values over numeric values */}
                        {(session.prediction as any)?.predicted_score_depression !== undefined && (session.prediction as any)?.predicted_score_depression !== null && (session.prediction as any)?.predicted_score_depression !== '' ?
                           formatQuantizedScoreLabel((session.prediction as any).predicted_score_depression, 'depression') :
                         session.prediction?.predictedScoreDepression !== undefined && session.prediction?.predictedScoreDepression !== null && session.prediction?.predictedScoreDepression !== '' ?
                           formatQuantizedScoreLabel(session.prediction.predictedScoreDepression, 'depression') :
                         session.analysisResults?.depressionScore !== undefined && session.analysisResults?.depressionScore !== null ?
                           formatQuantizedScoreLabel(session.analysisResults.depressionScore, 'depression') :
                           'N/A'}
                      </div>
                    </div>
                  )}

                  {/* Anxiety Score */}
                  {(((session.prediction as any)?.predicted_score_anxiety !== undefined && (session.prediction as any)?.predicted_score_anxiety !== null && (session.prediction as any)?.predicted_score_anxiety !== '') || (session.prediction?.predictedScoreAnxiety !== undefined && session.prediction?.predictedScoreAnxiety !== null && session.prediction?.predictedScoreAnxiety !== '') || session.analysisResults?.anxietyScore !== undefined) && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                          Anxiety Score
                        </span>
                        <Heart className="w-4 h-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                      </div>
                      <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {/* Prioritize descriptive string values over numeric values */}
                        {(session.prediction as any)?.predicted_score_anxiety !== undefined && (session.prediction as any)?.predicted_score_anxiety !== null && (session.prediction as any)?.predicted_score_anxiety !== '' ?
                           formatQuantizedScoreLabel((session.prediction as any).predicted_score_anxiety, 'anxiety') :
                         session.prediction?.predictedScoreAnxiety !== undefined && session.prediction?.predictedScoreAnxiety !== null && session.prediction?.predictedScoreAnxiety !== '' ?
                           formatQuantizedScoreLabel(session.prediction.predictedScoreAnxiety, 'anxiety') :
                         session.analysisResults?.anxietyScore !== undefined && session.analysisResults?.anxietyScore !== null ?
                           formatQuantizedScoreLabel(session.analysisResults.anxietyScore, 'anxiety') :
                           'N/A'}
                      </div>
                    </div>
                  )}

                  {/* Note: Risk Level and Confidence scores have been removed per user request */}
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
                        {formatInsightScoreText(insight)}
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
        </div>
      )}

      {/* AI Risk Assessment (Quick) - Conditionally rendered based on feature flag */}
      {isAIRiskAssessmentEnabled && (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsRiskAssessmentExpanded(!isRiskAssessmentExpanded)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          aria-expanded={isRiskAssessmentExpanded}
          aria-controls="risk-assessment-content"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <Brain className="w-5 h-5 mr-2" aria-hidden="true" />
            AI Risk Assessment (Quick)
          </h2>
          {isRiskAssessmentExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" aria-hidden="true" />
          )}
        </button>
        {isRiskAssessmentExpanded && (
          <div id="risk-assessment-content" className="border-t border-gray-200 dark:border-gray-700">
                  <RiskAssessmentComponent
              sessionId={session.sessionId}
              existingAssessment={session.riskAssessment || null}
              onAssessmentUpdated={(assessment) => {
                setSession(prev => prev ? { ...prev, riskAssessment: assessment } : null);
              }}
              onStart={() => {
                addToast('info', 'Generating Assessment', 'AI Risk Assessment generation started...');
                announceToScreenReader('AI risk assessment generation started');
              }}
              onSuccess={(assessment) => {
                addToast('success', 'Assessment Complete', `AI Risk Assessment generated successfully with ${assessment.overallRiskLevel} risk level`);
                announceToScreenReader('AI risk assessment completed successfully');
              }}
              onError={(errorMessage) => {
                addToast('error', 'Assessment Failed', `AI risk assessment failed: ${errorMessage}`);
                announceToScreenReader(`AI assessment error: ${errorMessage}`);
              }}
            />
          </div>
        )}
      </div>
      )}

      {/* Extended AI Risk Assessment - Conditionally rendered based on feature flag */}
      {isAIRiskAssessmentEnabled && (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsExtendedRiskExpanded(!isExtendedRiskExpanded)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          aria-expanded={isExtendedRiskExpanded}
          aria-controls="extended-risk-content"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <Brain className="w-5 h-5 mr-2" aria-hidden="true" />
            AI Risk Assessment (Extended)
          </h2>
          {isExtendedRiskExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" aria-hidden="true" />
          )}
        </button>
        {isExtendedRiskExpanded && (
          <div id="extended-risk-content" className="border-t border-gray-200 dark:border-gray-700">
            <div className="p-6 space-y-6">
              {/* DSM-5 Condition Selector */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Select Mental Health Conditions for Assessment
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Choose specific DSM-5 conditions to include in the extended risk assessment. If no conditions are selected,
                  the assessment will default to schizophrenia evaluation only.
                </p>
                <div className="relative">
                  <DSM5ConditionSelector
                    selectedConditions={selectedDSM5Conditions}
                    onSelectionChange={setSelectedDSM5Conditions}
                    maxSelections={5}
                  />
                </div>
              </div>

              {/* Extended Risk Assessment Component */}
              <ExtendedRiskAssessmentButton
                sessionId={session.sessionId}
                apiBaseUrl={config.api.baseUrl}
                existingAssessment={session.extendedRiskAssessment}
                selectedDSM5Conditions={selectedDSM5Conditions}
                onStart={() => {
                  addToast('info', 'Assessment Started', 'Extended risk assessment job has been initiated and is now processing...');
                  announceToScreenReader('Extended risk assessment started');
                }}
                onComplete={(assessment) => {
                  setSession(prev => prev ? { ...prev, extendedRiskAssessment: assessment } : null);
                  addToast('success', 'Assessment Complete', 'Extended risk assessment has been generated successfully');
                  announceToScreenReader('Extended risk assessment completed successfully');
                }}
                onError={(errorMessage) => {
                  addToast('error', 'Assessment Failed', `Extended risk assessment failed: ${errorMessage}`);
                  announceToScreenReader(`Extended assessment error: ${errorMessage}`);
                }}
              />
            </div>
          </div>
        )}
      </div>
      )}

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`max-w-sm w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg border-l-4 p-4 transition-all duration-300 transform ${
                toast.type === 'error' ? 'border-red-500' :
                toast.type === 'warning' ? 'border-yellow-500' :
                toast.type === 'success' ? 'border-green-500' : 'border-blue-500'
              }`}
              role="alert"
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {toast.type === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
                  )}
                  {toast.type === 'warning' && (
                    <AlertCircle className="h-5 w-5 text-yellow-500" aria-hidden="true" />
                  )}
                  {toast.type === 'success' && (
                    <CheckCircle className="h-5 w-5 text-green-500" aria-hidden="true" />
                  )}
                  {toast.type === 'info' && (
                    <Info className="h-5 w-5 text-blue-500" aria-hidden="true" />
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {toast.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    {toast.message}
                  </p>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => removeToast(toast.id)}
                    className="inline-flex text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 rounded"
                    aria-label="Dismiss notification"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SessionDetail;
