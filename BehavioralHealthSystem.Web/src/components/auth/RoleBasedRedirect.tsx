import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { APP_ROLES } from '@/config/authConfig';

/**
 * Component that redirects users to their appropriate default page based on their role
 */
export const RoleBasedRedirect: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isLoading, hasRole } = useAuth();

  useEffect(() => {
    // Wait for authentication to complete
    if (isLoading || !isAuthenticated || !user) {
      return;
    }

    // Only redirect from the root path
    if (location.pathname !== '/') {
      return;
    }

    // Determine default page based on user's primary role
    let defaultPath = '/';

    if (hasRole(APP_ROLES.CONTROL_PANEL) && !hasRole(APP_ROLES.ADMIN)) {
      // ControlPanel users go to summary page by default
      defaultPath = '/summary';
    } else if (hasRole(APP_ROLES.ADMIN)) {
      // Admin users stay on dashboard (current behavior)
      defaultPath = '/';
    } else {
      // Default fallback
      defaultPath = '/';
    }

    // Only navigate if we're changing paths
    if (defaultPath !== location.pathname) {
      navigate(defaultPath, { replace: true });
    }
  }, [user, isAuthenticated, isLoading, location.pathname, navigate, hasRole]);

  // This component doesn't render anything
  return null;
};