import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Trash2,
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  Brain,
  Heart,
  Calendar,
  FileAudio,
  BarChart3
} from 'lucide-react';
import { useAccessibility } from '../hooks/useAccessibility';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { fileGroupService } from '../services/fileGroupService';
import { getUserId, formatRelativeTime, formatDateTime } from '../utils';
import type { SessionData, AppError, FileGroup } from '../types';

// Status configuration for consistent styling
const statusConfig = {
  queued: { color: 'yellow', icon: Clock, label: 'Queued' },
  initiated: { color: 'blue', icon: Clock, label: 'Initiated' },
  running: { color: 'blue', icon: RefreshCw, label: 'Processing' },
  processing: { color: 'blue', icon: RefreshCw, label: 'Processing' },
  succeeded: { color: 'green', icon: CheckCircle, label: 'Completed' },
  success: { color: 'green', icon: CheckCircle, label: 'Completed' },
  completed: { color: 'green', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'red', icon: XCircle, label: 'Failed' },
  error: { color: 'red', icon: XCircle, label: 'Error' },
} as const;

// Status Badge Component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config = statusConfig[status as keyof typeof statusConfig] || {
    color: 'gray',
    icon: AlertCircle,
    label: status || 'Unknown'
  };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      config.color === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
      config.color === 'blue' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
      config.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
      config.color === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
      'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }`}>
      <Icon className="w-3 h-3 mr-1" aria-hidden="true" />
      {config.label}
    </span>
  );
};

interface GroupSessionsDetailProps {
  // Optional prop to allow usage as a component
  groupId?: string;
}

const GroupSessionsDetail: React.FC<GroupSessionsDetailProps> = ({ groupId: propGroupId }) => {
  const { groupId: paramGroupId } = useParams<{ groupId: string }>();
  const groupId = propGroupId || paramGroupId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { announceToScreenReader } = useAccessibility();

  const [group, setGroup] = useState<FileGroup | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Get authenticated user ID for API calls
  const getAuthenticatedUserId = useCallback((): string => {
    return user?.id || getUserId();
  }, [user?.id]);

  // Load group information
  const loadGroup = useCallback(async () => {
    if (!groupId) return;

    try {
      setLoadingGroup(true);
      const groupData = await fileGroupService.getFileGroup(groupId);
      setGroup(groupData);
      if (groupData) {
        announceToScreenReader(`Group loaded: ${groupData.groupName}`);
      }
    } catch (err) {
      console.error('Failed to load group:', err);
      announceToScreenReader('Failed to load group information');
    } finally {
      setLoadingGroup(false);
    }
  }, [groupId, announceToScreenReader]);

  // Load sessions in this group
  const loadGroupSessions = useCallback(async () => {
    if (!groupId) return;

    try {
      setLoading(true);
      setError(null);
      
      const userId = getAuthenticatedUserId();
      const response = await apiService.getUserSessions(userId);
      
      // Filter sessions that belong to this group
      const groupSessions = response.sessions.filter(session => session.groupId === groupId);
      
      setSessions(groupSessions);
      announceToScreenReader(`${groupSessions.length} sessions loaded for this group`);
    } catch (err) {
      const appError = err as AppError;
      setError(appError);
      announceToScreenReader(`Error loading group sessions: ${appError.message}`);
    } finally {
      setLoading(false);
    }
  }, [groupId, getAuthenticatedUserId, announceToScreenReader]);

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadGroup(), loadGroupSessions()]);
    setRefreshing(false);
  }, [loadGroup, loadGroupSessions]);

  // Load data on mount and when groupId changes
  useEffect(() => {
    if (groupId) {
      loadGroup();
      loadGroupSessions();
    }
  }, [groupId, loadGroup, loadGroupSessions]);

  // Calculate group analytics
  const groupAnalytics = useMemo(() => {
    const completedSessions = sessions.filter(s => s.status === 'succeeded' || s.status === 'completed');
    const withPredictions = completedSessions.filter(s => s.prediction || s.analysisResults);
    
    // Extract depression scores
    const depressionScores = withPredictions.map(session => {
      const prediction = session.prediction as any;
      const analysisResults = session.analysisResults;
      return prediction?.predicted_score_depression || 
             prediction?.predictedScoreDepression ||
             analysisResults?.depressionScore;
    }).filter(score => score !== undefined && score !== null);

    // Extract anxiety scores
    const anxietyScores = withPredictions.map(session => {
      const prediction = session.prediction as any;
      const analysisResults = session.analysisResults;
      return prediction?.predicted_score_anxiety || 
             prediction?.predictedScoreAnxiety ||
             analysisResults?.anxietyScore;
    }).filter(score => score !== undefined && score !== null);

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      withPredictions: withPredictions.length,
      avgDepression: depressionScores.length > 0 ? 
        depressionScores.reduce((a, b) => Number(a) + Number(b), 0) / depressionScores.length : null,
      avgAnxiety: anxietyScores.length > 0 ? 
        anxietyScores.reduce((a, b) => Number(a) + Number(b), 0) / anxietyScores.length : null,
      depressionTrend: depressionScores.length >= 2 ? 
        (Number(depressionScores[depressionScores.length - 1]) - Number(depressionScores[0])) : 0,
      anxietyTrend: anxietyScores.length >= 2 ? 
        (Number(anxietyScores[anxietyScores.length - 1]) - Number(anxietyScores[0])) : 0
    };
  }, [sessions]);

  if (!groupId) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Group Specified
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Please provide a valid group ID.
          </p>
          <Link to="/sessions" className="btn btn--primary">
            Back to Sessions
          </Link>
        </div>
      </div>
    );
  }

  if (loading && loadingGroup) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mr-3" aria-hidden="true" />
          <span className="text-lg text-gray-700 dark:text-gray-300">
            Loading group sessions...
          </span>
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
                Error Loading Group Sessions
              </h3>
              <p className="text-red-700 dark:text-red-300 mt-1">{error.message}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-4 btn btn--primary"
                aria-label="Retry loading group sessions"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => navigate('/sessions')}
            className="btn btn--secondary"
            aria-label="Back to sessions list"
          >
            <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
            Back to Sessions
          </button>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {group ? group.groupName : 'Group Sessions'}
            </h1>
            {group?.description && (
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                {group.description}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn--secondary"
            aria-label="Refresh group sessions"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {/* Group Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Sessions
            </span>
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {groupAnalytics.totalSessions}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {groupAnalytics.completedSessions} completed
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Avg Depression
            </span>
            <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {groupAnalytics.avgDepression !== null ? groupAnalytics.avgDepression.toFixed(1) : '—'}
          </div>
          {groupAnalytics.depressionTrend !== 0 && (
            <div className={`flex items-center text-xs mt-1 ${
              groupAnalytics.depressionTrend > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {groupAnalytics.depressionTrend > 0 ? (
                <TrendingUp className="w-3 h-3 mr-1" aria-hidden="true" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" aria-hidden="true" />
              )}
              {Math.abs(groupAnalytics.depressionTrend).toFixed(1)} trend
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Avg Anxiety
            </span>
            <Heart className="w-4 h-4 text-red-600 dark:text-red-400" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {groupAnalytics.avgAnxiety !== null ? groupAnalytics.avgAnxiety.toFixed(1) : '—'}
          </div>
          {groupAnalytics.anxietyTrend !== 0 && (
            <div className={`flex items-center text-xs mt-1 ${
              groupAnalytics.anxietyTrend > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {groupAnalytics.anxietyTrend > 0 ? (
                <TrendingUp className="w-3 h-3 mr-1" aria-hidden="true" />
              ) : (
                <TrendingDown className="w-3 h-3 mr-1" aria-hidden="true" />
              )}
              {Math.abs(groupAnalytics.anxietyTrend).toFixed(1)} trend
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              With Analysis
            </span>
            <BarChart3 className="w-4 h-4 text-green-600 dark:text-green-400" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {groupAnalytics.withPredictions}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {groupAnalytics.totalSessions > 0 ? 
              Math.round((groupAnalytics.withPredictions / groupAnalytics.totalSessions) * 100) : 0}% analyzed
          </div>
        </div>
      </div>

      {/* Sessions List */}
      {sessions.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Sessions in This Group ({sessions.length})
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full" role="table" aria-label="Group sessions">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Session
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Depression Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Anxiety Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {sessions.map((session) => {
                  const prediction = session.prediction as any;
                  const analysisResults = session.analysisResults;
                  const depressionScore = prediction?.predicted_score_depression || 
                                        prediction?.predictedScoreDepression ||
                                        analysisResults?.depressionScore;
                  const anxietyScore = prediction?.predicted_score_anxiety || 
                                     prediction?.predictedScoreAnxiety ||
                                     analysisResults?.anxietyScore;

                  return (
                    <tr
                      key={session.sessionId}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {session.audioFileName || `Audio_${session.sessionId.slice(-8)}.wav`}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            ID: {session.sessionId.slice(-12)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={session.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          {depressionScore ? (
                            <span className="text-gray-900 dark:text-white font-medium">
                              {typeof depressionScore === 'string' ? depressionScore : depressionScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          {anxietyScore ? (
                            <span className="text-gray-900 dark:text-white font-medium">
                              {typeof anxietyScore === 'string' ? anxietyScore : anxietyScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatRelativeTime(session.createdAt)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDateTime(session.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/sessions/${session.sessionId}`}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            aria-label={`View details for session ${session.sessionId}`}
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <FileAudio className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Sessions in This Group
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            This group doesn't contain any analysis sessions yet.
          </p>
          <Link to="/upload" className="btn btn--primary">
            Upload Audio for This Group
          </Link>
        </div>
      )}
    </div>
  );
};

export default GroupSessionsDetail;