import { CCUIMCPServer } from '@/mcp-server/ccui-mcp-server';
import { PermissionRequest, CCUIError } from '@/types';

// Mock the MCP SDK
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');

describe('CCUIMCPServer', () => {
  let mcpServer: CCUIMCPServer;

  beforeEach(() => {
    mcpServer = new CCUIMCPServer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct server configuration', () => {
      expect(mcpServer).toBeInstanceOf(CCUIMCPServer);
      expect(mcpServer.getStatus().isStarted).toBe(false);
      expect(mcpServer.getStatus().pendingRequestCount).toBe(0);
    });
  });

  describe('lifecycle management', () => {
    describe('start', () => {
      it('should start the MCP server successfully', async () => {
        await expect(mcpServer.start()).resolves.toBeUndefined();
        expect(mcpServer.getStatus().isStarted).toBe(true);
      });

      it('should emit started event when server starts', async () => {
        const startedSpy = jest.fn();
        mcpServer.on('started', startedSpy);

        await mcpServer.start();

        expect(startedSpy).toHaveBeenCalledTimes(1);
      });

      it('should throw error if already started', async () => {
        await mcpServer.start();

        await expect(mcpServer.start()).rejects.toThrow(CCUIError);
        await expect(mcpServer.start()).rejects.toThrow('MCP server is already running');
      });

      it('should throw CCUIError on start failure', async () => {
        // Mock server.connect to fail
        const mockServer = (mcpServer as any).server;
        mockServer.connect.mockRejectedValue(new Error('Connection failed'));

        await expect(mcpServer.start()).rejects.toThrow(CCUIError);
        await expect(mcpServer.start()).rejects.toThrow('Failed to start MCP server');
      });
    });

    describe('stop', () => {
      it('should stop the MCP server successfully', async () => {
        await mcpServer.start();
        
        await expect(mcpServer.stop()).resolves.toBeUndefined();
        expect(mcpServer.getStatus().isStarted).toBe(false);
      });

      it('should emit stopped event when server stops', async () => {
        await mcpServer.start();
        
        const stoppedSpy = jest.fn();
        mcpServer.on('stopped', stoppedSpy);

        await mcpServer.stop();

        expect(stoppedSpy).toHaveBeenCalledTimes(1);
      });

      it('should not throw error if already stopped', async () => {
        await expect(mcpServer.stop()).resolves.toBeUndefined();
        expect(mcpServer.getStatus().isStarted).toBe(false);
      });

      it('should throw CCUIError on stop failure', async () => {
        await mcpServer.start();
        
        // Mock server.close to fail
        const mockServer = (mcpServer as any).server;
        mockServer.close.mockRejectedValue(new Error('Close failed'));

        await expect(mcpServer.stop()).rejects.toThrow(CCUIError);
        await expect(mcpServer.stop()).rejects.toThrow('Failed to stop MCP server');
      });
    });
  });

  describe('permission handling', () => {
    let mockPermissionRequest: PermissionRequest;

    beforeEach(() => {
      mockPermissionRequest = {
        id: 'test-request-id',
        streamingId: 'test-session-id',
        toolName: 'Bash',
        toolInput: { command: 'ls -la' },
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
    });

    describe('handleDecision', () => {
      it('should approve permission request', () => {
        // Add a pending request
        (mcpServer as any).pendingRequests.set(mockPermissionRequest.id, mockPermissionRequest);

        const result = mcpServer.handleDecision(mockPermissionRequest.id, 'approve');

        expect(result).toBe(true);
        const request = mcpServer.getRequest(mockPermissionRequest.id);
        expect(request?.status).toBe('approved');
      });

      it('should deny permission request', () => {
        // Add a pending request
        (mcpServer as any).pendingRequests.set(mockPermissionRequest.id, mockPermissionRequest);

        const result = mcpServer.handleDecision(mockPermissionRequest.id, 'deny');

        expect(result).toBe(true);
        const request = mcpServer.getRequest(mockPermissionRequest.id);
        expect(request?.status).toBe('denied');
        expect(request?.denyReason).toBe('Permission denied by user');
      });

      it('should handle modified input on approval', () => {
        // Add a pending request
        (mcpServer as any).pendingRequests.set(mockPermissionRequest.id, mockPermissionRequest);

        const modifiedInput = { command: 'ls -l' };
        const result = mcpServer.handleDecision(mockPermissionRequest.id, 'approve', modifiedInput);

        expect(result).toBe(true);
        const request = mcpServer.getRequest(mockPermissionRequest.id);
        expect(request?.status).toBe('approved');
        expect(request?.modifiedInput).toEqual(modifiedInput);
      });

      it('should return false for non-existent request', () => {
        const result = mcpServer.handleDecision('non-existent-id', 'approve');
        expect(result).toBe(false);
      });

      it('should emit decision-made event', () => {
        const decisionSpy = jest.fn();
        mcpServer.on('decision-made', decisionSpy);

        // Add a pending request
        (mcpServer as any).pendingRequests.set(mockPermissionRequest.id, mockPermissionRequest);

        mcpServer.handleDecision(mockPermissionRequest.id, 'approve');

        expect(decisionSpy).toHaveBeenCalledWith({
          requestId: mockPermissionRequest.id,
          action: 'approve',
          request: expect.objectContaining({ status: 'approved' })
        });
      });
    });

    describe('getPendingRequests', () => {
      it('should return only pending requests', () => {
        const pendingRequest = { ...mockPermissionRequest, id: 'pending-1' };
        const approvedRequest = { ...mockPermissionRequest, id: 'approved-1', status: 'approved' as const };
        
        (mcpServer as any).pendingRequests.set('pending-1', pendingRequest);
        (mcpServer as any).pendingRequests.set('approved-1', approvedRequest);

        const pendingRequests = mcpServer.getPendingRequests();

        expect(pendingRequests).toHaveLength(1);
        expect(pendingRequests[0].id).toBe('pending-1');
        expect(pendingRequests[0].status).toBe('pending');
      });

      it('should return empty array when no pending requests', () => {
        const pendingRequests = mcpServer.getPendingRequests();
        expect(pendingRequests).toEqual([]);
      });
    });

    describe('getRequest', () => {
      it('should return specific request by ID', () => {
        (mcpServer as any).pendingRequests.set(mockPermissionRequest.id, mockPermissionRequest);

        const request = mcpServer.getRequest(mockPermissionRequest.id);

        expect(request).toEqual(mockPermissionRequest);
      });

      it('should return undefined for non-existent request', () => {
        const request = mcpServer.getRequest('non-existent-id');
        expect(request).toBeUndefined();
      });
    });

    describe('clearPendingRequests', () => {
      it('should clear all pending requests', () => {
        (mcpServer as any).pendingRequests.set('request-1', mockPermissionRequest);
        (mcpServer as any).pendingRequests.set('request-2', { ...mockPermissionRequest, id: 'request-2' });

        expect(mcpServer.getPendingRequests()).toHaveLength(2);

        mcpServer.clearPendingRequests();

        expect(mcpServer.getPendingRequests()).toHaveLength(0);
        expect(mcpServer.getRequest('request-1')).toBeUndefined();
        expect(mcpServer.getRequest('request-2')).toBeUndefined();
      });
    });
  });

  describe('tool registration', () => {
    it('should register permission_prompt tool with correct schema', async () => {
      await mcpServer.start();

      const mockServer = (mcpServer as any).server;
      const toolsListHandler = mockServer.setRequestHandler.mock.calls.find(
        (call: any) => call[0].shape?.method?._def?.value === 'tools/list'
      )?.[1];

      expect(toolsListHandler).toBeDefined();

      const result = await toolsListHandler();

      expect(result).toEqual({
        tools: [
          {
            name: 'permission_prompt',
            description: 'Handle permission requests from Claude CLI',
            inputSchema: {
              type: 'object',
              properties: {
                tool_name: { type: 'string', description: 'The tool requesting permission' },
                input: { type: 'object', description: 'The input for the tool' },
                session_id: { type: 'string', description: 'The session ID for the conversation' }
              },
              required: ['tool_name', 'input', 'session_id']
            }
          }
        ]
      });
    });

    describe('tools/call handler', () => {
      let toolsCallHandler: any;

      beforeEach(async () => {
        await mcpServer.start();

        const mockServer = (mcpServer as any).server;
        toolsCallHandler = mockServer.setRequestHandler.mock.calls.find(
          (call: any) => call[0].shape?.method?._def?.value === 'tools/call'
        )?.[1];
      });

      it('should handle permission_prompt tool call', async () => {
        const permissionRequestSpy = jest.fn();
        mcpServer.on('permission-request', permissionRequestSpy);

        const request = {
          params: {
            name: 'permission_prompt',
            arguments: {
              tool_name: 'Bash',
              input: { command: 'ls -la' },
              session_id: 'test-session-id'
            }
          }
        };

        // Mock the decision-making process
        setTimeout(() => {
          const pendingRequests = mcpServer.getPendingRequests();
          if (pendingRequests.length > 0) {
            mcpServer.handleDecision(pendingRequests[0].id, 'approve');
          }
        }, 10);

        const result = await toolsCallHandler(request);

        // Check that the permission request was created with correct initial values
        expect(permissionRequestSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            toolName: 'Bash',
            toolInput: { command: 'ls -la' },
            streamingId: 'test-session-id',
            // Don't check status as it changes quickly due to async decision handling
            id: expect.any(String),
            timestamp: expect.any(String)
          })
        );

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: JSON.stringify({
              behavior: 'allow',
              updatedInput: { command: 'ls -la' }
            })
          }]
        });
      });

      it('should reject unknown tool calls', async () => {
        const request = {
          params: {
            name: 'unknown_tool',
            arguments: {}
          }
        };

        await expect(toolsCallHandler(request)).rejects.toThrow('Unknown tool: unknown_tool');
      });

      it('should handle permission denial', async () => {
        const request = {
          params: {
            name: 'permission_prompt',
            arguments: {
              tool_name: 'Bash',
              input: { command: 'rm -rf /' },
              session_id: 'test-session-id'
            }
          }
        };

        // Mock the decision-making process - deny this time
        setTimeout(() => {
          const pendingRequests = mcpServer.getPendingRequests();
          if (pendingRequests.length > 0) {
            mcpServer.handleDecision(pendingRequests[0].id, 'deny');
          }
        }, 10);

        const result = await toolsCallHandler(request);

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: JSON.stringify({
              behavior: 'deny',
              message: 'Permission denied by user'
            })
          }]
        });
      });

      it('should handle timeout for permission requests', async () => {
        // Mock shorter timeout for testing
        jest.spyOn(mcpServer as any, 'waitForDecision').mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                behavior: 'deny',
                message: 'Permission request timed out'
              });
            }, 10);
          });
        });

        const request = {
          params: {
            name: 'permission_prompt',
            arguments: {
              tool_name: 'Bash',
              input: { command: 'ls -la' },
              session_id: 'test-session-id'
            }
          }
        };

        const result = await toolsCallHandler(request);

        expect(result).toEqual({
          content: [{
            type: 'text',
            text: JSON.stringify({
              behavior: 'deny',
              message: 'Permission request timed out'
            })
          }]
        });
      });
    });
  });

  describe('getStatus', () => {
    it('should return correct status when stopped', () => {
      const status = mcpServer.getStatus();

      expect(status).toEqual({
        isStarted: false,
        pendingRequestCount: 0
      });
    });

    it('should return correct status when started', async () => {
      await mcpServer.start();

      const status = mcpServer.getStatus();

      expect(status).toEqual({
        isStarted: true,
        pendingRequestCount: 0
      });
    });

    it('should return correct pending request count', () => {
      const testRequest: PermissionRequest = {
        id: 'test-request-id',
        streamingId: 'test-session-id',
        toolName: 'Bash',
        toolInput: { command: 'ls -la' },
        timestamp: new Date().toISOString(),
        status: 'pending'
      };

      (mcpServer as any).pendingRequests.set('request-1', testRequest);
      (mcpServer as any).pendingRequests.set('request-2', { ...testRequest, id: 'request-2' });

      const status = mcpServer.getStatus();

      expect(status.pendingRequestCount).toBe(2);
    });
  });
});