/**
 * Configuration types for CCUI
 */

export interface ServerConfig {
  host: string;
  port: number;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  email: string;
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
   * VAPID keys for web push notifications
   */
  vapid?: VapidConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Omit<CCUIConfig, 'machine_id'> = {
  server: {
    host: 'localhost',
    port: 3001
  }
};