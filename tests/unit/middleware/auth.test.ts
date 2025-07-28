import { Request, Response, NextFunction } from 'express';
import { authMiddleware, clearRateLimitStore, createAuthMiddleware } from '@/middleware/auth';
import { ConfigService } from '@/services/config-service';

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockGetConfig: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear rate limit store to ensure clean state
    clearRateLimitStore();
    
    // Reset NODE_ENV
    process.env.NODE_ENV = 'development';
    
    mockRequest = {
      headers: {},
      connection: { remoteAddress: '127.0.0.1' } as any
    };
    
    // Add ip as a mutable property
    Object.defineProperty(mockRequest, 'ip', {
      value: '127.0.0.1',
      writable: true,
      configurable: true
    });
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
    
    // Mock ConfigService using spyOn
    mockGetConfig = jest.fn();
    jest.spyOn(ConfigService, 'getInstance').mockReturnValue({
      getConfig: mockGetConfig
    } as any);
  });

  describe('Test Environment Bypass', () => {
    it('should bypass auth in test environment', () => {
      process.env.NODE_ENV = 'test';
      
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(ConfigService.getInstance).not.toHaveBeenCalled();
    });
  });

  describe('Authorization Header Validation', () => {
    beforeEach(() => {
      // Reset the mock before each test
      clearRateLimitStore();
      mockGetConfig.mockReturnValue({
        authToken: 'valid-test-token-123456789abcdef0'
      });
    });

    it('should return 401 when Authorization header is missing', () => {
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header does not start with Bearer', () => {
      mockRequest.headers!.authorization = 'Basic some-token';
      
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when Bearer token is invalid', () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() when Bearer token is valid', () => {
      mockRequest.headers!.authorization = 'Bearer valid-test-token-123456789abcdef0';
      
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      mockGetConfig.mockReturnValue({
        authToken: 'valid-test-token-123456789abcdef0'
      });
    });

    it('should allow requests under rate limit', () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      
      // Make 4 failed attempts (under the limit of 5)
      for (let i = 0; i < 9; i++) {
        authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      }
      
      // 5th attempt should still get 401 (not 429)
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenLastCalledWith(401);
      expect(mockResponse.json).toHaveBeenLastCalledWith({ error: 'Unauthorized' });
    });

    it('should rate limit after 10 failed attempts', () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      
      // Make 5 failed attempts
      for (let i = 0; i < 10; i++) {
        authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      }
      
      // 6th attempt should be rate limited
      jest.clearAllMocks();
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({ 
        error: 'Too many authentication attempts. Try again later.' 
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should track rate limits per IP address', () => {
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      
      // Make 5 failed attempts from first IP
      for (let i = 0; i < 5; i++) {
        authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      }
      
      // Switch to different IP
      Object.defineProperty(mockRequest, 'ip', {
        value: '192.168.1.100',
        writable: true,
        configurable: true
      });
      jest.clearAllMocks();
      
      // Should not be rate limited on different IP
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should not increment rate limit on successful auth', () => {
      // Make 4 failed attempts
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      for (let i = 0; i < 4; i++) {
        authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      }
      
      // Make successful request
      mockRequest.headers!.authorization = 'Bearer valid-test-token-123456789abcdef0';
      jest.clearAllMocks();
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      
      // Make another failed attempt - should still be under limit
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      jest.clearAllMocks();
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
  });

  describe('Error Handling', () => {
    it('should return 401 when ConfigService throws error', () => {
      mockRequest.headers!.authorization = 'Bearer some-token';
      mockGetConfig.mockImplementation(() => {
        throw new Error('Config service error');
      });
      
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('IP Address Handling', () => {
    beforeEach(() => {
      mockGetConfig.mockReturnValue({
        authToken: 'valid-test-token-123456789abcdef0'
      });
    });

    it('should handle missing IP address', () => {
      Object.defineProperty(mockRequest, 'ip', {
        value: undefined,
        writable: true,
        configurable: true
      });
      mockRequest.connection = {} as any;
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should use connection.remoteAddress when req.ip is not available', () => {
      Object.defineProperty(mockRequest, 'ip', {
        value: undefined,
        writable: true,
        configurable: true
      });
      mockRequest.connection = { remoteAddress: '10.0.0.1' } as any;
      mockRequest.headers!.authorization = 'Bearer invalid-token';
      
      // Make 5 failed attempts to trigger rate limiting
      for (let i = 0; i < 10; i++) {
        authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      }
      
      jest.clearAllMocks();
      authMiddleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });
  });
  
  describe('createAuthMiddleware with token override', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      clearRateLimitStore();
    });
    
    it('should use provided token instead of config token', () => {
      const customToken = 'my-custom-token-123';
      const middleware = createAuthMiddleware(customToken);
      
      mockRequest.headers = { authorization: `Bearer ${customToken}` };
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
    
    it('should reject invalid token when custom token is set', () => {
      const customToken = 'my-custom-token-123';
      const middleware = createAuthMiddleware(customToken);
      
      mockRequest.headers = { authorization: 'Bearer wrong-token' };
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });
    
    it('should not call ConfigService when using token override', () => {
      const customToken = 'my-custom-token-123';
      const middleware = createAuthMiddleware(customToken);
      
      mockRequest.headers = { authorization: `Bearer ${customToken}` };
      
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockGetConfig).not.toHaveBeenCalled();
    });
    
    it('should apply rate limiting with custom token', () => {
      const customToken = 'my-custom-token-123';
      const middleware = createAuthMiddleware(customToken);
      
      mockRequest.headers = { authorization: 'Bearer wrong-token' };
      
      // Make 10 failed attempts
      for (let i = 0; i < 10; i++) {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }
      
      jest.clearAllMocks();
      
      // 11th attempt should be rate limited
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({ 
        error: 'Too many authentication attempts. Try again later.' 
      });
    });
  });
});