import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Upload, History, TrendingUp } from 'lucide-react';
import { useHealthCheck, useUserSessions } from '@/hooks/api';
import { useAnnouncements } from '@/hooks/accessibility';
import { useAuth } from '@/contexts/useAuth';
import { getUserId } from '@/utils';

export const Dashboard: React.FC = () => {
  const { announce } = useAnnouncements();
  const { canAccessControlPanel, user } = useAuth();
  // Get authenticated user ID for API calls (matches blob storage folder structure)
  const getAuthenticatedUserId = (): string => {
    // Use authenticated user ID if available, otherwise fall back to getUserId utility
    return user?.id || getUserId();
  };

  // Fetch health status and recent sessions
  const { data: healthStatus, isLoading: isHealthLoading, error: healthError } = useHealthCheck();
  const { data: sessionsResponse, isLoading: isSessionsLoading } = useUserSessions(getAuthenticatedUserId());

  useEffect(() => {
    announce('Dashboard page loaded', 'polite');
  }, [announce]);

  const quickActions = [
    {
      title: 'Upload & Analyze',
      description: 'Upload audio files for behavioral health analysis',
      href: '/upload',
      icon: Upload,
      color: 'primary',
      disabled: false
    },
    {
      title: 'View Sessions',
      description: 'Browse all analysis sessions and their results',
      href: '/sessions',
      icon: History,
      color: 'secondary',
      disabled: false
    },
    {
      title: 'My Predictions',
      description: 'View your complete prediction history',
      href: '/predictions',
      icon: TrendingUp,
      color: 'accent',
      disabled: false
    }
  ];

  const getActionClasses = (_color: string, disabled: boolean = false) => {
    return disabled
      ? 'block min-h-36 cursor-not-allowed rounded border border-gray-300 bg-white p-5 opacity-60 dark:border-gray-700 dark:bg-gray-800'
      : 'block min-h-36 rounded border border-gray-300 bg-white p-5 transition-colors hover:border-primary-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-600 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-400 dark:hover:bg-gray-700';
  };

  return (
    <div className="space-y-7">
      {/* Page header */}
      <div className="border-b border-gray-300 pb-5 dark:border-gray-700">
        <p className="mb-1 text-xs font-semibold uppercase text-primary-700 dark:text-primary-300">
          Clinical workspace
        </p>
        <h1 className="text-2xl font-semibold text-text-primary-light dark:text-text-primary-dark">
          MindBridge overview
        </h1>
        <p className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
          Audio-based mental health prediction and analysis
        </p>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
          Quick actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            if (action.disabled) {
              const IconComponent = action.icon;
              return (
                <div
                  key={action.href}
                  className={`${getActionClasses(action.color, true)} relative`}
                  aria-label={`${action.title}: Disabled`}
                >
                  <div>
                    <div className="mb-4 flex h-8 w-8 items-center justify-center rounded bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300" aria-hidden="true">
                      <IconComponent size={18} />
                    </div>
                    <h3 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">
                      {action.title}
                    </h3>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                      {action.description}
                    </p>
                  </div>
                  {/* Disabled Overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-white font-bold text-sm mb-1">�</div>
                      <div className="text-white font-semibold text-xs">DISABLED</div>
                    </div>
                  </div>
                </div>
              );
            }

            const IconComponent = action.icon;
            return (
              <Link
                key={action.href}
                to={action.href}
                className={`${getActionClasses(action.color, false)} relative`}
                aria-label={`${action.title}: ${action.description}`}
              >
                <div>
                  <div className="mb-4 flex h-8 w-8 items-center justify-center rounded bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300" aria-hidden="true">
                    <IconComponent size={18} />
                  </div>
                  <h3 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">
                    {action.title}
                  </h3>
                  <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    {action.description}
                  </p>
                </div>
                {/* NEW badge for Agent Experience */}
                {action.title === 'Agent Experience' && (
                  <div className="absolute right-3 top-3 rounded-sm bg-success-100 px-2 py-1 text-xs font-semibold text-success-800 dark:bg-success-900 dark:text-success-200">
                    NEW
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Summary Access - Only for authorized users */}
      {canAccessControlPanel() && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary-light dark:text-text-primary-dark mb-2">
                Summary
              </h2>
              <p className="text-text-secondary-light dark:text-text-secondary-dark">
                Advanced analytics dashboard
              </p>
            </div>
            <Link
              to="/summary"
              className="btn btn--primary"
            >
              View Summary
            </Link>
          </div>
        </div>
      )}

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
            {sessionsResponse.sessions
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 3)
              .map((session) => (
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
            System Status
          </h2>
          <Link
            to="/health"
            className="px-6 py-3 bg-black hover:bg-gray-800 text-white border-2 border-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 inline-block"
          >
            System Health
          </Link>
        </div>
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
            <span>API available</span>
            {(healthStatus?.entries || healthStatus?.checks) && (
              <span className="text-text-muted-light dark:text-text-muted-dark">
                ({Object.keys(healthStatus.entries ?? healthStatus.checks ?? {}).length} component checks)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
