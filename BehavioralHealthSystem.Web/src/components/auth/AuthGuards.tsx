import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AuthenticatedTemplate, UnauthenticatedTemplate } from '@/contexts/AuthContext';
import { APP_ROLES, type UserRole } from '@/config/authConfig';

/**
 * Props for authorization components
 */
interface AuthorizationProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

interface RoleGuardProps extends AuthorizationProps {
  roles: UserRole[];
  requireAll?: boolean; // If true, user must have ALL roles, otherwise ANY role
}

/**
 * Login component for unauthenticated users
 */
export const LoginPrompt: React.FC = () => {
  const { login, isLoading, error } = useAuth();

  const handleLogin = () => {
    login().catch(console.error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="text-6xl mb-4 group cursor-pointer inline-block">
            <span className="group-hover:animate-brain-throb transition-transform duration-300">🧠</span>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            Behavioral Health System
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Please sign in to access the application
          </p>
        </div>
        
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
              <div className="text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            </div>
          )}
          
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </div>
            ) : (
              <div className="flex items-center">
                <svg className="mr-2 h-4 w-4" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
                Sign in with Microsoft
              </div>
            )}
          </button>
          
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Sign in using your organizational account
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Component that requires authentication
 */
export const RequireAuth: React.FC<AuthorizationProps> = ({ 
  children, 
  fallback,
  redirectTo 
}) => {
  const location = useLocation();
  
  return (
    <>
      <AuthenticatedTemplate>
        {children}
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        {fallback || (
          redirectTo ? (
            <Navigate to={redirectTo} state={{ from: location }} replace />
          ) : (
            <LoginPrompt />
          )
        )}
      </UnauthenticatedTemplate>
    </>
  );
};

/**
 * Component that requires specific roles
 */
export const RequireRole: React.FC<RoleGuardProps> = ({ 
  children, 
  roles, 
  requireAll = false,
  fallback,
  redirectTo 
}) => {
  const { hasRole, hasAnyRole, user } = useAuth();
  const location = useLocation();
  
  // Check if user has required roles
  const hasAccess = requireAll 
    ? roles.every(role => hasRole(role))
    : hasAnyRole(roles);
  
  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    if (redirectTo) {
      return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to access this resource.
          </p>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Required role{roles.length > 1 ? 's' : ''}: {roles.join(', ')}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your role{user?.roles.length && user.roles.length > 1 ? 's' : ''}: {user?.roles.join(', ') || 'None'}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
};

/**
 * Component that requires admin role
 */
export const RequireAdmin: React.FC<AuthorizationProps> = (props) => (
  <RequireRole {...props} roles={[APP_ROLES.ADMIN]} />
);

/**
 * Component that allows both admin and control panel roles
 */
export const RequireControlPanelAccess: React.FC<AuthorizationProps> = (props) => (
  <RequireRole {...props} roles={[APP_ROLES.ADMIN, APP_ROLES.CONTROL_PANEL]} />
);

/**
 * Hook for conditional rendering based on roles
 */
export const useRoleAccess = () => {
  const { hasRole, hasAnyRole, isAdmin, canAccessControlPanel } = useAuth();
  
  return {
    hasRole,
    hasAnyRole,
    isAdmin,
    canAccessControlPanel,
    // Convenience methods
    canAccessAdminOnly: () => isAdmin(),
    hasControlPanelAccess: () => canAccessControlPanel(),
  };
};

/**
 * Route guard component for protecting routes
 */
interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  requireRoles?: UserRole[];
  requireAll?: boolean;
  fallback?: ReactNode;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireRoles = [],
  requireAll = false,
  fallback,
  redirectTo
}) => {
  if (!requireAuth && requireRoles.length === 0) {
    return <>{children}</>;
  }
  
  if (requireAuth && requireRoles.length === 0) {
    return (
      <RequireAuth fallback={fallback} redirectTo={redirectTo}>
        {children}
      </RequireAuth>
    );
  }
  
  return (
    <RequireAuth fallback={fallback} redirectTo={redirectTo}>
      <RequireRole 
        roles={requireRoles} 
        requireAll={requireAll} 
        fallback={fallback} 
        redirectTo={redirectTo}
      >
        {children}
      </RequireRole>
    </RequireAuth>
  );
};