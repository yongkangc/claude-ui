/// <reference lib="webworker" />

// Declare self as ServiceWorkerGlobalScope
declare const self: ServiceWorkerGlobalScope;

// Type definitions for notification data
interface NotificationPayload {
  type: 'permission_request' | 'session_complete' | 'session_started';
  sessionId: string;
  sessionName: string;
  details?: {
    toolName?: string;
    [key: string]: any;
  };
}

// Service worker lifecycle events
self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[Service Worker] Install event');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[Service Worker] Activate event');
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

// Push notification handler
self.addEventListener('push', (event: PushEvent) => {
  console.log('[Service Worker] Push event received');
  
  if (!event.data) {
    console.error('[Service Worker] Push event with no data');
    return;
  }

  event.waitUntil(
    (async () => {
      try {
        const data: NotificationPayload = event.data.json();
        console.log('[Service Worker] Push data:', data);

        const title = data.sessionName || 'CCUI Notification';
        const options: NotificationOptions = {
          body: data.type === 'permission_request'
            ? `Permission requested for ${data.details?.toolName}`
            : data.type === 'session_started'
            ? `Session ${data.sessionName} started`
            : `Session ${data.sessionName} completed`,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          vibrate: [200, 100, 200],
          data,
          requireInteraction: data.type === 'permission_request'
        };

        await self.registration.showNotification(title, options);
        console.log('[Service Worker] Notification shown');
      } catch (error) {
        console.error('[Service Worker] Error handling push:', error);
      }
    })()
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[Service Worker] Notification clicked');
  event.notification.close();

  event.waitUntil(
    (async () => {
      try {
        const data = event.notification.data as NotificationPayload;
        const sessionId = data?.sessionId;
        
        if (!sessionId) {
          console.warn('[Service Worker] No sessionId in notification data');
          return;
        }

        // Get all window clients
        const clientList = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });

        // Try to focus an existing window
        for (const client of clientList) {
          if (client.url.includes(sessionId) || client.url === '/') {
            console.log('[Service Worker] Focusing existing window');
            await client.focus();
            return;
          }
        }

        // Open new window if no existing one found
        console.log('[Service Worker] Opening new window');
        await self.clients.openWindow(`/?sessionId=${sessionId}`);
      } catch (error) {
        console.error('[Service Worker] Error handling notification click:', error);
      }
    })()
  );
});
