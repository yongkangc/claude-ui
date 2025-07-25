export interface Preferences {
  colorScheme: 'light' | 'dark' | 'system';
  language: string;
  notificationsEnabled: boolean;
  pushSubscriptions: PushSubscription[];
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export const DEFAULT_PREFERENCES: Preferences = {
  colorScheme: 'system',
  language: 'en',
  notificationsEnabled: false,
  pushSubscriptions: []
};
