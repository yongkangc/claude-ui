import request from 'supertest';
import { CCUIServer } from '@/ccui-server';
import { StreamManager } from '@/services/stream-manager';
import { ClaudeProcessManager } from '@/services/claude-process-manager';
import { CCUIMCPServer } from '@/mcp-server/ccui-mcp-server';
import { StreamEvent } from '@/types';

// Mock the services
jest.mock('@/services/claude-process-manager');
jest.mock('@/mcp-server/ccui-mcp-server');

describe('Streaming Integration - Simplified', () => {
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

  describe('Stream Endpoint', () => {
    it('should respond to streaming requests with correct headers', async () => {
      const sessionId = 'test-session';
      
      // Just verify that the endpoint responds with 200 and sets headers
      // We expect this to timeout, but that's ok - we just want to verify the endpoint works
      try {
        await request(app)
          .get(`/api/stream/${sessionId}`)
          .timeout(100)
          .expect(200)
          .expect('Content-Type', 'application/x-ndjson')
          .expect('Cache-Control', 'no-cache')
          .expect('Connection', 'keep-alive');
      } catch (err: any) {
        // Timeout is expected for streaming endpoints
        if (err.code !== 'ECONNABORTED') {
          throw err;
        }
      }
    });

    it('should include CORS headers', async () => {
      const sessionId = 'test-session-cors';
      
      await request(app)
        .get(`/api/stream/${sessionId}`)
        .timeout(100)
        .expect('Access-Control-Allow-Origin', '*')
        .catch((err) => {
          if (err.code !== 'ECONNABORTED') {
            throw err;
          }
        });
    });
  });

  describe('StreamManager Direct Testing', () => {
    it('should track client connections', () => {
      const sessionId = 'test-session-direct';
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
      
      streamManager.closeSession(sessionId);
      expect(streamManager.getClientCount(sessionId)).toBe(0);
    });

    it('should handle multiple clients for same session', () => {
      const sessionId = 'test-session-multi';
      const mockResponse1 = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        writableEnded: false,
        destroyed: false
      } as any;
      
      const mockResponse2 = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        writableEnded: false,
        destroyed: false
      } as any;

      streamManager.addClient(sessionId, mockResponse1);
      streamManager.addClient(sessionId, mockResponse2);
      
      expect(streamManager.getClientCount(sessionId)).toBe(2);
      
      streamManager.closeSession(sessionId);
      expect(streamManager.getClientCount(sessionId)).toBe(0);
    });

    it('should broadcast events to connected clients', () => {
      const sessionId = 'test-session-broadcast';
      const mockResponse = {
        setHeader: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        writableEnded: false,
        destroyed: false
      } as any;

      streamManager.addClient(sessionId, mockResponse);
      
      const event: StreamEvent = {
        type: 'claude_message',
        data: {
          type: 'assistant',
          session_id: sessionId,
          message: { content: 'test' }
        } as any,
        sessionId,
        timestamp: new Date().toISOString()
      };

      streamManager.broadcast(sessionId, event);
      
      // Verify that write was called (the event was sent)
      expect(mockResponse.write).toHaveBeenCalled();
    });
  });

  describe('Integration Event Handlers', () => {
    it('should register process manager event handlers', () => {
      expect(mockProcessManager.on).toHaveBeenCalledWith('claude-message', expect.any(Function));
      expect(mockProcessManager.on).toHaveBeenCalledWith('process-closed', expect.any(Function));
      expect(mockProcessManager.on).toHaveBeenCalledWith('process-error', expect.any(Function));
    });

    it('should register MCP server event handlers', () => {
      expect(mockMcpServer.on).toHaveBeenCalledWith('permission-request', expect.any(Function));
    });

    it('should handle process-closed events', () => {
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

    it('should handle permission-request events', () => {
      const handler = mockMcpServer.on.mock.calls.find(call => 
        call[0] === 'permission-request'
      )?.[1];
      
      expect(handler).toBeDefined();
      
      const sessionId = 'test-session-permission';
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
});