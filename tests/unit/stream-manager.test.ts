import { StreamManager } from '@/services/stream-manager';
import { Response } from 'express';
import { StreamEvent, AssistantStreamMessage } from '@/types';
import { EventEmitter } from 'events';

// Mock Express Response
const createMockResponse = (): jest.Mocked<Response> => {
  const res = new EventEmitter() as any;
  res.setHeader = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn();
  // Use a property descriptor to make writableEnded assignable
  let _writableEnded = false;
  Object.defineProperty(res, 'writableEnded', {
    get: () => _writableEnded,
    set: (value) => { _writableEnded = value; },
    configurable: true
  });
  res.destroyed = false;
  return res;
};

describe('StreamManager', () => {
  let manager: StreamManager;
  let mockResponse: jest.Mocked<Response>;

  beforeEach(() => {
    manager = new StreamManager();
    mockResponse = createMockResponse();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addClient', () => {
    it('should add client and configure headers', () => {
      const sessionId = 'test-session-123';
      
      manager.addClient(sessionId, mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/x-ndjson');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Accel-Buffering', 'no');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });

    it('should send connection confirmation', () => {
      const sessionId = 'test-session-123';
      
      manager.addClient(sessionId, mockResponse);

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"connected"')
      );
    });

    it('should track client count', () => {
      const sessionId = 'test-session-123';
      
      expect(manager.getClientCount(sessionId)).toBe(0);
      
      manager.addClient(sessionId, mockResponse);
      expect(manager.getClientCount(sessionId)).toBe(1);
    });

    it('should handle multiple clients for same session', () => {
      const sessionId = 'test-session-123';
      const mockResponse2 = createMockResponse();
      
      manager.addClient(sessionId, mockResponse);
      manager.addClient(sessionId, mockResponse2);
      
      expect(manager.getClientCount(sessionId)).toBe(2);
    });

    it('should auto-remove client on close event', () => {
      const sessionId = 'test-session-123';
      
      manager.addClient(sessionId, mockResponse);
      expect(manager.getClientCount(sessionId)).toBe(1);
      
      mockResponse.emit('close');
      expect(manager.getClientCount(sessionId)).toBe(0);
    });

    it('should auto-remove client on error event', () => {
      const sessionId = 'test-session-123';
      
      manager.addClient(sessionId, mockResponse);
      expect(manager.getClientCount(sessionId)).toBe(1);
      
      mockResponse.emit('error', new Error('Connection error'));
      expect(manager.getClientCount(sessionId)).toBe(0);
    });
  });

  describe('removeClient', () => {
    it('should remove specific client', () => {
      const sessionId = 'test-session-123';
      const mockResponse2 = createMockResponse();
      
      manager.addClient(sessionId, mockResponse);
      manager.addClient(sessionId, mockResponse2);
      expect(manager.getClientCount(sessionId)).toBe(2);
      
      manager.removeClient(sessionId, mockResponse);
      expect(manager.getClientCount(sessionId)).toBe(1);
    });

    it('should remove session when no clients remain', () => {
      const sessionId = 'test-session-123';
      
      manager.addClient(sessionId, mockResponse);
      expect(manager.getActiveSessions()).toContain(sessionId);
      
      manager.removeClient(sessionId, mockResponse);
      expect(manager.getActiveSessions()).not.toContain(sessionId);
    });

    it('should emit client-disconnected event', (done) => {
      const sessionId = 'test-session-123';
      
      manager.on('client-disconnected', (event) => {
        expect(event.sessionId).toBe(sessionId);
        done();
      });
      
      manager.addClient(sessionId, mockResponse);
      manager.removeClient(sessionId, mockResponse);
    });
  });

  describe('broadcast', () => {
    it('should send event to all clients in session', () => {
      const sessionId = 'test-session-123';
      const mockResponse2 = createMockResponse();
      const streamMessage: AssistantStreamMessage = {
        type: 'assistant',
        session_id: sessionId,
        message: { role: 'assistant', content: 'Hello' }
      };
      
      manager.addClient(sessionId, mockResponse);
      manager.addClient(sessionId, mockResponse2);
      
      manager.broadcast(sessionId, streamMessage);
      
      const expectedData = JSON.stringify(streamMessage) + '\n';
      expect(mockResponse.write).toHaveBeenCalledWith(expectedData);
      expect(mockResponse2.write).toHaveBeenCalledWith(expectedData);
    });

    it('should handle non-existent session gracefully', () => {
      const event: StreamEvent = {
        type: 'error',
        error: 'Test error',
        sessionId: 'non-existent',
        timestamp: new Date().toISOString()
      };
      
      expect(() => manager.broadcast('non-existent', event)).not.toThrow();
    });

    it('should clean up dead clients during broadcast', () => {
      const sessionId = 'test-session-123';
      
      // Set up the mock to throw error after being added
      manager.addClient(sessionId, mockResponse);
      expect(manager.getClientCount(sessionId)).toBe(1);
      
      // Now set up the mock to throw error on write
      mockResponse.write.mockImplementation(() => {
        throw new Error('Connection closed');
      });
      
      const streamMessage: AssistantStreamMessage = {
        type: 'assistant',
        session_id: sessionId,
        message: { role: 'assistant', content: 'test' }
      };
      
      manager.broadcast(sessionId, streamMessage);
      expect(manager.getClientCount(sessionId)).toBe(0);
    });

    it('should handle writableEnded responses', () => {
      const sessionId = 'test-session-123';
      
      // Create response that will be ended after adding
      const endedResponse = createMockResponse();
      
      // Add client first (this succeeds)
      manager.addClient(sessionId, endedResponse);
      expect(manager.getClientCount(sessionId)).toBe(1);
      
      // Now mark it as ended
      (endedResponse as any).writableEnded = true;
      
      const streamMessage: AssistantStreamMessage = {
        type: 'assistant',
        session_id: sessionId,
        message: { role: 'assistant', content: 'test' }
      };
      
      // Broadcasting should detect the ended response and clean it up
      manager.broadcast(sessionId, streamMessage);
      expect(manager.getClientCount(sessionId)).toBe(0);
    });
  });

  describe('closeSession', () => {
    it('should send close event to all clients', () => {
      const sessionId = 'test-session-123';
      const mockResponse2 = createMockResponse();
      
      manager.addClient(sessionId, mockResponse);
      manager.addClient(sessionId, mockResponse2);
      
      manager.closeSession(sessionId);
      
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"closed"')
      );
      expect(mockResponse2.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"closed"')
      );
    });

    it('should end all client connections', () => {
      const sessionId = 'test-session-123';
      const mockResponse2 = createMockResponse();
      
      manager.addClient(sessionId, mockResponse);
      manager.addClient(sessionId, mockResponse2);
      
      manager.closeSession(sessionId);
      
      expect(mockResponse.end).toHaveBeenCalled();
      expect(mockResponse2.end).toHaveBeenCalled();
    });

    it('should remove session from active sessions', () => {
      const sessionId = 'test-session-123';
      
      manager.addClient(sessionId, mockResponse);
      expect(manager.getActiveSessions()).toContain(sessionId);
      
      manager.closeSession(sessionId);
      expect(manager.getActiveSessions()).not.toContain(sessionId);
    });

    it('should handle errors during client close gracefully', () => {
      const sessionId = 'test-session-123';
      
      // Add client first
      manager.addClient(sessionId, mockResponse);
      
      // Then set up the mock to throw error on subsequent writes
      mockResponse.write.mockImplementation(() => {
        throw new Error('Write error');
      });
      
      expect(() => manager.closeSession(sessionId)).not.toThrow();
    });
  });

  describe('getActiveSessions', () => {
    it('should return empty array when no sessions', () => {
      expect(manager.getActiveSessions()).toEqual([]);
    });

    it('should return active session IDs', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';
      
      manager.addClient(session1, mockResponse);
      manager.addClient(session2, createMockResponse());
      
      const sessions = manager.getActiveSessions();
      expect(sessions).toContain(session1);
      expect(sessions).toContain(session2);
      expect(sessions).toHaveLength(2);
    });
  });

  describe('getClientMetadata', () => {
    it('should return empty array when no clients', () => {
      expect(manager.getClientMetadata()).toEqual([]);
    });

    it('should return client metadata with connection times', () => {
      const sessionId = 'test-session-123';
      const beforeConnect = new Date();
      
      manager.addClient(sessionId, mockResponse);
      
      const metadata = manager.getClientMetadata();
      expect(metadata).toHaveLength(1);
      expect(metadata[0].sessionId).toBe(sessionId);
      expect(metadata[0].connectedAt).toBeInstanceOf(Date);
      expect(metadata[0].connectedAt.getTime()).toBeGreaterThanOrEqual(beforeConnect.getTime());
    });
  });

  describe('edge cases', () => {
    it('should handle destroyed response objects', () => {
      const sessionId = 'test-session-123';
      const destroyedResponse = createMockResponse();
      
      // Add client first (this succeeds)
      manager.addClient(sessionId, destroyedResponse);
      expect(manager.getClientCount(sessionId)).toBe(1);
      
      // Now mark it as destroyed
      destroyedResponse.destroyed = true;
      
      const streamMessage: AssistantStreamMessage = {
        type: 'assistant',
        session_id: sessionId,
        message: { role: 'assistant', content: 'test' }
      };
      
      // Broadcasting should detect the destroyed response and clean it up
      manager.broadcast(sessionId, streamMessage);
      expect(manager.getClientCount(sessionId)).toBe(0);
    });

    it('should handle large event payloads', () => {
      const sessionId = 'test-session-123';
      const largeContent = Array(1000).fill(0).map((_, i) => `Line ${i}: This is a very long line with lots of content to make the payload large enough to test streaming capabilities.`).join('\n');
      const largeStreamMessage: AssistantStreamMessage = {
        type: 'assistant',
        session_id: sessionId,
        message: { role: 'assistant', content: largeContent }
      };
      
      manager.addClient(sessionId, mockResponse);
      manager.broadcast(sessionId, largeStreamMessage);
      
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining(largeContent.substring(0, 100))
      );
    });
  });
});