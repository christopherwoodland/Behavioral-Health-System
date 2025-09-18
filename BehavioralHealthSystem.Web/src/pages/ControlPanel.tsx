import React, { useState, useCallback, useEffect } from 'react';
import { RefreshCw, AlertCircle, TrendingUp, TrendingDown, Users, Activity, Info } from 'lucide-react';
import { useAccessibility } from '../hooks/useAccessibility';
import { apiService } from '../services/api';
import type { SessionData as ImportedSessionData, AppError } from '../types';

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
}

// Utility function to calculate percentage
const getPercentage = (value: number, total: number): number => {
  return total > 0 ? Math.round((value / total) * 100) : 0;
};

// Function to aggregate session data into analytics
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
    // Handle depression scores - try multiple sources
    let depressionCategory: string | null = null;
    let anxietyCategory: string | null = null;

    // First try prediction object for classification strings
    if (session.prediction) {
      const prediction = session.prediction as any;
      depressionCategory = prediction.predictedScoreDepression || prediction.predicted_score_depression;
      anxietyCategory = prediction.predictedScoreAnxiety || prediction.predicted_score_anxiety;
    }

    // If no classification from prediction, try to categorize from numeric scores in analysisResults
    if (!depressionCategory && session.analysisResults?.depressionScore !== null && session.analysisResults?.depressionScore !== undefined) {
      const score = session.analysisResults.depressionScore;
      // Convert numeric PHQ-9 score to categories (0-27 scale)
      if (score >= 0 && score <= 4) depressionCategory = 'no_to_mild';
      else if (score >= 5 && score <= 9) depressionCategory = 'mild_to_moderate';
      else if (score >= 10 && score <= 14) depressionCategory = 'mild_to_moderate';
      else if (score >= 15 && score <= 19) depressionCategory = 'moderate_to_severe';
      else if (score >= 20) depressionCategory = 'severe';
    }

    if (!anxietyCategory && session.analysisResults?.anxietyScore !== null && session.analysisResults?.anxietyScore !== undefined) {
      const score = session.analysisResults.anxietyScore;
      // Convert numeric GAD-7 score to categories (0-21 scale)
      if (score >= 0 && score <= 4) anxietyCategory = 'no_or_minimal';
      else if (score >= 5 && score <= 9) anxietyCategory = 'mild';
      else if (score >= 10 && score <= 14) anxietyCategory = 'moderate';
      else if (score >= 15 && score <= 19) anxietyCategory = 'moderately_severe';
      else if (score >= 20) anxietyCategory = 'severe';
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
      // Handle depression scores - try multiple sources
      let depressionCategory: string | null = null;
      let anxietyCategory: string | null = null;

      // First try prediction object for classification strings
      if (session.prediction) {
        const prediction = session.prediction as any;
        depressionCategory = prediction.predictedScoreDepression || prediction.predicted_score_depression;
        anxietyCategory = prediction.predictedScoreAnxiety || prediction.predicted_score_anxiety;
      }

      // If no classification from prediction, try to categorize from numeric scores in analysisResults
      if (!depressionCategory && session.analysisResults?.depressionScore !== null && session.analysisResults?.depressionScore !== undefined) {
        const score = session.analysisResults.depressionScore;
        // Convert numeric PHQ-9 score to categories (0-27 scale)
        if (score >= 0 && score <= 4) depressionCategory = 'no_to_mild';
        else if (score >= 5 && score <= 9) depressionCategory = 'mild_to_moderate';
        else if (score >= 10 && score <= 14) depressionCategory = 'mild_to_moderate';
        else if (score >= 15 && score <= 19) depressionCategory = 'moderate_to_severe';
        else if (score >= 20) depressionCategory = 'severe';
      }

      if (!anxietyCategory && session.analysisResults?.anxietyScore !== null && session.analysisResults?.anxietyScore !== undefined) {
        const score = session.analysisResults.anxietyScore;
        // Convert numeric GAD-7 score to categories (0-21 scale)
        if (score >= 0 && score <= 4) anxietyCategory = 'no_or_minimal';
        else if (score >= 5 && score <= 9) anxietyCategory = 'mild';
        else if (score >= 10 && score <= 14) anxietyCategory = 'moderate';
        else if (score >= 15 && score <= 19) anxietyCategory = 'moderately_severe';
        else if (score >= 20) anxietyCategory = 'severe';
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

  // Helper function to determine if a session indicates depression/anxiety
  const hasDepressionCase = (session: ImportedSessionData): boolean => {
    // Check for moderate_to_severe or severe depression
    if (session.prediction) {
      const prediction = session.prediction as any;
      const depressionCategory = prediction.predictedScoreDepression || prediction.predicted_score_depression;
      return depressionCategory === 'moderate_to_severe' || depressionCategory === 'severe';
    }
    // Fallback to numeric score (PHQ-9 >= 10 indicates moderate or higher depression)
    if (session.analysisResults?.depressionScore !== null && session.analysisResults?.depressionScore !== undefined) {
      return session.analysisResults.depressionScore >= 10;
    }
    return false;
  };

  const hasAnxietyCase = (session: ImportedSessionData): boolean => {
    // Check for moderate, moderately_severe, or severe anxiety
    if (session.prediction) {
      const prediction = session.prediction as any;
      const anxietyCategory = prediction.predictedScoreAnxiety || prediction.predicted_score_anxiety;
      return anxietyCategory === 'moderate' || anxietyCategory === 'moderately_severe' || anxietyCategory === 'severe';
    }
    // Fallback to numeric score (GAD-7 >= 10 indicates moderate or higher anxiety)
    if (session.analysisResults?.anxietyScore !== null && session.analysisResults?.anxietyScore !== undefined) {
      return session.analysisResults.anxietyScore >= 10;
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
                className={`h-2 rounded-full transition-all duration-500 ${item.color}`}
                style={{ width: `${percentage}%` }}
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
                  <span className="text-sm text-gray-600 dark:text-gray-400">Depression Cases</span>
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {categoryData.depressionCases} ({depressionRate.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="h-2 bg-red-500 rounded-full transition-all duration-500"
                    style={{ width: `${depressionRate}%` }}
                    role="progressbar"
                    aria-label={`Depression rate: ${depressionRate.toFixed(1)}%`}
                  />
                </div>
              </div>
              
              {/* Anxiety Bar */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Anxiety Cases</span>
                  <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    {categoryData.anxietyCases} ({anxietyRate.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="h-2 bg-orange-500 rounded-full transition-all duration-500"
                    style={{ width: `${anxietyRate}%` }}
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
            <div className="text-xs text-gray-600 dark:text-gray-400">Total Depression Cases</div>
          </div>
          <div>
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {categories.reduce((sum, cat) => sum + data[cat].anxietyCases, 0)}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total Anxiety Cases</div>
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
                  className={`h-full ${stage.color} transition-all duration-700 ease-out flex items-center justify-center relative`}
                  style={{ width: `${width}%` }}
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
                  Risk Distribution
                </th>
                <th className="text-center py-3 px-2 font-medium text-gray-900 dark:text-white relative">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center space-x-1">
                      <span>Avg Confidence</span>
                      <div className="relative group">
                        <Info className="h-3 w-3 text-gray-400 hover:text-blue-500 cursor-help" />
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[99999]">
                          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg p-3 shadow-2xl border border-gray-600 whitespace-nowrap w-80">
                            <div className="font-semibold mb-2 text-center">Average Confidence Calculation:</div>
                            <div className="space-y-1 text-left">
                              <div>• Calculated from AI model confidence scores</div>
                              <div>• Averaged across all successful sessions per user</div>
                              <div>• Related to risk distribution/evaluation accuracy</div>
                              <div>• Higher values indicate more reliable assessments</div>
                            </div>
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                          </div>
                        </div>
                      </div>
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
  const refreshInterval = parseInt(import.meta.env.VITE_CONTROL_PANEL_REFRESH_INTERVAL || '69') * 1000;

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
        console.log('🔄 ControlPanel: Fetching data with cache-buster:', timestamp);
        
        const allSessionsResponse = await apiService.getAllSessions();
        allSessions = allSessionsResponse.sessions;
        console.log('📊 ControlPanel: Fetched sessions data:', {
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
        console.warn('getAllSessions endpoint not available, using mock data for demonstration:', apiError);
        
        // Fallback to mock data for demonstration purposes
        allSessions = [
          {
            sessionId: 'demo-session-1',
            userId: 'a8b7c6d5-e4f3-4a2b-9c8d-7e6f5a4b3c2d',
            status: 'succeeded',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
            updatedAt: new Date().toISOString(),
            audioFileName: 'session_1.wav',
            userMetadata: {
              age: 28,
              gender: 'female',
              race: 'white',
              ethnicity: 'Not Hispanic, Latino, or Spanish Origin',
              language: true,
              weight: 145,
              zipcode: '10001',
            },
            prediction: {
              sessionId: 'demo-session-1',
              status: 'succeeded',
              predictedScoreDepression: 'mild_to_moderate',
              predictedScoreAnxiety: 'no_or_minimal',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            analysisResults: {
              riskLevel: 'medium',
              confidence: 0.85,
              insights: ['Analysis completed'],
              completedAt: new Date().toISOString(),
            },
          },
          {
            sessionId: 'demo-session-2',
            userId: 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f',
            status: 'succeeded',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
            updatedAt: new Date().toISOString(),
            audioFileName: 'session_2.wav',
            userMetadata: {
              age: 45,
              gender: 'male',
              race: 'black or african-american',
              ethnicity: 'Hispanic, Latino, or Spanish Origin',
              language: true,
              weight: 190,
              zipcode: '90210',
            },
            prediction: {
              sessionId: 'demo-session-2',
              status: 'succeeded',
              predictedScoreDepression: 'no_to_mild',
              predictedScoreAnxiety: 'moderate',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            analysisResults: {
              riskLevel: 'low',
              confidence: 0.92,
              insights: ['Analysis completed'],
              completedAt: new Date().toISOString(),
            },
          },
          {
            sessionId: 'demo-session-3',
            userId: '9d8c7b6a-5e4f-4392-8a1b-0c9d8e7f6a5b',
            status: 'failed',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
            updatedAt: new Date().toISOString(),
            audioFileName: 'session_3.wav',
            userMetadata: {
              age: 65,
              gender: 'non-binary',
              race: 'asian',
              ethnicity: 'Not Hispanic, Latino, or Spanish Origin',
              language: false,
              weight: 160,
              zipcode: '60601',
            },
            analysisResults: {
              riskLevel: 'unknown',
              confidence: 0,
              insights: ['Processing failed'],
              completedAt: new Date().toISOString(),
            },
          },
          {
            sessionId: 'demo-session-4',
            userId: 'a8b7c6d5-e4f3-4a2b-9c8d-7e6f5a4b3c2d', // Same user as session 1
            status: 'succeeded',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
            updatedAt: new Date().toISOString(),
            audioFileName: 'session_4.wav',
            userMetadata: {
              age: 28,
              gender: 'female',
              race: 'white',
              ethnicity: 'Not Hispanic, Latino, or Spanish Origin',
              language: true,
              weight: 145,
              zipcode: '10001',
            },
            prediction: {
              sessionId: 'demo-session-4',
              status: 'succeeded',
              predictedScoreDepression: 'moderate_to_severe',
              predictedScoreAnxiety: 'moderately_severe',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            analysisResults: {
              riskLevel: 'high',
              confidence: 0.78,
              insights: ['Analysis completed'],
              completedAt: new Date().toISOString(),
            },
          },
          {
            sessionId: 'demo-session-5',
            userId: '4c3b2a19-8e7f-4d6c-5b4a-392817f6e5d4',
            status: 'processing',
            createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
            updatedAt: new Date().toISOString(),
            audioFileName: 'session_5.wav',
            userMetadata: {
              age: 52,
              gender: 'male',
              race: 'american indian or alaskan native',
              ethnicity: 'Not Hispanic, Latino, or Spanish Origin',
              language: true,
              weight: 220,
              zipcode: '80202',
            },
            analysisResults: {
              riskLevel: 'unknown',
              confidence: 0,
              insights: ['Processing in progress'],
              completedAt: new Date().toISOString(),
            },
          },
          {
            sessionId: 'demo-session-6',
            userId: 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f', // Same user as session 2
            status: 'succeeded',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(), // 36 hours ago
            updatedAt: new Date().toISOString(),
            audioFileName: 'session_6.wav',
            userMetadata: {
              age: 45,
              gender: 'male',
              race: 'black or african-american',
              ethnicity: 'Hispanic, Latino, or Spanish Origin',
              language: true,
              weight: 190,
              zipcode: '90210',
            },
            prediction: {
              sessionId: 'demo-session-6',
              status: 'succeeded',
              predictedScoreDepression: 'no_to_mild',
              predictedScoreAnxiety: 'mild',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            analysisResults: {
              riskLevel: 'low',
              confidence: 0.89,
              insights: ['Analysis completed'],
              completedAt: new Date().toISOString(),
            },
          },
          {
            sessionId: 'demo-session-7',
            userId: '7f6e5d4c-3b2a-4190-8e7f-6d5c4b3a2918',
            status: 'succeeded',
            createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 48 hours ago
            updatedAt: new Date().toISOString(),
            audioFileName: 'session_7.wav',
            userMetadata: {
              age: 35,
              gender: 'transgender female',
              race: 'two or more races',
              ethnicity: 'Hispanic, Latino, or Spanish Origin',
              language: false,
              weight: 135,
              zipcode: '33101',
            },
            prediction: {
              sessionId: 'demo-session-7',
              status: 'succeeded',
              predictedScoreDepression: 'mild_to_moderate',
              predictedScoreAnxiety: 'moderate',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            analysisResults: {
              riskLevel: 'medium',
              confidence: 0.82,
              insights: ['Analysis completed'],
              completedAt: new Date().toISOString(),
            },
          },
        ];
      }
      
      const aggregatedData = aggregateSessionData(allSessions);
      console.log('📈 ControlPanel: Aggregated analytics:', {
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
    console.log('🔄 ControlPanel: Setting up auto-refresh with interval:', refreshInterval / 1000, 'seconds');
    
    const interval = setInterval(() => {
      console.log('🔄 ControlPanel: Auto-refresh triggered, loading state:', loading);
      // Remove loading check to ensure refresh happens
      loadAnalytics();
    }, refreshInterval);

    return () => {
      console.log('🔄 ControlPanel: Cleaning up auto-refresh interval');
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

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Risk Level Distribution */}
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

        {/* Prediction Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

        {/* Per-User Statistics */}
        <div className="mb-8">
          <UserStatsTable userStats={analytics.userStats} />
        </div>

        {/* Metadata Correlation Analysis */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Demographic Correlation Analysis
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Correlation between patient demographics and mental health outcomes (Depression & Anxiety cases)
            </p>
          </div>
          
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
        </div>

        {/* Session Analytics */}
        <div className="mb-8">
          <FunnelChart
            title="Session Completion Funnel"
            sessionStatus={analytics.sessionStatus}
          />
        </div>

        {/* Sessions Over Time - Full Width */}
        <div className="mb-8">
          <TimeSeriesChart
            title="Sessions Over Time (7 Days)"
            data={analytics.timeData}
          />
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;