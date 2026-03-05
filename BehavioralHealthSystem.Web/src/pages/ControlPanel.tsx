import React, { useState, useCallback, useEffect } from 'react';
import { RefreshCw, AlertCircle, TrendingUp, TrendingDown, Users, Activity, Info, X, ChevronDown } from 'lucide-react';
import { useAccessibility } from '../hooks/useAccessibility';
import { AccessibleDialog } from '../components/AccessibleDialog';
import { apiService } from '../services/api';
import { env } from '@/utils/env';
import { Logger } from '@/utils/logger';
import type { SessionData as ImportedSessionData, AppError } from '../types';

const log = Logger.create('ControlPanel');

// Collapsible section wrapper for visualization panels
const CollapsibleSection: React.FC<{
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, defaultOpen = true, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between group cursor-pointer mb-4"
        aria-expanded={isOpen}
        aria-controls={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <div className="text-left">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {title}
            <ChevronDown
              className={`h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-transform duration-200 ${
                isOpen ? '' : '-rotate-90'
              }`}
            />
          </h2>
          {subtitle && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
      </button>
      {isOpen && (
        <div id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}>
          {children}
        </div>
      )}
    </div>
  );
};

// Types for analytics data
interface AnalyticsData {
  overview: {
    totalSessions: number;
    uniqueUsers: number;
    successRate: number;
    avgSessionsPerUser: number;
    recentActivity: number;
  };
  sessionStatus: {
    succeeded: number;
    failed: number;
    processing: number;
    total: number;
  };
  riskLevels: {
    low: number;
    medium: number;
    high: number;
    unknown: number;
    total: number;
  };
  predictions: {
    depression: {
      no_to_mild: number;
      mild_to_moderate: number;
      moderate_to_severe: number;
      severe: number;
      total: number;
    };
    anxiety: {
      no_or_minimal: number;
      mild: number;
      moderate: number;
      moderately_severe: number;
      severe: number;
      total: number;
    };
  };
  timeData: Array<{
    date: string;
    count: number;
  }>;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    unknown: number;
  };
  userStats: Array<{
    userId: string;
    totalSessions: number;
    successfulSessions: number;
    successRate: number;
    avgConfidence: number;
    riskDistribution: {
      low: number;
      medium: number;
      high: number;
      unknown: number;
    };
    lastActivity: string;
    depressionScores: {
      no_to_mild: number;
      mild_to_moderate: number;
      moderate_to_severe: number;
      severe: number;
    };
    anxietyScores: {
      no_or_minimal: number;
      mild: number;
      moderate: number;
      moderately_severe: number;
      severe: number;
    };
  }>;
  correlations: {
    ageDistribution: {
      [ageGroup: string]: {
        depressionCases: number;
        anxietyCases: number;
        totalSessions: number;
      };
    };
    genderDistribution: {
      [gender: string]: {
        depressionCases: number;
        anxietyCases: number;
        totalSessions: number;
      };
    };
    raceDistribution: {
      [race: string]: {
        depressionCases: number;
        anxietyCases: number;
        totalSessions: number;
      };
    };
    ethnicityDistribution: {
      [ethnicity: string]: {
        depressionCases: number;
        anxietyCases: number;
        totalSessions: number;
      };
    };
    languageDistribution: {
      [language: string]: {
        depressionCases: number;
        anxietyCases: number;
        totalSessions: number;
      };
    };
    weightDistribution: {
      [weightGroup: string]: {
        depressionCases: number;
        anxietyCases: number;
        totalSessions: number;
      };
    };
    zipCodeDistribution: {
      [zipGroup: string]: {
        depressionCases: number;
        anxietyCases: number;
        totalSessions: number;
      };
    };
  };
  modelAnalytics: {
    providerDistribution: Record<string, number>;
    modelCategoryDistribution: Record<string, number>;
    calibratedCount: number;
    uncalibratedCount: number;
    totalWithModelInfo: number;
  };
}

// Utility function to calculate percentage
const getPercentage = (value: number, total: number): number => {
  return total > 0 ? Math.round((value / total) * 100) : 0;
};

// Function to aggregate session data into analytics
// Map DAM model quantized scores (0-4) or category strings to distribution keys
const mapDepressionScore = (value: string | number | null | undefined): string | null => {
  if (value === undefined || value === null || value === '') return null;
  const v = String(value).trim().toLowerCase();
  // DAM quantized scores: 0=no_to_mild, 1=mild_to_moderate, 2=moderate_to_severe, 3=severe
  if (v === '0' || v === 'no_to_mild') return 'no_to_mild';
  if (v === '1' || v === 'mild_to_moderate') return 'mild_to_moderate';
  if (v === '2' || v === 'moderate_to_severe') return 'moderate_to_severe';
  if (v === '3' || v === 'severe') return 'severe';
  return null;
};

const mapAnxietyScore = (value: string | number | null | undefined): string | null => {
  if (value === undefined || value === null || value === '') return null;
  const v = String(value).trim().toLowerCase();
  // DAM quantized scores: 0=no_or_minimal, 1=mild, 2=moderate, 3=moderately_severe, 4=severe
  if (v === '0' || v === 'no_or_minimal') return 'no_or_minimal';
  if (v === '1' || v === 'mild') return 'mild';
  if (v === '2' || v === 'moderate') return 'moderate';
  if (v === '3' || v === 'moderately_severe') return 'moderately_severe';
  if (v === '4' || v === 'severe') return 'severe';
  return null;
};

const aggregateSessionData = (allSessions: ImportedSessionData[]): AnalyticsData => {
  const totalSessions = allSessions.length;
  const uniqueUsers = new Set(allSessions.map(s => s.userId)).size;

  const completedSessions = allSessions.filter(s =>
    s.status === 'succeeded' || s.status === 'completed'
  );

  const failedSessions = allSessions.filter(s =>
    s.status === 'failed'
  );

  const processingSessions = allSessions.filter(s =>
    s.status === 'processing'
  );

  // Calculate success rate and average sessions per user
  const successRate = getPercentage(completedSessions.length, totalSessions);
  const avgSessionsPerUser = uniqueUsers > 0 ? Math.round((totalSessions / uniqueUsers) * 10) / 10 : 0;

  // Calculate recent activity (sessions in last 24 hours)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentActivity = allSessions.filter(s =>
    new Date(s.createdAt) > twentyFourHoursAgo
  ).length;

  // Risk level distribution
  const riskCounts = {
    low: 0,
    medium: 0,
    high: 0,
    unknown: 0,
  };

  allSessions.forEach(session => {
    const riskLevel = session.analysisResults?.riskLevel || 'unknown';
    if (riskLevel in riskCounts) {
      riskCounts[riskLevel as keyof typeof riskCounts]++;
    }
  });

  // Depression score distribution
  const depressionCounts = {
    no_to_mild: 0,
    mild_to_moderate: 0,
    moderate_to_severe: 0,
    severe: 0,
  };

  // Anxiety score distribution
  const anxietyCounts = {
    no_or_minimal: 0,
    mild: 0,
    moderate: 0,
    moderately_severe: 0,
    severe: 0,
  };

  completedSessions.forEach(session => {
    // Map prediction scores to distribution categories using DAM quantized scale
    let depressionCategory: string | null = null;
    let anxietyCategory: string | null = null;

    // Try prediction object first (DAM returns numeric strings 0-4)
    if (session.prediction) {
      const prediction = session.prediction as any;
      const depValue = prediction.predictedScoreDepression || prediction.predicted_score_depression;
      const anxValue = prediction.predictedScoreAnxiety || prediction.predicted_score_anxiety;
      depressionCategory = mapDepressionScore(depValue);
      anxietyCategory = mapAnxietyScore(anxValue);
    }

    // Fallback to analysisResults numeric scores (also DAM quantized 0-4 scale)
    if (!depressionCategory && session.analysisResults?.depressionScore !== null && session.analysisResults?.depressionScore !== undefined) {
      depressionCategory = mapDepressionScore(session.analysisResults.depressionScore);
    }

    if (!anxietyCategory && session.analysisResults?.anxietyScore !== null && session.analysisResults?.anxietyScore !== undefined) {
      anxietyCategory = mapAnxietyScore(session.analysisResults.anxietyScore);
    }

    // Count the categories
    if (depressionCategory && depressionCategory in depressionCounts) {
      depressionCounts[depressionCategory as keyof typeof depressionCounts]++;
    }

    if (anxietyCategory && anxietyCategory in anxietyCounts) {
      anxietyCounts[anxietyCategory as keyof typeof anxietyCounts]++;
    }
  });

  // Time series data (last 7 days)
  const timeData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const sessionsOnDate = allSessions.filter(s =>
      s.createdAt.split('T')[0] === dateStr
    ).length;

    timeData.push({
      date: dateStr,
      count: sessionsOnDate,
    });
  }

  // Calculate per-user statistics
  const userStatsMap = new Map<string, {
    totalSessions: number;
    successfulSessions: number;
    sessions: ImportedSessionData[];
  }>();

  // Group sessions by metadata user ID (patient) when available, otherwise by authenticated user ID
  allSessions.forEach(session => {
    // Use metadata_user_id (patient ID) for grouping if available, otherwise use userId (authenticated user)
    const groupingUserId = session.metadata_user_id || session.userId;

    if (!userStatsMap.has(groupingUserId)) {
      userStatsMap.set(groupingUserId, {
        totalSessions: 0,
        successfulSessions: 0,
        sessions: [],
      });
    }
    const userStats = userStatsMap.get(groupingUserId)!;
    userStats.totalSessions++;
    userStats.sessions.push(session);
    if (session.status === 'succeeded' || session.status === 'completed') {
      userStats.successfulSessions++;
    }
  });

  // Calculate detailed user statistics
  const userStats = Array.from(userStatsMap.entries()).map(([userId, stats]) => {
    const successRate = getPercentage(stats.successfulSessions, stats.totalSessions);

    // Calculate average confidence for this user
    const successfulSessions = stats.sessions.filter(s =>
      s.status === 'succeeded' || s.status === 'completed'
    );

    const confidenceValues = successfulSessions
      .map(s => s.analysisResults?.confidence)
      .filter(c => c !== null && c !== undefined && typeof c === 'number');

    const avgConfidence = confidenceValues.length > 0
      ? confidenceValues.reduce((sum, c) => sum + c!, 0) / confidenceValues.length
      : 0;

    // Risk distribution for this user
    const userRiskDistribution = {
      low: 0,
      medium: 0,
      high: 0,
      unknown: 0,
    };

    stats.sessions.forEach(session => {
      const riskLevel = session.analysisResults?.riskLevel || 'unknown';
      if (riskLevel in userRiskDistribution) {
        userRiskDistribution[riskLevel as keyof typeof userRiskDistribution]++;
      }
    });

    // Depression and anxiety score distributions for this user
    const userDepressionScores = {
      no_to_mild: 0,
      mild_to_moderate: 0,
      moderate_to_severe: 0,
      severe: 0,
    };

    const userAnxietyScores = {
      no_or_minimal: 0,
      mild: 0,
      moderate: 0,
      moderately_severe: 0,
      severe: 0,
    };

    successfulSessions.forEach(session => {
      // Map prediction scores to distribution categories using DAM quantized scale
      let depressionCategory: string | null = null;
      let anxietyCategory: string | null = null;

      // Try prediction object first (DAM returns numeric strings 0-4)
      if (session.prediction) {
        const prediction = session.prediction as any;
        const depValue = prediction.predictedScoreDepression || prediction.predicted_score_depression;
        const anxValue = prediction.predictedScoreAnxiety || prediction.predicted_score_anxiety;
        depressionCategory = mapDepressionScore(depValue);
        anxietyCategory = mapAnxietyScore(anxValue);
      }

      // Fallback to analysisResults numeric scores (also DAM quantized 0-4 scale)
      if (!depressionCategory && session.analysisResults?.depressionScore !== null && session.analysisResults?.depressionScore !== undefined) {
        depressionCategory = mapDepressionScore(session.analysisResults.depressionScore);
      }

      if (!anxietyCategory && session.analysisResults?.anxietyScore !== null && session.analysisResults?.anxietyScore !== undefined) {
        anxietyCategory = mapAnxietyScore(session.analysisResults.anxietyScore);
      }

      // Count the categories for this user
      if (depressionCategory && depressionCategory in userDepressionScores) {
        userDepressionScores[depressionCategory as keyof typeof userDepressionScores]++;
      }

      if (anxietyCategory && anxietyCategory in userAnxietyScores) {
        userAnxietyScores[anxietyCategory as keyof typeof userAnxietyScores]++;
      }
    });

    // Find last activity
    const lastActivity = stats.sessions.reduce((latest, session) => {
      return new Date(session.updatedAt) > new Date(latest) ? session.updatedAt : latest;
    }, stats.sessions[0]?.updatedAt || new Date().toISOString());

    return {
      userId,
      totalSessions: stats.totalSessions,
      successfulSessions: stats.successfulSessions,
      successRate,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      riskDistribution: userRiskDistribution,
      lastActivity,
      depressionScores: userDepressionScores,
      anxietyScores: userAnxietyScores,
    };
  }).sort((a, b) => b.totalSessions - a.totalSessions); // Sort by total sessions desc

  // Calculate correlations between metadata and mental health outcomes
  const correlations = {
    ageDistribution: {} as Record<string, { depressionCases: number; anxietyCases: number; totalSessions: number; }>,
    genderDistribution: {} as Record<string, { depressionCases: number; anxietyCases: number; totalSessions: number; }>,
    raceDistribution: {} as Record<string, { depressionCases: number; anxietyCases: number; totalSessions: number; }>,
    ethnicityDistribution: {} as Record<string, { depressionCases: number; anxietyCases: number; totalSessions: number; }>,
    languageDistribution: {} as Record<string, { depressionCases: number; anxietyCases: number; totalSessions: number; }>,
    weightDistribution: {} as Record<string, { depressionCases: number; anxietyCases: number; totalSessions: number; }>,
    zipCodeDistribution: {} as Record<string, { depressionCases: number; anxietyCases: number; totalSessions: number; }>,
  };

  // Helper function to determine if a session has any depression/anxiety prediction
  const hasDepressionCase = (session: ImportedSessionData): boolean => {
    // Check for any depression prediction category
    if (session.prediction) {
      const prediction = session.prediction as any;
      const depressionCategory = prediction.predictedScoreDepression || prediction.predicted_score_depression;
      return !!depressionCategory;
    }
    // Fallback to numeric score existing
    if (session.analysisResults?.depressionScore !== null && session.analysisResults?.depressionScore !== undefined) {
      return true;
    }
    return false;
  };

  const hasAnxietyCase = (session: ImportedSessionData): boolean => {
    // Check for any anxiety prediction category
    if (session.prediction) {
      const prediction = session.prediction as any;
      const anxietyCategory = prediction.predictedScoreAnxiety || prediction.predicted_score_anxiety;
      return !!anxietyCategory;
    }
    // Fallback to numeric score existing
    if (session.analysisResults?.anxietyScore !== null && session.analysisResults?.anxietyScore !== undefined) {
      return true;
    }
    return false;
  };

  // Process sessions with metadata
  const sessionsWithMetadata = allSessions.filter(session => session.userMetadata);

  sessionsWithMetadata.forEach(session => {
    const metadata = session.userMetadata!;
    const hasDepression = hasDepressionCase(session);
    const hasAnxiety = hasAnxietyCase(session);

    // Age correlation (group by age ranges)
    if (metadata.age) {
      let ageGroup: string;
      if (metadata.age < 25) ageGroup = '18-24';
      else if (metadata.age < 35) ageGroup = '25-34';
      else if (metadata.age < 45) ageGroup = '35-44';
      else if (metadata.age < 55) ageGroup = '45-54';
      else if (metadata.age < 65) ageGroup = '55-64';
      else ageGroup = '65+';

      if (!correlations.ageDistribution[ageGroup]) {
        correlations.ageDistribution[ageGroup] = { depressionCases: 0, anxietyCases: 0, totalSessions: 0 };
      }
      correlations.ageDistribution[ageGroup].totalSessions++;
      if (hasDepression) correlations.ageDistribution[ageGroup].depressionCases++;
      if (hasAnxiety) correlations.ageDistribution[ageGroup].anxietyCases++;
    }

    // Gender correlation
    if (metadata.gender) {
      const gender = metadata.gender;
      if (!correlations.genderDistribution[gender]) {
        correlations.genderDistribution[gender] = { depressionCases: 0, anxietyCases: 0, totalSessions: 0 };
      }
      correlations.genderDistribution[gender].totalSessions++;
      if (hasDepression) correlations.genderDistribution[gender].depressionCases++;
      if (hasAnxiety) correlations.genderDistribution[gender].anxietyCases++;
    }

    // Race correlation
    if (metadata.race) {
      const race = metadata.race;
      if (!correlations.raceDistribution[race]) {
        correlations.raceDistribution[race] = { depressionCases: 0, anxietyCases: 0, totalSessions: 0 };
      }
      correlations.raceDistribution[race].totalSessions++;
      if (hasDepression) correlations.raceDistribution[race].depressionCases++;
      if (hasAnxiety) correlations.raceDistribution[race].anxietyCases++;
    }

    // Ethnicity correlation
    if (metadata.ethnicity) {
      const ethnicity = metadata.ethnicity;
      if (!correlations.ethnicityDistribution[ethnicity]) {
        correlations.ethnicityDistribution[ethnicity] = { depressionCases: 0, anxietyCases: 0, totalSessions: 0 };
      }
      correlations.ethnicityDistribution[ethnicity].totalSessions++;
      if (hasDepression) correlations.ethnicityDistribution[ethnicity].depressionCases++;
      if (hasAnxiety) correlations.ethnicityDistribution[ethnicity].anxietyCases++;
    }

    // Language correlation
    if (metadata.language !== undefined) {
      const language = metadata.language ? 'English' : 'Other';
      if (!correlations.languageDistribution[language]) {
        correlations.languageDistribution[language] = { depressionCases: 0, anxietyCases: 0, totalSessions: 0 };
      }
      correlations.languageDistribution[language].totalSessions++;
      if (hasDepression) correlations.languageDistribution[language].depressionCases++;
      if (hasAnxiety) correlations.languageDistribution[language].anxietyCases++;
    }

    // Weight correlation (group by BMI-like ranges)
    if (metadata.weight) {
      let weightGroup: string;
      if (metadata.weight < 120) weightGroup = 'Under 120 lbs';
      else if (metadata.weight < 150) weightGroup = '120-149 lbs';
      else if (metadata.weight < 180) weightGroup = '150-179 lbs';
      else if (metadata.weight < 220) weightGroup = '180-219 lbs';
      else weightGroup = '220+ lbs';

      if (!correlations.weightDistribution[weightGroup]) {
        correlations.weightDistribution[weightGroup] = { depressionCases: 0, anxietyCases: 0, totalSessions: 0 };
      }
      correlations.weightDistribution[weightGroup].totalSessions++;
      if (hasDepression) correlations.weightDistribution[weightGroup].depressionCases++;
      if (hasAnxiety) correlations.weightDistribution[weightGroup].anxietyCases++;
    }

    // ZIP code correlation (group by region - first 2 digits for demonstration)
    if (metadata.zipcode) {
      const zipPrefix = metadata.zipcode.substring(0, 2);
      let region: string;
      // Simple US region mapping based on ZIP code prefixes
      if (['0', '1', '2'].some(prefix => zipPrefix.startsWith(prefix))) region = 'Northeast';
      else if (['3', '4'].some(prefix => zipPrefix.startsWith(prefix))) region = 'Southeast';
      else if (['5', '6'].some(prefix => zipPrefix.startsWith(prefix))) region = 'South Central';
      else if (['7', '8'].some(prefix => zipPrefix.startsWith(prefix))) region = 'Mountain/West';
      else if (['9'].some(prefix => zipPrefix.startsWith(prefix))) region = 'Pacific';
      else region = 'Other/International';

      if (!correlations.zipCodeDistribution[region]) {
        correlations.zipCodeDistribution[region] = { depressionCases: 0, anxietyCases: 0, totalSessions: 0 };
      }
      correlations.zipCodeDistribution[region].totalSessions++;
      if (hasDepression) correlations.zipCodeDistribution[region].depressionCases++;
      if (hasAnxiety) correlations.zipCodeDistribution[region].anxietyCases++;
    }
  });

  // Calculate model analytics from prediction metadata
  const modelAnalytics = {
    providerDistribution: {} as Record<string, number>,
    modelCategoryDistribution: {} as Record<string, number>,
    calibratedCount: 0,
    uncalibratedCount: 0,
    totalWithModelInfo: 0,
  };

  completedSessions.forEach(session => {
    if (!session.prediction) return;
    const prediction = session.prediction as any;

    const provider = prediction.provider || prediction.Provider;
    const modelCategory = prediction.modelCategory || prediction.model_category;
    const isCalibrated = prediction.isCalibrated ?? prediction.is_calibrated;

    if (provider || modelCategory || isCalibrated !== undefined) {
      modelAnalytics.totalWithModelInfo++;
    }

    if (provider) {
      const providerLabel = provider === 'local-dam' ? 'DAM (Local)' : provider;
      modelAnalytics.providerDistribution[providerLabel] =
        (modelAnalytics.providerDistribution[providerLabel] || 0) + 1;
    } else {
      modelAnalytics.providerDistribution['API (Kintsugi)'] =
        (modelAnalytics.providerDistribution['API (Kintsugi)'] || 0) + 1;
    }

    if (modelCategory) {
      modelAnalytics.modelCategoryDistribution[modelCategory] =
        (modelAnalytics.modelCategoryDistribution[modelCategory] || 0) + 1;
    }

    if (isCalibrated === true) {
      modelAnalytics.calibratedCount++;
    } else if (isCalibrated === false) {
      modelAnalytics.uncalibratedCount++;
    }
  });

  return {
    overview: {
      totalSessions,
      uniqueUsers,
      successRate,
      avgSessionsPerUser,
      recentActivity,
    },
    sessionStatus: {
      succeeded: completedSessions.length,
      failed: failedSessions.length,
      processing: processingSessions.length,
      total: totalSessions,
    },
    riskLevels: {
      ...riskCounts,
      total: totalSessions,
    },
    predictions: {
      depression: {
        ...depressionCounts,
        total: completedSessions.length,
      },
      anxiety: {
        ...anxietyCounts,
        total: completedSessions.length,
      },
    },
    timeData,
    riskDistribution: riskCounts,
    userStats,
    correlations,
    modelAnalytics,
  };
};

// Types for chart components

// Metric card component
const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}> = ({ title, value, subtitle, icon, trend, color = 'text-blue-600' }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">{title}</p>
        <p className={`text-2xl font-bold ${color} dark:text-white mt-1`}>{value}</p>
        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        )}
      </div>
      <div className={`p-3 rounded-full bg-gray-100 dark:bg-gray-700 ${color}`}>
        {icon}
      </div>
    </div>
    {trend && (
      <div className="flex items-center mt-4">
        {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500 mr-1" />}
        {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500 mr-1" />}
        <span className={`text-sm ${
          trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
        }`}>
          {trend === 'up' ? 'Trending up' : trend === 'down' ? 'Trending down' : 'Stable'}
        </span>
      </div>
    )}
  </div>
);

// Distribution chart component
const DistributionChart: React.FC<{
  title: string;
  data: Array<{ label: string; value: number; color: string }>;
  total: number;
}> = ({ title, data, total }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{title}</h3>
    <div className="space-y-3">
      {data.map((item, index) => {
        const percentage = getPercentage(item.value, total);
        return (
          <div key={index}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {item.value} ({percentage}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 progress-dynamic ${item.color}`}
                style={{ '--progress-width': `${percentage}%` } as React.CSSProperties}
                role="progressbar"
                aria-label={`${item.label}: ${item.value} (${percentage}%)`}
              />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// Time series chart component (elegant line chart)
const TimeSeriesChart: React.FC<{
  title: string;
  data: Array<{ date: string; count: number }>;
}> = ({ title, data }) => {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const minCount = 0; // Start bars from zero for better visual comparison
  const range = maxCount - minCount || 1;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">{title}</h3>

      {/* Chart Container */}
      <div className="relative h-48">
        {/* SVG Chart */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgb(229 231 235)"
                strokeWidth="0.5"
                className="dark:stroke-gray-600"
              />
            </pattern>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0.6"/>
            </linearGradient>
          </defs>

          {/* Grid */}
          <rect width="100" height="100" fill="url(#grid)" />

          {/* Thin Vertical Bars */}
          {data.map((point, index) => {
            const barWidth = 80 / data.length; // Thin bars with spacing
            const x = (index / (data.length - 1)) * (100 - barWidth) + barWidth / 2;
            const barHeight = ((point.count - minCount) / range) * 95; // 95% of container height
            const y = 100 - barHeight;

            return (
              <rect
                key={index}
                x={x - barWidth / 2}
                y={y}
                width={barWidth * 0.6} // Make bars a little thicker
                height={barHeight}
                fill="url(#barGradient)"
                stroke="rgb(59 130 246)"
                strokeWidth="0.2"
                className="transition-all duration-300 hover:opacity-80"
                rx="0.5" // Slightly rounded corners
              />
            );
          })}
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="flex items-center justify-between mt-4 px-2">
        {data.map((item, index) => {
          const date = new Date(item.date);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          return (
            <div key={index} className="text-center flex-1">
              <div className="text-xs font-medium text-gray-900 dark:text-white">
                {dayName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {monthDay}
              </div>
              <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1">
                {item.count}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Metadata Correlation Chart Component
const MetadataCorrelationChart: React.FC<{
  title: string;
  data: Record<string, { depressionCases: number; anxietyCases: number; totalSessions: number; }>;
  subtitle?: string;
}> = ({ title, data, subtitle }) => {
  const categories = Object.keys(data);

  if (categories.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{title}</h3>
        {subtitle && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{subtitle}</p>
        )}
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          No metadata available for this correlation
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{title}</h3>
      {subtitle && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{subtitle}</p>
      )}

      <div className="space-y-4">
        {categories.map((category, index) => {
          const categoryData = data[category];
          const depressionRate = categoryData.totalSessions > 0
            ? (categoryData.depressionCases / categoryData.totalSessions) * 100
            : 0;
          const anxietyRate = categoryData.totalSessions > 0
            ? (categoryData.anxietyCases / categoryData.totalSessions) * 100
            : 0;

          return (
            <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium text-gray-900 dark:text-white">{category}</h4>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {categoryData.totalSessions} sessions
                </span>
              </div>

              {/* Depression Bar */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Depression Detected</span>
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {categoryData.depressionCases} ({depressionRate.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="h-2 bg-red-500 rounded-full transition-all duration-500 progress-dynamic"
                    style={{ '--progress-width': `${depressionRate}%` } as React.CSSProperties}
                    role="progressbar"
                    aria-label={`Depression rate: ${depressionRate.toFixed(1)}%`}
                  />
                </div>
              </div>

              {/* Anxiety Bar */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Anxiety Detected</span>
                  <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    {categoryData.anxietyCases} ({anxietyRate.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="h-2 bg-orange-500 rounded-full transition-all duration-500 progress-dynamic"
                    style={{ '--progress-width': `${anxietyRate}%` } as React.CSSProperties}
                    role="progressbar"
                    aria-label={`Anxiety rate: ${anxietyRate.toFixed(1)}%`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              {categories.reduce((sum, cat) => sum + data[cat].depressionCases, 0)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total Depression Detected</div>
          </div>
          <div>
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {categories.reduce((sum, cat) => sum + data[cat].anxietyCases, 0)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total Anxiety Detected</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Depression vs Anxiety Correlation Chart
const CorrelationChart: React.FC<{
  title: string;
  depressionData: AnalyticsData['predictions']['depression'];
  anxietyData: AnalyticsData['predictions']['anxiety'];
}> = ({ title, depressionData, anxietyData }) => {
  // Create correlation data points
  const correlationPoints = [
    { depression: depressionData.no_to_mild, anxiety: anxietyData.no_or_minimal, severity: 'Low', label: 'Minimal/None' },
    { depression: depressionData.mild_to_moderate, anxiety: anxietyData.mild, severity: 'Mild', label: 'Mild' },
    { depression: depressionData.moderate_to_severe, anxiety: anxietyData.moderate, severity: 'Moderate', label: 'Moderate' },
    { depression: depressionData.severe, anxiety: anxietyData.moderately_severe + anxietyData.severe, severity: 'High', label: 'Severe' },
  ];

  const maxValue = Math.max(
    ...correlationPoints.map(p => Math.max(p.depression, p.anxiety)),
    10
  );

  const getColor = (severity: string) => {
    switch (severity) {
      case 'Low': return 'fill-green-500 stroke-green-600';
      case 'Mild': return 'fill-yellow-500 stroke-yellow-600';
      case 'Moderate': return 'fill-orange-500 stroke-orange-600';
      case 'High': return 'fill-red-500 stroke-red-600';
      default: return 'fill-gray-500 stroke-gray-600';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">{title}</h3>

      <div className="relative h-[28rem]">
        <svg className="w-full h-full" viewBox="0 0 600 350">
          {/* Grid lines */}
          <defs>
            <pattern id="correlationGrid" width="50" height="35" patternUnits="userSpaceOnUse">
              <path
                d="M 50 0 L 0 0 0 35"
                fill="none"
                stroke="rgb(229 231 235)"
                strokeWidth="0.5"
                className="dark:stroke-gray-600"
              />
            </pattern>
          </defs>

          <rect width="600" height="350" fill="url(#correlationGrid)" />

          {/* Axes */}
          <line x1="70" y1="310" x2="550" y2="310" stroke="rgb(107 114 128)" strokeWidth="2" />
          <line x1="70" y1="310" x2="70" y2="40" stroke="rgb(107 114 128)" strokeWidth="2" />

          {/* Data points */}
          {correlationPoints.map((point, index) => {
            const x = 70 + (point.depression / maxValue) * 480;
            const y = 310 - (point.anxiety / maxValue) * 270;
            const radius = Math.max(Math.sqrt(point.depression + point.anxiety) * 3, 10);

            return (
              <g key={index}>
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  className={`${getColor(point.severity)} opacity-70 hover:opacity-90 transition-opacity`}
                  strokeWidth="2"
                />
                <text
                  x={x}
                  y={y + 5}
                  textAnchor="middle"
                  className="text-sm fill-white font-bold"
                >
                  {point.depression + point.anxiety}
                </text>
              </g>
            );
          })}

          {/* Axis labels */}
          <text x="310" y="335" textAnchor="middle" className="text-sm font-medium fill-gray-700 dark:fill-gray-300">
            Depression Cases →
          </text>
          <text x="40" y="175" textAnchor="middle" transform="rotate(-90 40 175)" className="text-sm font-medium fill-gray-700 dark:fill-gray-300">
            ← Anxiety Cases
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 flex justify-center space-x-4">
        {correlationPoints.map((point, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${getColor(point.severity).replace('fill-', 'bg-').replace('stroke-', 'border-').replace(' stroke-gray-600', '').replace(' stroke-green-600', '').replace(' stroke-yellow-600', '').replace(' stroke-orange-600', '').replace(' stroke-red-600', '')}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Session Completion Funnel Chart
const FunnelChart: React.FC<{
  title: string;
  sessionStatus: AnalyticsData['sessionStatus'];
}> = ({ title, sessionStatus }) => {
  const stages = [
    { label: 'Total Sessions', value: sessionStatus.total, color: 'bg-blue-500' },
    { label: 'In Processing', value: sessionStatus.processing, color: 'bg-yellow-500' },
    { label: 'Completed', value: sessionStatus.succeeded, color: 'bg-green-500' },
    { label: 'Failed', value: sessionStatus.failed, color: 'bg-red-500' },
  ];

  const maxValue = sessionStatus.total || 1;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">{title}</h3>

      <div className="space-y-4">
        {stages.map((stage, index) => {
          const width = (stage.value / maxValue) * 100;
          const conversionRate = index > 0 ? ((stage.value / stages[0].value) * 100).toFixed(1) : '100.0';

          return (
            <div key={index} className="relative">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {stage.label}
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {stage.value}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({conversionRate}%)
                  </span>
                </div>
              </div>

              <div className="relative h-8 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                <div
                  className={`h-full ${stage.color} transition-all duration-700 ease-out flex items-center justify-center relative progress-dynamic`}
                  style={{ '--progress-width': `${width}%` } as React.CSSProperties}
                >
                  {width > 20 && (
                    <span className="text-xs font-medium text-white">
                      {stage.value}
                    </span>
                  )}
                </div>

                {/* Conversion arrow */}
                {index < stages.length - 1 && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {((sessionStatus.succeeded / sessionStatus.total) * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Success Rate</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              {((sessionStatus.failed / sessionStatus.total) * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Failure Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// User statistics table component
const UserStatsTable: React.FC<{
  userStats: AnalyticsData['userStats'];
}> = ({ userStats }) => {
  const [showConfidenceModal, setShowConfidenceModal] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRiskColor = (riskLevel: string, count: number) => {
    if (count === 0) return 'text-gray-400';
    switch (riskLevel) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Calculate summary stats
  const totalUsers = userStats.length;
  const avgSessionsPerUser = totalUsers > 0
    ? Math.round(userStats.reduce((sum, u) => sum + u.totalSessions, 0) / totalUsers * 10) / 10
    : 0;
  const topPerformer = userStats.length > 0
    ? userStats.reduce((best, current) =>
        current.avgConfidence > best.avgConfidence ? current : best, userStats[0])
    : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 overflow-visible">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
          <Users className="h-5 w-5 mr-2 text-blue-500" />
          Per-User Analytics
        </h3>

        {/* Summary stats */}
        <div className="flex space-x-6 text-sm">
          <div className="text-center">
            <div className="font-semibold text-gray-900 dark:text-white">{totalUsers}</div>
            <div className="text-gray-600 dark:text-gray-400">Total Users</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-900 dark:text-white">{avgSessionsPerUser}</div>
            <div className="text-gray-600 dark:text-gray-400">Avg Sessions</div>
          </div>
          {topPerformer && (
            <div className="text-center">
              <div className="font-semibold text-blue-600">{(topPerformer.avgConfidence * 100).toFixed(1)}%</div>
              <div className="text-gray-600 dark:text-gray-400">Highest Avg Confidence</div>
            </div>
          )}
        </div>
      </div>

      {userStats.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
          No user data available
        </p>
      ) : (
        <div>
          {/* Risk Distribution Legend */}
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Risk Distribution Legend:
              </span>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-xs font-medium">
                    L
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Low Risk</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded text-xs font-medium">
                    M
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Medium Risk</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded text-xs font-medium">
                    H
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">High Risk</span>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-visible relative">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-2 font-medium text-gray-900 dark:text-white w-48">
                  User ID
                </th>
                <th className="text-center py-3 px-2 font-medium text-gray-900 dark:text-white">
                  Sessions
                </th>
                <th className="text-center py-3 px-2 font-medium text-gray-900 dark:text-white">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center space-x-1">
                      <span>Risk Distribution</span>
                      <button
                        type="button"
                        onClick={() => setShowRiskModal(true)}
                        className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                        aria-label="Show Risk Distribution information"
                      >
                        <Info className="h-3 w-3 text-gray-400 hover:text-blue-500 cursor-pointer" />
                      </button>
                    </div>
                  </div>
                </th>
                <th className="text-center py-3 px-2 font-medium text-gray-900 dark:text-white relative">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center space-x-1">
                      <span>Avg Confidence</span>
                      <button
                        type="button"
                        onClick={() => setShowConfidenceModal(true)}
                        className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                        aria-label="Show Average Confidence information"
                      >
                        <Info className="h-3 w-3 text-gray-400 hover:text-blue-500 cursor-pointer" />
                      </button>
                    </div>
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400 mt-1">
                      (Analysis accuracy 0-100%)
                    </span>
                  </div>
                </th>
                <th className="text-right py-3 px-2 font-medium text-gray-900 dark:text-white">
                  Last Activity
                </th>
              </tr>
            </thead>
            <tbody>
              {userStats.map((user, index) => (
                <tr
                  key={user.userId}
                  className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                    index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'
                  }`}
                >
                  <td className="py-3 px-2">
                    <div className="font-mono text-sm text-gray-900 dark:text-white">
                      <div className="truncate max-w-[200px]" title={user.userId}>
                        {user.userId}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="text-gray-900 dark:text-white font-medium">
                      {user.totalSessions}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {user.successfulSessions} successful
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex justify-center space-x-2 text-xs">
                      <span className={`px-1 py-0.5 rounded ${getRiskColor('low', user.riskDistribution.low)}`}>
                        L:{user.riskDistribution.low}
                      </span>
                      <span className={`px-1 py-0.5 rounded ${getRiskColor('medium', user.riskDistribution.medium)}`}>
                        M:{user.riskDistribution.medium}
                      </span>
                      <span className={`px-1 py-0.5 rounded ${getRiskColor('high', user.riskDistribution.high)}`}>
                        H:{user.riskDistribution.high}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="text-gray-900 dark:text-white font-medium">
                      {(user.avgConfidence * 100).toFixed(1)}%
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(user.lastActivity)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {/* Average Confidence Modal */}
      <AccessibleDialog
        isOpen={showConfidenceModal}
        onClose={() => setShowConfidenceModal(false)}
        title="Average Confidence Information"
        titleId="confidence-modal-title"
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
      >
            <div className="flex justify-between items-center mb-4">
              <h3 id="confidence-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">Average Confidence Information</h3>
              <button
                type="button"
                onClick={() => setShowConfidenceModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div className="font-medium text-center text-gray-900 dark:text-white mb-3">Average Confidence Calculation:</div>
              <div className="space-y-2">
                <div>• Calculated from AI model confidence scores</div>
                <div>• Averaged across all successful sessions per user</div>
                <div>• Related to risk distribution/evaluation accuracy</div>
                <div>• Higher values indicate more reliable assessments</div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                Analysis accuracy range: 0-100%
              </div>
            </div>
      </AccessibleDialog>

      {/* Risk Distribution Modal */}
      <AccessibleDialog
        isOpen={showRiskModal}
        onClose={() => setShowRiskModal(false)}
        title="Risk Distribution Information"
        titleId="risk-modal-title"
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
      >
            <div className="flex justify-between items-center mb-4">
              <h3 id="risk-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">Risk Distribution Information</h3>
              <button
                type="button"
                onClick={() => setShowRiskModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
              <div className="font-medium text-center text-gray-900 dark:text-white mb-3">Risk Distribution Explanation:</div>
              <div className="space-y-2">
                <div>• Shows the distribution of risk levels across all user sessions</div>
                <div>• Visualized as colored dots representing risk categories</div>
                <div>• <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1" aria-hidden="true"></span>Low Risk: Minimal behavioral health concerns</div>
                <div>• <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-1" aria-hidden="true"></span>Medium Risk: Moderate concerns requiring attention</div>
                <div>• <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1" aria-hidden="true"></span>High Risk: Significant concerns requiring intervention</div>
                <div>• <span className="inline-block w-2 h-2 bg-gray-400 rounded-full mr-1" aria-hidden="true"></span>Unknown: Risk level could not be determined</div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                Analysis accuracy: 0-100% (higher confidence = more reliable risk assessment)
              </div>
            </div>
      </AccessibleDialog>
    </div>
  );
};

export const ControlPanel: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { announceToScreenReader } = useAccessibility();

  // Get refresh interval from environment variable (default to 69 seconds)
  const refreshInterval = env.CONTROL_PANEL_REFRESH_INTERVAL * 1000;

  // Load all sessions data for analytics
  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all sessions from all users for system-wide analytics
      let allSessions: ImportedSessionData[] = [];

      try {
        // Add cache-busting timestamp to ensure fresh data
        const timestamp = Date.now();
        log.debug('Fetching data with cache-buster', { timestamp });

        const allSessionsResponse = await apiService.getAllSessions();
        allSessions = allSessionsResponse.sessions;
        log.debug('Fetched sessions data', {
          timestamp,
          totalCount: allSessions.length,
          responseCount: allSessionsResponse.count,
          firstFewSessions: allSessions.slice(0, 3).map(s => ({
            sessionId: s.sessionId,
            userId: s.userId,
            status: s.status,
            createdAt: s.createdAt
          }))
        });
      } catch (apiError) {
        log.warn('getAllSessions endpoint not available', { error: apiError });

        // No fallback data - show empty state when API is unavailable
        allSessions = [];
      }

      const aggregatedData = aggregateSessionData(allSessions);
      log.debug('Aggregated analytics', {
        totalSessions: aggregatedData.overview.totalSessions,
        uniqueUsers: aggregatedData.overview.uniqueUsers,
        successRate: aggregatedData.overview.successRate,
        sessionStatusBreakdown: aggregatedData.sessionStatus
      });
      setAnalytics(aggregatedData);
      setLastRefresh(new Date());

      announceToScreenReader('Control panel data loaded successfully');
    } catch (err) {
      const appError = err as AppError;
      setError(appError);
      announceToScreenReader(`Error loading control panel data: ${appError.message}`);
    } finally {
      setLoading(false);
    }
  }, [announceToScreenReader]);

  // Load data on component mount
  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Auto-refresh data at specified interval
  useEffect(() => {
    log.debug('Setting up auto-refresh', { intervalSeconds: refreshInterval / 1000 });

    const interval = setInterval(() => {
      log.debug('Auto-refresh triggered', { loading });
      // Remove loading check to ensure refresh happens
      loadAnalytics();
    }, refreshInterval);

    return () => {
      log.debug('Cleaning up auto-refresh interval');
      clearInterval(interval);
    }; // Cleanup on unmount
  }, [loadAnalytics, refreshInterval]); // Keep loadAnalytics in dependencies but remove loading

  // Retry error handler
  const handleRetry = useCallback(() => {
    setError(null);
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-3">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
              <span className="text-lg text-gray-600 dark:text-gray-300">
                Loading control panel data...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Error Loading Control Panel
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {error.message}
              </p>
              <button
                onClick={handleRetry}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <span className="text-lg text-gray-600 dark:text-gray-300">
              No data available
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Summary
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                System-wide analytics and insights from all users and sessions
              </p>
            </div>

            {/* Auto-refresh status and controls */}
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  Auto-refresh: {refreshInterval / 1000}s intervals
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={loadAnalytics}
                  disabled={loading}
                  className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                  aria-label="Refresh control panel data"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Overview Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <MetricCard
            title="Total Sessions"
            value={analytics.overview.totalSessions}
            subtitle="All time"
            icon={<Activity className="h-6 w-6" />}
            color="text-blue-600"
          />
          <MetricCard
            title="Unique Users"
            value={analytics.overview.uniqueUsers}
            subtitle="Active users"
            icon={<Users className="h-6 w-6" />}
            color="text-green-600"
          />
        </div>

        {/* Risk Level Distribution */}
        <CollapsibleSection title="Risk Level Distribution">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-2">
              <DistributionChart
                title="Risk Level Distribution"
                data={[
                  { label: 'Low Risk', value: analytics.riskLevels.low, color: 'bg-green-500' },
                  { label: 'Medium Risk', value: analytics.riskLevels.medium, color: 'bg-yellow-500' },
                  { label: 'High Risk', value: analytics.riskLevels.high, color: 'bg-red-500' },
                  { label: 'Unknown', value: analytics.riskLevels.unknown, color: 'bg-gray-500' },
                ]}
                total={analytics.riskLevels.total}
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* Prediction Distribution */}
        <CollapsibleSection title="Prediction Distribution" subtitle="Depression and anxiety score breakdowns across all sessions">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Depression Score Distribution */}
            <DistributionChart
              title="Depression Score Distribution"
              data={[
                { label: 'No to Mild', value: analytics.predictions.depression.no_to_mild, color: 'bg-green-500' },
                { label: 'Mild to Moderate', value: analytics.predictions.depression.mild_to_moderate, color: 'bg-yellow-500' },
                { label: 'Moderate to Severe', value: analytics.predictions.depression.moderate_to_severe, color: 'bg-orange-500' },
                { label: 'Severe', value: analytics.predictions.depression.severe, color: 'bg-red-500' },
              ]}
              total={analytics.predictions.depression.total}
            />

            {/* Anxiety Score Distribution */}
            <DistributionChart
              title="Anxiety Score Distribution"
              data={[
                { label: 'No or Minimal', value: analytics.predictions.anxiety.no_or_minimal, color: 'bg-green-500' },
                { label: 'Mild', value: analytics.predictions.anxiety.mild, color: 'bg-yellow-500' },
                { label: 'Moderate', value: analytics.predictions.anxiety.moderate, color: 'bg-orange-500' },
                { label: 'Moderately Severe', value: analytics.predictions.anxiety.moderately_severe, color: 'bg-red-500' },
                { label: 'Severe', value: analytics.predictions.anxiety.severe, color: 'bg-red-700' },
              ]}
              total={analytics.predictions.anxiety.total}
            />
          </div>
        </CollapsibleSection>

        {/* Per-User Statistics */}
        <CollapsibleSection title="Per-User Statistics" subtitle="Individual user session history and risk breakdown">
          <UserStatsTable userStats={analytics.userStats} />
        </CollapsibleSection>

        {/* Metadata Correlation Analysis */}
        <CollapsibleSection
          title="Demographic Correlation Analysis"
          subtitle="Correlation between patient demographics and mental health outcomes (Depression & Anxiety cases)"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Depression vs Anxiety Correlation - Featured First */}
            <div className="lg:col-span-2">
              <CorrelationChart
                title="Depression vs Anxiety Correlation"
                depressionData={analytics.predictions.depression}
                anxietyData={analytics.predictions.anxiety}
              />
            </div>

            {/* Age Correlation */}
            <MetadataCorrelationChart
              title="Age Groups vs Mental Health Cases"
              subtitle="Distribution by age ranges showing depression and anxiety case rates"
              data={analytics.correlations.ageDistribution}
            />

            {/* Gender Correlation */}
            <MetadataCorrelationChart
              title="Gender vs Mental Health Cases"
              subtitle="Distribution by gender identity showing case rates"
              data={analytics.correlations.genderDistribution}
            />

            {/* Weight Correlation */}
            <MetadataCorrelationChart
              title="Weight Groups vs Mental Health Cases"
              subtitle="Distribution by weight ranges showing case rates"
              data={analytics.correlations.weightDistribution}
            />

            {/* Race Correlation */}
            <MetadataCorrelationChart
              title="Race vs Mental Health Cases"
              subtitle="Distribution by racial identity showing case rates"
              data={analytics.correlations.raceDistribution}
            />

            {/* Ethnicity Correlation */}
            <MetadataCorrelationChart
              title="Ethnicity vs Mental Health Cases"
              subtitle="Distribution by ethnic background showing case rates"
              data={analytics.correlations.ethnicityDistribution}
            />

            {/* Language Correlation */}
            <MetadataCorrelationChart
              title="Primary Language vs Mental Health Cases"
              subtitle="Distribution by language preference showing case rates"
              data={analytics.correlations.languageDistribution}
            />

            {/* Geographic Correlation */}
            <MetadataCorrelationChart
              title="Geographic Region vs Mental Health Cases"
              subtitle="Distribution by ZIP code regions showing case rates"
              data={analytics.correlations.zipCodeDistribution}
            />
          </div>
        </CollapsibleSection>

        {/* Session Analytics */}
        <CollapsibleSection title="Session Analytics" subtitle="Session completion funnel and status breakdown">
          <FunnelChart
            title="Session Completion Funnel"
            sessionStatus={analytics.sessionStatus}
          />
        </CollapsibleSection>

        {/* Model Analytics */}
        {analytics.modelAnalytics.totalWithModelInfo > 0 && (
          <CollapsibleSection
            title="Model Analytics"
            subtitle="DAM prediction model metadata across all completed sessions"
          >

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Provider Distribution */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Provider Distribution
                </h3>
                <div className="space-y-3">
                  {Object.entries(analytics.modelAnalytics.providerDistribution).map(([provider, count]) => {
                    const total = Object.values(analytics.modelAnalytics.providerDistribution).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={provider}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400">{provider}</span>
                          <span className="text-gray-900 dark:text-white font-medium">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-indigo-500 transition-all duration-500 progress-dynamic"
                            style={{ '--progress-width': `${pct}%` } as React.CSSProperties}
                            role="progressbar"
                            aria-label={`${provider}: ${count} (${pct}%)`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Model Category Distribution */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Model Category
                </h3>
                {Object.keys(analytics.modelAnalytics.modelCategoryDistribution).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(analytics.modelAnalytics.modelCategoryDistribution).map(([category, count]) => {
                      const total = Object.values(analytics.modelAnalytics.modelCategoryDistribution).reduce((a, b) => a + b, 0);
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={category}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600 dark:text-gray-400">{category}</span>
                            <span className="text-gray-900 dark:text-white font-medium">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-cyan-500 transition-all duration-500 progress-dynamic"
                              style={{ '--progress-width': `${pct}%` } as React.CSSProperties}
                              role="progressbar"
                              aria-label={`${category}: ${count} (${pct}%)`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4 text-sm">
                    No model category data available
                  </p>
                )}
              </div>

              {/* Calibration Status */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Calibration Status
                </h3>
                {(analytics.modelAnalytics.calibratedCount > 0 || analytics.modelAnalytics.uncalibratedCount > 0) ? (
                  <div className="space-y-3">
                    {analytics.modelAnalytics.calibratedCount > 0 && (() => {
                      const total = analytics.modelAnalytics.calibratedCount + analytics.modelAnalytics.uncalibratedCount;
                      const pct = total > 0 ? Math.round((analytics.modelAnalytics.calibratedCount / total) * 100) : 0;
                      return (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600 dark:text-gray-400">Calibrated</span>
                            <span className="text-gray-900 dark:text-white font-medium">
                              {analytics.modelAnalytics.calibratedCount} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-green-500 transition-all duration-500 progress-dynamic"
                              style={{ '--progress-width': `${pct}%` } as React.CSSProperties}
                              role="progressbar"
                              aria-label={`Calibrated: ${analytics.modelAnalytics.calibratedCount} (${pct}%)`}
                            />
                          </div>
                        </div>
                      );
                    })()}
                    {analytics.modelAnalytics.uncalibratedCount > 0 && (() => {
                      const total = analytics.modelAnalytics.calibratedCount + analytics.modelAnalytics.uncalibratedCount;
                      const pct = total > 0 ? Math.round((analytics.modelAnalytics.uncalibratedCount / total) * 100) : 0;
                      return (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600 dark:text-gray-400">Uncalibrated</span>
                            <span className="text-gray-900 dark:text-white font-medium">
                              {analytics.modelAnalytics.uncalibratedCount} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="h-2 rounded-full bg-amber-500 transition-all duration-500 progress-dynamic"
                              style={{ '--progress-width': `${pct}%` } as React.CSSProperties}
                              role="progressbar"
                              aria-label={`Uncalibrated: ${analytics.modelAnalytics.uncalibratedCount} (${pct}%)`}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4 text-sm">
                    No calibration data available
                  </p>
                )}
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Sessions Over Time - Full Width */}
        <CollapsibleSection title="Sessions Over Time" subtitle="Session volume trends over the past 7 days">
          <TimeSeriesChart
            title="Sessions Over Time (7 Days)"
            data={analytics.timeData}
          />
        </CollapsibleSection>
      </div>
    </div>
  );
};

export default ControlPanel;
