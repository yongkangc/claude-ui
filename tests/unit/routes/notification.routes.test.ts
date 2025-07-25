import request from 'supertest';
import express from 'express';
import { createNotificationRoutes } from '@/routes/notification.routes';
import { NotificationService } from '@/services/notification-service';

jest.mock('@/services/logger');

describe('Notification Routes', () => {
  let app: express.Application;
  let service: jest.Mocked<NotificationService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    service = {
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      getPublicKey: jest.fn().mockReturnValue('publicKey')
    } as any;

    app.use('/api/notifications', createNotificationRoutes(service));
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(500).json({ error: 'err' });
    });
  });

  it('POST /subscribe should add subscription', async () => {
    const res = await request(app)
      .post('/api/notifications/subscribe')
      .send({ endpoint: 'e', keys: { p256dh: 'k1', auth: 'a1' } });
    expect(res.status).toBe(200);
    expect(service.subscribe).toHaveBeenCalled();
  });

  it('DELETE /unsubscribe should remove subscription', async () => {
    const res = await request(app)
      .delete('/api/notifications/unsubscribe')
      .send({ endpoint: 'e' });
    expect(res.status).toBe(200);
    expect(service.unsubscribe).toHaveBeenCalledWith('e');
  });

  it('GET /vapid-public-key should return key', async () => {
    const res = await request(app).get('/api/notifications/vapid-public-key');
    expect(res.status).toBe(200);
    expect(res.body.publicKey).toBe('publicKey');
  });
});
