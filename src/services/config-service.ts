import fs from 'fs';
import path from 'path';
import os from 'os';
import { CCUIConfig, DEFAULT_CONFIG } from '@/types/config';
import { generateMachineId } from '@/utils/machine-id';
import { createLogger, type Logger } from './logger';

/**
 * ConfigService manages CCUI configuration
 * Loads from ~/.ccui/config.json
 * Creates default config on first run
 */
export class ConfigService {
  private static instance: ConfigService;
  private config: CCUIConfig | null = null;
  private logger: Logger;
  private configPath: string;
  private configDir: string;

  private constructor() {
    this.logger = createLogger('ConfigService');
    this.configDir = path.join(os.homedir(), '.ccui');
    this.configPath = path.join(this.configDir, 'config.json');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Initialize configuration
   * Creates config file if it doesn't exist
   * Throws error if initialization fails
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing configuration', { configPath: this.configPath });

    try {
      // Check if config exists
      if (!fs.existsSync(this.configPath)) {
        await this.createDefaultConfig();
      }

      // Load and validate config
      await this.loadConfig();
      
      this.logger.info('Configuration initialized successfully', {
        machineId: this.config?.machine_id,
        serverPort: this.config?.server.port
      });
    } catch (error) {
      this.logger.error('Failed to initialize configuration', error);
      throw new Error(`Configuration initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current configuration
   * Throws if not initialized
   */
  getConfig(): CCUIConfig {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return this.config;
  }

  /**
   * Create default configuration
   */
  private async createDefaultConfig(): Promise<void> {
    this.logger.info('Creating default configuration');

    try {
      // Ensure config directory exists
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
        this.logger.debug('Created config directory', { dir: this.configDir });
      }

      // Generate machine ID
      const machineId = await generateMachineId();
      this.logger.debug('Generated machine ID', { machineId });

      // Create default config
      const config: CCUIConfig = {
        machine_id: machineId,
        ...DEFAULT_CONFIG
      };

      // Write config file
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf-8'
      );

      this.logger.info('Default configuration created', {
        path: this.configPath,
        machineId: config.machine_id
      });
    } catch (error) {
      throw new Error(`Failed to create default config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load configuration from file
   */
  private async loadConfig(): Promise<void> {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(configData) as CCUIConfig;

      // Validate required fields
      if (!config.machine_id) {
        throw new Error('Invalid config: missing machine_id');
      }
      if (!config.server || typeof config.server.port !== 'number') {
        throw new Error('Invalid config: missing or invalid server configuration');
      }

      this.config = config;
      this.logger.debug('Configuration loaded', { config });
    } catch (error) {
      throw new Error(`Failed to load config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }


  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<CCUIConfig>): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }

    this.logger.info('Updating configuration', { updates });
    
    // Update in-memory config
    this.config = { ...this.config, ...updates };
    
    // Write to file
    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf-8'
      );
      this.logger.info('Configuration updated successfully');
    } catch (error) {
      this.logger.error('Failed to update configuration', error);
      throw new Error(`Failed to update config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    ConfigService.instance = null as any;
  }
}