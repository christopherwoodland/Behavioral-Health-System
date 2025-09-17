import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { getUserId } from '@/utils';
import { useHealthCheck, useUserSessions } from '@/hooks/api';
import { useAnnouncements } from '@/hooks/accessibility';
import { useAuth } from '@/contexts/AuthContext';

export const Dashboard: React.FC = () => {
  const userId = getUserId();
  const { announce } = useAnnouncements();
  const { canAccessControlPanel } = useAuth();
  const [showControlPanel, setShowControlPanel] = useState(false);
  
  // Fetch health status and recent sessions
  const { data: healthStatus, isLoading: isHealthLoading, error: healthError } = useHealthCheck();
  const { data: sessionsResponse, isLoading: isSessionsLoading } = useUserSessions(userId);

  useEffect(() => {
    announce('Dashboard page loaded', 'polite');
  }, [announce]);

  const quickActions = [
    {
      title: 'Upload & Analyze',
      description: 'Upload audio files for behavioral health analysis',
      href: '/upload',
      icon: '📤',
      color: 'primary'
    },
    {
      title: 'View Sessions',
      description: 'Browse all analysis sessions and their results',
      href: '/sessions',
      icon: '📊',
      color: 'secondary'
    },
    {
      title: 'My Predictions',
      description: 'View your complete prediction history',
      href: '/predictions',
      icon: '📈',
      color: 'accent'
    },
    {
      title: 'System Health',
      description: 'Check API status and system connectivity',
      href: '/health',
      icon: '🏥',
      color: 'warning'
    }
  ];

  const getActionClasses = (color: string) => {
    const baseClasses = 'block p-6 rounded-lg border-2 transition-all hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    switch (color) {
      case 'primary':
        return `${baseClasses} border-primary-200 bg-primary-50 hover:border-primary-300 hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-900 dark:hover:border-primary-700 dark:hover:bg-primary-800 focus:ring-primary-500`;
      case 'secondary':
        return `${baseClasses} border-secondary-200 bg-secondary-50 hover:border-secondary-300 hover:bg-secondary-100 dark:border-secondary-800 dark:bg-secondary-900 dark:hover:border-secondary-700 dark:hover:bg-secondary-800 focus:ring-secondary-500`;
      case 'accent':
        return `${baseClasses} border-accent-200 bg-accent-50 hover:border-accent-300 hover:bg-accent-100 dark:border-accent-800 dark:bg-accent-900 dark:hover:border-accent-700 dark:hover:bg-accent-800 focus:ring-accent-500`;
      case 'warning':
        return `${baseClasses} border-warning-200 bg-warning-50 hover:border-warning-300 hover:bg-warning-100 dark:border-teal-600 dark:bg-teal-800 dark:hover:border-teal-500 dark:hover:bg-teal-700 focus:ring-warning-500`;
      default:
        return `${baseClasses} border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:bg-gray-700 focus:ring-gray-500`;
    }
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">
          Behavioral Health System
        </h1>
        <p className="mt-2 text-lg text-text-secondary-light dark:text-text-secondary-dark">
          Audio-based mental health prediction and analysis
        </p>
      </div>

      {/* Control Panel Access - Only for authorized users */}
      {canAccessControlPanel() && (
        <div className="card border-2 border-primary-200 bg-gradient-to-r from-primary-50 to-secondary-50 dark:border-primary-800 dark:from-primary-900 dark:to-secondary-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
                🛠️ Control Panel
              </h2>
              <p className="text-text-secondary-light dark:text-text-secondary-dark">
                Access advanced administrative features and system controls
              </p>
            </div>
            <button
              onClick={() => setShowControlPanel(!showControlPanel)}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              {showControlPanel ? 'Hide Control Panel' : 'Show Control Panel'}
            </button>
          </div>
          
          {showControlPanel && (
            <div className="mt-6 border-t border-primary-200 dark:border-primary-800 pt-6">
              <div className="card bg-gray-50 dark:bg-gray-800">
                <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
                  🔧 Control Panel
                </h3>
                <p className="text-text-secondary-light dark:text-text-secondary-dark mb-4">
                  Advanced administrative features and system controls will be displayed here.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h4 className="font-medium text-text-primary-light dark:text-text-primary-dark">User Management</h4>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">Manage user accounts and permissions</p>
                  </div>
                  <div className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h4 className="font-medium text-text-primary-light dark:text-text-primary-dark">System Configuration</h4>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">Configure system settings and parameters</p>
                  </div>
                  <div className="p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h4 className="font-medium text-text-primary-light dark:text-text-primary-dark">Data Analytics</h4>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">View system analytics and reports</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* User ID display */}
      <div className="card">
        <h2 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
          Your User ID
        </h2>
        <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
          <code className="text-sm font-mono text-text-primary-light dark:text-text-primary-dark break-all">
            {userId}
          </code>
        </div>
        <p className="mt-2 text-sm text-text-muted-light dark:text-text-muted-dark">
          This ID is automatically generated and stored locally to track your sessions.
        </p>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-6">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              to={action.href}
              className={getActionClasses(action.color)}
              aria-label={`${action.title}: ${action.description}`}
            >
              <div className="text-center">
                <div className="text-3xl mb-3" role="img" aria-hidden="true">
                  {action.icon}
                </div>
                <h3 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
                  {action.title}
                </h3>
                <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {action.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="card">
        <h2 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
          Recent Activity
        </h2>
        {isSessionsLoading ? (
          <div className="flex items-center space-x-2">
            <div className="spinner w-4 h-4"></div>
            <span className="text-text-secondary-light dark:text-text-secondary-dark">
              Loading recent sessions...
            </span>
          </div>
        ) : (!sessionsResponse?.sessions || sessionsResponse.sessions.length === 0) ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4" role="img" aria-label="No data">📭</div>
            <p className="text-text-secondary-light dark:text-text-secondary-dark">
              No sessions yet. 
              <Link 
                to="/upload" 
                className="text-primary-600 dark:text-primary-400 hover:underline ml-1"
              >
                Upload your first audio file
              </Link> to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessionsResponse.sessions.slice(0, 3).map((session) => (
              <div
                key={session.sessionId}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md"
              >
                <div className="flex items-center space-x-3">
                  <div className={`status-${session.status || 'completed'}`}>
                    {session.status || 'completed'}
                  </div>
                  <span className="text-text-primary-light dark:text-text-primary-dark">
                    {session.audioFileName || session.sessionId?.slice(0, 8) || 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2" title={session.createdAt}>
                    {session.createdAt ? new Date(session.createdAt).toLocaleString() : ''}
                  </span>
                </div>
                <Link
                  to={`/sessions/${session.sessionId || ''}`}
                  className="text-primary-600 dark:text-primary-400 hover:underline text-sm flex items-center gap-1"
                  title="View session details"
                  aria-label={`View details for session ${session.audioFileName || session.sessionId?.slice(0, 8) || 'Unknown'}`}
                >
                  <Eye className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            ))}
            {sessionsResponse.sessions.length > 3 && (
              <div className="text-center pt-3">
                <Link
                  to="/sessions"
                  className="text-primary-600 dark:text-primary-400 hover:underline"
                >
                  View all {sessionsResponse.sessions.length} sessions →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* System status */}
      <div className="card">
        <h2 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark mb-4">
          System Status
        </h2>
        {isHealthLoading ? (
          <div className="flex items-center space-x-2">
            <div className="spinner w-4 h-4"></div>
            <span className="text-text-secondary-light dark:text-text-secondary-dark">
              Checking system health...
            </span>
          </div>
        ) : healthError ? (
          <div className="flex items-center space-x-2 text-error-600 dark:text-error-400">
            <span role="img" aria-label="Error">⚠️</span>
            <span>System health check failed</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-success-600 dark:text-success-400">
            <span role="img" aria-label="Healthy">✅</span>
            <span>All systems operational</span>
            {healthStatus?.checks && (
              <span className="text-text-muted-light dark:text-text-muted-dark">
                ({Object.keys(healthStatus.checks).length} services checked)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
