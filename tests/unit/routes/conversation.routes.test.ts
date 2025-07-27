import request from 'supertest';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { createConversationRoutes } from '@/routes/conversation.routes';
import { ClaudeProcessManager } from '@/services/claude-process-manager';
import { ClaudeHistoryReader } from '@/services/claude-history-reader';
import { SessionInfoService } from '@/services/session-info-service';
import { ConversationStatusManager } from '@/services/conversation-status-manager';
import { ToolMetricsService } from '@/services/ToolMetricsService';
import { ConversationSummary, ConversationMessage, ToolMetrics, CUIError } from '@/types';

jest.mock('@/services/logger');

describe('Conversation Routes - Unified Start/Resume Endpoint', () => {
  let app: express.Application;
  let processManager: jest.Mocked<ClaudeProcessManager>;
  let sessionInfoService: jest.Mocked<SessionInfoService>;
  let historyReader: jest.Mocked<ClaudeHistoryReader>;
  let conversationStatusManager: jest.Mocked<ConversationStatusManager>;
  let toolMetricsService: jest.Mocked<ToolMetricsService>;

  // Helper to create a valid ConversationSummary
  const createMockConversation = (sessionId: string): ConversationSummary => ({
    sessionId,
    projectPath: '/path/to/project',
    summary: 'Test conversation',
    sessionInfo: {
      custom_name: '',
      pinned: false,
      archived: false,
      continuation_session_id: '',
      initial_commit_head: '',
      permission_mode: 'default',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      version: 1
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    messageCount: 5,
    totalDuration: 60000,
    model: 'claude-3',
    status: 'completed' as const
  });

  beforeEach(() => {
    app = express();
    app.use(express.json());

    processManager = {
      startConversation: jest.fn(),
      stopConversation: jest.fn(),
    } as any;

    sessionInfoService = {
      updateSessionInfo: jest.fn(),
      getSessionInfo: jest.fn(),
      updateCustomName: jest.fn(),
      archiveAllSessions: jest.fn(),
    } as any;

    historyReader = {
      fetchConversation: jest.fn(),
      listConversations: jest.fn(),
      getConversationMetadata: jest.fn(),
    } as any;

    conversationStatusManager = {
      registerActiveSession: jest.fn(),
      getConversationStatus: jest.fn(),
      getStreamingId: jest.fn(),
      getConversationsNotInHistory: jest.fn(),
      getActiveConversationDetails: jest.fn(),
    } as any;

    toolMetricsService = {
      getMetrics: jest.fn(),
    } as any;

    app.use('/api/conversations', createConversationRoutes(
      processManager,
      historyReader,
      conversationStatusManager,
      sessionInfoService,
      conversationStatusManager,
      toolMetricsService
    ));
    
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(err.statusCode || 500).json({ error: err.message });
    });
  });

  describe('POST /api/conversations/start', () => {
    it('should start new conversation without resumedSessionId', async () => {
      const mockSystemInit = {
        type: 'system' as const,
        subtype: 'init' as const,
        session_id: 'new-session-123',
        cwd: '/path/to/project',
        tools: [],
        mcp_servers: [],
        model: 'claude-3',
        permissionMode: 'prompt',
        apiKeySource: 'env'
      };

      processManager.startConversation.mockResolvedValue({
        streamingId: 'stream-123',
        systemInit: mockSystemInit
      });

      sessionInfoService.updateSessionInfo.mockResolvedValue({} as any);

      const response = await request(app)
        .post('/api/conversations/start')
        .send({
          workingDirectory: '/path/to/project',
          initialPrompt: 'Hello Claude!'
        });

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe('new-session-123');
      expect(processManager.startConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          workingDirectory: '/path/to/project',
          initialPrompt: 'Hello Claude!',
          previousMessages: undefined
        })
      );
    });

    it('should handle resume with resumedSessionId and set continuation_session_id', async () => {
      const mockSystemInit = {
        type: 'system' as const,
        subtype: 'init' as const,
        session_id: 'new-session-123',
        cwd: '/path/to/git/repo',
        tools: [],
        mcp_servers: [],
        model: 'claude-3',
        permissionMode: 'prompt',
        apiKeySource: 'env'
      };

      const mockPreviousMessages = [
        { uuid: '1', type: 'user' as const, message: 'Previous message' }
      ];

      historyReader.fetchConversation.mockResolvedValue(mockPreviousMessages as any);
      sessionInfoService.getSessionInfo.mockResolvedValue({ permission_mode: 'default' } as any);

      processManager.startConversation.mockResolvedValue({
        streamingId: 'stream-123',
        systemInit: mockSystemInit
      });

      sessionInfoService.updateSessionInfo.mockResolvedValue({} as any);

      const response = await request(app)
        .post('/api/conversations/start')
        .send({
          resumedSessionId: 'original-session-456',
          initialPrompt: 'Continue the conversation',
          workingDirectory: '/path/to/git/repo'
        });

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe('new-session-123');

      // Verify previous messages were fetched
      expect(historyReader.fetchConversation).toHaveBeenCalledWith('original-session-456');

      // Verify continuation_session_id was set on original session
      expect(sessionInfoService.updateSessionInfo).toHaveBeenCalledWith(
        'original-session-456',
        { continuation_session_id: 'new-session-123' }
      );

      // Verify process manager was called with previous messages
      expect(processManager.startConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          workingDirectory: '/path/to/git/repo',
          initialPrompt: 'Continue the conversation',
          previousMessages: mockPreviousMessages,
          resumedSessionId: 'original-session-456'
        })
      );

      // Verify active session was registered with inherited messages
      expect(conversationStatusManager.registerActiveSession).toHaveBeenCalledWith(
        'stream-123',
        'new-session-123',
        expect.objectContaining({
          inheritedMessages: mockPreviousMessages
        })
      );
    });

    it('should handle missing workingDirectory validation', async () => {
      const response = await request(app)
        .post('/api/conversations/start')
        .send({
          initialPrompt: 'Hello Claude!'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('workingDirectory is required');
    });

    it('should handle missing initialPrompt validation', async () => {
      const response = await request(app)
        .post('/api/conversations/start')
        .send({
          workingDirectory: '/path/to/project'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('initialPrompt is required');
    });

    it('should inherit permission mode from original session when resuming', async () => {
      const mockSystemInit = {
        type: 'system' as const,
        subtype: 'init' as const,
        session_id: 'new-session-123',
        cwd: '/path/to/git/repo',
        tools: [],
        mcp_servers: [],
        model: 'claude-3',
        permissionMode: 'bypassPermissions',
        apiKeySource: 'env'
      };

      historyReader.fetchConversation.mockResolvedValue([]);
      sessionInfoService.getSessionInfo.mockResolvedValue({ permission_mode: 'bypassPermissions' } as any);

      processManager.startConversation.mockResolvedValue({
        streamingId: 'stream-123',
        systemInit: mockSystemInit
      });

      const response = await request(app)
        .post('/api/conversations/start')
        .send({
          resumedSessionId: 'original-session-456',
          initialPrompt: 'Continue the conversation',
          workingDirectory: '/path/to/git/repo'
          // Note: not providing permissionMode, should inherit from original session
        });

      expect(response.status).toBe(200);
      expect(processManager.startConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          permissionMode: 'bypassPermissions'
        })
      );
    });

    it('should reject invalid permissionMode values', async () => {
      const response = await request(app)
        .post('/api/conversations/start')
        .send({
          workingDirectory: '/path/to/project',
          initialPrompt: 'Hello Claude!',
          permissionMode: 'invalidMode'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('permissionMode must be one of: acceptEdits, bypassPermissions, default, plan');
    });

    it('should handle failures when fetching previous conversation', async () => {
      const mockSystemInit = {
        type: 'system' as const,
        subtype: 'init' as const,
        session_id: 'new-session-123',
        cwd: '/path/to/project',
        tools: [],
        mcp_servers: [],
        model: 'claude-3',
        permissionMode: 'prompt',
        apiKeySource: 'env'
      };

      historyReader.fetchConversation.mockRejectedValue(new Error('Database error'));
      sessionInfoService.getSessionInfo.mockResolvedValue({ permission_mode: 'default' } as any);

      processManager.startConversation.mockResolvedValue({
        streamingId: 'stream-123',
        systemInit: mockSystemInit
      });

      const response = await request(app)
        .post('/api/conversations/start')
        .send({
          resumedSessionId: 'original-session-456',
          initialPrompt: 'Continue the conversation',
          workingDirectory: '/path/to/project'
        });

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe('new-session-123');
      // Should continue without previous messages
      expect(processManager.startConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          previousMessages: undefined
        })
      );
    });

    it('should handle failures when getting session info', async () => {
      const mockSystemInit = {
        type: 'system' as const,
        subtype: 'init' as const,
        session_id: 'new-session-123',
        cwd: '/path/to/project',
        tools: [],
        mcp_servers: [],
        model: 'claude-3',
        permissionMode: 'prompt',
        apiKeySource: 'env'
      };

      historyReader.fetchConversation.mockResolvedValue([]);
      sessionInfoService.getSessionInfo.mockRejectedValue(new Error('Session info not found'));

      processManager.startConversation.mockResolvedValue({
        streamingId: 'stream-123',
        systemInit: mockSystemInit
      });

      const response = await request(app)
        .post('/api/conversations/start')
        .send({
          resumedSessionId: 'original-session-456',
          initialPrompt: 'Continue the conversation',
          workingDirectory: '/path/to/project'
        });

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe('new-session-123');
      // Should continue without inherited permission mode
      expect(processManager.startConversation).toHaveBeenCalledWith(
        expect.objectContaining({
          permissionMode: undefined
        })
      );
    });

    it('should handle failure when updating continuation_session_id', async () => {
      const mockSystemInit = {
        type: 'system' as const,
        subtype: 'init' as const,
        session_id: 'new-session-123',
        cwd: '/path/to/project',
        tools: [],
        mcp_servers: [],
        model: 'claude-3',
        permissionMode: 'prompt',
        apiKeySource: 'env'
      };

      historyReader.fetchConversation.mockResolvedValue([]);
      sessionInfoService.getSessionInfo.mockResolvedValue({ permission_mode: 'default' } as any);

      processManager.startConversation.mockResolvedValue({
        streamingId: 'stream-123',
        systemInit: mockSystemInit
      });

      // First updateSessionInfo call (for continuation_session_id) fails
      sessionInfoService.updateSessionInfo.mockRejectedValueOnce(new Error('Update failed'));

      const response = await request(app)
        .post('/api/conversations/start')
        .send({
          resumedSessionId: 'original-session-456',
          initialPrompt: 'Continue the conversation',
          workingDirectory: '/path/to/project'
        });

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe('new-session-123');
      // Should continue despite update failure
    });

    it('should handle failure when registering active session', async () => {
      const mockSystemInit = {
        type: 'system' as const,
        subtype: 'init' as const,
        session_id: 'new-session-123',
        cwd: '/path/to/project',
        tools: [],
        mcp_servers: [],
        model: 'claude-3',
        permissionMode: 'prompt',
        apiKeySource: 'env'
      };

      historyReader.fetchConversation.mockResolvedValue([
        { 
          uuid: '1', 
          type: 'user' as const, 
          message: { role: 'user', content: 'Previous message' } as Anthropic.MessageParam,
          timestamp: '2024-01-01T00:00:00Z',
          sessionId: 'original-session-456'
        }
      ]);

      processManager.startConversation.mockResolvedValue({
        streamingId: 'stream-123',
        systemInit: mockSystemInit
      });

      sessionInfoService.updateSessionInfo.mockResolvedValue({} as any);
      conversationStatusManager.registerActiveSession.mockImplementation(() => {
        throw new Error('Registration failed');
      });

      const response = await request(app)
        .post('/api/conversations/start')
        .send({
          resumedSessionId: 'original-session-456',
          initialPrompt: 'Continue the conversation',
          workingDirectory: '/path/to/project'
        });

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe('new-session-123');
      // Should continue despite registration failure
    });

    it('should handle failure when storing permission mode in session info', async () => {
      const mockSystemInit = {
        type: 'system' as const,
        subtype: 'init' as const,
        session_id: 'new-session-123',
        cwd: '/path/to/project',
        tools: [],
        mcp_servers: [],
        model: 'claude-3',
        permissionMode: 'bypassPermissions',
        apiKeySource: 'env'
      };

      processManager.startConversation.mockResolvedValue({
        streamingId: 'stream-123',
        systemInit: mockSystemInit
      });

      sessionInfoService.updateSessionInfo.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .post('/api/conversations/start')
        .send({
          workingDirectory: '/path/to/project',
          initialPrompt: 'Hello Claude!',
          permissionMode: 'bypassPermissions'
        });

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe('new-session-123');
      // Should continue despite update failure
    });
  });

  describe('GET /api/conversations/', () => {
    it('should list conversations with tool metrics when available', async () => {
      const mockConversations: ConversationSummary[] = [
        {
          sessionId: 'session-1',
          summary: 'Test conversation 1',
          projectPath: '/path/to/project',
          sessionInfo: {
            custom_name: 'Custom Name 1',
            pinned: false,
            archived: false,
            continuation_session_id: '',
            initial_commit_head: '',
            permission_mode: 'default',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            version: 1
          },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          messageCount: 10,
          totalDuration: 120000,
          model: 'claude-3',
          status: 'completed'
        },
        {
          sessionId: 'session-2',
          summary: 'Test conversation 2',
          projectPath: '/path/to/project',
          sessionInfo: {
            custom_name: 'Custom Name 2',
            pinned: true,
            archived: false,
            continuation_session_id: '',
            initial_commit_head: '',
            permission_mode: 'default',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            version: 1
          },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          messageCount: 5,
          totalDuration: 60000,
          model: 'claude-3',
          status: 'completed'
        }
      ];

      historyReader.listConversations.mockResolvedValue({
        conversations: mockConversations,
        total: 2
      });

      conversationStatusManager.getConversationStatus.mockReturnValue('completed');
      conversationStatusManager.getConversationsNotInHistory.mockReturnValue([]);
      
      // Mock tool metrics for session-1
      toolMetricsService.getMetrics.mockImplementation((sessionId: string) => {
        if (sessionId === 'session-1') {
          return {
            linesAdded: 100,
            linesRemoved: 50,
            editCount: 10,
            writeCount: 5
          };
        }
        return undefined;
      });

      const response = await request(app)
        .get('/api/conversations/')
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.conversations).toHaveLength(2);
      expect(response.body.conversations[0]).toMatchObject({
        sessionId: 'session-1',
        summary: 'Test conversation 1',
        status: 'completed',
        toolMetrics: {
          linesAdded: 100,
          linesRemoved: 50,
          editCount: 10,
          writeCount: 5
        }
      });
      expect(response.body.conversations[1]).toMatchObject({
        sessionId: 'session-2',
        summary: 'Test conversation 2',
        status: 'completed'
      });
      expect(response.body.conversations[1].toolMetrics).toBeUndefined();
    });

    it('should include streamingId for ongoing conversations', async () => {
      const mockConversations: ConversationSummary[] = [{
        sessionId: 'session-1',
        summary: 'Ongoing conversation',
        projectPath: '/path/to/project',
        sessionInfo: {
          custom_name: '',
          pinned: false,
          archived: false,
          continuation_session_id: '',
          initial_commit_head: '',
          permission_mode: 'default',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          version: 1
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        messageCount: 5,
        totalDuration: 60000,
        model: 'claude-3',
        status: 'ongoing' as const
      }];

      historyReader.listConversations.mockResolvedValue({
        conversations: mockConversations,
        total: 1
      });

      conversationStatusManager.getConversationStatus.mockReturnValue('ongoing');
      conversationStatusManager.getStreamingId.mockReturnValue('stream-123');
      conversationStatusManager.getConversationsNotInHistory.mockReturnValue([]);
      toolMetricsService.getMetrics.mockReturnValue(undefined);

      const response = await request(app)
        .get('/api/conversations/')
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.conversations[0]).toMatchObject({
        sessionId: 'session-1',
        status: 'ongoing',
        streamingId: 'stream-123'
      });
    });

    it('should include conversations not in history', async () => {
      const mockHistoryConversations: ConversationSummary[] = [{
        sessionId: 'session-1',
        summary: 'History conversation',
        projectPath: '/path/to/project',
        sessionInfo: {
          custom_name: '',
          pinned: false,
          archived: false,
          continuation_session_id: '',
          initial_commit_head: '',
          permission_mode: 'default',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          version: 1
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        messageCount: 10,
        totalDuration: 120000,
        model: 'claude-3',
        status: 'completed' as const
      }];

      const mockActiveConversations: ConversationSummary[] = [{
        sessionId: 'active-session-1',
        summary: 'Active conversation not in history',
        projectPath: '/path/to/active',
        status: 'ongoing',
        streamingId: 'active-stream-1',
        sessionInfo: {
          custom_name: '',
          pinned: false,
          archived: false,
          continuation_session_id: '',
          initial_commit_head: '',
          permission_mode: 'default',
          created_at: '2024-01-01T12:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
          version: 1
        },
        createdAt: '2024-01-01T12:00:00Z',
        updatedAt: '2024-01-01T12:00:00Z',
        messageCount: 0,
        totalDuration: 0,
        model: 'claude-3'
      }];

      historyReader.listConversations.mockResolvedValue({
        conversations: mockHistoryConversations,
        total: 1
      });

      conversationStatusManager.getConversationStatus.mockReturnValue('completed');
      conversationStatusManager.getConversationsNotInHistory.mockReturnValue(mockActiveConversations);
      toolMetricsService.getMetrics.mockReturnValue(undefined);

      const response = await request(app)
        .get('/api/conversations/')
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.conversations).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.conversations[0].sessionId).toBe('session-1');
      expect(response.body.conversations[1].sessionId).toBe('active-session-1');
    });

    it('should handle listConversations errors', async () => {
      historyReader.listConversations.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/conversations/')
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('GET /api/conversations/:sessionId', () => {
    it('should get conversation details with tool metrics', async () => {
      const mockMessages: ConversationMessage[] = [
        { 
          uuid: '1', 
          type: 'user' as const, 
          message: { role: 'user', content: 'Hello' } as Anthropic.MessageParam,
          timestamp: '2024-01-01T00:00:00Z',
          sessionId: 'test-session-123'
        },
        { 
          uuid: '2', 
          type: 'assistant' as const, 
          message: { 
            id: 'msg_123',
            type: 'message' as const,
            role: 'assistant' as const,
            content: [{ type: 'text' as const, text: 'Hi there' }],
            model: 'claude-3',
            stop_reason: 'end_turn' as const,
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 5 }
          } as Anthropic.Message,
          timestamp: '2024-01-01T00:00:01Z',
          sessionId: 'test-session-123'
        }
      ];

      const mockMetadata = {
        summary: 'Test conversation',
        projectPath: '/path/to/project',
        totalDuration: 120000,
        model: 'claude-3'
      };

      const mockToolMetrics: ToolMetrics = {
        linesAdded: 50,
        linesRemoved: 20,
        editCount: 5,
        writeCount: 2
      };

      historyReader.fetchConversation.mockResolvedValue(mockMessages);
      historyReader.getConversationMetadata.mockResolvedValue(mockMetadata);
      toolMetricsService.getMetrics.mockReturnValue(mockToolMetrics);

      const response = await request(app)
        .get('/api/conversations/test-session-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        messages: mockMessages,
        summary: 'Test conversation',
        projectPath: '/path/to/project',
        metadata: {
          totalDuration: 120000,
          model: 'claude-3'
        },
        toolMetrics: mockToolMetrics
      });
    });

    it('should get conversation details without tool metrics', async () => {
      const mockMessages: ConversationMessage[] = [
        { 
          uuid: '1', 
          type: 'user' as const, 
          message: { role: 'user', content: 'Hello' } as Anthropic.MessageParam,
          timestamp: '2024-01-01T00:00:00Z',
          sessionId: 'test-session-123'
        }
      ];

      const mockMetadata = {
        summary: 'Test conversation',
        projectPath: '/path/to/project',
        totalDuration: 60000,
        model: 'claude-3'
      };

      historyReader.fetchConversation.mockResolvedValue(mockMessages);
      historyReader.getConversationMetadata.mockResolvedValue(mockMetadata);
      toolMetricsService.getMetrics.mockReturnValue(undefined);

      const response = await request(app)
        .get('/api/conversations/test-session-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        messages: mockMessages,
        summary: 'Test conversation',
        projectPath: '/path/to/project',
        metadata: {
          totalDuration: 60000,
          model: 'claude-3'
        }
      });
      expect(response.body.toolMetrics).toBeUndefined();
    });

    it('should return active conversation details when not found in history', async () => {
      const mockActiveDetails = {
        messages: [],
        summary: 'Active conversation',
        projectPath: '/path/to/active',
        metadata: {
          totalDuration: 0,
          model: 'claude-3'
        }
      };

      historyReader.fetchConversation.mockRejectedValue(
        new CUIError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404)
      );
      historyReader.getConversationMetadata.mockResolvedValue(null);
      conversationStatusManager.getActiveConversationDetails.mockReturnValue(mockActiveDetails);

      const response = await request(app)
        .get('/api/conversations/active-session-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockActiveDetails);
    });

    it('should return 404 when conversation not found anywhere', async () => {
      historyReader.fetchConversation.mockRejectedValue(
        new CUIError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404)
      );
      historyReader.getConversationMetadata.mockResolvedValue(null);
      conversationStatusManager.getActiveConversationDetails.mockReturnValue(null);

      const response = await request(app)
        .get('/api/conversations/not-found-session');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Conversation not found');
    });

    it('should handle other errors when fetching conversation', async () => {
      historyReader.fetchConversation.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/conversations/test-session-123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database error');
    });

    it('should return 404 when metadata is null despite having messages', async () => {
      const mockMessages: ConversationMessage[] = [
        { 
          uuid: '1', 
          type: 'user' as const, 
          message: { role: 'user', content: 'Hello' } as Anthropic.MessageParam,
          timestamp: '2024-01-01T00:00:00Z',
          sessionId: 'test-session-123'
        }
      ];

      historyReader.fetchConversation.mockResolvedValue(mockMessages);
      historyReader.getConversationMetadata.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/conversations/test-session-123');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Conversation not found');
    });
  });

  describe('POST /api/conversations/:streamingId/stop', () => {
    it('should stop conversation successfully', async () => {
      processManager.stopConversation.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/conversations/stream-123/stop');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
      expect(processManager.stopConversation).toHaveBeenCalledWith('stream-123');
    });

    it('should handle failed stop', async () => {
      processManager.stopConversation.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/conversations/stream-123/stop');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: false });
    });

    it('should handle stop conversation errors', async () => {
      processManager.stopConversation.mockRejectedValue(new Error('Process error'));

      const response = await request(app)
        .post('/api/conversations/stream-123/stop');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Process error');
    });
  });

  describe('POST /api/conversations/archive-all', () => {
    beforeEach(() => {
      sessionInfoService.archiveAllSessions = jest.fn();
    });

    it('should archive all sessions successfully', async () => {
      sessionInfoService.archiveAllSessions.mockResolvedValue(5);

      const response = await request(app)
        .post('/api/conversations/archive-all')
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        archivedCount: 5,
        message: 'Successfully archived 5 sessions'
      });
      expect(sessionInfoService.archiveAllSessions).toHaveBeenCalled();
    });

    it('should handle archiving zero sessions', async () => {
      sessionInfoService.archiveAllSessions.mockResolvedValue(0);

      const response = await request(app)
        .post('/api/conversations/archive-all')
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        archivedCount: 0,
        message: 'Successfully archived 0 sessions'
      });
      expect(sessionInfoService.archiveAllSessions).toHaveBeenCalled();
    });

    it('should handle archiving one session with singular message', async () => {
      sessionInfoService.archiveAllSessions.mockResolvedValue(1);

      const response = await request(app)
        .post('/api/conversations/archive-all')
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        archivedCount: 1,
        message: 'Successfully archived 1 session'
      });
      expect(sessionInfoService.archiveAllSessions).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      sessionInfoService.archiveAllSessions.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/conversations/archive-all')
        .send();

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database error');
      expect(sessionInfoService.archiveAllSessions).toHaveBeenCalled();
    });
  });

  describe('PUT /api/conversations/:sessionId/rename', () => {
    beforeEach(() => {
      sessionInfoService.updateCustomName = jest.fn();
      historyReader.getConversationMetadata = jest.fn();
    });

    it('should rename session successfully', async () => {
      historyReader.getConversationMetadata.mockResolvedValue({
        summary: 'Test conversation',
        projectPath: '/path/to/project',
        model: 'claude-3',
        totalDuration: 60000
      });
      sessionInfoService.updateCustomName.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/conversations/test-session-123/rename')
        .send({ customName: 'My Custom Name' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        sessionId: 'test-session-123',
        customName: 'My Custom Name'
      });
      expect(sessionInfoService.updateCustomName).toHaveBeenCalledWith('test-session-123', 'My Custom Name');
    });

    it('should trim custom name', async () => {
      historyReader.getConversationMetadata.mockResolvedValue({
        summary: 'Test conversation',
        projectPath: '/path/to/project',
        model: 'claude-3',
        totalDuration: 60000
      });
      sessionInfoService.updateCustomName.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/conversations/test-session-123/rename')
        .send({ customName: '  My Custom Name  ' });

      expect(response.status).toBe(200);
      expect(response.body.customName).toBe('My Custom Name');
      expect(sessionInfoService.updateCustomName).toHaveBeenCalledWith('test-session-123', 'My Custom Name');
    });

    it('should allow empty custom name', async () => {
      historyReader.getConversationMetadata.mockResolvedValue({
        summary: 'Test conversation',
        projectPath: '/path/to/project',
        model: 'claude-3',
        totalDuration: 60000
      });
      sessionInfoService.updateCustomName.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/conversations/test-session-123/rename')
        .send({ customName: '' });

      expect(response.status).toBe(200);
      expect(response.body.customName).toBe('');
      expect(sessionInfoService.updateCustomName).toHaveBeenCalledWith('test-session-123', '');
    });

    it('should reject missing custom name', async () => {
      const response = await request(app)
        .put('/api/conversations/test-session-123/rename')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('customName is required');
    });

    it('should reject null custom name', async () => {
      const response = await request(app)
        .put('/api/conversations/test-session-123/rename')
        .send({ customName: null });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('customName is required');
    });

    it('should reject custom name that is too long', async () => {
      const longName = 'a'.repeat(201);
      const response = await request(app)
        .put('/api/conversations/test-session-123/rename')
        .send({ customName: longName });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('customName must be 200 characters or less');
    });

    it('should handle session not found', async () => {
      historyReader.getConversationMetadata.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/conversations/test-session-123/rename')
        .send({ customName: 'My Custom Name' });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Conversation not found');
    });

    it('should handle empty session ID in path', async () => {
      const response = await request(app)
        .put('/api/conversations/ /rename')
        .send({ customName: 'My Custom Name' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('sessionId is required');
    });

    it('should handle service errors', async () => {
      historyReader.getConversationMetadata.mockResolvedValue({
        summary: 'Test conversation',
        projectPath: '/path/to/project',
        model: 'claude-3',
        totalDuration: 60000
      });
      sessionInfoService.updateCustomName.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/conversations/test-session-123/rename')
        .send({ customName: 'My Custom Name' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('PUT /api/conversations/:sessionId/update', () => {
    beforeEach(() => {
      sessionInfoService.updateSessionInfo = jest.fn();
      historyReader.listConversations = jest.fn();
    });

    it('should update session info successfully', async () => {
      historyReader.listConversations.mockResolvedValue({
        conversations: [createMockConversation('test-session-123')],
        total: 1
      });
      sessionInfoService.updateSessionInfo.mockResolvedValue({
        custom_name: 'Updated Name',
        pinned: true,
        archived: false,
        continuation_session_id: '',
        initial_commit_head: '',
        permission_mode: 'default',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        version: 1
      });

      const response = await request(app)
        .put('/api/conversations/test-session-123/update')
        .send({
          customName: 'Updated Name',
          pinned: true,
          archived: false
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        sessionId: 'test-session-123',
        updatedFields: expect.objectContaining({
          custom_name: 'Updated Name',
          pinned: true,
          archived: false
        })
      });
      expect(sessionInfoService.updateSessionInfo).toHaveBeenCalledWith(
        'test-session-123',
        {
          custom_name: 'Updated Name',
          pinned: true,
          archived: false
        }
      );
    });

    it('should update all supported fields', async () => {
      historyReader.listConversations.mockResolvedValue({
        conversations: [createMockConversation('test-session-123')],
        total: 1
      });
      sessionInfoService.updateSessionInfo.mockResolvedValue({
        custom_name: 'Updated Name',
        pinned: true,
        archived: true,
        continuation_session_id: 'cont-123',
        initial_commit_head: 'abc123',
        permission_mode: 'bypassPermissions',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        version: 1
      });

      const response = await request(app)
        .put('/api/conversations/test-session-123/update')
        .send({
          customName: 'Updated Name',
          pinned: true,
          archived: true,
          continuationSessionId: 'cont-123',
          initialCommitHead: 'abc123',
          permissionMode: 'bypassPermissions'
        });

      expect(response.status).toBe(200);
      expect(sessionInfoService.updateSessionInfo).toHaveBeenCalledWith(
        'test-session-123',
        {
          custom_name: 'Updated Name',
          pinned: true,
          archived: true,
          continuation_session_id: 'cont-123',
          initial_commit_head: 'abc123',
          permission_mode: 'bypassPermissions'
        }
      );
    });

    it('should trim custom name when updating', async () => {
      historyReader.listConversations.mockResolvedValue({
        conversations: [createMockConversation('test-session-123')],
        total: 1
      });
      sessionInfoService.updateSessionInfo.mockResolvedValue({
        custom_name: 'Trimmed Name',
        pinned: false,
        archived: false,
        continuation_session_id: '',
        initial_commit_head: '',
        permission_mode: 'default',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        version: 1
      });

      const response = await request(app)
        .put('/api/conversations/test-session-123/update')
        .send({
          customName: '  Trimmed Name  '
        });

      expect(response.status).toBe(200);
      expect(sessionInfoService.updateSessionInfo).toHaveBeenCalledWith(
        'test-session-123',
        { custom_name: 'Trimmed Name' }
      );
    });

    it('should reject empty session ID', async () => {
      const response = await request(app)
        .put('/api/conversations/ /update')
        .send({ customName: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Session ID is required');
      expect(response.body.success).toBe(false);
    });

    // Note: Missing session ID in path results in 404 from Express routing, not 400
    // This is expected behavior as the route doesn't match

    it('should handle session not found', async () => {
      historyReader.listConversations.mockResolvedValue({
        conversations: [],
        total: 0
      });

      const response = await request(app)
        .put('/api/conversations/test-session-123/update')
        .send({ customName: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Conversation session not found');
      expect(response.body.success).toBe(false);
    });

    it('should reject custom name that is too long', async () => {
      historyReader.listConversations.mockResolvedValue({
        conversations: [createMockConversation('test-session-123')],
        total: 1
      });

      const longName = 'a'.repeat(201);
      const response = await request(app)
        .put('/api/conversations/test-session-123/update')
        .send({ customName: longName });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Custom name must be 200 characters or less');
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid permission mode', async () => {
      historyReader.listConversations.mockResolvedValue({
        conversations: [createMockConversation('test-session-123')],
        total: 1
      });

      const response = await request(app)
        .put('/api/conversations/test-session-123/update')
        .send({ permissionMode: 'invalidMode' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Permission mode must be one of: acceptEdits, bypassPermissions, default, plan');
      expect(response.body.success).toBe(false);
    });

    it('should handle service errors', async () => {
      historyReader.listConversations.mockResolvedValue({
        conversations: [createMockConversation('test-session-123')],
        total: 1
      });
      sessionInfoService.updateSessionInfo.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/conversations/test-session-123/update')
        .send({ customName: 'Test' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database error');
    });

    it('should handle empty update payload', async () => {
      historyReader.listConversations.mockResolvedValue({
        conversations: [createMockConversation('test-session-123')],
        total: 1
      });
      sessionInfoService.updateSessionInfo.mockResolvedValue({
        custom_name: '',
        pinned: false,
        archived: false,
        continuation_session_id: '',
        initial_commit_head: '',
        permission_mode: 'default',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        version: 1
      });

      const response = await request(app)
        .put('/api/conversations/test-session-123/update')
        .send({});

      expect(response.status).toBe(200);
      expect(sessionInfoService.updateSessionInfo).toHaveBeenCalledWith(
        'test-session-123',
        {}
      );
    });
  });
});