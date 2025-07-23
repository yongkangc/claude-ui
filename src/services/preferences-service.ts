import fs from 'fs';
import path from 'path';
import os from 'os';
import { Preferences, DEFAULT_PREFERENCES } from '@/types/preferences';
import { createLogger, type Logger } from './logger';
import { JsonFileManager } from './json-file-manager';

interface PreferenceDB {
  preferences: Preferences;
  metadata: {
    schema_version: number;
    created_at: string;
    last_updated: string;
  };
}

export class PreferencesService {
  private static instance: PreferencesService;
  private jsonManager!: JsonFileManager<PreferenceDB>;
  private logger: Logger;
  private dbPath!: string;
  private configDir!: string;
  private isInitialized = false;

  private constructor() {
    this.logger = createLogger('PreferencesService');
    this.initializePaths();
  }

  private initializePaths(): void {
    this.configDir = path.join(os.homedir(), '.ccui');
    this.dbPath = path.join(this.configDir, 'preferences.json');

    const defaultData: PreferenceDB = {
      preferences: DEFAULT_PREFERENCES,
      metadata: {
        schema_version: 1,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }
    };

    this.jsonManager = new JsonFileManager<PreferenceDB>(this.dbPath, defaultData);
  }

  static getInstance(): PreferencesService {
    if (!PreferencesService.instance) {
      PreferencesService.instance = new PreferencesService();
    }
    return PreferencesService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true });
      }

      await this.jsonManager.read();
      this.isInitialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize preferences', error);
      throw new Error('Preferences initialization failed');
    }
  }

  async getPreferences(): Promise<Preferences> {
    try {
      const data = await this.jsonManager.read();
      return data.preferences;
    } catch (error) {
      this.logger.error('Failed to get preferences', error);
      return { ...DEFAULT_PREFERENCES };
    }
  }

  async updatePreferences(updates: Partial<Preferences>): Promise<Preferences> {
    let updated: Preferences = { ...DEFAULT_PREFERENCES };
    await this.jsonManager.update((data) => {
      updated = { ...data.preferences, ...updates };
      data.preferences = updated;
      data.metadata.last_updated = new Date().toISOString();
      return data;
    });
    return updated;
  }

  static resetInstance(): void {
    if (PreferencesService.instance) {
      PreferencesService.instance.isInitialized = false;
    }
    PreferencesService.instance = null as unknown as PreferencesService;
  }

  reinitializePaths(): void {
    this.initializePaths();
  }

  getDbPath(): string {
    return this.dbPath;
  }
}
