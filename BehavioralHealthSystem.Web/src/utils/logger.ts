/**
 * Centralized Logger Utility
 *
 * Provides consistent, structured logging across the frontend application.
 * Respects the VITE_ENABLE_DEBUG_LOGGING feature flag — debug/info messages
 * are suppressed in production unless explicitly enabled.
 *
 * Usage:
 *   import { Logger } from '@/utils/logger';
 *   const log = Logger.create('MyComponent');
 *   log.info('Operation started', { userId, sessionId });
 *   log.error('Upload failed', error, { fileName });
 *   log.warn('Retrying request', { attempt: 2 });
 *   log.debug('Payload details', payload);
 */

import { env } from '@/utils/env';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/** Structured context attached to log entries */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LogContext = Record<string, any>;

/** A scoped logger instance for a specific module/component */
export interface ILogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
}

/**
 * Determine the active log level from the environment.
 * - When ENABLE_DEBUG_LOGGING is true → DEBUG (all messages)
 * - Otherwise → WARN (only warnings & errors reach the console)
 */
function getMinLevel(): LogLevel {
  return env.ENABLE_DEBUG_LOGGING ? LogLevel.DEBUG : LogLevel.WARN;
}

function formatPrefix(category: string): string {
  return `[${category}]`;
}

function createScopedLogger(category: string): ILogger {
  const prefix = formatPrefix(category);

  return {
    debug(message: string, context?: LogContext) {
      if (getMinLevel() > LogLevel.DEBUG) return;
      if (context) {
        console.debug(prefix, message, context);
      } else {
        console.debug(prefix, message);
      }
    },

    info(message: string, context?: LogContext) {
      if (getMinLevel() > LogLevel.INFO) return;
      if (context) {
        console.info(prefix, message, context);
      } else {
        console.info(prefix, message);
      }
    },

    warn(message: string, context?: LogContext) {
      if (getMinLevel() > LogLevel.WARN) return;
      if (context) {
        console.warn(prefix, message, context);
      } else {
        console.warn(prefix, message);
      }
    },

    error(message: string, error?: unknown, context?: LogContext) {
      if (getMinLevel() > LogLevel.ERROR) return;
      if (error && context) {
        console.error(prefix, message, error, context);
      } else if (error) {
        console.error(prefix, message, error);
      } else {
        console.error(prefix, message);
      }
    },
  };
}

/**
 * Logger factory — mirrors the backend ILogger<T> pattern.
 *
 * ```ts
 * const log = Logger.create('SessionStorageService');
 * log.info('Session saved', { sessionId });
 * ```
 */
export const Logger = {
  /**
   * Create a scoped logger for a component or service.
   * @param category Module/component name (e.g. 'UploadAnalyze', 'api')
   */
  create(category: string): ILogger {
    return createScopedLogger(category);
  },
} as const;
