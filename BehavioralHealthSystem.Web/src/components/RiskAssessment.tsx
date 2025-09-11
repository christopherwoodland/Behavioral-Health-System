import React, { useState, useCallback } from 'react';
import { 
  Brain, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw, 
  Clock, 
  TrendingUp,
  Lightbulb,
  ShieldAlert,
  FileText,
  Target,
  Calendar
} from 'lucide-react';
import { apiService } from '../services/api';
import { useAccessibility } from '../hooks/useAccessibility';
import { formatDateTime } from '../utils';
import type { RiskAssessment, AppError } from '../types';

interface RiskAssessmentProps {
  sessionId: string;
  existingAssessment?: RiskAssessment | null;
  onAssessmentUpdated?: (assessment: RiskAssessment) => void;
}

// Risk level configuration
const riskLevelConfig = {
  low: { 
    color: 'green', 
    label: 'Low Risk',
    icon: CheckCircle,
    description: 'Low likelihood of immediate concerns'
  },
  moderate: { 
    color: 'yellow', 
    label: 'Moderate Risk',
    icon: AlertTriangle,
    description: 'Some concerns that warrant attention'
  },
  high: { 
    color: 'red', 
    label: 'High Risk',
    icon: ShieldAlert,
    description: 'Significant concerns requiring immediate attention'
  },
  critical: { 
    color: 'red', 
    label: 'Critical Risk',
    icon: ShieldAlert,
    description: 'Urgent intervention required'
  },
} as const;

const RiskAssessmentComponent: React.FC<RiskAssessmentProps> = ({
  sessionId,
  existingAssessment,
  onAssessmentUpdated
}) => {
  const { announceToScreenReader } = useAccessibility();
  const [assessment, setAssessment] = useState<RiskAssessment | null>(existingAssessment || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  // Generate new risk assessment
  const generateAssessment = useCallback(async () => {
    try {
      setIsGenerating(true);
      setError(null);
      announceToScreenReader('Generating AI risk assessment...');

      const response = await apiService.generateRiskAssessment(sessionId);
      
      if (response.success && response.riskAssessment) {
        setAssessment(response.riskAssessment);
        onAssessmentUpdated?.(response.riskAssessment);
        announceToScreenReader('Risk assessment generated successfully');
      } else {
        throw new Error(response.message || 'Failed to generate risk assessment');
      }
    } catch (err) {
      const appError = err as AppError;
      setError(appError);
      announceToScreenReader(`Error generating assessment: ${appError.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [sessionId, onAssessmentUpdated, announceToScreenReader]);

  // Load existing assessment
  const loadAssessment = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiService.getRiskAssessment(sessionId);
      
      if (response.success && response.riskAssessment) {
        setAssessment(response.riskAssessment);
        onAssessmentUpdated?.(response.riskAssessment);
      }
    } catch (err) {
      const appError = err as AppError;
      setError(appError);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, onAssessmentUpdated]);

  // Risk level badge component
  const RiskLevelBadge: React.FC<{ riskLevel: string; riskScore?: number }> = ({ riskLevel, riskScore }) => {
    const config = riskLevelConfig[riskLevel.toLowerCase() as keyof typeof riskLevelConfig];
    if (!config) return null;

    const Icon = config.icon;
    
    return (
      <div className="flex items-center space-x-2">
        <span
          className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${
            config.color === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
            config.color === 'yellow' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}
          role="status"
          aria-label={`Risk level: ${config.label}`}
        >
          <Icon className="w-4 h-4 mr-2" aria-hidden="true" />
          {config.label}
          {riskScore && (
            <span className="ml-2 px-2 py-0.5 bg-white dark:bg-gray-800 rounded text-xs font-bold">
              {riskScore}/10
            </span>
          )}
        </span>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {config.description}
        </span>
      </div>
    );
  };

  // If no assessment exists and not generating, show generate button
  if (!assessment && !isGenerating && !isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Brain className="w-5 h-5 mr-2" aria-hidden="true" />
          AI Risk Assessment
        </h2>
        
        <div className="text-center py-8">
          <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Risk Assessment Available
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Generate an AI-powered risk assessment based on session data and clinical insights.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={generateAssessment}
              className="btn-primary"
              aria-label="Generate AI risk assessment"
            >
              <Brain className="w-4 h-4 mr-2" aria-hidden="true" />
              Generate AI Risk Assessment
            </button>
            
            <button
              onClick={loadAssessment}
              className="btn-secondary"
              aria-label="Check for existing assessment"
            >
              <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
              Check for Existing Assessment
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-700 dark:text-red-300 text-sm">
                {error.message}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (isGenerating || isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Brain className="w-5 h-5 mr-2" aria-hidden="true" />
          AI Risk Assessment
        </h2>
        
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mr-3" aria-hidden="true" />
          <span className="text-lg text-gray-900 dark:text-white">
            {isGenerating ? 'Generating AI risk assessment...' : 'Loading assessment...'}
          </span>
        </div>
        
        {isGenerating && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This may take a few moments as AI analyzes the session data...
            </p>
          </div>
        )}
      </div>
    );
  }

  // Display assessment
  if (!assessment) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
          <Brain className="w-5 h-5 mr-2" aria-hidden="true" />
          AI Risk Assessment
        </h2>
        
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          {assessment.confidenceLevel && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Confidence: {(assessment.confidenceLevel * 100).toFixed(0)}%
            </span>
          )}
          
          <button
            onClick={generateAssessment}
            disabled={isGenerating}
            className="btn-secondary text-xs"
            aria-label="Regenerate risk assessment"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isGenerating ? 'animate-spin' : ''}`} aria-hidden="true" />
            Regenerate
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Risk Level and Score */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Overall Risk Level
            </h3>
            <RiskLevelBadge riskLevel={assessment.overallRiskLevel} riskScore={assessment.riskScore} />
          </div>
          
          {assessment.generatedAt && (
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                <Calendar className="w-4 h-4 mr-1" aria-hidden="true" />
                Generated
              </h3>
              <div className="text-sm text-gray-900 dark:text-white">
                {formatDateTime(assessment.generatedAt)}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        {assessment.summary && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <FileText className="w-5 h-5 mr-2" aria-hidden="true" />
              Summary
            </h3>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-blue-900 dark:text-blue-100 text-sm leading-relaxed">
                {assessment.summary}
              </p>
            </div>
          </div>
        )}

        {/* Key Risk Factors */}
        {assessment.keyFactors && assessment.keyFactors.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" aria-hidden="true" />
              Key Risk Factors
            </h3>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <ul className="space-y-2">
                {assessment.keyFactors.map((factor: string, index: number) => (
                  <li key={index} className="text-yellow-900 dark:text-yellow-100 text-sm flex items-start">
                    <span className="inline-block w-2 h-2 bg-yellow-600 dark:bg-yellow-400 rounded-full mt-2 mr-3 flex-shrink-0" aria-hidden="true"></span>
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Recommendations */}
        {assessment.recommendations && assessment.recommendations.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <Lightbulb className="w-5 h-5 mr-2" aria-hidden="true" />
              Recommendations
            </h3>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <ul className="space-y-2">
                {assessment.recommendations.map((recommendation: string, index: number) => (
                  <li key={index} className="text-green-900 dark:text-green-100 text-sm flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 mr-3 flex-shrink-0" aria-hidden="true" />
                    {recommendation}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Immediate Actions */}
        {assessment.immediateActions && assessment.immediateActions.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <Target className="w-5 h-5 mr-2" aria-hidden="true" />
              Immediate Actions Required
            </h3>
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <ul className="space-y-2">
                {assessment.immediateActions.map((action: string, index: number) => (
                  <li key={index} className="text-red-900 dark:text-red-100 text-sm flex items-start">
                    <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" aria-hidden="true" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Follow-up Recommendations */}
        {assessment.followUpRecommendations && assessment.followUpRecommendations.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" aria-hidden="true" />
              Follow-up Recommendations
            </h3>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <ul className="space-y-2">
                {assessment.followUpRecommendations.map((followUp: string, index: number) => (
                  <li key={index} className="text-purple-900 dark:text-purple-100 text-sm flex items-start">
                    <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 mr-3 flex-shrink-0" aria-hidden="true" />
                    {followUp}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <Clock className="w-3 h-3 mr-1" aria-hidden="true" />
            Generated: {formatDateTime(assessment.generatedAt)}
            {assessment.modelVersion && (
              <span className="ml-4">Model: {assessment.modelVersion}</span>
            )}
          </div>
        </div>
      </div>
      
      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-300 text-sm">
            {error.message}
          </p>
        </div>
      )}
    </div>
  );
};

export default RiskAssessmentComponent;
