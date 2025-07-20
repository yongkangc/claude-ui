import pino, { Logger } from 'pino';
import { PassThrough } from 'stream';

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
 * Log level is controlled by LOG_LEVEL environment variable
 */
class LoggerService {
  private static instance: LoggerService;
  private baseLogger: Logger;
  private logInterceptStream: PassThrough;
  private childLoggers: Map<string, Logger> = new Map();

  private constructor() {
    // Get log level from environment variable, default to 'info'
    const logLevel = process.env.LOG_LEVEL || 'info';
    
    // Create a pass-through stream to intercept logs
    this.logInterceptStream = new PassThrough();
    
    // Forward logs to the log buffer (lazy loaded to avoid circular dependency)
    this.logInterceptStream.on('data', (chunk) => {
      const logLine = chunk.toString().trim();
      if (logLine) {
        // Lazy load to avoid circular dependency
        import('@/services/log-stream-buffer').then(({ logStreamBuffer }) => {
          logStreamBuffer.addLog(logLine);
        }).catch(() => {
          // Silently ignore if log buffer is not available
        });
      }
    });
    
    // Create multi-stream configuration
    const streams = [
      { level: logLevel as pino.Level, stream: process.stdout },
      { level: logLevel as pino.Level, stream: this.logInterceptStream }
    ];
    
    // Initialize logger with environment-based level
    this.baseLogger = pino({
      level: logLevel,
      formatters: {
        level: (label) => {
          return { level: label };
        }
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      // Enable in test environment if debug level, otherwise suppress
      enabled: process.env.NODE_ENV !== 'test' || logLevel === 'debug'
    }, pino.multistream(streams));
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
    const contextKey = JSON.stringify(context);
    if (!this.childLoggers.has(contextKey)) {
      this.childLoggers.set(contextKey, this.baseLogger.child(context));
    }
    return this.childLoggers.get(contextKey)!;
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