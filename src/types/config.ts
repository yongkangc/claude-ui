/**
 * Configuration types for CCUI
 */

export type LogLevel = 'silent' | 'debug' | 'info' | 'warn' | 'error';

export interface ServerConfig {
  host: string;
  port: number;
}

export interface LoggingConfig {
  level: LogLevel;
}

export interface CCUIConfig {
  /**
   * Unique machine identifier
   * Format: {hostname}-{8char_hash}
   * Example: "wenbomacbook-a1b2c3d4"
   */
  machine_id: string;
  
  /**
   * Server configuration
   */
  server: ServerConfig;
  
  /**
   * Logging configuration
   */
  logging: LoggingConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Omit<CCUIConfig, 'machine_id'> = {
  server: {
    host: 'localhost',
    port: 3001
  },
  logging: {
    level: 'info'
  }
};