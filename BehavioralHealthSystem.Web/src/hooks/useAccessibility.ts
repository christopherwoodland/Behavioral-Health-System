import { useCallback, useRef } from 'react';

/**
 * Hook for accessibility features like screen reader announcements
 */
export const useAccessibility = () => {
  const announcementRef = useRef<HTMLDivElement | null>(null);

  /**
   * Announce text to screen readers
   */
  const announceToScreenReader = useCallback((message: string) => {
    // Create a live region if it doesn't exist
    if (!announcementRef.current) {
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
      announcementRef.current = liveRegion;
    }

    // Clear previous message and set new one
    announcementRef.current.textContent = '';
    setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = message;
      }
    }, 100);
  }, []);

  /**
   * Focus management utilities
   */
  const focusManagement = {
    /**
     * Set focus to element by ID
     */
    focusById: (elementId: string) => {
      const element = document.getElementById(elementId);
      if (element) {
        element.focus();
      }
    },

    /**
     * Focus the first focusable element within a container
     */
    focusFirstInContainer: (container: HTMLElement) => {
      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      const firstElement = focusableElements[0] as HTMLElement;
      if (firstElement) {
        firstElement.focus();
      }
    },

    /**
     * Trap focus within a container (for modals)
     */
    trapFocus: (container: HTMLElement) => {
      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      };

      container.addEventListener('keydown', handleTabKey);

      // Return cleanup function
      return () => {
        container.removeEventListener('keydown', handleTabKey);
      };
    }
  };

  /**
   * Keyboard navigation helpers
   */
  const keyboardNavigation = {
    /**
     * Handle arrow key navigation for lists
     */
    handleArrowNavigation: (
      event: React.KeyboardEvent,
      items: HTMLElement[],
      currentIndex: number,
      onIndexChange: (newIndex: number) => void
    ) => {
      let newIndex = currentIndex;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          break;
        case 'ArrowUp':
          event.preventDefault();
          newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          break;
        case 'Home':
          event.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          newIndex = items.length - 1;
          break;
        default:
          return;
      }

      onIndexChange(newIndex);
      items[newIndex]?.focus();
    },

    /**
     * Handle escape key to close modals/dropdowns
     */
    handleEscape: (event: React.KeyboardEvent, onEscape: () => void) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape();
      }
    }
  };

  /**
   * Generate unique IDs for form elements
   */
  const generateId = useCallback((prefix: string = 'element') => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Check if user prefers reduced motion
   */
  const prefersReducedMotion = useCallback(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  /**
   * Get appropriate ARIA attributes for form validation
   */
  const getValidationAttributes = useCallback((
    isValid: boolean,
    errorMessage?: string,
    describedById?: string
  ) => {
    const attributes: Record<string, string> = {};

    if (!isValid) {
      attributes['aria-invalid'] = 'true';
      if (errorMessage && describedById) {
        attributes['aria-describedby'] = describedById;
      }
    }

    return attributes;
  }, []);

  return {
    announceToScreenReader,
    focusManagement,
    keyboardNavigation,
    generateId,
    prefersReducedMotion,
    getValidationAttributes,
  };
};
