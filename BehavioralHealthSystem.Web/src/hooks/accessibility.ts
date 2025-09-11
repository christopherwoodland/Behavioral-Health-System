import { useEffect, useRef, useCallback } from 'react';
import { announceToScreenReader, focusElement, trapFocus, debounce } from '@/utils';
import { A11Y } from '@/config/constants';
// import type { A11yAnnouncement } from '@/types'; // Commented out until used

// Screen reader announcements
export const useAnnouncements = () => {
  const announce = useCallback((
    message: string, 
    priority: 'polite' | 'assertive' = 'polite'
  ) => {
    announceToScreenReader(message, priority);
  }, []);

  const announceError = useCallback((message: string) => {
    announce(message, 'assertive');
  }, [announce]);

  const announceSuccess = useCallback((message: string) => {
    announce(message, 'polite');
  }, [announce]);

  return {
    announce,
    announceError,
    announceSuccess,
  };
};

// Focus management
export const useFocusManagement = () => {
  const focusById = useCallback((elementId: string, delay?: number) => {
    focusElement(elementId, delay);
  }, []);

  const focusFirst = useCallback((container?: HTMLElement) => {
    const target = container || document;
    const firstFocusable = target.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement;
    
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }, []);

  return {
    focusById,
    focusFirst,
  };
};

// Focus trap for modals and dialogs
export const useFocusTrap = (isActive: boolean) => {
  const containerRef = useRef<HTMLElement>(null);
  const trapRef = useRef<{ release: () => void } | null>(null);

  useEffect(() => {
    if (isActive && containerRef.current) {
      trapRef.current = trapFocus(containerRef.current);
    }

    return () => {
      if (trapRef.current) {
        trapRef.current.release();
        trapRef.current = null;
      }
    };
  }, [isActive]);

  return containerRef;
};

// Keyboard navigation
export const useKeyboardNavigation = () => {
  const handleEscape = useCallback((callback: () => void) => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        callback();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleEnterSpace = useCallback((callback: () => void) => {
    return (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        callback();
      }
    };
  }, []);

  return {
    handleEscape,
    handleEnterSpace,
  };
};

// ARIA live regions for dynamic content
export const useAriaLive = () => {
  const liveRegionRef = useRef<HTMLDivElement>(null);

  const updateLiveRegion = useCallback((
    message: string,
    priority: 'polite' | 'assertive' = 'polite'
  ) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.setAttribute('aria-live', priority);
      liveRegionRef.current.textContent = message;
    }
  }, []);

  const clearLiveRegion = useCallback(() => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = '';
    }
  }, []);

  return {
    liveRegionRef,
    updateLiveRegion,
    clearLiveRegion,
  };
};

// Progress announcements with debouncing
export const useProgressAnnouncement = () => {
  const lastAnnouncedProgress = useRef(-1);

  const debouncedProgressAnnounce = debounce((...args: unknown[]) => {
    const progress = args[0] as number;
    const message = args[1] as string;
    // Only announce significant progress changes
    if (Math.abs(progress - lastAnnouncedProgress.current) >= 10 || progress === 100) {
      announceToScreenReader(`${message} ${progress}% complete`, 'polite');
      lastAnnouncedProgress.current = progress;
    }
  }, A11Y.DEBOUNCE_MS);

  const announceProgress = useCallback(debouncedProgressAnnounce, []);

  return { announceProgress };
};

// Skip to content functionality
export const useSkipToContent = () => {
  const skipToMain = useCallback(() => {
    focusElement(A11Y.SKIP_TO_CONTENT_ID, A11Y.FOCUS_TIMEOUT);
  }, []);

  return { skipToMain };
};

// Form accessibility helpers
export const useFormAccessibility = () => {
  const getFieldId = useCallback((name: string) => `field-${name}`, []);
  const getErrorId = useCallback((name: string) => `error-${name}`, []);
  const getDescriptionId = useCallback((name: string) => `description-${name}`, []);

  const getFieldProps = useCallback((
    name: string,
    hasError: boolean,
    hasDescription: boolean
  ) => {
    const props: React.InputHTMLAttributes<HTMLInputElement> = {
      id: getFieldId(name),
      'aria-invalid': hasError,
    };

    const describedBy: string[] = [];
    
    if (hasError) {
      describedBy.push(getErrorId(name));
    }
    
    if (hasDescription) {
      describedBy.push(getDescriptionId(name));
    }

    if (describedBy.length > 0) {
      props['aria-describedby'] = describedBy.join(' ');
    }

    return props;
  }, [getFieldId, getErrorId, getDescriptionId]);

  return {
    getFieldId,
    getErrorId,
    getDescriptionId,
    getFieldProps,
  };
};

// Status announcements for file uploads and processing
export const useStatusAnnouncements = () => {
  const announceUploadStart = useCallback((fileName: string) => {
    announceToScreenReader(`Starting upload of ${fileName}`, 'polite');
  }, []);

  const announceUploadComplete = useCallback((fileName: string) => {
    announceToScreenReader(`Upload of ${fileName} completed successfully`, 'polite');
  }, []);

  const announceConversionStart = useCallback((fileName: string) => {
    announceToScreenReader(`Starting audio conversion for ${fileName}`, 'polite');
  }, []);

  const announceConversionComplete = useCallback((fileName: string) => {
    announceToScreenReader(`Audio conversion for ${fileName} completed`, 'polite');
  }, []);

  const announcePredictionStart = useCallback((sessionId: string) => {
    announceToScreenReader(`Starting behavioral health prediction for session ${sessionId}`, 'polite');
  }, []);

  const announcePredictionComplete = useCallback((sessionId: string) => {
    announceToScreenReader(`Behavioral health prediction completed for session ${sessionId}`, 'polite');
  }, []);

  const announceError = useCallback((operation: string, error: string) => {
    announceToScreenReader(`Error during ${operation}: ${error}`, 'assertive');
  }, []);

  return {
    announceUploadStart,
    announceUploadComplete,
    announceConversionStart,
    announceConversionComplete,
    announcePredictionStart,
    announcePredictionComplete,
    announceError,
  };
};
