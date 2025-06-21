import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ClaudeProcessManager } from './services/claude-process-manager';
import { StreamManager } from './services/stream-manager';
import { ClaudeHistoryReader } from './services/claude-history-reader';
import { ConversationStatusTracker } from './services/conversation-status-tracker';
import { 
  StartConversationRequest,
  StartConversationResponse,
  ResumeConversationRequest,
  ConversationListQuery,
  ConversationDetailsResponse,
  SystemStatusResponse,
  ModelsResponse,
  StreamEvent,
  CCUIError 
} from './types';
import { createLogger } from './services/logger';
import type { Logger } from 'pino';

/**
 * Main CCUI server class
 */
export class CCUIServer {
  private app: Express;
  private server?: import('http').Server;
  private processManager: ClaudeProcessManager;
  private streamManager: StreamManager;
  private historyReader: ClaudeHistoryReader;
  private statusTracker: ConversationStatusTracker;
  private logger: Logger;
  private port: number;

  constructor(config?: {
    port?: number;
  }) {
    this.port = config?.port || parseInt(process.env.PORT || '3001');
    this.app = express();
    this.logger = createLogger('CCUIServer');
    
    this.logger.debug('Initializing CCUIServer', {
      port: this.port,
      configProvided: !!config,
      nodeEnv: process.env.NODE_ENV
    });
    
    // Initialize services
    this.logger.debug('Initializing services');
    this.processManager = new ClaudeProcessManager();
    this.streamManager = new StreamManager();
    this.historyReader = new ClaudeHistoryReader();
    this.statusTracker = new ConversationStatusTracker();
    this.logger.debug('Services initialized successfully');
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupProcessManagerIntegration();
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    this.logger.debug('Start method called');
    try {
      // Start Express server
      this.logger.info(`Starting HTTP server on port ${this.port}...`);
      this.logger.debug('Creating HTTP server listener');
      await new Promise<void>((resolve, reject) => {
        this.server = this.app.listen(this.port, () => {
          this.logger.info(`CCUI backend server running on port ${this.port}`);
          this.logger.debug('Server successfully bound to port', {
            port: this.port,
            address: this.server?.address()
          });
          resolve();
        });

        this.server.on('error', (error: Error) => {
          this.logger.error('Failed to start HTTP server:', error, {
            errorCode: (error as any).code,
            errorSyscall: (error as any).syscall,
            port: this.port
          });
          reject(new CCUIError('HTTP_SERVER_START_FAILED', `Failed to start HTTP server: ${error.message}`, 500));
        });
      });
      this.logger.debug('Server start successful');
    } catch (error) {
      this.logger.error('Failed to start server:', error, {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      
      // Attempt cleanup on startup failure
      await this.cleanup();
      
      if (error instanceof CCUIError) {
        throw error;
      } else {
        throw new CCUIError('SERVER_START_FAILED', `Server startup failed: ${error}`, 500);
      }
    }
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    this.logger.info('Starting graceful shutdown...');
    this.logger.debug('Stop method called', {
      hasServer: !!this.server,
      activeSessions: this.processManager.getActiveSessions().length,
      connectedClients: this.streamManager.getTotalClientCount()
    });
    
    // Stop accepting new connections
    if (this.server) {
      this.logger.debug('Closing HTTP server');
      await new Promise<void>((resolve, reject) => {
        this.server!.close((error) => {
          if (error) {
            this.logger.error('Error closing HTTP server:', error);
            reject(error);
          } else {
            this.logger.info('HTTP server closed');
            resolve();
          }
        });
      });
    }
    
    // Stop all active Claude processes
    const activeSessions = this.processManager.getActiveSessions();
    if (activeSessions.length > 0) {
      this.logger.info(`Stopping ${activeSessions.length} active sessions...`);
      this.logger.debug('Active sessions to stop', { sessionIds: activeSessions });
      
      const stopResults = await Promise.allSettled(
        activeSessions.map(streamingId => 
          this.processManager.stopConversation(streamingId)
            .catch(error => this.logger.error(`Error stopping session ${streamingId}:`, error))
        )
      );
      
      this.logger.debug('Session stop results', {
        total: stopResults.length,
        fulfilled: stopResults.filter(r => r.status === 'fulfilled').length,
        rejected: stopResults.filter(r => r.status === 'rejected').length
      });
    }
    
    // Disconnect all streaming clients
    this.logger.debug('Disconnecting all streaming clients');
    this.streamManager.disconnectAll();
    this.logger.info('Graceful shutdown complete');
  }

  /**
   * Cleanup resources during failed startup
   */
  private async cleanup(): Promise<void> {
    this.logger.info('Performing cleanup after startup failure...');
    this.logger.debug('Cleanup initiated', {
      hasServer: !!this.server,
      hasActiveStreams: this.streamManager.getTotalClientCount() > 0
    });
    
    try {
      // Close HTTP server if it was started
      if (this.server) {
        await new Promise<void>((resolve) => {
          this.server!.close(() => {
            this.logger.info('HTTP server closed during cleanup');
            resolve();
          });
        });
      }

      // Disconnect streaming clients
      this.streamManager.disconnectAll();
      
      this.logger.info('Cleanup completed');
    } catch (error) {
      this.logger.error('Error during cleanup:', error, {
        errorType: error instanceof Error ? error.constructor.name : typeof error
      });
    }
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Request logging
    this.app.use((req, res, next) => {
      const requestId = Math.random().toString(36).substring(7);
      (req as any).requestId = requestId;
      
      this.logger.info({ 
        method: req.method, 
        url: req.url,
        requestId,
        headers: {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent']
        },
        query: req.query,
        ip: req.ip
      }, 'Incoming request');
      
      // Log response when finished
      const startTime = Date.now();
      res.on('finish', () => {
        this.logger.debug('Request completed', {
          requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration: Date.now() - startTime,
          contentLength: res.get('content-length')
        });
      });
      
      next();
    });
    
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Conversation management routes
    this.setupConversationRoutes();
    
    // System management routes
    this.setupSystemRoutes();
    
    // Streaming endpoint
    this.setupStreamingRoute();
    
    // Error handling - MUST be last
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      const requestId = (req as any).requestId || 'unknown';
      
      if (err instanceof CCUIError) {
        this.logger.warn('CCUIError in request', {
          requestId,
          code: err.code,
          message: err.message,
          statusCode: err.statusCode,
          url: req.url,
          method: req.method
        });
        res.status(err.statusCode).json({ error: err.message, code: err.code });
      } else {
        this.logger.error(err, 'Unhandled error', {
          requestId,
          url: req.url,
          method: req.method,
          errorType: err.constructor.name
        });
        res.status(500).json({ error: 'Internal server error' });
      }
    });
    
  }

  private setupConversationRoutes(): void {
    // Start new conversation
    this.app.post('/api/conversations/start', async (req: Request<{}, StartConversationResponse, StartConversationRequest>, res, next) => {
      const requestId = (req as any).requestId;
      this.logger.debug('Start conversation request', {
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
        
        const { streamingId, systemInit } = await this.processManager.startConversation(req.body);
        
        this.logger.debug('Conversation started successfully', {
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
        this.logger.debug('Start conversation failed', {
          requestId,
          error: error instanceof Error ? error.message : String(error)
        });
        next(error);
      }
    });

    // Resume existing conversation
    this.app.post('/api/conversations/resume', async (req: Request<{}, StartConversationResponse, ResumeConversationRequest>, res, next) => {
      const requestId = (req as any).requestId;
      this.logger.debug('Resume conversation request', {
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
        
        const { streamingId, systemInit } = await this.processManager.resumeConversation({
          sessionId: req.body.sessionId,
          message: req.body.message
        });
        
        this.logger.debug('Conversation resumed successfully', {
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
        this.logger.debug('Resume conversation failed', {
          requestId,
          sessionId: req.body.sessionId,
          error: error instanceof Error ? error.message : String(error)
        });
        next(error);
      }
    });

    // List conversations
    this.app.get('/api/conversations', async (req: Request<{}, {}, {}, ConversationListQuery>, res, next) => {
      const requestId = (req as any).requestId;
      this.logger.debug('List conversations request', {
        requestId,
        query: req.query
      });
      
      try {
        const result = await this.historyReader.listConversations(req.query);
        
        // Update status for each conversation based on active streams
        const conversationsWithStatus = result.conversations.map(conversation => {
          const status = this.statusTracker.getConversationStatus(conversation.sessionId);
          const baseConversation = {
            ...conversation,
            status
          };
          
          // Add streamingId if conversation is ongoing
          if (status === 'ongoing') {
            const streamingId = this.statusTracker.getStreamingId(conversation.sessionId);
            if (streamingId) {
              return { ...baseConversation, streamingId };
            }
          }
          
          return baseConversation;
        });
        
        this.logger.debug('Conversations listed successfully', {
          requestId,
          conversationCount: conversationsWithStatus.length,
          totalFound: result.total,
          activeConversations: conversationsWithStatus.filter(c => c.status === 'ongoing').length
        });
        
        res.json({
          conversations: conversationsWithStatus,
          total: result.total
        });
      } catch (error) {
        this.logger.debug('List conversations failed', {
          requestId,
          error: error instanceof Error ? error.message : String(error)
        });
        next(error);
      }
    });

    // Get conversation details
    this.app.get('/api/conversations/:sessionId', async (req, res, next) => {
      const requestId = (req as any).requestId;
      const { sessionId } = req.params;
      
      this.logger.debug('Get conversation details request', {
        requestId,
        sessionId
      });
      
      try {
        const messages = await this.historyReader.fetchConversation(req.params.sessionId);
        const metadata = await this.historyReader.getConversationMetadata(req.params.sessionId);
        
        if (!metadata) {
          throw new CCUIError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
        }
        
        const response: ConversationDetailsResponse = {
          messages,
          summary: metadata.summary,
          projectPath: metadata.projectPath,
          metadata: {
            totalCost: metadata.totalCost,
            totalDuration: metadata.totalDuration,
            model: metadata.model
          }
        };
        
        this.logger.debug('Conversation details retrieved successfully', {
          requestId,
          sessionId,
          messageCount: response.messages.length,
          hasSummary: !!response.summary,
          projectPath: response.projectPath
        });
        
        res.json(response);
      } catch (error) {
        this.logger.debug('Get conversation details failed', {
          requestId,
          sessionId,
          error: error instanceof Error ? error.message : String(error)
        });
        next(error);
      }
    });


    // Stop conversation
    this.app.post('/api/conversations/:streamingId/stop', async (req, res, next) => {
      const requestId = (req as any).requestId;
      const { streamingId } = req.params;
      
      this.logger.debug('Stop conversation request', {
        requestId,
        streamingId
      });
      
      try {
        const success = await this.processManager.stopConversation(streamingId);
        
        this.logger.debug('Stop conversation result', {
          requestId,
          streamingId,
          success
        });
        
        res.json({ success });
      } catch (error) {
        this.logger.debug('Stop conversation failed', {
          requestId,
          streamingId,
          error: error instanceof Error ? error.message : String(error)
        });
        next(error);
      }
    });
  }

  private setupSystemRoutes(): void {
    // Get system status
    this.app.get('/api/system/status', async (req, res, next) => {
      const requestId = (req as any).requestId;
      this.logger.debug('Get system status request', { requestId });
      
      try {
        const systemStatus = await this.getSystemStatus();
        
        this.logger.debug('System status retrieved', {
          requestId,
          ...systemStatus
        });
        
        res.json(systemStatus);
      } catch (error) {
        this.logger.debug('Get system status failed', {
          requestId,
          error: error instanceof Error ? error.message : String(error)
        });
        next(error);
      }
    });
  }

  private setupStreamingRoute(): void {
    this.app.get('/api/stream/:streamingId', (req, res) => {
      const { streamingId } = req.params;
      const requestId = (req as any).requestId;
      
      this.logger.debug('Stream connection request', {
        requestId,
        streamingId,
        headers: {
          'accept': req.headers.accept,
          'user-agent': req.headers['user-agent']
        }
      });
      
      this.streamManager.addClient(streamingId, res);
      
      // Log when stream closes
      res.on('close', () => {
        this.logger.debug('Stream connection closed', {
          requestId,
          streamingId
        });
      });
    });
  }

  private setupProcessManagerIntegration(): void {
    this.logger.debug('Setting up ProcessManager integration with StreamManager');
    
    // Forward Claude messages to stream
    this.processManager.on('claude-message', ({ streamingId, message }) => {
      this.logger.debug('Received claude-message event', { 
        streamingId, 
        messageType: message?.type,
        messageSubtype: message?.subtype,
        hasContent: !!message?.content,
        contentLength: message?.content?.length || 0,
        messageKeys: message ? Object.keys(message) : []
      });
      
      // Extract session ID from stream message and register with status tracker
      if (message && message.session_id) {
        const claudeSessionId = message.session_id;
        this.logger.debug('Registering active session with status tracker', {
          streamingId,
          claudeSessionId
        });
        this.statusTracker.registerActiveSession(streamingId, claudeSessionId);
      }
      
      // Skip broadcasting system init messages as they're now included in API response
      if (message && message.type === 'system' && message.subtype === 'init') {
        this.logger.debug('Skipping broadcast of system init message (included in API response)', {
          streamingId,
          sessionId: message.session_id
        });
        return;
      }
      
      // Stream other Claude messages as normal
      this.logger.debug('Broadcasting message to StreamManager', { 
        streamingId, 
        messageType: message?.type,
        messageSubtype: message?.subtype
      });
      this.streamManager.broadcast(streamingId, message);
    });

    // Handle process closure
    this.processManager.on('process-closed', ({ streamingId, code }) => {
      this.logger.debug('Received process-closed event, closing StreamManager session', { 
        streamingId,
        exitCode: code,
        clientCount: this.streamManager.getClientCount(streamingId),
        wasSuccessful: code === 0
      });
      
      // Unregister session from status tracker
      this.logger.debug('Unregistering session from status tracker', { streamingId });
      this.statusTracker.unregisterActiveSession(streamingId);
      
      this.streamManager.closeSession(streamingId);
    });

    // Handle process errors
    this.processManager.on('process-error', ({ streamingId, error }) => {
      this.logger.debug('Received process-error event, forwarding to StreamManager', { 
        streamingId, 
        error,
        errorLength: error?.toString().length || 0,
        clientCount: this.streamManager.getClientCount(streamingId)
      });
      
      // Unregister session from status tracker on error
      this.logger.debug('Unregistering session from status tracker due to error', { streamingId });
      this.statusTracker.unregisterActiveSession(streamingId);
      
      const errorEvent: StreamEvent = {
        type: 'error' as const,
        error: error.toString(),
        streamingId: streamingId,
        timestamp: new Date().toISOString()
      };
      
      this.logger.debug('Broadcasting error event to clients', {
        streamingId,
        errorEventKeys: Object.keys(errorEvent)
      });
      
      this.streamManager.broadcast(streamingId, errorEvent);
    });
    
    this.logger.debug('ProcessManager integration setup complete', {
      totalEventListeners: this.processManager.listenerCount('claude-message') + 
                          this.processManager.listenerCount('process-closed') + 
                          this.processManager.listenerCount('process-error')
    });
  }

  /**
   * Get system status including Claude version and active conversations
   */
  private async getSystemStatus(): Promise<SystemStatusResponse> {
    const { execSync } = require('child_process');
    
    try {
      // Get Claude version
      let claudeVersion = 'unknown';
      let claudePath = 'unknown';
      
      try {
        claudePath = execSync('which claude', { encoding: 'utf-8' }).trim();
        claudeVersion = execSync('claude --version', { encoding: 'utf-8' }).trim();
        this.logger.debug('Claude version info retrieved', {
          version: claudeVersion,
          path: claudePath
        });
      } catch (error) {
        this.logger.warn('Failed to get Claude version information', { 
          error: error instanceof Error ? error.message : String(error),
          errorCode: (error as any).code
        });
      }
      
      return {
        claudeVersion,
        claudePath,
        configPath: this.historyReader.homePath,
        activeConversations: this.processManager.getActiveSessions().length
      };
    } catch (error) {
      throw new CCUIError('SYSTEM_STATUS_ERROR', 'Failed to get system status', 500);
    }
  }
}