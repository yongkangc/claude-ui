interface NotificationServiceConfig {
  vapidPublicKey: string | null;
  permission: NotificationPermission;
  subscription: PushSubscription | null;
}

export interface NotificationState {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
}

class NotificationService {
  private config: NotificationServiceConfig = {
    vapidPublicKey: null,
    permission: 'default',
    subscription: null
  };

  private listeners = new Set<(state: NotificationState) => void>();

  constructor() {
    // Initialize permission status
    if ('Notification' in window) {
      this.config.permission = Notification.permission;
    }
  }

  /**
   * Check if push notifications are supported by the browser
   */
  isSupported(): boolean {
    return (
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  /**
   * Get current notification state
   */
  getState(): NotificationState {
    return {
      isSupported: this.isSupported(),
      permission: this.config.permission,
      isSubscribed: this.config.subscription !== null,
      isLoading: false,
      error: null
    };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: NotificationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(updates: Partial<NotificationState> = {}) {
    const state = { ...this.getState(), ...updates };
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Get VAPID public key from the server
   */
  private async getVapidPublicKey(): Promise<string> {
    if (this.config.vapidPublicKey) {
      return this.config.vapidPublicKey;
    }

    try {
      const response = await fetch('/api/notifications/vapid-public-key');
      if (!response.ok) {
        throw new Error('Failed to get VAPID public key');
      }
      const data = await response.json();
      this.config.vapidPublicKey = data.publicKey;
      return data.publicKey;
    } catch (error) {
      throw new Error(`Failed to get VAPID key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Request notification permission from the user
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported by this browser');
    }

    this.notifyListeners({ isLoading: true, error: null });

    try {
      const permission = await Notification.requestPermission();
      this.config.permission = permission;
      this.notifyListeners({ isLoading: false, permission });
      return permission;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request permission';
      this.notifyListeners({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  }

  /**
   * Ensure service worker is registered and ready
   */
  private async ensureServiceWorkerReady(): Promise<ServiceWorkerRegistration> {
    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Worker is not supported');
    }

    // Check if service worker is already registered
    let registration = await navigator.serviceWorker.getRegistration();
    
    if (!registration) {
      console.log('[NotificationService] No service worker found, registering...');
      registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('[NotificationService] Service worker registered');
    }

    // Wait for service worker to be ready
    console.log('[NotificationService] Waiting for service worker to be ready...');
    const readyRegistration = await navigator.serviceWorker.ready;
    console.log('[NotificationService] Service worker is ready');
    
    return readyRegistration;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribeToPush(): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported');
    }

    if (this.config.permission !== 'granted') {
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }
    }

    this.notifyListeners({ isLoading: true, error: null });

    try {
      // Ensure service worker is ready
      const registration = await this.ensureServiceWorkerReady();
      
      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('[NotificationService] Already subscribed, updating server...');
        this.config.subscription = existingSubscription;
        
        // Send existing subscription to server
        const response = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(existingSubscription.toJSON())
        });

        if (!response.ok) {
          console.warn('[NotificationService] Failed to update server with existing subscription');
        }
        
        this.notifyListeners({ isLoading: false, isSubscribed: true });
        return true;
      }
      
      // Get VAPID public key
      const vapidPublicKey = await this.getVapidPublicKey();
      console.log('[NotificationService] Got VAPID public key');
      
      // Subscribe to push notifications
      console.log('[NotificationService] Subscribing to push notifications...');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      });
      console.log('[NotificationService] Push subscription created');

      // Send subscription to server
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription.toJSON())
      });

      if (!response.ok) {
        // Unsubscribe if server registration fails
        await subscription.unsubscribe();
        throw new Error('Failed to register subscription with server');
      }

      console.log('[NotificationService] Subscription registered with server');
      this.config.subscription = subscription;
      this.notifyListeners({ isLoading: false, isSubscribed: true });
      return true;
    } catch (error) {
      console.error('[NotificationService] Subscribe error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe to notifications';
      this.notifyListeners({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.config.subscription) {
      return true; // Already unsubscribed
    }

    this.notifyListeners({ isLoading: true, error: null });

    try {
      // Unsubscribe from browser
      await this.config.subscription.unsubscribe();
      
      // Remove from server
      const response = await fetch('/api/notifications/unsubscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endpoint: this.config.subscription.endpoint })
      });

      if (!response.ok) {
        console.warn('Failed to remove subscription from server, but browser unsubscribed');
      }

      this.config.subscription = null;
      this.notifyListeners({ isLoading: false, isSubscribed: false });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to unsubscribe from notifications';
      this.notifyListeners({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  }

  /**
   * Check current subscription status
   */
  async checkSubscriptionStatus(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    try {
      const registration = await this.ensureServiceWorkerReady();
      const subscription = await registration.pushManager.getSubscription();
      
      this.config.subscription = subscription;
      const isSubscribed = subscription !== null;
      this.notifyListeners({ isSubscribed });
      
      console.log('[NotificationService] Subscription status checked:', isSubscribed);
      return isSubscribed;
    } catch (error) {
      console.warn('[NotificationService] Failed to check subscription status:', error);
      return false;
    }
  }

  /**
   * Helper function to convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();