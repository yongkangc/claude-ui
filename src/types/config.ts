/**
 * Configuration types for CUI
 */

export interface ServerConfig {
  host: string;
  port: number;
}

export interface CUIConfig {
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

}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Omit<CUIConfig, 'machine_id'> = {
  server: {
    host: 'localhost',
    port: 3001
  }
};