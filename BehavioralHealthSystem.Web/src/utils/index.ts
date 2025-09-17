import { v4 as uuidv4 } from 'uuid';
import { STORAGE_KEYS, VALIDATION } from '@/config/constants';
import type { Theme, AppError } from '@/types';

// Global variable to hold the current authenticated user ID
let currentAuthenticatedUserId: string | null = null;

// Set the authenticated user ID (called from auth context)
export const setAuthenticatedUserId = (userId: string | null): void => {
  currentAuthenticatedUserId = userId;
};

// User ID management - prioritizes authenticated user ID
export const getUserId = (): string => {
  // If user is authenticated, use their ID
  if (currentAuthenticatedUserId) {
    return currentAuthenticatedUserId;
  }

  // Fallback to local storage for non-authenticated users
  let userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
  
  // If no User ID exists, generate a new UUID
  if (!userId || userId.trim().length === 0) {
    userId = uuidv4();
    localStorage.setItem(STORAGE_KEYS.USER_ID, userId);
  }
  
  return userId;
};

// Set a custom user ID
export const setUserId = (userId: string): void => {
  if (!userId || userId.trim().length === 0) {
    throw new Error('User ID cannot be empty');
  }
  localStorage.setItem(STORAGE_KEYS.USER_ID, userId.trim());
};

// Generate a new user ID
export const generateNewUserId = (): string => {
  const newUserId = uuidv4();
  localStorage.setItem(STORAGE_KEYS.USER_ID, newUserId);
  return newUserId;
};

// Check if user ID is custom (not auto-generated)
export const isCustomUserId = (): boolean => {
  return localStorage.getItem('bh_user_id_custom') === 'true';
};

// Set user ID as custom or auto-generated
export const setUserIdMode = (isCustom: boolean): void => {
  localStorage.setItem('bh_user_id_custom', isCustom.toString());
};

// Theme management
export const getStoredTheme = (): Theme => {
  const stored = localStorage.getItem(STORAGE_KEYS.THEME) as Theme;
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  
  // Default to system preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const setStoredTheme = (theme: Theme): void => {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  
  // Apply theme to document
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

// Processing mode management
export const getStoredProcessingMode = (): boolean => {
  const stored = localStorage.getItem(STORAGE_KEYS.PROCESSING_MODE);
  if (stored === 'true' || stored === 'false') {
    return stored === 'true';
  }
  
  // Default to single file mode
  return false;
};

export const setStoredProcessingMode = (isMultiMode: boolean): void => {
  localStorage.setItem(STORAGE_KEYS.PROCESSING_MODE, isMultiMode.toString());
};

// File utilities
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const getAudioDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    });
    
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to load audio metadata'));
    });
    
    audio.src = url;
  });
};

// Date utilities
export const formatRelativeTime = (date: string): string => {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return target.toLocaleDateString();
};

export const formatDateTime = (date: string): string => {
  return new Date(date).toLocaleString();
};

// Error handling
export const createAppError = (code: string, message: string, details?: Record<string, unknown>): AppError => ({
  code,
  message,
  details,
  timestamp: new Date().toISOString(),
});

export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  if (error instanceof Error) {
    return error.message.includes('Network') || 
           error.message.includes('connection') ||
           error.message.includes('timeout');
  }
  
  return false;
};

// Validation utilities
export const isValidUUID = (uuid: string): boolean => {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(uuid);
};

export const isValidAudioFile = (file: File): { valid: boolean; error?: string } => {
  // Check file size
  if (file.size > VALIDATION.MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds maximum limit of ${formatFileSize(VALIDATION.MAX_FILE_SIZE_BYTES)}`
    };
  }
  
  // Check file type
  const validTypes = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/flac', 'audio/x-m4a'];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(wav|mp3|m4a|aac|flac)$/i)) {
    return {
      valid: false,
      error: 'Please select a valid audio file (WAV, MP3, M4A, AAC, or FLAC)'
    };
  }
  
  return { valid: true };
};

// Accessibility utilities
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite'): void => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

export const focusElement = (elementId: string, delay = 100): void => {
  setTimeout(() => {
    const element = document.getElementById(elementId);
    if (element) {
      element.focus();
    }
  }, delay);
};

export const trapFocus = (container: HTMLElement): { release: () => void } => {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  const firstFocusable = focusableElements[0] as HTMLElement;
  const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;
  
  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    
    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable?.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable?.focus();
        e.preventDefault();
      }
    }
  };
  
  container.addEventListener('keydown', handleTabKey);
  firstFocusable?.focus();
  
  return {
    release: () => {
      container.removeEventListener('keydown', handleTabKey);
    }
  };
};

// Debounce utility
export const debounce = <T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};
