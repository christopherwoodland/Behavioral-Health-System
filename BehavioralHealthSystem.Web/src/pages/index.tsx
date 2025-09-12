import React from 'react';
import { RefreshCw, AlertCircle, Activity, Info } from 'lucide-react';
import { useHealthCheck } from '@/hooks/api';
import { useAnnouncements } from '@/hooks/accessibility';

// Re-export the full UploadAnalyze component
export { default as UploadAnalyze } from './UploadAnalyze';

// Re-export the full Sessions component
export { default as Sessions } from './Sessions';

export { default as SessionDetail } from './SessionDetail';

export { default as Predictions } from './Predictions';

export const SystemHealth: React.FC = () => {
  const { data: healthStatus, isLoading, error, refetch } = useHealthCheck();
  const { announce } = useAnnouncements();

  React.useEffect(() => {
    announce('System Health page loaded', 'polite');
  }, [announce]);

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Just now';
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Just now';
      }
      
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return 'Just now';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return 'text-green-600 dark:text-green-400';
      case 'degraded':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'unhealthy':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return '✅';
      case 'degraded':
        return '⚠️';
      case 'unhealthy':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium';
    switch (status?.toLowerCase()) {
      case 'healthy':
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`;
      case 'degraded':
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`;
      case 'unhealthy':
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            System Health
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Monitor API status and system connectivity
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="btn-secondary flex items-center space-x-2"
          aria-label="Refresh system health status"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
            <span className="text-lg text-gray-900 dark:text-white">
              Checking system health...
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-center">
            <AlertCircle className="w-6 h-6 text-red-500 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-red-900 dark:text-red-200">
                Health Check Failed
              </h3>
              <p className="text-red-700 dark:text-red-300 mt-1">
                {error.message || 'Unable to retrieve system health status'}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-3 text-sm text-red-800 dark:text-red-200 hover:text-red-900 dark:hover:text-red-100 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Health Status Display */}
      {healthStatus && !isLoading && (
        <>
          {/* Overall Status Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Overall System Status
              </h2>
              <div className={getStatusBadge(healthStatus.status)}>
                <span className="mr-1">{getStatusIcon(healthStatus.status)}</span>
                {healthStatus.status}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl mb-2">{getStatusIcon(healthStatus.status)}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
                <div className={`font-medium ${getStatusColor(healthStatus.status)}`}>
                  {healthStatus.status}
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl mb-2">⏱️</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Response Time</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {healthStatus.totalDuration ? `${healthStatus.totalDuration}ms` : 'N/A'}
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl mb-2">📅</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Last Checked</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {formatTimestamp(healthStatus.timestamp)}
                </div>
              </div>
            </div>
          </div>

          {/* Individual Service Checks */}
          {healthStatus.checks && Object.keys(healthStatus.checks).length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Service Details
              </h3>
              
              <div className="space-y-4">
                {Object.entries(healthStatus.checks).map(([serviceName, serviceStatus]) => (
                  <div key={serviceName} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">{getStatusIcon(serviceStatus.status)}</span>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white capitalize">
                          {serviceName.replace(/-/g, ' ')}
                        </div>
                        {serviceStatus.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {serviceStatus.description}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      {serviceStatus.duration && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {serviceStatus.duration}ms
                        </div>
                      )}
                      <div className={getStatusBadge(serviceStatus.status)}>
                        {serviceStatus.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Info className="w-5 h-5 mr-2" />
              System Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">API Endpoints</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Health Check:</span>
                    <span className="font-mono text-gray-900 dark:text-white">/health</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Sessions:</span>
                    <span className="font-mono text-gray-900 dark:text-white">/sessions</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Predictions:</span>
                    <span className="font-mono text-gray-900 dark:text-white">/predictions</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">Connection Status</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-900 dark:text-white">API Connected</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-900 dark:text-white">Real-time Updates</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span className="text-gray-900 dark:text-white">Auto-refresh Enabled</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const NotFound: React.FC = () => {
  return (
    <div className="text-center py-16">
      <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        The page you're looking for doesn't exist.
      </p>
      <a
        href="/"
        className="btn-primary"
      >
        Go to Dashboard
      </a>
    </div>
  );
};
