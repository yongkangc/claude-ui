import { CUIServer } from '@/cui-server';
import { clearRateLimitStore } from '@/middleware/auth';
import { TestHelpers } from '../utils/test-helpers';

/**
 * End-to-end Authentication Integration Test
 * Tests the complete auth flow with real auth middleware enabled
 */
describe('Authentication Integration E2E', () => {
  let server: CUIServer;
  let baseUrl: string;
  let originalEnv: string | undefined;
  let authToken: string;

  beforeAll(async () => {
    // Enable auth in tests
    originalEnv = process.env.ENABLE_AUTH_IN_TESTS;
    process.env.ENABLE_AUTH_IN_TESTS = 'true';

    // Generate a test auth token (32 hex characters)
    authToken = 'a1b2c3d4e5f67890123456789012345f';

    // Create server with mocked config that includes auth token
    const testPort = 9000 + Math.floor(Math.random() * 1000);
    
    // Mock ConfigService for auth tests
    const { ConfigService } = require('@/services/config-service');
    jest.spyOn(ConfigService, 'getInstance').mockReturnValue({
      initialize: jest.fn().mockResolvedValue(undefined),
      getConfig: jest.fn().mockReturnValue({
        machine_id: 'test-machine-auth-12345678',
        authToken: authToken,
        server: {
          host: 'localhost',
          port: testPort
        },
        logging: {
          level: 'silent'
        }
      })
    });
    
    server = new CUIServer({ port: testPort, host: 'localhost' });
    
    // Start server
    await server.start();
    
    baseUrl = `http://localhost:${testPort}`;
  });

  afterAll(async () => {
    // Stop server
    if (server) {
      await server.stop();
    }

    // Restore environment
    if (originalEnv !== undefined) {
      process.env.ENABLE_AUTH_IN_TESTS = originalEnv;
    } else {
      delete process.env.ENABLE_AUTH_IN_TESTS;
    }
  });

  beforeEach(() => {
    // Clear rate limiting before each test
    clearRateLimitStore();
  });

  describe('Authentication Flow', () => {
    it('should reject API requests without auth token', async () => {
      const response = await fetch(`${baseUrl}/api/conversations`);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject API requests with invalid auth token', async () => {
      const response = await fetch(`${baseUrl}/api/conversations`, {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should accept API requests with valid auth token', async () => {
      const response = await fetch(`${baseUrl}/api/conversations`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('conversations');
      expect(data).toHaveProperty('total');
    });

    it('should allow system endpoints without auth', async () => {
      // Health check should work without auth
      const healthResponse = await fetch(`${baseUrl}/health`);
      expect(healthResponse.status).toBe(200);

      // System status should work without auth  
      const statusResponse = await fetch(`${baseUrl}/api/system/status`);
      expect(statusResponse.status).toBe(200);
    });

    it('should reject requests with malformed authorization header', async () => {
      const response = await fetch(`${baseUrl}/api/conversations`, {
        headers: {
          'Authorization': 'InvalidFormat'
        }
      });
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject requests with Bearer but no token', async () => {
      const response = await fetch(`${baseUrl}/api/conversations`, {
        headers: {
          'Authorization': 'Bearer '
        }
      });
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit after multiple failed attempts', async () => {
      const invalidToken = 'invalid-token';
      
      // Make 10 failed attempts (should hit rate limit)
      for (let i = 0; i < 10; i++) {
        const response = await fetch(`${baseUrl}/api/conversations`, {
          headers: {
            'Authorization': `Bearer ${invalidToken}`
          }
        });
        expect(response.status).toBe(401);
      }
      
      // 11th attempt should be rate limited
      const rateLimitedResponse = await fetch(`${baseUrl}/api/conversations`, {
        headers: {
          'Authorization': `Bearer ${invalidToken}`
        }
      });
      
      expect(rateLimitedResponse.status).toBe(429);
      const data = await rateLimitedResponse.json();
      expect(data.error).toMatch(/Too many authentication attempts/);
    });

    it('should rate limit all requests from same IP after failed attempts', async () => {
      const invalidToken = 'invalid-token';
      
      // Make 10 failed attempts to trigger rate limiting
      for (let i = 0; i < 10; i++) {
        await fetch(`${baseUrl}/api/conversations`, {
          headers: {
            'Authorization': `Bearer ${invalidToken}`
          }
        });
      }
      
      // Even valid token gets rate limited from same IP (correct security behavior)
      const validResponse = await fetch(`${baseUrl}/api/conversations`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      expect(validResponse.status).toBe(429);
      const data = await validResponse.json();
      expect(data.error).toMatch(/Too many authentication attempts/);
    });
  });

  describe('Protected Endpoints', () => {
    const protectedEndpoints = [
      '/api/conversations',
      '/api/permissions',
      '/api/filesystem',
      '/api/logs/recent',
      '/api/working-directories',
      '/api/preferences'
    ];

    protectedEndpoints.forEach(endpoint => {
      it(`should protect ${endpoint} endpoint`, async () => {
        // Without auth
        const unauthorizedResponse = await fetch(`${baseUrl}${endpoint}`);
        expect(unauthorizedResponse.status).toBe(401);

        // With valid auth
        const authorizedResponse = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        expect(authorizedResponse.status).not.toBe(401);
      });
    });
  });

  describe('Token Validation', () => {
    it('should validate token length and format', async () => {
      const invalidTokens = [
        'short',                    // Too short
        'toolongtoken'.repeat(10),  // Too long
        'invalid-chars-!@#$',       // Invalid characters
        '1234567890abcdef'.repeat(3) // Wrong length (48 chars instead of 32)
      ];

      for (const invalidToken of invalidTokens) {
        const response = await fetch(`${baseUrl}/api/conversations`, {
          headers: {
            'Authorization': `Bearer ${invalidToken}`
          }
        });
        
        expect(response.status).toBe(401);
      }
    });

    it('should validate against the exact config token', async () => {
      // Create a valid-looking but wrong token
      const wrongToken = 'a'.repeat(32); // 32 'a' characters
      
      const response = await fetch(`${baseUrl}/api/conversations`, {
        headers: {
          'Authorization': `Bearer ${wrongToken}`
        }
      });
      
      expect(response.status).toBe(401);
    });
  });

  describe('Complete Auth Flow Simulation', () => {
    it('should simulate complete user authentication flow', async () => {
      // 1. User tries to access API without token - should fail
      let response = await fetch(`${baseUrl}/api/conversations`);
      expect(response.status).toBe(401);

      // 2. User gets token (simulated - in real flow this would be from URL fragment)
      const userToken = authToken;

      // 3. User makes authenticated request - should succeed
      response = await fetch(`${baseUrl}/api/conversations`, {
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      });
      expect(response.status).toBe(200);

      // 4. User can access multiple protected endpoints
      const endpoints = ['/api/conversations', '/api/preferences'];
      for (const endpoint of endpoints) {
        response = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${userToken}`
          }
        });
        expect(response.status).toBe(200);
      }

      // 5. User can still access public endpoints
      response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);
    });
  });
});