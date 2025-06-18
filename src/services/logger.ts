import pino, { Logger } from 'pino';

export interface LogContext {
  component?: string;
  sessionId?: string;
  streamingId?: string;
  requestId?: string;
  [key: string]: any;
}

/**
 * Centralized logger service using Pino
 * Provides consistent logging across all CCUI components
 */
class LoggerService {
  private static instance: LoggerService;
  private baseLogger: Logger;

  private constructor() {
    this.baseLogger = pino({
      level: process.env.LOG_LEVEL || 'info',
      formatters: {
        level: (label) => {
          return { level: label };
        }
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      // Suppress logs in test environment
      enabled: process.env.NODE_ENV !== 'test' || process.env.LOG_LEVEL === 'debug'
    });
  }

  /**
   * Get the singleton logger instance
   */
  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  /**
   * Create a child logger with context
   */
  child(context: LogContext): Logger {
    return this.baseLogger.child(context);
  }

  /**
   * Get the base logger
   */
  getLogger(): Logger {
    return this.baseLogger;
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    if (context) {
      this.baseLogger.child(context).debug(message);
    } else {
      this.baseLogger.debug(message);
    }
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    if (context) {
      this.baseLogger.child(context).info(message);
    } else {
      this.baseLogger.info(message);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    if (context) {
      this.baseLogger.child(context).warn(message);
    } else {
      this.baseLogger.warn(message);
    }
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const logData = error ? { err: error } : {};
    if (context) {
      this.baseLogger.child({ ...context, ...logData }).error(message);
    } else {
      this.baseLogger.error(logData, message);
    }
  }

  /**
   * Log fatal message
   */
  fatal(message: string, error?: Error | unknown, context?: LogContext): void {
    const logData = error ? { err: error } : {};
    if (context) {
      this.baseLogger.child({ ...context, ...logData }).fatal(message);
    } else {
      this.baseLogger.fatal(logData, message);
    }
  }
}

// Export singleton instance
export const logger = LoggerService.getInstance();

// Export factory function for creating component loggers
export function createLogger(component: string, baseContext?: LogContext): Logger {
  const context = { component, ...baseContext };
  return logger.child(context);
}