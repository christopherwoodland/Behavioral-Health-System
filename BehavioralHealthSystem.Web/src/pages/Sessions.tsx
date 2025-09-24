import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Filter, ChevronDown, ChevronUp, Eye, Download, Trash2, RefreshCw, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useAccessibility } from '../hooks/useAccessibility';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { getUserId, formatRelativeTime, formatDateTime } from '../utils';
import type { SessionData, AppError } from '../types';

// Session interface for UI with additional computed fields
interface SessionWithUI extends SessionData {
  fileName?: string;
  fileSize?: number;
  uploadedAt: string;
  riskLevel?: string;
  depressionScore?: string;
  anxietyScore?: string;
}

// Filter and sort types
interface SessionFilters {
  search: string;
  status: string | 'all';
  dateRange: 'all' | 'today' | 'week' | 'month' | 'year';
  sortBy: 'date' | 'status' | 'depressionScore' | 'anxietyScore';
  sortOrder: 'asc' | 'desc';
}

// Status color mapping for accessibility
const statusConfig = {
  queued: { color: 'yellow', icon: Clock, label: 'Queued' },
  running: { color: 'blue', icon: RefreshCw, label: 'Processing' },
  processing: { color: 'blue', icon: RefreshCw, label: 'Processing' },
  succeeded: { color: 'green', icon: CheckCircle, label: 'Completed' },
  success: { color: 'green', icon: CheckCircle, label: 'Completed' },
  completed: { color: 'green', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'red', icon: XCircle, label: 'Failed' },
  error: { color: 'red', icon: XCircle, label: 'Error' },
} as const;

// Utility function to format score categories
const formatScoreCategory = (category?: string): string => {
  if (!category) return '—';
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l: string) => l.toUpperCase());
};

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

const Sessions: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionWithUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SessionFilters>({
    search: '',
    status: 'all',
    dateRange: 'all',
    sortBy: 'date',
    sortOrder: 'desc',
  });

  const { announceToScreenReader } = useAccessibility();

  // Get authenticated user ID for API calls (matches blob storage folder structure)
  const getAuthenticatedUserId = useCallback((): string => {
    // Use authenticated user ID if available, otherwise fall back to getUserId utility
    return user?.id || getUserId();
  }, [user?.id]);

  // Load sessions from API
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userId = getAuthenticatedUserId(); // Use authenticated user ID to match blob storage folder structure
      const response = await apiService.getUserSessions(userId);
      
      // Transform session data to include computed UI fields
      const transformedSessions: SessionWithUI[] = response.sessions.map(session => {
        // Handle both camelCase and snake_case property names from API
        const prediction = session.prediction as any;
        const analysisResults = session.analysisResults;
        
        return {
          ...session,
          uploadedAt: session.createdAt,
          fileName: session.audioFileName || `Audio_${session.sessionId.slice(-8)}.wav`,
          fileSize: Math.floor(Math.random() * 5000000) + 1000000, // Mock file size for now
          riskLevel: analysisResults?.riskLevel || 'unknown',
          // Prioritize descriptive string values from prediction over numeric values from analysisResults
          depressionScore: prediction?.predicted_score_depression || 
                          prediction?.predictedScoreDepression ||
                          (analysisResults?.depressionScore?.toString()) ||
                          undefined,
          anxietyScore: prediction?.predicted_score_anxiety || 
                       prediction?.predictedScoreAnxiety ||
                       (analysisResults?.anxietyScore?.toString()) ||
                       undefined,
        };
      });

      setSessions(transformedSessions);
      announceToScreenReader(`${transformedSessions.length} sessions loaded successfully`);
    } catch (err) {
      const appError = err as AppError;
      setError(appError);
      announceToScreenReader(`Error loading sessions: ${appError.message}`);
    } finally {
      setLoading(false);
    }
  }, [announceToScreenReader]);

  // Load sessions on component mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Filter and sort sessions
  const filteredAndSortedSessions = useMemo(() => {
    let filtered = sessions;

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(session => 
        session.sessionId.toLowerCase().includes(searchLower) ||
        session.fileName?.toLowerCase().includes(searchLower) ||
        statusConfig[session.status as keyof typeof statusConfig]?.label.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(session => session.status === filters.status);
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const startDate = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      filtered = filtered.filter(session => 
        new Date(session.uploadedAt) >= startDate
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'date':
          comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'depressionScore':
          const depressionA = getSeverityLevel(a.depressionScore);
          const depressionB = getSeverityLevel(b.depressionScore);
          comparison = depressionA - depressionB;
          break;
        case 'anxietyScore':
          const anxietyA = getSeverityLevel(a.anxietyScore);
          const anxietyB = getSeverityLevel(b.anxietyScore);
          comparison = anxietyA - anxietyB;
          break;
      }
      
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [sessions, filters]);

  // Handle filter changes
  const updateFilter = useCallback((key: keyof SessionFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    announceToScreenReader(`Filter ${key} changed to ${value}`);
  }, [announceToScreenReader]);

  // Handle session selection
  const toggleSessionSelection = useCallback((sessionId: string) => {
    setSelectedSessions(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(sessionId)) {
        newSelection.delete(sessionId);
        announceToScreenReader('Session deselected');
      } else {
        newSelection.add(sessionId);
        announceToScreenReader('Session selected');
      }
      return newSelection;
    });
  }, [announceToScreenReader]);

  // Handle select all
  const toggleSelectAll = useCallback(() => {
    const allSelected = selectedSessions.size === filteredAndSortedSessions.length;
    if (allSelected) {
      setSelectedSessions(new Set());
      announceToScreenReader('All sessions deselected');
    } else {
      setSelectedSessions(new Set(filteredAndSortedSessions.map(s => s.sessionId)));
      announceToScreenReader(`All ${filteredAndSortedSessions.length} sessions selected`);
    }
  }, [selectedSessions.size, filteredAndSortedSessions, announceToScreenReader]);

  // Handle individual session deletion
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this session? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await apiService.deleteSessionData(sessionId);
      
      // Remove from local state after successful API call
      setSessions(prev => prev.filter(session => session.sessionId !== sessionId));
      
      // Remove from selection if it was selected
      setSelectedSessions(prev => {
        const newSelection = new Set(prev);
        newSelection.delete(sessionId);
        return newSelection;
      });
      
      announceToScreenReader('Session deleted successfully');
    } catch (err) {
      const appError = err as AppError;
      announceToScreenReader(`Error deleting session: ${appError.message}`);
      // Optionally show a toast or alert for the error
      alert(`Failed to delete session: ${appError.message}`);
    }
  }, [announceToScreenReader]);

  // Handle individual session re-run - navigate to upload page with session data pre-filled
  const handleRerunSession = useCallback(async (sessionId: string) => {
    const confirmed = window.confirm('Are you sure you want to re-run the analysis for this session? You will be redirected to the upload page with the session data pre-filled.');
    if (!confirmed) return;

    try {
      // Find the session data to pass to upload page
      const session = sessions.find(s => s.sessionId === sessionId);
      if (!session) {
        announceToScreenReader('Cannot re-run analysis: Session not found');
        alert('Cannot re-run analysis: Session not found');
        return;
      }

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
    } catch (err) {
      const appError = err as AppError;
      announceToScreenReader(`Error preparing re-run: ${appError.message}`);
      alert(`Failed to prepare re-run: ${appError.message}`);
    }
  }, [announceToScreenReader, sessions, navigate]);

  // Handle bulk actions
  const handleBulkDelete = useCallback(async () => {
    if (selectedSessions.size === 0) return;
    
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedSessions.size} session(s)? This action cannot be undone.`);
    if (!confirmed) return;

    const sessionIds = Array.from(selectedSessions);
    let successCount = 0;
    let failedSessions: string[] = [];

    // Process deletions sequentially to avoid overwhelming the server
    for (const sessionId of sessionIds) {
      try {
        await apiService.deleteSessionData(sessionId);
        successCount++;
      } catch (err) {
        const appError = err as AppError;
        failedSessions.push(sessionId);
        console.error(`Failed to delete session ${sessionId}:`, appError.message);
      }
    }

    // Remove successfully deleted sessions from local state
    if (successCount > 0) {
      setSessions(prev => prev.filter(session => {
        const wasDeleted = selectedSessions.has(session.sessionId) && !failedSessions.includes(session.sessionId);
        return !wasDeleted;
      }));
    }

    // Clear selection
    setSelectedSessions(new Set());

    // Announce results
    if (failedSessions.length === 0) {
      announceToScreenReader(`${successCount} sessions deleted successfully`);
    } else {
      const message = `${successCount} sessions deleted successfully, ${failedSessions.length} failed`;
      announceToScreenReader(message);
      alert(`${message}. Failed sessions: ${failedSessions.join(', ')}`);
    }
  }, [selectedSessions, announceToScreenReader]);

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Get status badge component
  const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    // For any unknown status that contains "error" or "fail", treat as error
    const normalizedStatus = status.toLowerCase();
    let config = statusConfig[status as keyof typeof statusConfig];
    
    if (!config) {
      if (normalizedStatus.includes('error') || normalizedStatus.includes('fail')) {
        config = statusConfig.error;
      } else {
        // Default to queued for unknown statuses instead of failed
        config = statusConfig.queued;
      }
    }
    
    const Icon = config.icon;
    
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          config.color === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
          config.color === 'blue' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
          config.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }`}
        role="status"
        aria-label={`Status: ${config.label}`}
      >
        <Icon className="w-3 h-3 mr-1" aria-hidden="true" />
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mr-3" aria-hidden="true" />
          <span className="text-lg text-gray-900 dark:text-white">Loading sessions...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3" aria-hidden="true" />
            <div>
              <h3 className="text-lg font-medium text-red-900 dark:text-red-200">
                Error Loading Sessions
              </h3>
              <p className="text-red-700 dark:text-red-300 mt-1">{error.message}</p>
              <button type="button"
                onClick={loadSessions}
                className="mt-4 btn btn--primary"
                aria-label="Retry loading sessions"
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Analysis Sessions
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            View and manage your audio analysis sessions
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button type="button"
            onClick={loadSessions}
            disabled={loading}
            className="btn btn--secondary"
            aria-label="Refresh sessions list"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </button>
          
          <Link
            to="/upload"
            className="btn btn--primary"
            aria-label="Start new analysis session"
          >
            New Analysis
          </Link>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-0">
            <label htmlFor="search-sessions" className="sr-only">
              Search sessions
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
              <input
                id="search-sessions"
                type="text"
                placeholder="Search by session ID, filename, or status..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="form__input w-full pl-10 pr-4 py-2"
                aria-describedby="search-help"
              />
            </div>
            <p id="search-help" className="sr-only">
              Search through your analysis sessions by ID, filename, or status
            </p>
          </div>

          {/* Filter Toggle */}
          <button type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn--secondary flex items-center"
            aria-expanded={showFilters}
            aria-controls="filter-panel"
            aria-label={`${showFilters ? 'Hide' : 'Show'} filter options`}
          >
            <Filter className="w-4 h-4 mr-2" aria-hidden="true" />
            Filters
            {showFilters ? <ChevronUp className="w-4 h-4 ml-2" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 ml-2" aria-hidden="true" />}
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div id="filter-panel" className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                id="status-filter"
                value={filters.status}
                onChange={(e) => updateFilter('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="queued">Queued</option>
                <option value="processing">Processing</option>
                <option value="running">Running</option>
                <option value="succeeded">Completed</option>
                <option value="success">Success</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <select
                id="date-filter"
                value={filters.dateRange}
                onChange={(e) => updateFilter('dateRange', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="year">Past Year</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort By
              </label>
              <select
                id="sort-by"
                value={filters.sortBy}
                onChange={(e) => updateFilter('sortBy', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="date">Date</option>
                <option value="status">Status</option>
                <option value="depressionScore">Depression Score</option>
                <option value="anxietyScore">Anxiety Score</option>
              </select>
            </div>

            {/* Sort Order */}
            <div>
              <label htmlFor="sort-order" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort Order
              </label>
              <select
                id="sort-order"
                value={filters.sortOrder}
                onChange={(e) => updateFilter('sortOrder', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary and Bulk Actions */}
      {filteredAndSortedSessions.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {filteredAndSortedSessions.length} of {sessions.length} sessions
              {selectedSessions.size > 0 && ` • ${selectedSessions.size} selected`}
            </p>
          </div>
          
          {selectedSessions.size > 0 && (
            <div className="flex items-center gap-2">
              <button type="button"
                onClick={handleBulkDelete}
                className="btn btn--danger"
                aria-label={`Delete ${selectedSessions.size} selected sessions`}
              >
                <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" />
                Delete Selected
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sessions Table */}
      {filteredAndSortedSessions.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full" role="table" aria-label="Analysis sessions">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedSessions.size === filteredAndSortedSessions.length}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label="Select all sessions"
                    />
                  </th>
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
                {filteredAndSortedSessions.map((session) => (
                  <tr
                    key={session.sessionId}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedSessions.has(session.sessionId)}
                        onChange={() => toggleSessionSelection(session.sessionId)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        aria-label={`Select session ${session.sessionId}`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {session.fileName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          ID: {session.sessionId.slice(-12)}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {formatFileSize(session.fileSize || 0)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {session.depressionScore ? (
                          <span className="text-gray-900 dark:text-white font-medium">
                            {formatScoreCategory(session.depressionScore)}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {session.anxietyScore ? (
                          <span className="text-gray-900 dark:text-white font-medium">
                            {formatScoreCategory(session.anxietyScore)}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {formatRelativeTime(session.uploadedAt)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(session.uploadedAt)}
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
                        {session.status === 'succeeded' && (
                          <button type="button"
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                            aria-label={`Download results for session ${session.sessionId}`}
                          >
                            <Download className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                        <button type="button"
                          onClick={() => handleRerunSession(session.sessionId)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          aria-label={`Re-run analysis for session ${session.sessionId}`}
                        >
                          <RefreshCw className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button type="button"
                          onClick={() => handleDeleteSession(session.sessionId)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          aria-label={`Delete session ${session.sessionId}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4 p-4">
            {filteredAndSortedSessions.map((session) => (
              <div
                key={session.sessionId}
                className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedSessions.has(session.sessionId)}
                      onChange={() => toggleSessionSelection(session.sessionId)}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Select session ${session.sessionId}`}
                    />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        {session.fileName}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        ID: {session.sessionId.slice(-12)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={session.status} />
                </div>

                {(session.depressionScore || session.anxietyScore) && (
                  <div className="text-sm">
                    {session.depressionScore && (
                      <div>Depression: {formatScoreCategory(session.depressionScore)}</div>
                    )}
                    {session.anxietyScore && (
                      <div>Anxiety: {formatScoreCategory(session.anxietyScore)}</div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{formatRelativeTime(session.uploadedAt)}</span>
                  <span>{formatFileSize(session.fileSize || 0)}</span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <Link
                    to={`/sessions/${session.sessionId}`}
                    className="btn btn--secondary text-xs"
                    aria-label={`View details for session ${session.sessionId}`}
                  >
                    <Eye className="w-4 h-4 mr-1" aria-hidden="true" />
                    View
                  </Link>
                  {session.status === 'succeeded' && (
                    <button type="button"
                      className="btn btn--secondary text-xs"
                      aria-label={`Download results for session ${session.sessionId}`}
                    >
                      <Download className="w-4 h-4 mr-1" aria-hidden="true" />
                      Download
                    </button>
                  )}
                  <button type="button"
                    onClick={() => handleRerunSession(session.sessionId)}
                    className="btn btn--secondary text-xs"
                    aria-label={`Re-run analysis for session ${session.sessionId}`}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" aria-hidden="true" />
                    Re-run
                  </button>
                  <button type="button"
                    onClick={() => handleDeleteSession(session.sessionId)}
                    className="btn btn--danger text-xs"
                    aria-label={`Delete session ${session.sessionId}`}
                  >
                    <Trash2 className="w-4 h-4 mr-1" aria-hidden="true" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No sessions found
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {sessions.length === 0 
              ? "You haven't created any analysis sessions yet."
              : "No sessions match your current filters."
            }
          </p>
          {sessions.length === 0 ? (
            <Link to="/upload" className="btn btn--primary">
              Start Your First Analysis
            </Link>
          ) : (
            <button type="button"
              onClick={() => setFilters({
                search: '',
                status: 'all',
                dateRange: 'all',
                sortBy: 'date',
                sortOrder: 'desc',
              })}
              className="btn btn--secondary"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Sessions;
