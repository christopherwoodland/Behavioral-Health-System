import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKeyboardNavigation } from '@/hooks/accessibility';
import { APP_ROLES } from '@/config/authConfig';

interface HeaderProps {
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();
  const { handleEnterSpace } = useKeyboardNavigation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Filter navigation items based on user permissions
  const getNavigationItems = () => {
    const baseItems = [
      { path: '/', label: 'Dashboard', icon: '🏠', roles: [APP_ROLES.ADMIN] },
      { path: '/upload', label: 'Upload & Analyze', icon: '📤', roles: [APP_ROLES.ADMIN] },
      { path: '/sessions', label: 'Sessions', icon: '📊', roles: [APP_ROLES.ADMIN] },
      { path: '/predictions', label: 'My Predictions', icon: '📈', roles: [APP_ROLES.ADMIN] },
      { path: '/summary', label: 'Summary', icon: '📋', roles: [APP_ROLES.ADMIN] }, // Only Admins can see navigation
      { path: '/agent-experience', label: 'Agent Experience', icon: '🤖', roles: [APP_ROLES.ADMIN] }, // Only Admins can see navigation
    ];

    if (!isAuthenticated) {
      return [];
    }

    // Only show navigation items to Admin users, ControlPanel users get no navigation buttons
    return baseItems.filter(() => {
      if (isAdmin()) return true; // Admins can access everything
      return false; // ControlPanel users see no navigation buttons
    });
  };

  // Debug authentication state
  useEffect(() => {
    console.log('[Header] Authentication state:', {
      isAuthenticated,
      user: user ? { id: user.id, name: user.name, roles: user.roles } : null,
      timestamp: new Date().toISOString()
    });
  }, [isAuthenticated, user]);

  const navItems = getNavigationItems();

  const isActivePath = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setShowUserMenu(false);
  }, [location.pathname]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showUserMenu && !target.closest('[data-user-menu]')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  return (
    <header className={`bg-surface-light dark:bg-surface-dark border-b border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and title */}
          <div className="flex items-center">
            <Link
              to="/"
              className="flex items-center space-x-3 text-xl font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md px-2 py-1 group"
              aria-label="Behavioral Health System - Go to Dashboard"
            >
              <span className="text-2xl group-hover:brain-throb transition-all duration-300 group-hover:scale-105" role="img" aria-label="Brain icon">🧠</span>
              <span className="hidden sm:block">Behavioral Health System</span>
              <span className="sm:hidden">BHS</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-1" role="navigation" aria-label="Main navigation">
            {navItems.map(({ path, label, icon }) => (
              <Link
                key={path}
                to={path}
                className={`
                  flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                  ${
                    isActivePath(path)
                      ? 'bg-primary-100 text-primary-900 dark:bg-primary-900 dark:text-primary-100'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700'
                  }
                `}
                aria-current={isActivePath(path) ? 'page' : undefined}
              >
                <span role="img" aria-hidden="true">{icon}</span>
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          {/* User menu and theme toggle */}
          <div className="flex items-center space-x-4">
            {/* Authenticated User Menu */}
            {isAuthenticated && user && (
              <div className="relative" data-user-menu>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  onKeyDown={handleEnterSpace(() => setShowUserMenu(!showUserMenu))}
                  className="
                    flex items-center space-x-2 p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100
                    dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                    transition-colors touch-target
                  "
                  aria-label="User menu"
                  type="button"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-900 dark:text-white">
                    {user.name}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* User dropdown menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {user.primaryRole}
                        </span>
                        {user.roles.length > 1 && (
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            +{user.roles.length - 1} more
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          logout();
                          setShowUserMenu(false);
                        }}
                        className="
                          w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 
                          hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                        "
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={toggleTheme}
              onKeyDown={handleEnterSpace(toggleTheme)}
              className="
                p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100
                dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                transition-colors touch-target
              "
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              type="button"
            >
              <span className="text-xl" role="img" aria-hidden="true">
                {theme === 'light' ? '🌙' : '☀️'}
              </span>
            </button>

            {/* Mobile menu button - only show when authenticated */}
            {isAuthenticated && (
              <button
                onClick={toggleMobileMenu}
                onKeyDown={handleEnterSpace(toggleMobileMenu)}
                className="
                  md:hidden p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100
                  dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                  transition-colors touch-target
                "
                aria-label={isMobileMenuOpen ? "Close mobile menu" : "Open mobile menu"}
                type="button"
                {...(isMobileMenuOpen ? { 'aria-expanded': true } : { 'aria-expanded': false })}
              >
                <span className="text-xl" role="img" aria-hidden="true">
                  {isMobileMenuOpen ? '✕' : '☰'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile navigation */}
        {isMobileMenuOpen && isAuthenticated && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 pt-4 pb-3">
            <nav className="space-y-1" role="navigation" aria-label="Mobile navigation">
              {navItems.map(({ path, label, icon }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={closeMobileMenu}
                  className={`
                    flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium transition-colors
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                    ${
                      isActivePath(path)
                        ? 'bg-primary-100 text-primary-900 dark:bg-primary-900 dark:text-primary-100'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                  aria-current={isActivePath(path) ? 'page' : undefined}
                >
                  <span role="img" aria-hidden="true">{icon}</span>
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};
