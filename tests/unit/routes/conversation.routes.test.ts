import request from 'supertest';
import express from 'express';
import { createConversationRoutes } from '@/routes/conversation.routes';
import { ClaudeProcessManager } from '@/services/claude-process-manager';
import { ClaudeHistoryReader } from '@/services/claude-history-reader';
import { ConversationStatusTracker } from '@/services/conversation-status-tracker';
import { SessionInfoService } from '@/services/session-info-service';
import { OptimisticConversationService } from '@/services/optimistic-conversation-service';
import { ToolMetricsService } from '@/services/ToolMetricsService';

jest.mock('@/services/logger');

describe('Conversation Routes - Resume Endpoint', () => {
  let app: express.Application;
  let processManager: jest.Mocked<ClaudeProcessManager>;
  let sessionInfoService: jest.Mocked<SessionInfoService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    processManager = {
      resumeConversation: jest.fn(),
    } as any;

    sessionInfoService = {
      updateSessionInfo: jest.fn(),
    } as any;

    const mockServices = {
      historyReader: {} as any,
      statusTracker: {} as any,
      optimisticConversationService: {} as any,
      toolMetricsService: {} as any,
    };

    app.use('/api/conversations', createConversationRoutes(
      processManager,
      mockServices.historyReader,
      mockServices.statusTracker,
      sessionInfoService,
      mockServices.optimisticConversationService,
      mockServices.toolMetricsService
    ));
    
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(err.statusCode || 500).json({ error: err.message });
    });
  });

  describe('POST /api/conversations/resume', () => {
    it('should set continuation_session_id on resume', async () => {
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

      processManager.resumeConversation.mockResolvedValue({
        streamingId: 'stream-123',
        systemInit: mockSystemInit
      });

      sessionInfoService.updateSessionInfo.mockResolvedValue({} as any);

      const response = await request(app)
        .post('/api/conversations/resume')
        .send({
          sessionId: 'original-session-456',
          message: 'Continue the conversation'
        });

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBe('new-session-123');

      // Verify continuation_session_id was set on original session
      expect(sessionInfoService.updateSessionInfo).toHaveBeenCalledWith(
        'original-session-456',
        { continuation_session_id: 'new-session-123' }
      );
    });

    it('should handle missing sessionId validation', async () => {
      const response = await request(app)
        .post('/api/conversations/resume')
        .send({
          message: 'Continue the conversation'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('sessionId is required');
    });

    it('should handle missing message validation', async () => {
      const response = await request(app)
        .post('/api/conversations/resume')
        .send({
          sessionId: 'test-session-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('message is required');
    });
  });
});