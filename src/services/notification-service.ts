import webpush from 'web-push';
import { createLogger, type Logger } from './logger';
import { PreferencesService } from './preferences-service';
import { ConfigService } from './config-service';
import type { PushSubscription } from '@/types/preferences';
import type { VapidConfig } from '@/types/config';

export interface NotificationPayload {
  type: 'permission_request' | 'session_complete';
  sessionId: string;
  sessionName: string;
  timestamp: string;
  details?: Record<string, any>;
}

export class NotificationService {
  private static instance: NotificationService;
  private logger: Logger;
  private prefsService: PreferencesService;
  private configService: ConfigService;
  private vapidConfig!: VapidConfig;
  private isInitialized = false;

  private constructor() {
    this.logger = createLogger('NotificationService');
    this.prefsService = PreferencesService.getInstance();
    this.configService = ConfigService.getInstance();
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      // Get VAPID config from ConfigService
      this.vapidConfig = await this.configService.getVapidConfig();
      
      // Set VAPID details for web-push
      webpush.setVapidDetails(
        `mailto:${this.vapidConfig.email}`,
        this.vapidConfig.publicKey,
        this.vapidConfig.privateKey
      );
      
      this.isInitialized = true;
      this.logger.info('Notification service initialized', {
        email: this.vapidConfig.email,
        publicKeyPrefix: this.vapidConfig.publicKey.substring(0, 20) + '...'
      });
    } catch (error) {
      this.logger.error('Failed to initialize notification service', error);
      throw error;
    }
  }

  getPublicKey(): string {
    if (!this.vapidConfig) {
      throw new Error('Notification service not initialized');
    }
    return this.vapidConfig.publicKey;
  }

  async subscribe(sub: PushSubscription): Promise<void> {
    const prefs = await this.prefsService.getPreferences();
    const existing = prefs.pushSubscriptions || [];
    if (!existing.find(s => s.endpoint === sub.endpoint)) {
      await this.prefsService.updatePreferences({ pushSubscriptions: [...existing, sub] });
    }
  }

  async unsubscribe(endpoint: string): Promise<void> {
    const prefs = await this.prefsService.getPreferences();
    const updated = (prefs.pushSubscriptions || []).filter(s => s.endpoint !== endpoint);
    await this.prefsService.updatePreferences({ pushSubscriptions: updated });
  }

  async sendNotification(payload: NotificationPayload): Promise<void> {
    const prefs = await this.prefsService.getPreferences();
    if (!prefs.notificationsEnabled) {
      this.logger.debug('Notifications disabled globally, skipping notification', { 
        type: payload.type,
        sessionId: payload.sessionId 
      });
      return;
    }
    
    const subs = prefs.pushSubscriptions || [];
    if (subs.length === 0) {
      this.logger.debug('No push subscriptions found, skipping notification', {
        type: payload.type,
        sessionId: payload.sessionId
      });
      return;
    }

    this.logger.info('Sending push notification', {
      type: payload.type,
      sessionId: payload.sessionId,
      sessionName: payload.sessionName,
      subscriptionCount: subs.length,
      details: payload.details
    });

    await Promise.all(subs.map(sub =>
      webpush.sendNotification(sub, JSON.stringify(payload))
        .then(() => {
          this.logger.debug('Push notification sent successfully', {
            endpoint: sub.endpoint.substring(0, 50) + '...',
            type: payload.type
          });
        })
        .catch((err: any) => {
          this.logger.warn('Failed to send push notification', { 
            error: err.message,
            statusCode: err.statusCode,
            endpoint: sub.endpoint.substring(0, 50) + '...',
            type: payload.type
          });
        })
    ));
  }
}
