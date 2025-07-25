import { Router } from 'express';
import { NotificationService } from '@/services/notification-service';
import type { PushSubscription } from '@/types/preferences';
import { createLogger } from '@/services/logger';

export function createNotificationRoutes(service: NotificationService): Router {
  const router = Router();
  const logger = createLogger('NotificationRoutes');

  router.post('/subscribe', async (req: { body: PushSubscription } & any, res, next) => {
    try {
      await service.subscribe(req.body);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to subscribe', error);
      next(error);
    }
  });

  router.delete('/unsubscribe', async (req: { body: { endpoint: string } } & any, res, next) => {
    try {
      await service.unsubscribe(req.body.endpoint);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to unsubscribe', error);
      next(error);
    }
  });

  router.get('/vapid-public-key', (req, res) => {
    res.json({ publicKey: service.getPublicKey() });
  });

  return router;
}
