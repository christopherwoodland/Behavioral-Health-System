/**
 * Common error handling utilities
 * Consolidates error handling patterns and logging throughout the application
 */

// Error types
export interface AppError {
  type: ErrorType;
  message: string;
  code?: string;
  details?: any;
  timestamp?: Date;
  userId?: string;
  sessionId?: string;
}

export enum ErrorType {
  VALIDATION = 'validation',
  NETWORK = 'network',
  API = 'api',
  FILE_UPLOAD = 'file_upload',
  PERMISSION = 'permission',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown',
  USER_INPUT = 'user_input',
  SYSTEM = 'system',
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error context interface
export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  additionalData?: Record<string, any>;
}

// Error handler configuration
export interface ErrorHandlerConfig {
  logToConsole?: boolean;
  logToServer?: boolean;
  showToUser?: boolean;
  retryable?: boolean;
  maxRetries?: number;
}

// Default error handler configuration
const DEFAULT_ERROR_CONFIG: ErrorHandlerConfig = {
  logToConsole: true,
  logToServer: false,
  showToUser: true,
  retryable: false,
  maxRetries: 0,
};

// Error classification utility
export const classifyError = (error: any, context?: ErrorContext): AppError => {
  const timestamp = new Date();
  
  // Handle API/Network errors
  if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
    return {
      type: ErrorType.NETWORK,
      message: 'Network connection failed. Please check your internet connection.',
      details: error,
      timestamp,
      ...context,
    };
  }

  if (error.message?.includes('timeout') || error.message?.includes('Request timeout')) {
    return {
      type: ErrorType.TIMEOUT,
      message: 'Request timed out. Please try again.',
      details: error,
      timestamp,
      ...context,
    };
  }

  // Handle validation errors
  if (error.type === 'validation' || error.message?.includes('validation')) {
    return {
      type: ErrorType.VALIDATION,
      message: error.message || 'Validation failed',
      details: error.details || error,
      timestamp,
      ...context,
    };
  }

  // Handle file upload errors
  if (error.message?.includes('upload') || error.message?.includes('file')) {
    return {
      type: ErrorType.FILE_UPLOAD,
      message: error.message || 'File upload failed',
      details: error,
      timestamp,
      ...context,
    };
  }

  // Handle permission errors
  if (error.status === 401 || error.status === 403 || error.message?.includes('permission')) {
    return {
      type: ErrorType.PERMISSION,
      message: 'You do not have permission to perform this action.',
      details: error,
      timestamp,
      ...context,
    };
  }

  // Handle API errors
  if (error.status || error.statusCode) {
    return {
      type: ErrorType.API,
      message: error.message || `API Error: ${error.status || error.statusCode}`,
      code: String(error.status || error.statusCode),
      details: error,
      timestamp,
      ...context,
    };
  }

  // Default to unknown error
  return {
    type: ErrorType.UNKNOWN,
    message: error.message || 'An unexpected error occurred',
    details: error,
    timestamp,
    ...context,
  };
};

// Error severity classifier
export const getErrorSeverity = (error: AppError): ErrorSeverity => {
  switch (error.type) {
    case ErrorType.VALIDATION:
    case ErrorType.USER_INPUT:
      return ErrorSeverity.LOW;
    
    case ErrorType.NETWORK:
    case ErrorType.TIMEOUT:
    case ErrorType.FILE_UPLOAD:
      return ErrorSeverity.MEDIUM;
    
    case ErrorType.API:
    case ErrorType.PERMISSION:
      return ErrorSeverity.HIGH;
    
    case ErrorType.SYSTEM:
    case ErrorType.UNKNOWN:
      return ErrorSeverity.CRITICAL;
    
    default:
      return ErrorSeverity.MEDIUM;
  }
};

// User-friendly error messages
export const getUserFriendlyMessage = (error: AppError): string => {
  switch (error.type) {
    case ErrorType.NETWORK:
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    
    case ErrorType.TIMEOUT:
      return 'The request is taking longer than expected. Please try again.';
    
    case ErrorType.VALIDATION:
      return error.message; // Validation messages are usually user-friendly
    
    case ErrorType.FILE_UPLOAD:
      return 'Failed to upload file. Please check the file size and format, then try again.';
    
    case ErrorType.PERMISSION:
      return 'You do not have permission to perform this action. Please contact an administrator.';
    
    case ErrorType.API:
      if (error.code === '404') {
        return 'The requested resource was not found.';
      }
      if (error.code === '500') {
        return 'A server error occurred. Please try again later.';
      }
      return 'An error occurred while processing your request. Please try again.';
    
    default:
      return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
  }
};

// Error logging utility
export const logError = (
  error: AppError,
  severity: ErrorSeverity = getErrorSeverity(error),
  config: ErrorHandlerConfig = DEFAULT_ERROR_CONFIG
): void => {
  if (config.logToConsole) {
    const logMethod = severity === ErrorSeverity.CRITICAL ? console.error : 
                     severity === ErrorSeverity.HIGH ? console.error :
                     severity === ErrorSeverity.MEDIUM ? console.warn : console.log;
    
    logMethod(`[${severity.toUpperCase()}] ${error.type}:`, {
      message: error.message,
      timestamp: error.timestamp,
      details: error.details,
      context: {
        userId: error.userId,
        sessionId: error.sessionId,
      },
    });
  }

  // Server logging would be implemented here
  if (config.logToServer) {
    // This would typically send to a logging service
    // logToServerService(error, severity);
  }
};

// Retry utility for retryable errors
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
  context?: ErrorContext
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const appError = classifyError(error, context);
      
      // Don't retry validation or permission errors
      if (appError.type === ErrorType.VALIDATION || appError.type === ErrorType.PERMISSION) {
        throw appError;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw appError;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
    }
  }
  
  throw classifyError(lastError, context);
};

// Safe operation wrapper
export const safeOperation = async <T>(
  operation: () => Promise<T>,
  context?: ErrorContext,
  config: ErrorHandlerConfig = DEFAULT_ERROR_CONFIG
): Promise<{ success: boolean; data?: T; error?: AppError }> => {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const appError = classifyError(error, context);
    const severity = getErrorSeverity(appError);
    
    logError(appError, severity, config);
    
    return { success: false, error: appError };
  }
};

// Error boundary helper for React components
export const createErrorHandler = (context: ErrorContext, config?: ErrorHandlerConfig) => {
  return (error: any): AppError => {
    const appError = classifyError(error, context);
    const severity = getErrorSeverity(appError);
    const mergedConfig = { ...DEFAULT_ERROR_CONFIG, ...config };
    
    logError(appError, severity, mergedConfig);
    
    return appError;
  };
};

// Common error scenarios
export const createValidationError = (message: string, details?: any): AppError => ({
  type: ErrorType.VALIDATION,
  message,
  details,
  timestamp: new Date(),
});

export const createNetworkError = (details?: any): AppError => ({
  type: ErrorType.NETWORK,
  message: 'Network connection failed',
  details,
  timestamp: new Date(),
});

export const createApiError = (status: number, message?: string, details?: any): AppError => ({
  type: ErrorType.API,
  message: message || `API Error: ${status}`,
  code: String(status),
  details,
  timestamp: new Date(),
});

export const createFileUploadError = (message: string, details?: any): AppError => ({
  type: ErrorType.FILE_UPLOAD,
  message,
  details,
  timestamp: new Date(),
});

// Error aggregation for batch operations
export interface BatchErrorResult<T> {
  successes: Array<{ index: number; data: T }>;
  errors: Array<{ index: number; error: AppError }>;
  hasErrors: boolean;
  successCount: number;
  errorCount: number;
}

export const processBatchErrors = <T>(
  results: Array<{ success: boolean; data?: T; error?: any }>,
  context?: ErrorContext
): BatchErrorResult<T> => {
  const successes: Array<{ index: number; data: T }> = [];
  const errors: Array<{ index: number; error: AppError }> = [];
  
  results.forEach((result, index) => {
    if (result.success && result.data !== undefined) {
      successes.push({ index, data: result.data });
    } else {
      const appError = result.error ? classifyError(result.error, context) : 
                      createValidationError('Unknown batch operation error');
      errors.push({ index, error: appError });
    }
  });
  
  return {
    successes,
    errors,
    hasErrors: errors.length > 0,
    successCount: successes.length,
    errorCount: errors.length,
  };
};

// Toast notification helper types (for UI integration)
export interface ToastOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  persistent?: boolean;
}

export const errorToToast = (error: AppError): ToastOptions => {
  const severity = getErrorSeverity(error);
  
  return {
    type: severity === ErrorSeverity.CRITICAL || severity === ErrorSeverity.HIGH ? 'error' : 'warning',
    title: `${error.type.charAt(0).toUpperCase() + error.type.slice(1)} Error`,
    message: getUserFriendlyMessage(error),
    duration: severity === ErrorSeverity.CRITICAL ? undefined : 5000, // Critical errors persist
    persistent: severity === ErrorSeverity.CRITICAL,
  };
};