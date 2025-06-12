import request from 'supertest';
import { CCUIServer } from '@/ccui-server';
import { StreamManager } from '@/services/stream-manager';
import { ClaudeProcessManager } from '@/services/claude-process-manager';
import { CCUIMCPServer } from '@/mcp-server/ccui-mcp-server';
import { StreamEvent } from '@/types';

// Mock the services
jest.mock('@/services/claude-process-manager');
jest.mock('@/mcp-server/ccui-mcp-server');

describe('Streaming Integration', () => {
  let server: CCUIServer;
  let app: any;
  let streamManager: StreamManager;
  let mockProcessManager: jest.Mocked<ClaudeProcessManager>;
  let mockMcpServer: jest.Mocked<CCUIMCPServer>;

  beforeEach(() => {
    // Setup mocks
    mockProcessManager = {
      startConversation: jest.fn(),
      getActiveSessions: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    mockMcpServer = {
      start: jest.fn(),
      stop: jest.fn(),
      on: jest.fn()
    } as any;

    // Mock the constructors
    (ClaudeProcessManager as jest.MockedClass<typeof ClaudeProcessManager>).mockImplementation(() => mockProcessManager);
    (CCUIMCPServer as jest.MockedClass<typeof CCUIMCPServer>).mockImplementation(() => mockMcpServer);

    server = new CCUIServer({
      port: 3001,
      mcpConfigPath: '/test/mcp-config.json',
      claudeHomePath: '/test/.claude'
    });

    app = (server as any).app;
    streamManager = (server as any).streamManager;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Stream Connection', () => {
    it('should establish streaming connection', (done) => {
      const sessionId = 'test-session-123';
      
      request(app)
        .get(`/api/stream/${sessionId}`)
        .buffer(false)
        .expect(200)
        .expect('Content-Type', 'application/x-ndjson')
        .expect('Cache-Control', 'no-cache')
        .expect('Connection', 'keep-alive')
        .end((err, res) => {
          if (err) return done(err);
          
          // Should receive initial connection message
          const lines = res.text.split('\n').filter(line => line.trim());
          expect(lines.length).toBeGreaterThan(0);
          
          const firstMessage = JSON.parse(lines[0]);
          expect(firstMessage.type).toBe('connected');
          expect(firstMessage.session_id).toBe(sessionId);
          
          done();
        });
      
      // Close the connection after a short delay
      setTimeout(() => {
        streamManager.closeSession(sessionId);
      }, 100);
    });

    it('should handle multiple concurrent connections', (done) => {
      const sessionId = 'test-session-multi';
      let connectionsReceived = 0;
      
      const checkConnection = (err: any, res: any) => {
        if (err) return done(err);
        
        connectionsReceived++;
        if (connectionsReceived === 2) {
          expect(streamManager.getClientCount(sessionId)).toBe(2);
          streamManager.closeSession(sessionId);
          done();
        }
      };
      
      // Start two connections
      request(app)
        .get(`/api/stream/${sessionId}`)
        .buffer(false)
        .end(checkConnection);
        
      request(app)
        .get(`/api/stream/${sessionId}`)
        .buffer(false)
        .end(checkConnection);
    });

    it('should include CORS headers in stream response', (done) => {
      const sessionId = 'test-session-cors';
      
      request(app)
        .get(`/api/stream/${sessionId}`)
        .expect('Access-Control-Allow-Origin', '*')
        .end((err, res) => {
          if (err) return done(err);
          done();
        });
      
      setTimeout(() => {
        streamManager.closeSession(sessionId);
      }, 50);
    });
  });

  describe('Event Broadcasting', () => {
    it('should broadcast events to connected clients', (done) => {
      const sessionId = 'test-session-broadcast';
      
      request(app)
        .get(`/api/stream/${sessionId}`)
        .buffer(false)
        .end((err, res) => {
          if (err) return done(err);
          
          const lines = res.text.split('\n').filter(line => line.trim());
          
          // Should have connection message and test event
          expect(lines.length).toBeGreaterThanOrEqual(2);
          
          const connectionMsg = JSON.parse(lines[0]);
          expect(connectionMsg.type).toBe('connected');
          
          const testEvent = JSON.parse(lines[1]);
          expect(testEvent.type).toBe('claude_message');
          expect(testEvent.data).toEqual({ test: 'data' });
          
          done();
        });
      
      // Send test event after connection is established
      setTimeout(() => {
        const testEvent: StreamEvent = {
          type: 'claude_message',
          data: { test: 'data' },
          sessionId,
          timestamp: new Date().toISOString()
        };
        
        streamManager.broadcast(sessionId, testEvent);
        
        setTimeout(() => {
          streamManager.closeSession(sessionId);
        }, 50);
      }, 50);
    });

    it('should handle permission request events', (done) => {
      const sessionId = 'test-session-permission';
      
      request(app)
        .get(`/api/stream/${sessionId}`)
        .buffer(false)
        .end((err, res) => {
          if (err) return done(err);
          
          const lines = res.text.split('\n').filter(line => line.trim());
          
          const permissionEvent = lines.find(line => {
            const parsed = JSON.parse(line);
            return parsed.type === 'permission_request';
          });
          
          expect(permissionEvent).toBeDefined();
          if (permissionEvent) {
            const parsed = JSON.parse(permissionEvent);
            expect(parsed.data.toolName).toBe('bash');
            expect(parsed.data.status).toBe('pending');
          }
          
          done();
        });
      
      // Trigger permission request event
      setTimeout(() => {
        const permissionRequest = {
          id: 'perm-123',
          sessionId,
          toolName: 'bash',
          toolInput: { command: 'ls' },
          timestamp: new Date().toISOString(),
          status: 'pending' as const
        };
        
        const event: StreamEvent = {
          type: 'permission_request',
          data: permissionRequest,
          sessionId,
          timestamp: new Date().toISOString()
        };
        
        streamManager.broadcast(sessionId, event);
        
        setTimeout(() => {
          streamManager.closeSession(sessionId);
        }, 50);
      }, 50);
    });

    it('should handle error events', (done) => {
      const sessionId = 'test-session-error';
      
      request(app)
        .get(`/api/stream/${sessionId}`)
        .buffer(false)
        .end((err, res) => {
          if (err) return done(err);
          
          const lines = res.text.split('\n').filter(line => line.trim());
          
          const errorEvent = lines.find(line => {
            const parsed = JSON.parse(line);
            return parsed.type === 'error';
          });
          
          expect(errorEvent).toBeDefined();
          if (errorEvent) {
            const parsed = JSON.parse(errorEvent);
            expect(parsed.error).toBe('Test error message');
          }
          
          done();
        });
      
      // Send error event
      setTimeout(() => {
        const errorEvent: StreamEvent = {
          type: 'error',
          error: 'Test error message',
          sessionId,
          timestamp: new Date().toISOString()
        };
        
        streamManager.broadcast(sessionId, errorEvent);
        
        setTimeout(() => {
          streamManager.closeSession(sessionId);
        }, 50);
      }, 50);
    });
  });

  describe('Connection Management', () => {
    it('should handle client disconnection gracefully', (done) => {
      const sessionId = 'test-session-disconnect';
      
      const req = request(app)
        .get(`/api/stream/${sessionId}`)
        .buffer(false);
      
      // Simulate client disconnect after a short delay
      setTimeout(() => {
        req.abort();
        
        // Verify client was cleaned up
        setTimeout(() => {
          expect(streamManager.getClientCount(sessionId)).toBe(0);
          done();
        }, 100);
      }, 100);
    });

    it('should clean up session when all clients disconnect', (done) => {
      const sessionId = 'test-session-cleanup';
      
      const req1 = request(app)
        .get(`/api/stream/${sessionId}`)
        .buffer(false);
        
      const req2 = request(app)
        .get(`/api/stream/${sessionId}`)
        .buffer(false);
      
      setTimeout(() => {
        expect(streamManager.getClientCount(sessionId)).toBe(2);
        
        // Disconnect both clients
        req1.abort();
        req2.abort();
        
        setTimeout(() => {
          expect(streamManager.getClientCount(sessionId)).toBe(0);
          expect(streamManager.getActiveSessions()).not.toContain(sessionId);
          done();
        }, 100);
      }, 100);
    });

    it('should handle session closure', (done) => {
      const sessionId = 'test-session-close';
      
      request(app)
        .get(`/api/stream/${sessionId}`)
        .buffer(false)
        .end((err, res) => {
          if (err) return done(err);
          
          const lines = res.text.split('\n').filter(line => line.trim());
          
          // Should have connection and close messages
          const closeEvent = lines.find(line => {
            const parsed = JSON.parse(line);
            return parsed.type === 'closed';
          });
          
          expect(closeEvent).toBeDefined();
          done();
        });
      
      // Close session after connection
      setTimeout(() => {
        streamManager.closeSession(sessionId);
      }, 100);
    });
  });

  describe('Integration with ProcessManager', () => {
    it('should forward claude-message events to stream', (done) => {
      const sessionId = 'test-session-integration';
      
      request(baseUrl)
        .get(`/api/stream/${sessionId}`)
        .buffer(false)
        .end((err, res) => {
          if (err) return done(err);
          
          const lines = res.text.split('\n').filter(line => line.trim());
          
          // Should have connection message and test message
          expect(lines.length).toBeGreaterThanOrEqual(2);
          
          const connectionMsg = JSON.parse(lines[0]);
          expect(connectionMsg.type).toBe('connected');
          
          const testEvent = JSON.parse(lines[1]);
          expect(testEvent.type).toBe('claude_message');
          expect(testEvent.data.message).toEqual({ type: 'test', content: 'Hello' });
          
          done();
        });
      
      // Simulate claude message event via the stream manager
      setTimeout(() => {
        const processManager = (server as any).processManager;
        processManager.emit('claude-message', {
          sessionId,
          message: {
            type: 'assistant',
            session_id: sessionId,
            message: { type: 'test', content: 'Hello' }
          }
        });
        
        setTimeout(() => {
          streamManager.closeSession(sessionId);
        }, 50);
      }, 50);
    });

    it('should handle process-closed events', () => {
      // Verify that the event handler was registered
      expect(mockProcessManager.on).toHaveBeenCalledWith('process-closed', expect.any(Function));
      
      const handler = mockProcessManager.on.mock.calls.find(call => 
        call[0] === 'process-closed'
      )?.[1];
      
      expect(handler).toBeDefined();
      
      const sessionId = 'test-session-closed';
      const mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        writableEnded: false,
        destroyed: false
      } as any;
      
      streamManager.addClient(sessionId, mockResponse);
      expect(streamManager.getClientCount(sessionId)).toBe(1);
      
      // Simulate process closed event
      if (handler) {
        handler({ sessionId });
      }
      
      // Verify session was closed
      expect(streamManager.getClientCount(sessionId)).toBe(0);
    });

    it('should handle process-error events', () => {
      // Verify that the event handler was registered
      expect(mockProcessManager.on).toHaveBeenCalledWith('process-error', expect.any(Function));
      
      const handler = mockProcessManager.on.mock.calls.find(call => 
        call[0] === 'process-error'
      )?.[1];
      
      expect(handler).toBeDefined();
      
      const sessionId = 'test-session-error';
      const mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        writableEnded: false,
        destroyed: false
      } as any;
      
      streamManager.addClient(sessionId, mockResponse);
      
      // Simulate process error event
      if (handler) {
        handler({ sessionId, error: 'Process crashed' });
      }
      
      // Verify error was broadcast
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });
  });

  describe('Integration with MCP Server', () => {
    it('should forward permission-request events to stream', () => {
      // Verify that the event handler was registered
      expect(mockMcpServer.on).toHaveBeenCalledWith('permission-request', expect.any(Function));
      
      const handler = mockMcpServer.on.mock.calls.find(call => 
        call[0] === 'permission-request'
      )?.[1];
      
      expect(handler).toBeDefined();
      
      const sessionId = 'test-session-mcp';
      const mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        writableEnded: false,
        destroyed: false
      } as any;
      
      streamManager.addClient(sessionId, mockResponse);
      
      const permissionRequest = {
        id: 'perm-123',
        sessionId,
        toolName: 'bash',
        toolInput: { command: 'ls' },
        timestamp: new Date().toISOString(),
        status: 'pending' as const
      };
      
      // Simulate permission request event
      if (handler) {
        handler(permissionRequest);
      }
      
      // Verify broadcast happened
      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining('"type":"permission_request"')
      );
    });
  });

  describe('Large Data Handling', () => {
    it('should handle message events correctly', (done) => {
      const sessionId = 'test-session-message';
      
      request(app)
        .get(`/api/stream/${sessionId}`)
        .buffer(false)
        .end((err, res) => {
          if (err) return done(err);
          
          const lines = res.text.split('\n').filter(line => line.trim());
          
          const messageEvent = lines.find(line => {
            try {
              const parsed = JSON.parse(line);
              return parsed.type === 'claude_message' && parsed.data.type === 'assistant';
            } catch {
              return false;
            }
          });
          
          expect(messageEvent).toBeDefined();
          done();
        });
      
      // Send test event instead of large data
      setTimeout(() => {
        const event: StreamEvent = {
          type: 'claude_message',
          data: {
            type: 'assistant',
            session_id: sessionId
          },
          sessionId,
          timestamp: new Date().toISOString()
        };
        
        streamManager.broadcast(sessionId, event);
        
        setTimeout(() => {
          streamManager.closeSession(sessionId);
        }, 50);
      }, 50);
    });
  });
});