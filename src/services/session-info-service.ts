import fs from 'fs';
import path from 'path';
import os from 'os';
import type { SessionInfo, SessionInfoDatabase, DatabaseMetadata } from '@/types';
import { createLogger } from './logger';
import type { Logger } from 'pino';
import { JsonFileManager } from './json-file-manager';

/**
 * SessionInfoService manages session information using custom JSON file manager
 * Stores session metadata including custom names in ~/.ccui/session-info.json
 * Provides fast lookups and updates for session-specific data with race condition protection
 */
export class SessionInfoService {
  private static instance: SessionInfoService;
  private jsonManager!: JsonFileManager<SessionInfoDatabase>;
  private logger: Logger;
  private dbPath!: string;
  private configDir!: string;
  private isInitialized = false;

  private constructor() {
    this.logger = createLogger('SessionInfoService');
    this.initializePaths();
  }

  /**
   * Initialize file paths and JsonFileManager
   * Separated to allow re-initialization during testing
   */
  private initializePaths(): void {
    this.configDir = path.join(os.homedir(), '.ccui');
    this.dbPath = path.join(this.configDir, 'session-info.json');
    
    this.logger.debug('Initializing paths', { 
      homedir: os.homedir(), 
      configDir: this.configDir, 
      dbPath: this.dbPath 
    });
    
    // Create default database structure
    const defaultData: SessionInfoDatabase = {
      sessions: {},
      metadata: {
        schema_version: 1,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }
    };
    
    this.jsonManager = new JsonFileManager<SessionInfoDatabase>(this.dbPath, defaultData);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SessionInfoService {
    if (!SessionInfoService.instance) {
      SessionInfoService.instance = new SessionInfoService();
    }
    return SessionInfoService.instance;
  }

  /**
   * Initialize the database
   * Creates database file if it doesn't exist
   * Throws error if initialization fails
   */
  async initialize(): Promise<void> {
    // Prevent multiple initializations
    if (this.isInitialized) {
      return;
    }

    this.logger.info('Initializing session info database', { dbPath: this.dbPath });

    try {
      // Ensure config directory exists
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
        this.logger.debug('Created config directory', { dir: this.configDir });
      }

      // Read existing data or initialize with defaults
      const data = await this.jsonManager.read();

      // Ensure metadata exists and update schema if needed
      await this.ensureMetadata();

      this.isInitialized = true;

      this.logger.info('Session info database initialized successfully', {
        dbPath: this.dbPath,
        sessionCount: Object.keys(data.sessions).length,
        schemaVersion: data.metadata.schema_version
      });
    } catch (error) {
      this.logger.error('Failed to initialize session info database', error);
      throw new Error(`Session info database initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get session information for a given session ID
   * Returns default values if session doesn't exist
   */
  async getSessionInfo(sessionId: string): Promise<SessionInfo> {
    this.logger.debug('Getting session info', { sessionId });

    try {
      const data = await this.jsonManager.read();
      
      const sessionInfo = data.sessions[sessionId];
      
      if (sessionInfo) {
        this.logger.debug('Found existing session info', { sessionId, sessionInfo });
        return sessionInfo;
      }

      // Return default session info if not found
      const defaultSessionInfo: SessionInfo = {
        custom_name: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1
      };

      this.logger.debug('Using default session info', { sessionId, sessionInfo: defaultSessionInfo });
      return defaultSessionInfo;
    } catch (error) {
      this.logger.error('Failed to get session info', { sessionId, error });
      // Return default on error to maintain graceful degradation
      return {
        custom_name: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1
      };
    }
  }

  /**
   * Update custom name for a session
   * Creates session entry if it doesn't exist
   */
  async updateCustomName(sessionId: string, customName: string): Promise<void> {
    this.logger.info('Updating custom name', { sessionId, customName });

    try {
      await this.jsonManager.update((data) => {
        const now = new Date().toISOString();
        const existingSession = data.sessions[sessionId];

        if (existingSession) {
          // Update existing session
          data.sessions[sessionId] = {
            ...existingSession,
            custom_name: customName,
            updated_at: now
          };
        } else {
          // Create new session entry
          data.sessions[sessionId] = {
            custom_name: customName,
            created_at: now,
            updated_at: now,
            version: 1
          };
        }

        // Update metadata
        data.metadata.last_updated = now;

        return data;
      });

      this.logger.info('Custom name updated successfully', { sessionId, customName });
    } catch (error) {
      this.logger.error('Failed to update custom name', { sessionId, customName, error });
      throw new Error(`Failed to update custom name: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete session information
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.logger.info('Deleting session info', { sessionId });

    try {
      await this.jsonManager.update((data) => {
        if (data.sessions[sessionId]) {
          delete data.sessions[sessionId];
          data.metadata.last_updated = new Date().toISOString();
          this.logger.info('Session info deleted successfully', { sessionId });
        } else {
          this.logger.debug('Session info not found for deletion', { sessionId });
        }
        return data;
      });
    } catch (error) {
      this.logger.error('Failed to delete session info', { sessionId, error });
      throw new Error(`Failed to delete session info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all session information
   * Returns mapping of sessionId -> SessionInfo
   */
  async getAllSessionInfo(): Promise<Record<string, SessionInfo>> {
    this.logger.debug('Getting all session info');

    try {
      const data = await this.jsonManager.read();
      return { ...data.sessions };
    } catch (error) {
      this.logger.error('Failed to get all session info', error);
      return {};
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{ sessionCount: number; dbSize: number; lastUpdated: string }> {
    try {
      const data = await this.jsonManager.read();
      
      let dbSize = 0;
      try {
        const stats = fs.statSync(this.dbPath);
        dbSize = stats.size;
      } catch (statError) {
        // File might not exist yet
        dbSize = 0;
      }
      
      return {
        sessionCount: Object.keys(data.sessions).length,
        dbSize,
        lastUpdated: data.metadata.last_updated
      };
    } catch (error) {
      this.logger.error('Failed to get database stats', error);
      return {
        sessionCount: 0,
        dbSize: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Ensure metadata exists and is current
   */
  private async ensureMetadata(): Promise<void> {
    try {
      await this.jsonManager.update((data) => {
        let changed = false;

        if (!data.metadata) {
          data.metadata = {
            schema_version: 1,
            created_at: new Date().toISOString(),
            last_updated: new Date().toISOString()
          };
          changed = true;
          this.logger.info('Created missing metadata');
        }

        // Future: Add schema migration logic here if needed
        if (data.metadata.schema_version < 1) {
          // Migrate to version 1
          data.metadata.schema_version = 1;
          data.metadata.last_updated = new Date().toISOString();
          changed = true;
          this.logger.info('Migrated database to schema version 1');
        }

        return data;
      });
    } catch (error) {
      this.logger.error('Failed to ensure metadata', error);
      throw error;
    }
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    if (SessionInfoService.instance) {
      SessionInfoService.instance.isInitialized = false;
    }
    SessionInfoService.instance = null as any;
  }

  /**
   * Re-initialize paths and JsonFileManager (for testing)
   * Call this after mocking os.homedir() to use test paths
   */
  reinitializePaths(): void {
    this.initializePaths();
  }

  /**
   * Get current database path (for testing)
   */
  getDbPath(): string {
    return this.dbPath;
  }

  /**
   * Get current config directory path (for testing)
   */
  getConfigDir(): string {
    return this.configDir;
  }
}