import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useKeyboardNavigation } from '@/hooks/accessibility';

interface HeaderProps {
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const { handleEnterSpace } = useKeyboardNavigation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '🏠' },
    { path: '/upload', label: 'Upload & Analyze', icon: '📤' },
    { path: '/sessions', label: 'Sessions', icon: '📊' },
    { path: '/predictions', label: 'My Predictions', icon: '📈' },
    { path: '/health', label: 'System Health', icon: '🏥' },
  ];

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
  }, [location.pathname]);

  return (
    <header className={`bg-surface-light dark:bg-surface-dark border-b border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and title */}
          <div className="flex items-center">
            <Link
              to="/"
              className="flex items-center space-x-3 text-xl font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md px-2 py-1"
              aria-label="Behavioral Health System - Go to Dashboard"
            >
              <span className="text-2xl" role="img" aria-label="Brain icon">🧠</span>
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

          {/* Theme toggle */}
          <div className="flex items-center space-x-4">
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

            {/* Mobile menu button */}
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
              aria-expanded={isMobileMenuOpen ? "true" : "false"}
            >
              <span className="text-xl" role="img" aria-hidden="true">
                {isMobileMenuOpen ? '✕' : '☰'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        {isMobileMenuOpen && (
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
