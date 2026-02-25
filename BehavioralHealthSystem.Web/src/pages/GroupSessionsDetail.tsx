import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  XCircle,
  Eye,
  Users,
  TrendingUp,
  TrendingDown,
  Brain,
  Heart,
  FileAudio,
  BarChart3,
  Trash2
} from 'lucide-react';
import { useAccessibility } from '../hooks/useAccessibility';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { fileGroupService } from '../services/fileGroupService';
import { getUserId, formatRelativeTime, formatDateTime, formatQuantizedScoreLabel, createAppError } from '../utils';
import type { SessionData, AppError, FileGroup } from '../types';

// Sort configuration interface
interface SortConfig {
  sortBy: 'date' | 'status' | 'depressionScore' | 'anxietyScore' | 'session';
  sortOrder: 'asc' | 'desc';
}

// Utility function to get severity level for sorting
const getSeverityLevel = (category?: string): number => {
  if (!category) return 0;
  switch (category.toLowerCase()) {
    // Depression categories: no_to_mild, mild_to_moderate, moderate_to_severe
    case 'no_to_mild':
      return 1;
    case 'mild_to_moderate':
      return 2;
    case 'moderate_to_severe':
      return 3;
    // Anxiety categories: no_or_minimal, moderate, moderately_severe, severe
    case 'no_or_minimal':
      return 1;
    case 'moderate':
      return 2;
    case 'moderately_severe':
      return 3;
    case 'severe':
      return 4;
    default:
      return 0;
  }
};

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
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    sortBy: 'date',
    sortOrder: 'desc'
  });

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

  // Delete group and all associated sessions
  const handleDeleteGroup = useCallback(async () => {
    if (!groupId || !group) return;

    setDeleting(true);
    try {
      const response = await fileGroupService.deleteFileGroup(groupId);
      
      if (response.success) {
        // Navigate back to sessions list after successful deletion
        navigate('/sessions');
      } else {
        setError(createAppError(
          'DELETE_ERROR',
          response.message || 'Failed to delete group',
          { groupId }
        ));
      }
    } catch (error: any) {
      setError(createAppError(
        'DELETE_ERROR',
        error.message || 'An error occurred while deleting the group',
        { groupId, error }
      ));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [groupId, group, navigate]);

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
    
    // Extract depression categories (categorical data, not numeric)
    const depressionCategories = withPredictions.map(session => {
      const prediction = session.prediction as any;
      return prediction?.predicted_score_depression || 
             prediction?.predictedScoreDepression;
    }).filter(category => category !== undefined && category !== null);

    // Extract anxiety categories (categorical data, not numeric)
    const anxietyCategories = withPredictions.map(session => {
      const prediction = session.prediction as any;
      return prediction?.predicted_score_anxiety || 
             prediction?.predictedScoreAnxiety;
    }).filter(category => category !== undefined && category !== null);

    // Calculate most common depression category
    let mostCommonDepression = null;
    if (depressionCategories.length > 0) {
      const depressionCounts: Record<string, number> = {};
      depressionCategories.forEach(cat => {
        depressionCounts[cat] = (depressionCounts[cat] || 0) + 1;
      });
      mostCommonDepression = Object.entries(depressionCounts)
        .sort(([,a], [,b]) => b - a)[0][0];
    }

    // Calculate most common anxiety category
    let mostCommonAnxiety = null;
    if (anxietyCategories.length > 0) {
      const anxietyCounts: Record<string, number> = {};
      anxietyCategories.forEach(cat => {
        anxietyCounts[cat] = (anxietyCounts[cat] || 0) + 1;
      });
      mostCommonAnxiety = Object.entries(anxietyCounts)
        .sort(([,a], [,b]) => b - a)[0][0];
    }

    return {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      withPredictions: withPredictions.length,
      mostCommonDepression,
      mostCommonAnxiety,
      depressionTrend: 0, // Keep for future trend analysis
      anxietyTrend: 0 // Keep for future trend analysis
    };
  }, [sessions]);

  // Sort sessions based on current sort configuration
  const sortedSessions = useMemo(() => {
    const sessionsCopy = [...sessions];
    
    sessionsCopy.sort((a, b) => {
      let comparison = 0;
      
      switch (sortConfig.sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'session':
          comparison = (a.audioFileName || '').localeCompare(b.audioFileName || '');
          break;
        case 'depressionScore':
          const predictionA = a.prediction as any;
          const predictionB = b.prediction as any;
          const depressionA = predictionA?.predicted_score_depression || 
                             predictionA?.predictedScoreDepression ||
                             a.analysisResults?.depressionScore;
          const depressionB = predictionB?.predicted_score_depression || 
                             predictionB?.predictedScoreDepression ||
                             b.analysisResults?.depressionScore;
          comparison = getSeverityLevel(depressionA) - getSeverityLevel(depressionB);
          break;
        case 'anxietyScore':
          const predictionA2 = a.prediction as any;
          const predictionB2 = b.prediction as any;
          const anxietyA = predictionA2?.predicted_score_anxiety || 
                          predictionA2?.predictedScoreAnxiety ||
                          a.analysisResults?.anxietyScore;
          const anxietyB = predictionB2?.predicted_score_anxiety || 
                          predictionB2?.predictedScoreAnxiety ||
                          b.analysisResults?.anxietyScore;
          comparison = getSeverityLevel(anxietyA) - getSeverityLevel(anxietyB);
          break;
      }
      
      return sortConfig.sortOrder === 'desc' ? -comparison : comparison;
    });

    return sessionsCopy;
  }, [sessions, sortConfig]);

  // Handle column header click for sorting
  const handleColumnSort = useCallback((column: 'date' | 'status' | 'depressionScore' | 'anxietyScore' | 'session') => {
    setSortConfig(prev => ({
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
    announceToScreenReader(`Sorted by ${column} ${sortConfig.sortBy === column && sortConfig.sortOrder === 'asc' ? 'descending' : 'ascending'}`);
  }, [announceToScreenReader, sortConfig.sortBy, sortConfig.sortOrder]);

  // Get sort indicator icon
  const getSortIcon = useCallback((column: string) => {
    if (sortConfig.sortBy !== column) {
      return null;
    }
    return sortConfig.sortOrder === 'asc' ? '↑' : '↓';
  }, [sortConfig.sortBy, sortConfig.sortOrder]);

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
          
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting || refreshing}
            className="btn btn--danger"
            aria-label="Delete group and all sessions"
          >
            <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
            Delete Group
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
              Depression (Most Common)
            </span>
            <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {groupAnalytics.mostCommonDepression ? 
              formatQuantizedScoreLabel(groupAnalytics.mostCommonDepression, 'depression') : 
              '—'
            }
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
              Anxiety (Most Common)
            </span>
            <Heart className="w-4 h-4 text-red-600 dark:text-red-400" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {groupAnalytics.mostCommonAnxiety ? 
              formatQuantizedScoreLabel(groupAnalytics.mostCommonAnxiety, 'anxiety') : 
              '—'
            }
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
                    <button
                      type="button"
                      onClick={() => handleColumnSort('session')}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
                      aria-label={`Sort by session name ${sortConfig.sortBy === 'session' && sortConfig.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                    >
                      Session
                      {getSortIcon('session') && (
                        <span className="ml-1 text-xs">{getSortIcon('session')}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('status')}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
                      aria-label={`Sort by status ${sortConfig.sortBy === 'status' && sortConfig.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                    >
                      Status
                      {getSortIcon('status') && (
                        <span className="ml-1 text-xs">{getSortIcon('status')}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('depressionScore')}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
                      aria-label={`Sort by depression score ${sortConfig.sortBy === 'depressionScore' && sortConfig.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                    >
                      Depression Score
                      {getSortIcon('depressionScore') && (
                        <span className="ml-1 text-xs">{getSortIcon('depressionScore')}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('anxietyScore')}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
                      aria-label={`Sort by anxiety score ${sortConfig.sortBy === 'anxietyScore' && sortConfig.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                    >
                      Anxiety Score
                      {getSortIcon('anxietyScore') && (
                        <span className="ml-1 text-xs">{getSortIcon('anxietyScore')}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleColumnSort('date')}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
                      aria-label={`Sort by date ${sortConfig.sortBy === 'date' && sortConfig.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                    >
                      Date
                      {getSortIcon('date') && (
                        <span className="ml-1 text-xs">{getSortIcon('date')}</span>
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {sortedSessions.map((session) => {
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
                          {depressionScore !== undefined && depressionScore !== null && depressionScore !== '' ? (
                            <span className="text-gray-900 dark:text-white font-medium">
                              {formatQuantizedScoreLabel(depressionScore as string | number, 'depression')}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          {anxietyScore !== undefined && anxietyScore !== null && anxietyScore !== '' ? (
                            <span className="text-gray-900 dark:text-white font-medium">
                              {formatQuantizedScoreLabel(anxietyScore as string | number, 'anxiety')}
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

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <AlertCircle className="w-8 h-8 text-red-600" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    Delete Group
                  </h3>
                </div>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Are you sure you want to delete the group "{group?.groupName}"?
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-2 font-medium">
                  ⚠️ This will permanently delete the group and all {sessions.length} associated session{sessions.length !== 1 ? 's' : ''}. This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="btn btn--secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  disabled={deleting}
                  className="btn btn--danger"
                >
                  {deleting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                      Delete Forever
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupSessionsDetail;