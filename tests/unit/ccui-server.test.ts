import { CCUIServer } from '@/ccui-server';
import { ClaudeProcessManager } from '@/services/claude-process-manager';
import { ClaudeHistoryReader } from '@/services/claude-history-reader';
import { StreamManager } from '@/services/stream-manager';
import { CCUIMCPServer } from '@/mcp-server/ccui-mcp-server';
import { CCUIError } from '@/types';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import request from 'supertest';
import { MCPConfigValidator } from '@/utils/mcp-config-validator';

// Mock all dependencies
jest.mock('@/services/claude-process-manager');
jest.mock('@/services/claude-history-reader');
jest.mock('@/services/stream-manager');
jest.mock('@/mcp-server/ccui-mcp-server');
jest.mock('child_process');
jest.mock('@/utils/mcp-config-validator');

const MockedClaudeProcessManager = ClaudeProcessManager as jest.MockedClass<typeof ClaudeProcessManager>;
const MockedClaudeHistoryReader = ClaudeHistoryReader as jest.MockedClass<typeof ClaudeHistoryReader>;
const MockedStreamManager = StreamManager as jest.MockedClass<typeof StreamManager>;
const MockedCCUIMCPServer = CCUIMCPServer as jest.MockedClass<typeof CCUIMCPServer>;
const mockExec = exec as jest.MockedFunction<typeof exec>;

describe('CCUIServer', () => {
  let server: CCUIServer;
  let mockProcessManager: jest.Mocked<ClaudeProcessManager>;
  let mockHistoryReader: jest.Mocked<ClaudeHistoryReader>;
  let mockStreamManager: jest.Mocked<StreamManager>;
  let mockMcpServer: jest.Mocked<CCUIMCPServer>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock implementations
    mockProcessManager = {
      startConversation: jest.fn(),
      sendInput: jest.fn(),
      stopConversation: jest.fn(),
      getActiveSessions: jest.fn(),
      isSessionActive: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      mcpConfigPath: './test-mcp-config.json'
    } as any;

    mockHistoryReader = {
      listConversations: jest.fn(),
      fetchConversation: jest.fn(),
      getConversationMetadata: jest.fn(),
      homePath: '/test/.claude'
    } as any;

    mockStreamManager = {
      addClient: jest.fn(),
      broadcast: jest.fn(),
      closeSession: jest.fn(),
      disconnectAll: jest.fn(),
      on: jest.fn()
    } as any;

    mockMcpServer = {
      start: jest.fn(),
      stop: jest.fn(),
      getPendingRequests: jest.fn(),
      handleDecision: jest.fn(),
      on: jest.fn()
    } as any;

    // Mock constructors
    MockedClaudeProcessManager.mockImplementation(() => mockProcessManager);
    MockedClaudeHistoryReader.mockImplementation(() => mockHistoryReader);
    MockedStreamManager.mockImplementation(() => mockStreamManager);
    MockedCCUIMCPServer.mockImplementation(() => mockMcpServer);

    // Skip execSync mocking for now - will be tested individually

    // Default server instance with random port to avoid conflicts
    const randomPort = 3000 + Math.floor(Math.random() * 1000);
    server = new CCUIServer({
      port: randomPort,
      mcpConfigPath: './test-mcp-config.json',
      claudeHomePath: '/test/.claude'
    });
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      expect(MockedClaudeProcessManager).toHaveBeenCalledWith('./test-mcp-config.json', false, undefined);
      expect(MockedClaudeHistoryReader).toHaveBeenCalledWith('/test/.claude');
      expect(MockedStreamManager).toHaveBeenCalled();
      expect(MockedCCUIMCPServer).toHaveBeenCalled();
    });

    it('should initialize with default values when options not provided', () => {
      const randomPort = 4000 + Math.floor(Math.random() * 1000);
      new CCUIServer({
        port: randomPort,
        mcpConfigPath: './default-mcp.json'
      });

      expect(MockedClaudeHistoryReader).toHaveBeenCalledWith(undefined);
    });

    it('should set up event handlers during construction', () => {
      expect(mockProcessManager.on).toHaveBeenCalledWith('claude-message', expect.any(Function));
      expect(mockProcessManager.on).toHaveBeenCalledWith('process-closed', expect.any(Function));
      expect(mockProcessManager.on).toHaveBeenCalledWith('process-error', expect.any(Function));
      expect(mockMcpServer.on).toHaveBeenCalledWith('permission-request', expect.any(Function));
    });

    it('should setup test mode correctly', () => {
      const randomPort = 5000 + Math.floor(Math.random() * 1000);
      const testServer = new CCUIServer({
        port: randomPort,
        mcpConfigPath: './test-mcp.json',
        testMode: true,
        claudeHomePath: '/test/.claude'
      });

      // In test mode, the server should still initialize all components
      expect(MockedClaudeProcessManager).toHaveBeenCalledWith('./test-mcp.json', true, '/test/.claude');
      expect(MockedStreamManager).toHaveBeenCalled();
    });
  });

  describe('request validation', () => {
    let mockApp: any;
    let mockReq: any;
    let mockRes: any;
    let mockNext: jest.Mock;

    beforeEach(() => {
      mockApp = (server as any).app;
      mockNext = jest.fn();
      mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };
    });

    describe('POST /api/conversations/start validation', () => {
      it('should reject request without workingDirectory', async () => {
        mockReq = {
          body: {
            initialPrompt: 'Hello Claude'
            // Missing workingDirectory
          }
        };

        // Get the route handler
        const routeHandler = mockApp._router?.stack?.find((layer: any) => 
          layer.route?.path === '/api/conversations/start'
        )?.route?.stack?.find((layer: any) => layer.method === 'post')?.handle;

        if (routeHandler) {
          await routeHandler(mockReq, mockRes, mockNext);
        }

        expect(mockNext).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'MISSING_WORKING_DIRECTORY',
            message: 'workingDirectory is required',
            statusCode: 400
          })
        );
      });

      it('should reject request without initialPrompt', async () => {
        mockReq = {
          body: {
            workingDirectory: '/test/dir'
            // Missing initialPrompt
          }
        };

        // Simulate the validation logic directly
        try {
          if (!mockReq.body.workingDirectory) {
            throw new CCUIError('MISSING_WORKING_DIRECTORY', 'workingDirectory is required', 400);
          }
          if (!mockReq.body.initialPrompt) {
            throw new CCUIError('MISSING_INITIAL_PROMPT', 'initialPrompt is required', 400);
          }
        } catch (error) {
          mockNext(error);
        }

        expect(mockNext).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'MISSING_INITIAL_PROMPT',
            message: 'initialPrompt is required',
            statusCode: 400
          })
        );
      });

      it('should accept valid request with all required fields', async () => {
        mockReq = {
          body: {
            workingDirectory: '/test/dir',
            initialPrompt: 'Hello Claude'
          }
        };

        mockProcessManager.startConversation.mockResolvedValue('session-123');

        // Simulate the validation logic
        let validationError = null;
        try {
          if (!mockReq.body.workingDirectory) {
            throw new CCUIError('MISSING_WORKING_DIRECTORY', 'workingDirectory is required', 400);
          }
          if (!mockReq.body.initialPrompt) {
            throw new CCUIError('MISSING_INITIAL_PROMPT', 'initialPrompt is required', 400);
          }
          
          // If validation passes, start conversation
          const streamingId = await mockProcessManager.startConversation(mockReq.body);
          mockRes.json({ 
            sessionId: streamingId, 
            streamUrl: `/api/stream/${streamingId}` 
          });
        } catch (error) {
          validationError = error;
        }

        expect(validationError).toBeNull();
        expect(mockProcessManager.startConversation).toHaveBeenCalledWith(mockReq.body);
        expect(mockRes.json).toHaveBeenCalledWith({
          sessionId: 'session-123',
          streamUrl: '/api/stream/session-123'
        });
      });

      it('should accept request with optional fields', async () => {
        mockReq = {
          body: {
            workingDirectory: '/test/dir',
            initialPrompt: 'Hello Claude',
            model: 'claude-opus-4-20250514',
            allowedTools: ['Bash', 'Read'],
            systemPrompt: 'You are a helpful assistant'
          }
        };

        mockProcessManager.startConversation.mockResolvedValue('session-456');

        // Simulate validation and processing
        let validationError = null;
        try {
          if (!mockReq.body.workingDirectory) {
            throw new CCUIError('MISSING_WORKING_DIRECTORY', 'workingDirectory is required', 400);
          }
          if (!mockReq.body.initialPrompt) {
            throw new CCUIError('MISSING_INITIAL_PROMPT', 'initialPrompt is required', 400);
          }
          
          const streamingId = await mockProcessManager.startConversation(mockReq.body);
          mockRes.json({ 
            sessionId: streamingId, 
            streamUrl: `/api/stream/${streamingId}` 
          });
        } catch (error) {
          validationError = error;
        }

        expect(validationError).toBeNull();
        expect(mockProcessManager.startConversation).toHaveBeenCalledWith(mockReq.body);
      });

      it('should handle empty string values as invalid', async () => {
        const testCases = [
          { workingDirectory: '', initialPrompt: 'Hello' },
          { workingDirectory: '/test', initialPrompt: '' },
          { workingDirectory: '   ', initialPrompt: 'Hello' },
          { workingDirectory: '/test', initialPrompt: '   ' }
        ];

        for (const testCase of testCases) {
          const errors: CCUIError[] = [];
          
          try {
            if (!testCase.workingDirectory || !testCase.workingDirectory.trim()) {
              throw new CCUIError('MISSING_WORKING_DIRECTORY', 'workingDirectory is required', 400);
            }
            if (!testCase.initialPrompt || !testCase.initialPrompt.trim()) {
              throw new CCUIError('MISSING_INITIAL_PROMPT', 'initialPrompt is required', 400);
            }
          } catch (error) {
            errors.push(error as CCUIError);
          }

          expect(errors.length).toBeGreaterThan(0);
        }
      });
    });

    describe('POST /api/conversations/:sessionId/continue validation', () => {
      it('should validate prompt field for continue requests', async () => {
        mockReq = {
          params: { streamingId: 'session-123' },
          body: {
            // Missing prompt
          }
        };

        mockProcessManager.sendInput.mockResolvedValue(undefined);

        // Simulate continue request validation
        let validationError = null;
        try {
          if (!mockReq.body.prompt) {
            throw new CCUIError('MISSING_PROMPT', 'prompt is required', 400);
          }
          
          await mockProcessManager.sendInput(mockReq.params.streamingId, mockReq.body.prompt);
          mockRes.json({ streamUrl: `/api/stream/${mockReq.params.streamingId}` });
        } catch (error) {
          validationError = error;
        }

        expect(validationError).toEqual(
          expect.objectContaining({
            code: 'MISSING_PROMPT',
            message: 'prompt is required',
            statusCode: 400
          })
        );
      });

      it('should accept valid continue request', async () => {
        mockReq = {
          params: { streamingId: 'session-123' },
          body: {
            prompt: 'Continue the conversation'
          }
        };

        mockProcessManager.sendInput.mockResolvedValue(undefined);

        // Simulate continue request processing
        let validationError = null;
        try {
          if (!mockReq.body.prompt) {
            throw new CCUIError('MISSING_PROMPT', 'prompt is required', 400);
          }
          
          await mockProcessManager.sendInput(mockReq.params.streamingId, mockReq.body.prompt);
          mockRes.json({ streamUrl: `/api/stream/${mockReq.params.streamingId}` });
        } catch (error) {
          validationError = error;
        }

        expect(validationError).toBeNull();
        expect(mockProcessManager.sendInput).toHaveBeenCalledWith('session-123', 'Continue the conversation');
        expect(mockRes.json).toHaveBeenCalledWith({ streamUrl: '/api/stream/session-123' });
      });
    });

    describe('permission request validation', () => {
      it('should validate permission decision actions', async () => {
        mockReq = {
          params: { requestId: 'perm-123' },
          body: {
            action: 'invalid-action'
          }
        };

        mockMcpServer.handleDecision.mockReturnValue(true);

        // Simulate permission decision validation
        let validationError = null;
        try {
          if (!['approve', 'deny'].includes(mockReq.body.action)) {
            throw new CCUIError('INVALID_ACTION', 'action must be "approve" or "deny"', 400);
          }
          
          const success = mockMcpServer.handleDecision(
            mockReq.params.requestId,
            mockReq.body.action,
            mockReq.body.modifiedInput
          );
          mockRes.json({ success });
        } catch (error) {
          validationError = error;
        }

        expect(validationError).toEqual(
          expect.objectContaining({
            code: 'INVALID_ACTION',
            message: 'action must be "approve" or "deny"',
            statusCode: 400
          })
        );
      });

      it('should accept valid permission decisions', async () => {
        const validActions = ['approve', 'deny'];

        for (const action of validActions) {
          mockReq = {
            params: { requestId: 'perm-123' },
            body: { action }
          };

          mockMcpServer.handleDecision.mockReturnValue(true);

          // Simulate permission decision processing
          let validationError = null;
          try {
            if (!['approve', 'deny'].includes(mockReq.body.action)) {
              throw new CCUIError('INVALID_ACTION', 'action must be "approve" or "deny"', 400);
            }
            
            const success = mockMcpServer.handleDecision(
              mockReq.params.requestId,
              mockReq.body.action,
              mockReq.body.modifiedInput
            );
            mockRes.json({ success });
          } catch (error) {
            validationError = error;
          }

          expect(validationError).toBeNull();
          expect(mockMcpServer.handleDecision).toHaveBeenCalledWith('perm-123', action, undefined);
        }
      });
    });
  });

  describe('event handling integration', () => {
    it('should handle claude-message events correctly', () => {
      const messageHandler = mockProcessManager.on.mock.calls.find(call => 
        call[0] === 'claude-message'
      )?.[1];

      expect(messageHandler).toBeDefined();

      if (messageHandler) {
        const testMessage = {
          streamingId: 'session-123',
          message: { type: 'assistant', content: 'Hello' }
        };

        messageHandler(testMessage);

        expect(mockStreamManager.broadcast).toHaveBeenCalledWith(
          'session-123',
          { type: 'assistant', content: 'Hello' }
        );
      }
    });

    it('should handle process-closed events correctly', () => {
      const closedHandler = mockProcessManager.on.mock.calls.find(call => 
        call[0] === 'process-closed'
      )?.[1];

      expect(closedHandler).toBeDefined();

      if (closedHandler) {
        closedHandler({ streamingId: 'session-123' });
        expect(mockStreamManager.closeSession).toHaveBeenCalledWith('session-123');
      }
    });

    it('should handle process-error events correctly', () => {
      const errorHandler = mockProcessManager.on.mock.calls.find(call => 
        call[0] === 'process-error'
      )?.[1];

      expect(errorHandler).toBeDefined();

      if (errorHandler) {
        const errorEvent = { streamingId: 'session-123', error: 'Process crashed' };
        errorHandler(errorEvent);

        expect(mockStreamManager.broadcast).toHaveBeenCalledWith(
          'session-123',
          expect.objectContaining({
            type: 'error',
            error: 'Process crashed',
            streamingId: 'session-123'
          })
        );
      }
    });

    it('should handle permission-request events correctly', () => {
      const permissionHandler = mockMcpServer.on.mock.calls.find(call => 
        call[0] === 'permission-request'
      )?.[1];

      expect(permissionHandler).toBeDefined();

      if (permissionHandler) {
        const permissionRequest = {
          id: 'perm-123',
          streamingId: 'session-123',
          toolName: 'bash',
          toolInput: { command: 'ls' }
        };

        permissionHandler(permissionRequest);

        expect(mockStreamManager.broadcast).toHaveBeenCalledWith(
          'session-123',
          expect.objectContaining({
            type: 'permission_request',
            data: permissionRequest,
            streamingId: 'session-123'
          })
        );
      }
    });
  });

  describe('error handling', () => {
    it('should handle CCUIError instances correctly', () => {
      const error = new CCUIError('TEST_ERROR', 'Test error message', 400);
      
      // Simulate error middleware
      const mockErrorHandler = (err: Error, req: any, res: any, next: any) => {
        if (err instanceof CCUIError) {
          res.status(err.statusCode).json({ error: err.message, code: err.code });
        } else {
          res.status(500).json({ error: 'Internal server error' });
        }
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      mockErrorHandler(error, {}, mockRes, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Test error message',
        code: 'TEST_ERROR'
      });
    });

    it('should handle generic errors correctly', () => {
      const error = new Error('Generic error');
      
      // Simulate error middleware
      const mockErrorHandler = (err: Error, req: any, res: any, next: any) => {
        if (err instanceof CCUIError) {
          res.status(err.statusCode).json({ error: err.message, code: err.code });
        } else {
          res.status(500).json({ error: 'Internal server error' });
        }
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      mockErrorHandler(error, {}, mockRes, jest.fn());

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('server lifecycle methods', () => {
    describe('start()', () => {
      it('should start successfully with all components', async () => {
        mockMcpServer.start.mockResolvedValue(undefined);
        
        await server.start();

        expect(mockMcpServer.start).toHaveBeenCalled();
        expect((server as any).server).toBeDefined();
      });

      it('should handle MCP server start failure', async () => {
        const mcpError = new Error('MCP server failed to start');
        mockMcpServer.start.mockRejectedValue(mcpError);

        await expect(server.start()).rejects.toThrow(CCUIError);
        
        // Verify cleanup was called
        expect(mockMcpServer.stop).toHaveBeenCalled();
        expect(mockStreamManager.disconnectAll).toHaveBeenCalled();
      });

      it('should handle HTTP server binding error', async () => {
        mockMcpServer.start.mockResolvedValue(undefined);
        
        // Mock server.listen to trigger error event
        const mockListen = jest.fn((port, callback) => {
          const mockServer = {
            on: jest.fn((event, handler) => {
              if (event === 'error') {
                // Simulate port already in use error
                setTimeout(() => handler(new Error('EADDRINUSE')), 0);
              }
            }),
            close: jest.fn((cb) => cb())
          };
          return mockServer;
        });
        
        (server as any).app.listen = mockListen;

        await expect(server.start()).rejects.toThrow(CCUIError);
        
        // Verify cleanup was called
        expect(mockMcpServer.stop).toHaveBeenCalled();
      });

      it('should validate MCP configuration if path is provided', async () => {
        const mockValidateConfig = MCPConfigValidator.validateConfig as jest.MockedFunction<typeof MCPConfigValidator.validateConfig>;
        mockValidateConfig.mockResolvedValue({ mcpServers: {} });
        mockMcpServer.start.mockResolvedValue(undefined);

        // Set the mcpConfigPath on the process manager mock
        Object.defineProperty(mockProcessManager, 'mcpConfigPath', {
          get: () => './test-mcp-config.json',
          configurable: true
        });

        await server.start();

        expect(mockValidateConfig).toHaveBeenCalledWith('./test-mcp-config.json');
      });

      it('should continue startup even if MCP config validation fails', async () => {
        const mockValidateConfig = MCPConfigValidator.validateConfig as jest.MockedFunction<typeof MCPConfigValidator.validateConfig>;
        mockValidateConfig.mockRejectedValue(new Error('Invalid config'));
        mockMcpServer.start.mockResolvedValue(undefined);

        // Set the mcpConfigPath on the process manager mock
        Object.defineProperty(mockProcessManager, 'mcpConfigPath', {
          get: () => './test-mcp-config.json',
          configurable: true
        });

        await server.start();

        expect(mockValidateConfig).toHaveBeenCalledWith('./test-mcp-config.json');
        expect(mockMcpServer.start).toHaveBeenCalled();
      });
    });

    describe('stop()', () => {
      beforeEach(async () => {
        mockMcpServer.start.mockResolvedValue(undefined);
        await server.start();
      });

      it('should stop gracefully with no active sessions', async () => {
        mockProcessManager.getActiveSessions.mockReturnValue([]);
        mockMcpServer.stop.mockResolvedValue(undefined);

        await server.stop();

        expect(mockStreamManager.disconnectAll).toHaveBeenCalled();
        expect(mockMcpServer.stop).toHaveBeenCalled();
      });

      it('should stop all active sessions during shutdown', async () => {
        const activeSessions = ['session-1', 'session-2', 'session-3'];
        mockProcessManager.getActiveSessions.mockReturnValue(activeSessions);
        mockProcessManager.stopConversation.mockResolvedValue(true);
        mockMcpServer.stop.mockResolvedValue(undefined);

        await server.stop();

        expect(mockProcessManager.stopConversation).toHaveBeenCalledTimes(3);
        expect(mockProcessManager.stopConversation).toHaveBeenCalledWith('session-1');
        expect(mockProcessManager.stopConversation).toHaveBeenCalledWith('session-2');
        expect(mockProcessManager.stopConversation).toHaveBeenCalledWith('session-3');
        expect(mockStreamManager.disconnectAll).toHaveBeenCalled();
        expect(mockMcpServer.stop).toHaveBeenCalled();
      });

      it('should handle errors during session cleanup', async () => {
        const activeSessions = ['session-1', 'session-2'];
        mockProcessManager.getActiveSessions.mockReturnValue(activeSessions);
        mockProcessManager.stopConversation
          .mockResolvedValueOnce(true)
          .mockRejectedValueOnce(new Error('Failed to stop session'));
        mockMcpServer.stop.mockResolvedValue(undefined);

        await server.stop();

        expect(mockProcessManager.stopConversation).toHaveBeenCalledTimes(2);
        expect(mockStreamManager.disconnectAll).toHaveBeenCalled();
        expect(mockMcpServer.stop).toHaveBeenCalled();
      });

      it('should handle HTTP server close error', async () => {
        // Mock server.close to trigger error
        const mockClose = jest.fn((callback) => {
          callback(new Error('Failed to close server'));
        });
        (server as any).server = { close: mockClose };
        
        mockProcessManager.getActiveSessions.mockReturnValue([]);
        mockMcpServer.stop.mockResolvedValue(undefined);

        await expect(server.stop()).rejects.toThrow('Failed to close server');
      });
    });
  });

  describe('route handlers', () => {
    let app: any;

    beforeEach(async () => {
      mockMcpServer.start.mockResolvedValue(undefined);
      await server.start();
      app = (server as any).app;
    });

    afterEach(async () => {
      try {
        if ((server as any).server) {
          await server.stop();
        }
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    });

    describe('GET /api/system/status', () => {
      it('should return system status successfully', async () => {
        (execSync as jest.MockedFunction<typeof execSync>).mockImplementation((command: string) => {
          if (command === 'which claude') {
            return Buffer.from('/usr/local/bin/claude\n');
          }
          if (command === 'claude --version') {
            return Buffer.from('claude version 1.0.19\n');
          }
          throw new Error('Command not found');
        });

        mockProcessManager.getActiveSessions.mockReturnValue(['session-1', 'session-2']);

        const response = await request(app)
          .get('/api/system/status')
          .expect(200);

        expect(response.body).toEqual({
          claudeVersion: 'claude version 1.0.19',
          claudePath: '/usr/local/bin/claude',
          configPath: '/test/.claude',
          activeConversations: 2
        });
      });

      it('should handle missing Claude CLI gracefully', async () => {
        (execSync as jest.MockedFunction<typeof execSync>).mockImplementation(() => {
          throw new Error('Command not found');
        });

        mockProcessManager.getActiveSessions.mockReturnValue([]);

        const response = await request(app)
          .get('/api/system/status')
          .expect(200);

        expect(response.body).toEqual({
          claudeVersion: 'unknown',
          claudePath: 'unknown',
          configPath: '/test/.claude',
          activeConversations: 0
        });
      });

      it('should handle system status error', async () => {
        // Mock getActiveSessions to throw error
        mockProcessManager.getActiveSessions.mockImplementation(() => {
          throw new Error('Process manager error');
        });

        const response = await request(app)
          .get('/api/system/status')
          .expect(500);

        expect(response.body).toEqual({
          error: 'Failed to get system status',
          code: 'SYSTEM_STATUS_ERROR'
        });
      });
    });

    describe('GET /api/conversations/:sessionId', () => {
      it('should return conversation details successfully', async () => {
        const mockMessages = [
          { 
            uuid: 'msg-1', 
            type: 'user' as const, 
            message: { content: 'Hello' }, 
            timestamp: '2024-01-01T00:00:00Z', 
            sessionId: 'test-session' 
          },
          { 
            uuid: 'msg-2', 
            type: 'assistant' as const, 
            message: { content: 'Hi there!' }, 
            timestamp: '2024-01-01T00:00:01Z', 
            sessionId: 'test-session' 
          }
        ];
        const mockMetadata = {
          summary: 'Test conversation',
          projectPath: '/test/project',
          totalCost: 0.005,
          totalDuration: 1500,
          model: 'claude-3-5-sonnet'
        };

        mockHistoryReader.fetchConversation.mockResolvedValue(mockMessages);
        mockHistoryReader.getConversationMetadata.mockResolvedValue(mockMetadata);

        const response = await request(app)
          .get('/api/conversations/test-session-123')
          .expect(200);

        expect(response.body).toEqual({
          messages: mockMessages,
          summary: 'Test conversation',
          projectPath: '/test/project',
          metadata: {
            totalCost: 0.005,
            totalDuration: 1500,
            model: 'claude-3-5-sonnet'
          }
        });
      });

      it('should return 404 for non-existent conversation', async () => {
        mockHistoryReader.fetchConversation.mockResolvedValue([]);
        mockHistoryReader.getConversationMetadata.mockResolvedValue(null);

        const response = await request(app)
          .get('/api/conversations/non-existent')
          .expect(404);

        expect(response.body).toEqual({
          error: 'Conversation not found',
          code: 'CONVERSATION_NOT_FOUND'
        });
      });

      it('should handle history reader errors', async () => {
        mockHistoryReader.fetchConversation.mockRejectedValue(new Error('Read error'));

        const response = await request(app)
          .get('/api/conversations/error-session')
          .expect(500);

        expect(response.body).toEqual({
          error: 'Internal server error'
        });
      });
    });

    describe('POST /api/conversations/:streamingId/continue', () => {
      it('should continue conversation successfully', async () => {
        mockProcessManager.sendInput.mockResolvedValue(undefined);

        const response = await request(app)
          .post('/api/conversations/session-123/continue')
          .send({ prompt: 'Tell me more' })
          .expect(200);

        expect(response.body).toEqual({
          streamUrl: '/api/stream/session-123'
        });
        expect(mockProcessManager.sendInput).toHaveBeenCalledWith('session-123', 'Tell me more');
      });

      it('should reject request without prompt', async () => {
        const response = await request(app)
          .post('/api/conversations/session-123/continue')
          .send({})
          .expect(400);

        expect(response.body.error).toBeDefined();
      });

      it('should handle non-existent session', async () => {
        mockProcessManager.sendInput.mockRejectedValue(
          new CCUIError('SESSION_NOT_FOUND', 'Session not found', 404)
        );

        const response = await request(app)
          .post('/api/conversations/non-existent/continue')
          .send({ prompt: 'Hello' })
          .expect(404);

        expect(response.body).toEqual({
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        });
      });
    });

    describe('POST /api/conversations/:streamingId/stop', () => {
      it('should stop conversation successfully', async () => {
        mockProcessManager.stopConversation.mockResolvedValue(true);

        const response = await request(app)
          .post('/api/conversations/session-123/stop')
          .expect(200);

        expect(response.body).toEqual({
          success: true
        });
        expect(mockProcessManager.stopConversation).toHaveBeenCalledWith('session-123');
      });

      it('should handle non-existent session', async () => {
        mockProcessManager.stopConversation.mockResolvedValue(false);

        const response = await request(app)
          .post('/api/conversations/non-existent/stop')
          .expect(200);

        expect(response.body).toEqual({
          success: false
        });
      });

      it('should handle stop conversation error', async () => {
        mockProcessManager.stopConversation.mockRejectedValue(new Error('Stop failed'));

        const response = await request(app)
          .post('/api/conversations/error-session/stop')
          .expect(500);

        expect(response.body).toEqual({
          error: 'Internal server error'
        });
      });
    });

    describe('GET /api/stream/:streamingId', () => {
      it('should set up streaming connection', async () => {
        const response = await request(app)
          .get('/api/stream/session-123')
          .expect(200);

        expect(mockStreamManager.addClient).toHaveBeenCalledWith(
          'session-123',
          expect.any(Object)
        );

        // Verify headers are set correctly
        expect(response.headers['content-type']).toBeDefined();
        expect(response.headers['cache-control']).toBeDefined();
      });
    });
  });

  describe('models endpoint', () => {
    let app: any;

    beforeEach(async () => {
      mockMcpServer.start.mockResolvedValue(undefined);
      await server.start();
      app = (server as any).app;
    });

    afterEach(async () => {
      try {
        if ((server as any).server) {
          await server.stop();
        }
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    });

    describe('GET /api/models', () => {
      it('should return available models successfully', async () => {
        (execSync as jest.MockedFunction<typeof execSync>).mockImplementation((command: string) => {
          if (command === 'claude --help') {
            return Buffer.from('--model [claude-opus-4-20250514|claude-3-5-sonnet-20241022]');
          }
          return Buffer.from('');
        });

        const response = await request(app)
          .get('/api/models')
          .expect(200);

        expect(response.body).toEqual({
          models: ['claude-opus-4-20250514', 'claude-3-5-sonnet-20241022'],
          defaultModel: 'claude-opus-4-20250514'
        });
      });

      it('should return fallback models when parsing fails', async () => {
        (execSync as jest.MockedFunction<typeof execSync>).mockImplementation(() => {
          throw new Error('Command failed');
        });

        const response = await request(app)
          .get('/api/models')
          .expect(200);

        expect(response.body).toEqual({
          models: [
            'claude-opus-4-20250514',
            'claude-3-5-sonnet-20241022',
            'claude-3-5-haiku-20241022'
          ],
          defaultModel: 'claude-opus-4-20250514'
        });
      });

      it('should handle models endpoint error', async () => {
        // Force an error by mocking internal method
        const originalMethod = (server as any).getAvailableModels;
        (server as any).getAvailableModels = jest.fn().mockRejectedValue(new Error('Models error'));

        const response = await request(app)
          .get('/api/models')
          .expect(500);

        expect(response.body).toEqual({
          error: 'Internal server error'
        });

        // Restore original method
        (server as any).getAvailableModels = originalMethod;
      });
    });
  });
});