import { ReactNode } from 'react';
import { Header } from './Header';
import { useSkipToContent } from '@/hooks/accessibility';
import { A11Y } from '@/config/constants';

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, className = '' }) => {
  const { skipToMain } = useSkipToContent();

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
      <footer className="bg-surface-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-text-muted-light dark:text-text-muted-dark">
            <p>
              Behavioral Health System &copy; {new Date().getFullYear()}
            </p>
            <p className="mt-1">
              WCAG 2.2 AA Compliant • Section 508 Compliant
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
