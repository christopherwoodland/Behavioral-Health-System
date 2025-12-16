import { ReactNode } from 'react';
import { Header } from './Header';
import { useSkipToContent } from '@/hooks/accessibility';
import { A11Y } from '@/config/constants';
import { MicrosoftLogo } from '@/components/icons';
import { env } from '@/utils/env';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, className = '' }) => {
  const { skipToMain } = useSkipToContent();
  const isDevEnvironment = env.DEV_ENVIRONMENT;
  const devEnvironmentText = env.DEV_ENVIRONMENT_TEXT;

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* Skip to content link for keyboard navigation */}
      <a
        href={`#${A11Y.SKIP_TO_CONTENT_ID}`}
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          skipToMain();
        }}
      >
        Skip to main content
      </a>

      {/* Development Environment Banner */}
      {isDevEnvironment && (
        <div
          className="bg-pink-500 text-white text-center py-2 px-4 font-semibold text-sm"
          role="banner"
          aria-label="Development environment indicator"
        >
          Development Environment
        </div>
      )}

      {/* Development Environment Text Banner (below dev banner) */}
      {devEnvironmentText && (
        <div
          className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 text-center py-2 px-4 text-sm border-b border-amber-200 dark:border-amber-700"
          role="status"
          aria-label="Environment status message"
        >
          {devEnvironmentText}
        </div>
      )}

      {/* Header */}
      <Header />

      {/* Main content */}
      <main
        id={A11Y.SKIP_TO_CONTENT_ID}
        className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${className}`}
        tabIndex={-1}
      >
        {children}
      </main>

      {/* ARIA live region for announcements */}
      <div
        id={A11Y.ANNOUNCEMENTS_ID}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      />

      {/* Footer */}
      <footer
        className="bg-surface-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-700 mt-auto"
        role="contentinfo"
        aria-label="Site footer"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col items-center space-y-4">
            {/* Microsoft Logo */}
            <div className="flex items-center space-x-2">
              <MicrosoftLogo size={24} className="opacity-80" />
              <span className="text-sm text-text-muted-light dark:text-text-muted-dark font-medium">
                Powered by Microsoft
              </span>
            </div>

            {/* Copyright and Compliance */}
            <div className="text-center text-sm text-text-muted-light dark:text-text-muted-dark">
              <p>
                Behavioral Health System &copy; {new Date().getFullYear()}
              </p>
              <p className="mt-1">
                WCAG 2.2 AA Compliant • Section 508 Compliant
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
