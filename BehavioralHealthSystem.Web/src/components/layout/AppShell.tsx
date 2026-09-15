import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  ChevronDown,
  CircleHelp,
  Cloud,
  HeartPulse,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  Settings,
  Sun,
  Upload,
  X,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useKeyboardNavigation } from '@/hooks/accessibility';
import { useHealthCheck } from '@/hooks/api';
import { APP_ROLES } from '@/config/authConfig';
import { env } from '@/utils/env';

interface AppShellProps {
  className?: string;
}

const navigationItems = [
  { path: '/', label: 'Overview', icon: LayoutDashboard, roles: [APP_ROLES.ADMIN] },
  { path: '/upload', label: 'Upload & analyze', icon: Upload, roles: [APP_ROLES.ADMIN] },
  { path: '/sessions', label: 'Sessions', icon: History, roles: [APP_ROLES.ADMIN] },
  { path: '/predictions', label: 'Predictions', icon: BarChart3, roles: [APP_ROLES.ADMIN] },
  { path: '/health', label: 'System health', icon: Activity, roles: [APP_ROLES.ADMIN] },
];

export const AppShell: React.FC<AppShellProps> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAuthenticated, isAdmin } = useAuth();
  const { data: healthStatus } = useHealthCheck();
  const location = useLocation();
  const { handleEnterSpace } = useKeyboardNavigation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isAuthEnabled = env.ENABLE_ENTRA_AUTH;

  const navItems = !isAuthEnabled
    ? navigationItems
    : isAuthenticated && isAdmin()
      ? navigationItems
      : [];

  const isActivePath = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setShowUserMenu(false);
  }, [location.pathname]);

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

  const navigation = (
    <nav className="space-y-0.5" aria-label="Main navigation">
      {navItems.map(({ path, label, icon: Icon }) => {
        const active = isActivePath(path);
        return (
          <Link
            key={path}
            to={path}
            className={`mindbridge-nav-item ${active ? 'mindbridge-nav-item--active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <header className={className}>
      <div className="mindbridge-topbar">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            className="mindbridge-icon-button md:hidden"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            onKeyDown={handleEnterSpace(() => setIsMobileMenuOpen((open) => !open))}
            aria-label={isMobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link to="/" className="mindbridge-brand" aria-label="MindBridge - Go to overview">
            <img src="/mbv.svg" alt="" className="mindbridge-brand__mark" />
            <span>MindBridge</span>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <div
            className="hidden items-center gap-1.5 px-2 text-xs text-white/80 sm:flex"
            title={healthStatus?.airGapMode ? `Air-gap mode: ${healthStatus.aiModel}` : 'Connected to cloud AI'}
          >
            {healthStatus?.airGapMode ? <HeartPulse size={15} /> : <Cloud size={15} />}
            <span>{healthStatus?.airGapMode ? 'Air-gap' : 'Cloud connected'}</span>
          </div>
          <button type="button" className="mindbridge-icon-button" aria-label="Help" title="Help">
            <CircleHelp size={18} />
          </button>
          <button type="button" className="mindbridge-icon-button" aria-label="Settings" title="Settings">
            <Settings size={18} />
          </button>
          <button
            type="button"
            className="mindbridge-icon-button"
            onClick={toggleTheme}
            onKeyDown={handleEnterSpace(toggleTheme)}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {isAuthEnabled && isAuthenticated && user && (
            <div className="relative" data-user-menu>
              <button
                type="button"
                onClick={() => setShowUserMenu((open) => !open)}
                className="mindbridge-user-button"
                aria-label="User menu"
                aria-expanded={showUserMenu}
              >
                <span className="mindbridge-avatar">{user.name.charAt(0).toUpperCase()}</span>
                <span className="hidden max-w-36 truncate text-sm sm:block">{user.name}</span>
                <ChevronDown size={14} className="hidden sm:block" />
              </button>
              {showUserMenu && (
                <div className="mindbridge-user-menu">
                  <div className="border-b border-gray-200 p-4 dark:border-gray-700">
                    <p className="font-semibold text-gray-900 dark:text-white">{user.name}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{user.primaryRole}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <aside className="mindbridge-sidebar hidden md:block">
        <div className="px-3 py-4">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Workspace
          </p>
          {navigation}
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div className="mindbridge-mobile-nav md:hidden">
          <div className="p-3">{navigation}</div>
        </div>
      )}
    </header>
  );
};
