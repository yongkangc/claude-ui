import { Router, Request } from 'express';
import { 
  StartConversationRequest,
  StartConversationResponse,
  ResumeConversationRequest,
  ConversationListQuery,
  ConversationDetailsResponse,
  CCUIError,
  SessionRenameRequest,
  SessionRenameResponse
} from '@/types';
import { ClaudeProcessManager } from '@/services/claude-process-manager';
import { ClaudeHistoryReader } from '@/services/claude-history-reader';
import { ConversationStatusTracker } from '@/services/conversation-status-tracker';
import { SessionInfoService } from '@/services/session-info-service';
import { OptimisticConversationService } from '@/services/optimistic-conversation-service';
import { createLogger } from '@/services/logger';
import { ToolMetricsService } from '@/services/ToolMetricsService';

export function createConversationRoutes(
  processManager: ClaudeProcessManager,
  historyReader: ClaudeHistoryReader,
  statusTracker: ConversationStatusTracker,
  sessionInfoService: SessionInfoService,
  optimisticConversationService: OptimisticConversationService,
  toolMetricsService: ToolMetricsService
): Router {
  const router = Router();
  const logger = createLogger('ConversationRoutes');

  // Start new conversation
  router.post('/start', async (req: Request<{}, StartConversationResponse, StartConversationRequest>, res, next) => {
    const requestId = (req as any).requestId;
    logger.debug('Start conversation request', {
      requestId,
      body: {
        ...req.body,
        initialPrompt: req.body.initialPrompt ? `${req.body.initialPrompt.substring(0, 50)}...` : undefined
      }
    });
    
    try {
      // Validate required fields
      if (!req.body.workingDirectory) {
        throw new CCUIError('MISSING_WORKING_DIRECTORY', 'workingDirectory is required', 400);
      }
      if (!req.body.initialPrompt) {
        throw new CCUIError('MISSING_INITIAL_PROMPT', 'initialPrompt is required', 400);
      }
      
      const { streamingId, systemInit } = await processManager.startConversation(req.body);
      
      logger.debug('Conversation started successfully', {
        requestId,
        streamingId,
        sessionId: systemInit.session_id,
        model: systemInit.model,
        cwd: systemInit.cwd
      });

      res.json({ 
        streamingId,
        streamUrl: `/api/stream/${streamingId}`,
        // System init fields
        sessionId: systemInit.session_id,
        cwd: systemInit.cwd,
        tools: systemInit.tools,
        mcpServers: systemInit.mcp_servers,
        model: systemInit.model,
        permissionMode: systemInit.permissionMode,
        apiKeySource: systemInit.apiKeySource
      });
    } catch (error) {
      logger.debug('Start conversation failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  // Resume existing conversation
  router.post('/resume', async (req: Request<{}, StartConversationResponse, ResumeConversationRequest>, res, next) => {
    const requestId = (req as any).requestId;
    logger.debug('Resume conversation request', {
      requestId,
      sessionId: req.body.sessionId,
      messagePreview: req.body.message ? `${req.body.message.substring(0, 50)}...` : undefined
    });
    
    try {
      // Validate required fields
      if (!req.body.sessionId || !req.body.sessionId.trim()) {
        throw new CCUIError('MISSING_SESSION_ID', 'sessionId is required', 400);
      }
      if (!req.body.message || !req.body.message.trim()) {
        throw new CCUIError('MISSING_MESSAGE', 'message is required', 400);
      }
      
      // Validate that only allowed fields are provided (no extra parameters)
      const allowedFields = ['sessionId', 'message'];
      const providedFields = Object.keys(req.body);
      const extraFields = providedFields.filter(field => !allowedFields.includes(field));
      
      if (extraFields.length > 0) {
        throw new CCUIError('INVALID_FIELDS', `Invalid fields for resume: ${extraFields.join(', ')}. Only sessionId and message are allowed.`, 400);
      }
      
      const { streamingId, systemInit } = await processManager.resumeConversation({
        sessionId: req.body.sessionId,
        message: req.body.message
      });
      
      logger.debug('Conversation resumed successfully', {
        requestId,
        originalSessionId: req.body.sessionId,
        newStreamingId: streamingId,
        newSessionId: systemInit.session_id,
        model: systemInit.model,
        cwd: systemInit.cwd
      });
      
      res.json({ 
        streamingId,
        streamUrl: `/api/stream/${streamingId}`,
        // System init fields
        sessionId: systemInit.session_id,
        cwd: systemInit.cwd,
        tools: systemInit.tools,
        mcpServers: systemInit.mcp_servers,
        model: systemInit.model,
        permissionMode: systemInit.permissionMode,
        apiKeySource: systemInit.apiKeySource
      });
    } catch (error) {
      logger.debug('Resume conversation failed', {
        requestId,
        sessionId: req.body.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  // List conversations
  router.get('/', async (req: Request<{}, {}, {}, ConversationListQuery>, res, next) => {
    const requestId = (req as any).requestId;
    logger.debug('List conversations request', {
      requestId,
      query: req.query
    });
    
    try {
      const result = await historyReader.listConversations(req.query);
      
      // Update status for each conversation based on active streams
      const conversationsWithStatus = result.conversations.map(conversation => {
        const status = statusTracker.getConversationStatus(conversation.sessionId);
        const baseConversation = {
          ...conversation,
          status
        };
        
        // Add toolMetrics if available
        const metrics = toolMetricsService.getMetrics(conversation.sessionId);
        if (metrics) {
          baseConversation.toolMetrics = metrics;
        }
        
        // Add streamingId if conversation is ongoing
        if (status === 'ongoing') {
          const streamingId = statusTracker.getStreamingId(conversation.sessionId);
          if (streamingId) {
            return { ...baseConversation, streamingId };
          }
        }
        
        return baseConversation;
      });

      // Get all active sessions and add optimistic conversations for those not in history
      const existingSessionIds = new Set(conversationsWithStatus.map(c => c.sessionId));
      const optimisticConversations = optimisticConversationService.getOptimisticConversations(existingSessionIds);

      // Combine history conversations with optimistic ones
      const allConversations = [...conversationsWithStatus, ...optimisticConversations];
      
      logger.debug('Conversations listed successfully', {
        requestId,
        conversationCount: allConversations.length,
        historyConversations: conversationsWithStatus.length,
        optimisticConversations: optimisticConversations.length,
        totalFound: result.total,
        activeConversations: allConversations.filter(c => c.status === 'ongoing').length
      });
      
      res.json({
        conversations: allConversations,
        total: result.total + optimisticConversations.length // Update total to include optimistic conversations
      });
    } catch (error) {
      logger.debug('List conversations failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  // Get conversation details
  router.get('/:sessionId', async (req, res, next) => {
    const requestId = (req as any).requestId;
    const { sessionId } = req.params;
    
    logger.debug('Get conversation details request', {
      requestId,
      sessionId
    });
    
    try {
      // First try to fetch from history
      try {
        const messages = await historyReader.fetchConversation(req.params.sessionId);
        const metadata = await historyReader.getConversationMetadata(req.params.sessionId);
        
        if (!metadata) {
          throw new CCUIError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
        }
        
        const response: ConversationDetailsResponse = {
          messages,
          summary: metadata.summary,
          projectPath: metadata.projectPath,
          metadata: {
            totalDuration: metadata.totalDuration,
            model: metadata.model
          }
        };
        
        // Add toolMetrics if available
        const metrics = toolMetricsService.getMetrics(req.params.sessionId);
        if (metrics) {
          response.toolMetrics = metrics;
        }
        
        logger.debug('Conversation details retrieved from history', {
          requestId,
          sessionId,
          messageCount: response.messages.length,
          hasSummary: !!response.summary,
          projectPath: response.projectPath
        });
        
        res.json(response);
      } catch (historyError) {
        // If not found in history, check if it's an active session
        if (historyError instanceof CCUIError && historyError.code === 'CONVERSATION_NOT_FOUND') {
          const optimisticDetails = optimisticConversationService.getOptimisticConversationDetails(sessionId);
          
          if (optimisticDetails) {
            logger.debug('Conversation details created for active session', {
              requestId,
              sessionId,
              projectPath: optimisticDetails.projectPath
            });
            
            res.json(optimisticDetails);
          } else {
            // Not found in history and not active
            throw historyError;
          }
        } else {
          // Other errors, re-throw
          throw historyError;
        }
      }
    } catch (error) {
      logger.debug('Get conversation details failed', {
        requestId,
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  // Stop conversation
  router.post('/:streamingId/stop', async (req, res, next) => {
    const requestId = (req as any).requestId;
    const { streamingId } = req.params;
    
    logger.debug('Stop conversation request', {
      requestId,
      streamingId
    });
    
    try {
      const success = await processManager.stopConversation(streamingId);
      
      logger.debug('Stop conversation result', {
        requestId,
        streamingId,
        success
      });
      
      res.json({ success });
    } catch (error) {
      logger.debug('Stop conversation failed', {
        requestId,
        streamingId,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  // Rename session (update custom name)
  router.put('/:sessionId/rename', async (req: Request<{ sessionId: string }, SessionRenameResponse, SessionRenameRequest>, res, next) => {
    const requestId = (req as any).requestId;
    const { sessionId } = req.params;
    const { customName } = req.body;
    
    logger.debug('Rename session request', {
      requestId,
      sessionId,
      customName
    });
    
    try {
      // Validate required fields
      if (!sessionId || !sessionId.trim()) {
        throw new CCUIError('MISSING_SESSION_ID', 'sessionId is required', 400);
      }
      if (customName === undefined || customName === null) {
        throw new CCUIError('MISSING_CUSTOM_NAME', 'customName is required', 400);
      }
      
      // Validate custom name length (reasonable limit)
      if (customName.length > 200) {
        throw new CCUIError('CUSTOM_NAME_TOO_LONG', 'customName must be 200 characters or less', 400);
      }
      
      // Check if session exists by trying to get its metadata
      const metadata = await historyReader.getConversationMetadata(sessionId);
      if (!metadata) {
        throw new CCUIError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
      }
      
      // Update custom name
      await sessionInfoService.updateCustomName(sessionId, customName.trim());
      
      logger.info('Session renamed successfully', {
        requestId,
        sessionId,
        customName: customName.trim()
      });
      
      res.json({
        success: true,
        sessionId,
        customName: customName.trim()
      });
    } catch (error) {
      logger.debug('Rename session failed', {
        requestId,
        sessionId,
        customName,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  return router;
}