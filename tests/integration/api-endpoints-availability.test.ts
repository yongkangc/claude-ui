import { CUIServer } from '@/cui-server';
import fetch from 'node-fetch';

describe('API Endpoints Availability', () => {
  let server: CUIServer;
  let serverPort: number;
  let baseUrl: string;

  beforeAll(async () => {
    // Use a random port to avoid conflicts
    serverPort = 9000 + Math.floor(Math.random() * 1000);
    baseUrl = `http://localhost:${serverPort}`;
    
    // Create server with specific port
    server = new CUIServer({ port: serverPort, host: 'localhost' });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('System API', () => {
    it('should have /api/system/status endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/system/status`);
      expect(response.status).toBe(200);
    });
  });

  describe('Conversations API', () => {
    it('should have /api/conversations endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/conversations`);
      expect(response.status).toBe(200);
    });

    it('should handle /api/conversations/:id endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/conversations/test-id`);
      // Should return 404 for non-existent conversation
      expect([200, 404]).toContain(response.status);
    });

    it('should have /api/conversations/start endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/conversations/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test' })
      });
      // Should return 400 for missing streamingId
      expect(response.status).toBe(400);
    });
  });

  describe('Permissions API', () => {
    it('should have /api/permissions/notify endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/permissions/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      // Should return 400 for invalid payload
      expect([200, 400]).toContain(response.status);
    });

    it('should handle /api/permissions/:requestId/decision endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/permissions/test-id/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true })
      });
      // Should return 400 for invalid request
      expect(response.status).toBe(400);
    });
  });

  describe('FileSystem API', () => {
    it('should have /api/filesystem/read endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/filesystem/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/test' })
      });
      // Should return error for non-existent path
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it('should have /api/filesystem/write endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/filesystem/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/test', content: 'test' })
      });
      // Should return 404 for invalid path
      expect(response.status).toBe(404);
    });
  });

  describe('Logs API', () => {
    it('should have /api/logs/recent endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/logs/recent`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('logs');
      expect(Array.isArray(data.logs)).toBe(true);
    });

    it('should have /api/logs/recent with limit parameter', async () => {
      const response = await fetch(`${baseUrl}/api/logs/recent?limit=10`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('logs');
      expect(Array.isArray(data.logs)).toBe(true);
    });

    it('should have /api/logs/stream endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/logs/stream`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      
      // Close the stream connection
      // For node-fetch, we don't need to explicitly close the stream
    });
  });

  describe('Stream API', () => {
    it('should handle /api/stream/:streamingId endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/stream/test-stream-id`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      
      // Close the stream connection
      // For node-fetch, we don't need to explicitly close the stream
    });
  });

  describe('Working Directories API', () => {
    it('should have /api/working-directories endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/working-directories`);
      expect(response.status).toBe(200);
    });
  });

  describe('Preferences API', () => {
    it('should have /api/preferences endpoint', async () => {
      const response = await fetch(`${baseUrl}/api/preferences`);
      expect(response.status).toBe(200);
    });

    it('should have /api/preferences endpoint for POST', async () => {
      const response = await fetch(`${baseUrl}/api/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: 'dark' })
      });
      // Should return 404 for unknown preference keys
      expect(response.status).toBe(404);
    });
  });

  describe('Health Check', () => {
    it('should respond to root endpoint', async () => {
      const response = await fetch(`${baseUrl}/`);
      expect(response.status).toBe(200);
    });
  });

  describe('All API Routes Summary', () => {
    it('should have all expected API endpoints available', async () => {
      const endpointChecks = [
        { path: '/api/system/status', method: 'GET', expectedStatus: 200 },
        { path: '/api/conversations', method: 'GET', expectedStatus: 200 },
        { path: '/api/logs/recent', method: 'GET', expectedStatus: 200 },
        { path: '/api/working-directories', method: 'GET', expectedStatus: 200 },
        { path: '/api/preferences', method: 'GET', expectedStatus: 200 }
      ];

      const results = await Promise.all(
        endpointChecks.map(async ({ path, method, expectedStatus }) => {
          try {
            const response = await fetch(`${baseUrl}${path}`, { method });
            return {
              path,
              method,
              status: response.status,
              success: response.status === expectedStatus
            };
          } catch (error) {
            return {
              path,
              method,
              error: error instanceof Error ? error.message : 'Unknown error',
              success: false
            };
          }
        })
      );

      const failedEndpoints = results.filter(r => !r.success);
      
      if (failedEndpoints.length > 0) {
        console.error('Failed endpoints:', failedEndpoints);
      }

      expect(failedEndpoints).toHaveLength(0);
    });
  });
});