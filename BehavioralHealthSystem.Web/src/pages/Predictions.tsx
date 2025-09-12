import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Brain, 
  Heart, 
  BarChart3, 
  PieChart, 
  Clock,
  AlertCircle,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  Download,
  Eye
} from 'lucide-react';
import { useAccessibility } from '../hooks/useAccessibility';
import { apiService } from '../services/api';
import { getUserId, formatRelativeTime } from '../utils';
import type { SessionData, AppError } from '../types';

// Chart data interfaces
interface ChartDataPoint {
  date: string;
  depression: number | null;
  anxiety: number | null;
  overall: number | null;
  sessionId: string;
}

interface ScoreDistribution {
  category: string;
  count: number;
  percentage: number;
  color: string;
}

interface TrendAnalysis {
  direction: 'improving' | 'worsening' | 'stable';
  change: number;
  period: string;
}

// Filter interface
interface PredictionFilters {
  dateRange: 'all' | 'week' | 'month' | 'quarter' | 'year';
  scoreType: 'all' | 'depression' | 'anxiety' | 'overall';
  showTrends: boolean;
}

const Predictions: React.FC = () => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [filters, setFilters] = useState<PredictionFilters>({
    dateRange: 'all',
    scoreType: 'all',
    showTrends: true
  });
  const [showFilters, setShowFilters] = useState(false);

  const { announceToScreenReader } = useAccessibility();
  const navigate = useNavigate();

  // Handle bar click to navigate to session details
  const handleBarClick = useCallback((sessionId: string) => {
    navigate(`/sessions/${sessionId}`);
    announceToScreenReader(`Navigating to session ${sessionId} details`);
  }, [navigate, announceToScreenReader]);

  // Load user sessions with prediction data
  const loadPredictions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const userId = getUserId();
      const response = await apiService.getUserSessions(userId);
      
      // Filter sessions that have analysis results or predictions
      const sessionsWithPredictions = response.sessions.filter(session => {
        return session.analysisResults || session.prediction;
      });
      
      setSessions(sessionsWithPredictions);
      announceToScreenReader(`${sessionsWithPredictions.length} prediction sessions loaded`);
    } catch (err) {
      const appError = err as AppError;
      setError(appError);
      announceToScreenReader(`Error loading predictions: ${appError.message}`);
    } finally {
      setLoading(false);
    }
  }, [announceToScreenReader]);

  useEffect(() => {
    loadPredictions();
  }, [loadPredictions]);

  // Filter sessions based on date range
  const filteredSessions = useMemo(() => {
    if (filters.dateRange === 'all') return sessions;

    const now = new Date();
    const startDate = new Date();
    
    switch (filters.dateRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return sessions.filter(session => 
      new Date(session.createdAt) >= startDate
    );
  }, [sessions, filters.dateRange]);

  // Prepare chart data
  const chartData = useMemo((): ChartDataPoint[] => {
    return filteredSessions
      .map(session => {
        // Since we now have categorical data, we'll map categories to numbers for visualization
        const mapCategoryToNumber = (category?: string): number | null => {
          if (!category) return null;
          switch (category.toLowerCase()) {
            // Depression categories
            case 'no_to_mild':
              return 1;
            case 'mild_to_moderate':
              return 2;
            case 'moderate_to_severe':
              return 3;
            // Anxiety categories
            case 'no_or_minimal':
              return 1;
            case 'moderate':
              return 2;
            case 'moderately_severe':
              return 3;
            case 'severe':
              return 4;
            default:
              return null;
          }
        };

        const depression = mapCategoryToNumber((session.prediction as any)?.predicted_score_depression);
        const anxiety = mapCategoryToNumber((session.prediction as any)?.predicted_score_anxiety);
        // Note: predicted_score is deprecated, no longer using overall score

        return {
          date: session.createdAt,
          depression,
          anxiety,
          overall: null, // No longer using deprecated predicted_score
          sessionId: session.sessionId
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredSessions]);

  // Calculate score distributions based on categorical data
  const scoreDistribution = useMemo((): Record<string, ScoreDistribution[]> => {
    const distributions: Record<string, ScoreDistribution[]> = {
      depression: [],
      anxiety: []
    };

    // Define possible categories and their colors
    const categories = [
      // Depression categories
      { category: 'no_to_mild', label: 'No to Mild', color: 'bg-green-400' },
      { category: 'mild_to_moderate', label: 'Mild to Moderate', color: 'bg-yellow-500' },
      { category: 'moderate_to_severe', label: 'Moderate to Severe', color: 'bg-red-600' },
      // Anxiety categories  
      { category: 'no_or_minimal', label: 'No or Minimal', color: 'bg-green-400' },
      { category: 'moderate', label: 'Moderate', color: 'bg-orange-500' },
      { category: 'moderately_severe', label: 'Moderately Severe', color: 'bg-red-500' },
      { category: 'severe', label: 'Severe', color: 'bg-red-700' }
    ];

    // Process depression scores
    const depressionScores = filteredSessions
      .map(session => (session.prediction as any)?.predicted_score_depression)
      .filter(score => score !== undefined);

    categories.forEach(cat => {
      const count = depressionScores.filter(score => score === cat.category).length;
      const percentage = depressionScores.length > 0 ? (count / depressionScores.length) * 100 : 0;
      
      if (count > 0) { // Only show categories that have data
        distributions.depression.push({
          category: cat.label,
          count,
          percentage,
          color: cat.color
        });
      }
    });

    // Process anxiety scores
    const anxietyScores = filteredSessions
      .map(session => (session.prediction as any)?.predicted_score_anxiety)
      .filter(score => score !== undefined);

    categories.forEach(cat => {
      const count = anxietyScores.filter(score => score === cat.category).length;
      const percentage = anxietyScores.length > 0 ? (count / anxietyScores.length) * 100 : 0;
      
      if (count > 0) { // Only show categories that have data
        distributions.anxiety.push({
          category: cat.label,
          count,
          percentage,
          color: cat.color
        });
      }
    });

    // Note: Overall scores (predicted_score) are deprecated and no longer processed

    return distributions;
  }, [filteredSessions]);

  // Calculate trend analysis for categorical data
  const trendAnalysis = useMemo((): Record<string, TrendAnalysis> => {
    const trends: Record<string, TrendAnalysis> = {};
    
    // For categorical data, we'll analyze if the trend is toward more severe or less severe categories
    const getCategorySeverity = (category?: string): number => {
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

    // Analyze depression trend
    const depressionCategories = filteredSessions
      .map(session => (session.prediction as any)?.predicted_score_depression)
      .filter(cat => cat !== undefined);

    if (depressionCategories.length < 2) {
      trends.depression = { direction: 'stable', change: 0, period: 'insufficient data' };
    } else {
      const severityScores = depressionCategories.map(getCategorySeverity);
      const firstHalf = severityScores.slice(0, Math.floor(severityScores.length / 2));
      const secondHalf = severityScores.slice(Math.floor(severityScores.length / 2));

      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const change = secondAvg - firstAvg;
      
      trends.depression = {
        direction: Math.abs(change) < 0.5 ? 'stable' : change < 0 ? 'improving' : 'worsening',
        change: Math.abs(change),
        period: `${filteredSessions.length} sessions`
      };
    }

    // Analyze anxiety trend
    const anxietyCategories = filteredSessions
      .map(session => (session.prediction as any)?.predicted_score_anxiety)
      .filter(cat => cat !== undefined);

    if (anxietyCategories.length < 2) {
      trends.anxiety = { direction: 'stable', change: 0, period: 'insufficient data' };
    } else {
      const severityScores = anxietyCategories.map(getCategorySeverity);
      const firstHalf = severityScores.slice(0, Math.floor(severityScores.length / 2));
      const secondHalf = severityScores.slice(Math.floor(severityScores.length / 2));

      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const change = secondAvg - firstAvg;
      
      trends.anxiety = {
        direction: Math.abs(change) < 0.5 ? 'stable' : change < 0 ? 'improving' : 'worsening',
        change: Math.abs(change),
        period: `${filteredSessions.length} sessions`
      };
    }

    // Overall trend (placeholder)
    trends.overall = { direction: 'stable', change: 0, period: 'coming soon' };

    return trends;
  }, [filteredSessions]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const stats = {
      totalSessions: filteredSessions.length,
      avgDepression: 0,
      avgAnxiety: 0,
      avgOverall: 0,
      latestSession: null as SessionData | null,
      improvementSessions: 0
    };

    if (filteredSessions.length === 0) return stats;

    // For categorical data, we'll show the most common category instead of averages
    const depressionCategories = filteredSessions
      .map(s => s.prediction?.predictedScoreDepression)
      .filter(s => s !== undefined);
    
    const anxietyCategories = filteredSessions
      .map(s => s.prediction?.predictedScoreAnxiety)
      .filter(s => s !== undefined);

    // Calculate mode (most frequent category) for depression
    if (depressionCategories.length > 0) {
      const depressionCounts: Record<string, number> = {};
      depressionCategories.forEach(cat => {
        depressionCounts[cat!] = (depressionCounts[cat!] || 0) + 1;
      });
      const mostCommonDepression = Object.entries(depressionCounts)
        .sort(([,a], [,b]) => b - a)[0][0];
      stats.avgDepression = depressionCounts[mostCommonDepression];
    }

    // Calculate mode (most frequent category) for anxiety
    if (anxietyCategories.length > 0) {
      const anxietyCounts: Record<string, number> = {};
      anxietyCategories.forEach(cat => {
        anxietyCounts[cat!] = (anxietyCounts[cat!] || 0) + 1;
      });
      const mostCommonAnxiety = Object.entries(anxietyCounts)
        .sort(([,a], [,b]) => b - a)[0][0];
      stats.avgAnxiety = anxietyCounts[mostCommonAnxiety];
    }
    
    stats.latestSession = filteredSessions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    // Improvement rate will be calculated later - for now set to 0
    stats.improvementSessions = 0;

    return stats;
  }, [filteredSessions]);

  // Handle filter changes
  const updateFilter = useCallback((key: keyof PredictionFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    announceToScreenReader(`Filter ${key} changed to ${value}`);
  }, [announceToScreenReader]);

  // Download predictions data
  const downloadPredictions = useCallback(() => {
    const dataStr = JSON.stringify(filteredSessions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `predictions-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    announceToScreenReader('Predictions data download started');
  }, [filteredSessions, announceToScreenReader]);

  // Trend indicator component
  const TrendIndicator: React.FC<{ trend: TrendAnalysis; label: string }> = ({ trend, label }) => {
    const Icon = trend.direction === 'improving' ? TrendingDown : 
                 trend.direction === 'worsening' ? TrendingUp : Activity;
    const colorClass = trend.direction === 'improving' ? 'text-green-600 dark:text-green-400' :
                       trend.direction === 'worsening' ? 'text-red-600 dark:text-red-400' :
                       'text-gray-600 dark:text-gray-400';

    return (
      <div className="flex items-center space-x-2">
        <Icon className={`w-4 h-4 ${colorClass}`} aria-hidden="true" />
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        <span className={`text-sm font-medium ${colorClass} capitalize`}>
          {trend.direction}
          {trend.period === 'insufficient data' 
            ? ' (need more sessions)'
            : trend.period === 'coming soon' 
              ? ' (analysis coming soon)'
              : ` (${trend.period})`
          }
        </span>
      </div>
    );
  };

  // Simple line chart component
  const SimpleLineChart: React.FC<{ 
    data: ChartDataPoint[]; 
    type: 'depression' | 'anxiety' | 'overall';
    onBarClick: (sessionId: string) => void;
  }> = ({ data, type, onBarClick }) => {
    const scores = data.map(d => d[type]).filter(s => s !== null) as number[];
    if (scores.length === 0) return <div className="text-center text-gray-500 py-8">No data available</div>;

    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const range = maxScore - minScore || 1;

    // Function to convert numeric score back to category name
    const getScoreCategoryName = (score: number): string => {
      switch (score) {
        case 1: return 'No to Mild / No or Minimal';
        case 2: return 'Mild to Moderate / Moderate';
        case 3: return 'Moderate to Severe / Moderately Severe';
        case 4: return 'Severe';
        default: return 'Unknown';
      }
    };

    // Function to get category color based on score and chart type
    const getCategoryColor = (score: number, type: 'depression' | 'anxiety' | 'overall'): string => {
      if (type === 'depression') {
        switch (score) {
          case 1: return 'bg-blue-400';  // no_to_mild
          case 2: return 'bg-blue-600';  // mild_to_moderate
          case 3: return 'bg-blue-800';  // moderate_to_severe
          default: return 'bg-blue-500';
        }
      } else if (type === 'anxiety') {
        switch (score) {
          case 1: return 'bg-purple-400'; // no_or_minimal
          case 2: return 'bg-purple-600'; // moderate
          case 3: return 'bg-purple-700'; // moderately_severe
          case 4: return 'bg-purple-900'; // severe
          default: return 'bg-purple-500';
        }
      } else {
        switch (score) {
          case 1: return 'bg-green-400';
          case 2: return 'bg-green-600';
          case 3: return 'bg-green-700';
          case 4: return 'bg-green-800';
          default: return 'bg-green-500';
        }
      }
    };

    // Legend data - updated to match the chart colors
    const getLegendItems = (chartType: 'depression' | 'anxiety' | 'overall') => {
      const baseItems = [
        { score: 1, label: 'No/Minimal' },
        { score: 2, label: 'Mild' },
        { score: 3, label: 'Moderate' },
        { score: 4, label: 'Mod-Severe' },
        { score: 5, label: 'Severe' }
      ];
      
      return baseItems.map(item => ({
        ...item,
        color: getCategoryColor(item.score, chartType)
      }));
    };

    // Filter legend to only show categories that exist in the data
    const usedScores = new Set(scores);
    const legendItems = getLegendItems(type);
    const activeLegendItems = legendItems.filter(item => usedScores.has(item.score));

    return (
      <div>
        <div className="h-32 flex items-end space-x-1 px-4 py-2 mb-4">
          {data.map((dataPoint, index) => {
            const score = dataPoint[type];
            if (score === null) return null;
            
            const height = ((score - minScore) / range) * 100;
            const categoryColor = getCategoryColor(score, type);
            const categoryName = getScoreCategoryName(score);
            const dateStr = new Date(dataPoint.date).toLocaleDateString();
            
            return (
              <div
                key={index}
                className={`flex-1 ${categoryColor} opacity-70 hover:opacity-100 hover:scale-105 transition-all duration-200 rounded-t cursor-pointer relative group`}
                style={{ height: `${Math.max(height, 8)}%` }}
                onClick={() => onBarClick(dataPoint.sessionId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onBarClick(dataPoint.sessionId);
                  }
                }}
                aria-label={`View session details for ${categoryName} score on ${dateStr}`}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                  <div className="font-medium">{categoryName}</div>
                  <div className="text-gray-300">{dateStr}</div>
                  <div className="text-gray-300">Session: {dataPoint.sessionId.slice(-8)}</div>
                  <div className="text-gray-400 text-xs mt-1">Click to view details</div>
                  {/* Tooltip arrow */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        {activeLegendItems.length > 0 && (
          <div className="px-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Legend:</span>
              {activeLegendItems.map((item) => (
                <div key={item.score} className="flex items-center gap-1">
                  <div className={`w-3 h-3 ${item.color} rounded`}></div>
                  <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mr-3" aria-hidden="true" />
          <span className="text-lg text-gray-900 dark:text-white">Loading predictions...</span>
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
                Error Loading Predictions
              </h3>
              <p className="text-red-700 dark:text-red-300 mt-1">{error.message}</p>
              <button
                onClick={loadPredictions}
                className="mt-4 btn-primary"
                aria-label="Retry loading predictions"
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
            My Predictions
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Analyze your mental health trends and insights over time
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary"
            aria-expanded={showFilters}
            aria-label={`${showFilters ? 'Hide' : 'Show'} filter options`}
          >
            <Filter className="w-4 h-4 mr-2" aria-hidden="true" />
            Filters
            {showFilters ? <ChevronUp className="w-4 h-4 ml-2" /> : <ChevronDown className="w-4 h-4 ml-2" />}
          </button>
          
          <button
            onClick={loadPredictions}
            className="btn-secondary"
            aria-label="Refresh predictions data"
          >
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            Refresh
          </button>
          
          <button
            onClick={downloadPredictions}
            className="btn-primary"
            disabled={filteredSessions.length === 0}
            aria-label="Download predictions data"
          >
            <Download className="w-4 h-4 mr-2" aria-hidden="true" />
            Download
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="date-range" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <select
                id="date-range"
                value={filters.dateRange}
                onChange={(e) => updateFilter('dateRange', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="quarter">Past Quarter</option>
                <option value="year">Past Year</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="score-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Focus Score
              </label>
              <select
                id="score-type"
                value={filters.scoreType}
                onChange={(e) => updateFilter('scoreType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Scores</option>
                <option value="depression">Depression</option>
                <option value="anxiety">Anxiety</option>
                <option value="overall">Overall</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.showTrends}
                  onChange={(e) => updateFilter('showTrends', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show trend analysis</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {filteredSessions.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Prediction Data Available
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {sessions.length === 0 
              ? "You haven't completed any analysis sessions yet."
              : "No sessions found for the selected date range."
            }
          </p>
          <Link to="/upload" className="btn-primary">
            Start Your First Analysis
          </Link>
        </div>
      ) : (
        <>
          {/* Statistics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Activity className="w-8 h-8 text-blue-600" aria-hidden="true" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sessions</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{statistics.totalSessions}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Brain className="w-8 h-8 text-purple-600" aria-hidden="true" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Depression (Most Common)</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {(() => {
                      const depressionCategories = filteredSessions
                        .map(s => (s.prediction as any)?.predicted_score_depression)
                        .filter(s => s !== undefined);
                      
                      if (depressionCategories.length === 0) return '—';
                      
                      const counts: Record<string, number> = {};
                      depressionCategories.forEach(cat => {
                        counts[cat!] = (counts[cat!] || 0) + 1;
                      });
                      
                      const mostCommon = Object.entries(counts)
                        .sort(([,a], [,b]) => b - a)[0][0];
                      
                      return mostCommon.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                    })()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Heart className="w-8 h-8 text-red-600" aria-hidden="true" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Anxiety (Most Common)</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {(() => {
                      const anxietyCategories = filteredSessions
                        .map(s => (s.prediction as any)?.predicted_score_anxiety)
                        .filter(s => s !== undefined);
                      
                      if (anxietyCategories.length === 0) return '—';
                      
                      const counts: Record<string, number> = {};
                      anxietyCategories.forEach(cat => {
                        counts[cat!] = (counts[cat!] || 0) + 1;
                      });
                      
                      const mostCommon = Object.entries(counts)
                        .sort(([,a], [,b]) => b - a)[0][0];
                      
                      return mostCommon.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                    })()}
                  </p>
                </div>
              </div>
            </div>

            {/* Improvement Rate section hidden - feature not implemented yet
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-6 opacity-60">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="w-8 h-8 text-gray-500" aria-hidden="true" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Improvement Rate</p>
                  <p className="text-lg font-semibold text-gray-500 dark:text-gray-400">
                    Coming Soon
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Feature in development
                  </p>
                </div>
              </div>
            </div>
            */}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Score Trends Chart */}
            {(filters.scoreType === 'all' || filters.scoreType === 'depression') && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" aria-hidden="true" />
                  Depression Score Trend
                </h3>
                <SimpleLineChart data={chartData} type="depression" onBarClick={handleBarClick} />
                {filters.showTrends && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <TrendIndicator trend={trendAnalysis.depression} label="Trend:" />
                  </div>
                )}
              </div>
            )}

            {(filters.scoreType === 'all' || filters.scoreType === 'anxiety') && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <PieChart className="w-5 h-5 mr-2" aria-hidden="true" />
                  Anxiety Score Trend
                </h3>
                <SimpleLineChart data={chartData} type="anxiety" onBarClick={handleBarClick} />
                {filters.showTrends && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <TrendIndicator trend={trendAnalysis.anxiety} label="Trend:" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Score Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" aria-hidden="true" />
              Score Distribution
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(scoreDistribution).map(([scoreType, distribution]) => (
                <div key={scoreType}>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 capitalize">
                    {scoreType} Scores
                  </h4>
                  <div className="space-y-2">
                    {distribution.map((item) => (
                      <div key={item.category} className="flex items-center">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 dark:text-gray-400">{item.category}</span>
                            <span className="text-gray-600 dark:text-gray-400">{item.count} ({item.percentage.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${item.color}`}
                              style={{ width: `${item.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Clock className="w-5 h-5 mr-2" aria-hidden="true" />
                Recent Analysis Sessions
              </h3>
              <Link to="/sessions" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm">
                View All Sessions →
              </Link>
            </div>

            <div className="space-y-4">
              {filteredSessions.slice(0, 5).map((session) => (
                <div key={session.sessionId} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${
                        session.status === 'succeeded' ? 'bg-green-500' :
                        session.status === 'processing' ? 'bg-blue-500' :
                        session.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {session.audioFileName || `Session ${session.sessionId.slice(-8)}`}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatRelativeTime(session.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {(session.prediction as any)?.predicted_score_depression && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Depression</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {(session.prediction as any).predicted_score_depression.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </p>
                      </div>
                    )}
                    {(session.prediction as any)?.predicted_score_anxiety && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Anxiety</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {(session.prediction as any).predicted_score_anxiety.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </p>
                      </div>
                    )}
                    <Link
                      to={`/sessions/${session.sessionId}`}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                      aria-label={`View session ${session.sessionId}`}
                    >
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Predictions;
