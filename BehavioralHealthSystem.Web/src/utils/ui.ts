/**
 * Common UI component utilities and patterns
 * Consolidates repeated UI logic and component patterns
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Common loading states
export interface LoadingState {
  isLoading: boolean;
  progress?: number;
  message?: string;
}

// Common form field state
export interface FieldState<T = string> {
  value: T;
  error?: string;
  touched: boolean;
  isValid: boolean;
}

// File upload state
export interface FileUploadState {
  file: File | null;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  error?: string;
}

// Toast notification state
export interface ToastState {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration: number;
  persistent: boolean;
  isVisible: boolean;
}

// Modal state
export interface ModalState {
  isOpen: boolean;
  title?: string;
  content?: string;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  }>;
}

// Custom hooks for common UI patterns

// Loading state hook
export const useLoadingState = (initialLoading: boolean = false) => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: initialLoading,
  });

  const setLoading = useCallback((isLoading: boolean, message?: string, progress?: number) => {
    setLoadingState({ isLoading, message, progress });
  }, []);

  const resetLoading = useCallback(() => {
    setLoadingState({ isLoading: false });
  }, []);

  return {
    ...loadingState,
    setLoading,
    resetLoading,
  };
};

// Form field hook
export const useFieldState = <T = string>(
  initialValue: T,
  validator?: (value: T) => string | undefined
) => {
  const [state, setState] = useState<FieldState<T>>({
    value: initialValue,
    touched: false,
    isValid: true,
  });

  const setValue = useCallback((value: T) => {
    const error = validator ? validator(value) : undefined;
    setState(prev => ({
      ...prev,
      value,
      error,
      isValid: !error,
    }));
  }, [validator]);

  const setTouched = useCallback((touched: boolean = true) => {
    setState(prev => ({ ...prev, touched }));
  }, []);

  const validate = useCallback(() => {
    const error = validator ? validator(state.value) : undefined;
    setState(prev => ({
      ...prev,
      error,
      isValid: !error,
      touched: true,
    }));
    return !error;
  }, [validator, state.value]);

  const reset = useCallback(() => {
    setState({
      value: initialValue,
      touched: false,
      isValid: true,
    });
  }, [initialValue]);

  return {
    ...state,
    setValue,
    setTouched,
    validate,
    reset,
  };
};

// File upload hook
export const useFileUpload = () => {
  const [state, setState] = useState<FileUploadState>({
    file: null,
    progress: 0,
    status: 'idle',
  });

  const setFile = useCallback((file: File | null) => {
    setState(prev => ({
      ...prev,
      file,
      status: file ? 'idle' : 'idle',
      progress: 0,
      error: undefined,
    }));
  }, []);

  const setProgress = useCallback((progress: number) => {
    setState(prev => ({ ...prev, progress }));
  }, []);

  const setUploading = useCallback(() => {
    setState(prev => ({ ...prev, status: 'uploading' }));
  }, []);

  const setSuccess = useCallback(() => {
    setState(prev => ({ ...prev, status: 'success', progress: 100 }));
  }, []);

  const setError = useCallback((error: string) => {
    setState(prev => ({ ...prev, status: 'error', error }));
  }, []);

  const reset = useCallback(() => {
    setState({
      file: null,
      progress: 0,
      status: 'idle',
    });
  }, []);

  return {
    ...state,
    setFile,
    setProgress,
    setUploading,
    setSuccess,
    setError,
    reset,
  };
};

// Toast notifications hook
export const useToasts = () => {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addToast = useCallback((
    message: string,
    type: ToastState['type'] = 'info',
    options: Partial<Pick<ToastState, 'title' | 'duration' | 'persistent'>> = {}
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const duration = options.duration ?? 5000;
    const persistent = options.persistent ?? false;

    const newToast: ToastState = {
      id,
      type,
      message,
      title: options.title,
      duration,
      persistent,
      isVisible: true,
    };

    setToasts(prev => [...prev, newToast]);

    if (!persistent && duration > 0) {
      const timeout = setTimeout(() => {
        removeToast(id);
      }, duration);
      timeoutsRef.current.set(id, timeout);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
  };
};

// Modal hook
export const useModal = () => {
  const [state, setState] = useState<ModalState>({
    isOpen: false,
  });

  const openModal = useCallback((options: Partial<ModalState> = {}) => {
    setState({
      isOpen: true,
      ...options,
    });
  }, []);

  const closeModal = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const setModalContent = useCallback((content: Partial<ModalState>) => {
    setState(prev => ({ ...prev, ...content }));
  }, []);

  return {
    ...state,
    openModal,
    closeModal,
    setModalContent,
  };
};

// Confirmation dialog hook
export const useConfirmDialog = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<{
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    message: '',
    onConfirm: () => {},
  });

  const showConfirm = useCallback((
    message: string,
    onConfirm: () => void,
    options: Partial<typeof config> = {}
  ) => {
    setConfig({
      message,
      onConfirm,
      title: options.title || 'Confirm Action',
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      onCancel: options.onCancel,
    });
    setIsOpen(true);
  }, []);

  const handleConfirm = useCallback(() => {
    config.onConfirm();
    setIsOpen(false);
  }, [config]);

  const handleCancel = useCallback(() => {
    config.onCancel?.();
    setIsOpen(false);
  }, [config]);

  return {
    isOpen,
    config,
    showConfirm,
    handleConfirm,
    handleCancel,
  };
};

// Debounced value hook
export const useDebounce = <T>(value: T, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Previous value hook
export const usePrevious = <T>(value: T): T | undefined => {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

// Local storage hook
export const useLocalStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
};

// CSS class utilities
export const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

export const conditionalClass = (
  condition: boolean,
  trueClass: string,
  falseClass?: string
): string => {
  return condition ? trueClass : (falseClass || '');
};

// Common CSS variable setters
export const setCssVariable = (name: string, value: string, element?: HTMLElement): void => {
  const target = element || document.documentElement;
  target.style.setProperty(`--${name}`, value);
};

export const getCssVariable = (name: string, element?: HTMLElement): string => {
  const target = element || document.documentElement;
  return getComputedStyle(target).getPropertyValue(`--${name}`);
};

// Focus management utilities
export const focusElement = (selector: string, timeout: number = 0): void => {
  const focus = () => {
    const element = document.querySelector(selector) as HTMLElement;
    if (element && element.focus) {
      element.focus();
    }
  };

  if (timeout > 0) {
    setTimeout(focus, timeout);
  } else {
    focus();
  }
};

export const trapFocus = (element: HTMLElement): (() => void) => {
  const focusableElements = element.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) as NodeListOf<HTMLElement>;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
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
    }
  };

  element.addEventListener('keydown', handleTabKey);

  // Return cleanup function
  return () => {
    element.removeEventListener('keydown', handleTabKey);
  };
};

// Scroll utilities
export const scrollToElement = (
  element: HTMLElement | string,
  options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'center' }
): void => {
  const target = typeof element === 'string' 
    ? document.querySelector(element) as HTMLElement
    : element;
  
  if (target) {
    target.scrollIntoView(options);
  }
};

export const scrollToTop = (smooth: boolean = true): void => {
  window.scrollTo({
    top: 0,
    behavior: smooth ? 'smooth' : 'auto',
  });
};

// Animation utilities
export const animateValue = (
  start: number,
  end: number,
  duration: number,
  callback: (value: number) => void,
  easing: (t: number) => number = (t) => t
): void => {
  const startTime = performance.now();
  
  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easing(progress);
    const currentValue = start + (end - start) * easedProgress;
    
    callback(currentValue);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };
  
  requestAnimationFrame(animate);
};

// Common easing functions
export const easingFunctions = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
};

// Format utilities
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};