import pino, { Logger } from 'pino';
import { PassThrough } from 'stream';
import type { LogLevel } from '@/types/config';

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
  private logInterceptStream: PassThrough;
  private streams: pino.StreamEntry[];
  private childLoggers: Map<string, Logger> = new Map();

  private constructor() {
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
    this.streams = [
      { stream: process.stdout },  // Original stdout
      { stream: this.logInterceptStream }  // Log buffer stream
    ];
    
    // Initialize with default level 'info' - will be updated after config loads
    this.baseLogger = pino({
      level: 'info',
      formatters: {
        level: (label) => {
          return { level: label };
        }
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      // Suppress logs in test environment
      enabled: process.env.NODE_ENV !== 'test'
    }, pino.multistream(this.streams));
  }

  /**
   * Update the log level dynamically
   * Called after ConfigService is initialized
   */
  updateLogLevel(level: LogLevel): void {
    this.baseLogger.level = level;
    
    // Recreate streams with the new level (this is the fix!)
    this.streams = [
      { level: level as pino.Level, stream: process.stdout },
      { level: level as pino.Level, stream: this.logInterceptStream }
    ];
    
    // Recreate logger with new level to ensure all streams are updated
    this.baseLogger = pino({
      level: level,
      formatters: {
        level: (label) => {
          return { level: label };
        }
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      // Enable in test environment if debug level
      enabled: process.env.NODE_ENV !== 'test' || level === 'debug'
    }, pino.multistream(this.streams));
    
    // Recreate all child loggers to use the new base logger
    const childContexts = Array.from(this.childLoggers.keys());
    this.childLoggers.clear();
    for (const contextKey of childContexts) {
      const context = JSON.parse(contextKey);
      this.childLoggers.set(contextKey, this.baseLogger.child(context));
    }
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