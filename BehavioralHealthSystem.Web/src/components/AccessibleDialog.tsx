import React, { useEffect, useRef, useCallback } from 'react';

interface AccessibleDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when the dialog should close */
  onClose: () => void;
  /** Dialog title for aria-labelledby */
  title: string;
  /** Optional ID override for aria-labelledby */
  titleId?: string;
  /** Use 'alertdialog' for destructive confirmations, 'dialog' otherwise */
  role?: 'dialog' | 'alertdialog';
  /** Additional className for the overlay */
  overlayClassName?: string;
  /** Additional className for the content panel */
  className?: string;
  /** Whether clicking the backdrop closes the dialog (default: true) */
  closeOnBackdropClick?: boolean;
  /** Dialog content */
  children: React.ReactNode;
}

/**
 * Accessible dialog/modal component with:
 * - role="dialog" or role="alertdialog"
 * - aria-modal="true" + aria-labelledby
 * - Focus trapping (Tab/Shift+Tab cycle within dialog)
 * - Escape key to close
 * - Focus restoration to triggering element on close
 * - Backdrop click to close (configurable)
 */
export const AccessibleDialog: React.FC<AccessibleDialogProps> = ({
  isOpen,
  onClose,
  title,
  titleId,
  role = 'dialog',
  overlayClassName,
  className,
  closeOnBackdropClick = true,
  children,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const generatedTitleId = titleId || `dialog-title-${title.replace(/\s+/g, '-').toLowerCase()}`;

  // Save previous focus and focus the dialog when opened
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;

      // Focus the first focusable element in the dialog after render
      requestAnimationFrame(() => {
        if (dialogRef.current) {
          const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            dialogRef.current.focus();
          }
        }
      });
    }

    return () => {
      // Restore focus when dialog closes
      if (!isOpen && previousFocusRef.current) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trapping
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;

    const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, []);

  const handleBackdropClick = useCallback(() => {
    if (closeOnBackdropClick) {
      onClose();
    }
  }, [closeOnBackdropClick, onClose]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className={overlayClassName || 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'}
      onClick={handleBackdropClick}
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={generatedTitleId}
        className={className || 'bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4'}
        onClick={handleContentClick}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
};

/** Hidden heading for dialogs that need an aria-labelledby target */
export const DialogTitle: React.FC<{
  id: string;
  children: React.ReactNode;
  className?: string;
  as?: 'h2' | 'h3' | 'h4';
}> = ({ id, children, className, as: Tag = 'h3' }) => (
  <Tag id={id} className={className}>
    {children}
  </Tag>
);

export default AccessibleDialog;
