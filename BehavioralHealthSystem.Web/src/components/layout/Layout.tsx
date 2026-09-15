import { ReactNode } from 'react';
import { AppShell } from './AppShell';
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

      <AppShell />

      {/* Main content */}
      <main
        id={A11Y.SKIP_TO_CONTENT_ID}
        className={`mindbridge-main ${className}`}
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
        className="mindbridge-footer"
        role="contentinfo"
        aria-label="Site footer"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src="/mbv.svg" alt="" className="h-6 w-6 object-contain" />
            <span>MindBridge &copy; {new Date().getFullYear()}</span>
          </div>
          <span>WCAG 2.2 AA &middot; Section 508</span>
        </div>
      </footer>
    </div>
  );
};
