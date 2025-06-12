import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ClaudeProcessManager } from './services/claude-process-manager';
import { StreamManager } from './services/stream-manager';
import { ClaudeHistoryReader } from './services/claude-history-reader';
import { CCUIMCPServer } from './mcp-server/ccui-mcp-server';
import { 
  StartConversationRequest, 
  ConversationListQuery,
  ContinueConversationRequest,
  PermissionDecisionRequest,
  CCUIError 
} from './types';
import pino from 'pino';

/**
 * Main CCUI server class
 */
export class CCUIServer {
  private app: Express;
  private processManager: ClaudeProcessManager;
  private streamManager: StreamManager;
  private historyReader: ClaudeHistoryReader;
  private mcpServer: CCUIMCPServer;
  private logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  private port: number;

  constructor(config?: {
    port?: number;
    mcpConfigPath?: string;
    claudeHomePath?: string;
  }) {
    this.port = config?.port || parseInt(process.env.PORT || '3001');
    this.app = express();
    
    // Initialize services
    this.processManager = new ClaudeProcessManager(config?.mcpConfigPath);
    this.streamManager = new StreamManager();
    this.historyReader = new ClaudeHistoryReader(config?.claudeHomePath);
    this.mcpServer = new CCUIMCPServer();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupMCPIntegration();
    this.setupProcessManagerIntegration();
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      // Start MCP server
      await this.mcpServer.start();
      
      // Start Express server
      await new Promise<void>((resolve) => {
        this.app.listen(this.port, () => {
          this.logger.info(`CCUI backend server running on port ${this.port}`);
          resolve();
        });
      });
    } catch (error) {
      this.logger.error('Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    await this.mcpServer.stop();
    // TODO: Implement graceful shutdown
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info({ method: req.method, url: req.url }, 'Incoming request');
      next();
    });
    
    // Error handling
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      if (err instanceof CCUIError) {
        res.status(err.statusCode).json({ error: err.message, code: err.code });
      } else {
        this.logger.error(err, 'Unhandled error');
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Conversation management routes
    this.setupConversationRoutes();
    
    // Permission management routes  
    this.setupPermissionRoutes();
    
    // System management routes
    this.setupSystemRoutes();
    
    // Streaming endpoint
    this.setupStreamingRoute();
  }

  private setupConversationRoutes(): void {
    // Start new conversation
    this.app.post('/api/conversations/start', async (req: Request<{}, {}, StartConversationRequest>, res, next) => {
      try {
        const sessionId = await this.processManager.startConversation(req.body);
        res.json({ 
          sessionId, 
          streamUrl: `/api/stream/${sessionId}` 
        });
      } catch (error) {
        next(error);
      }
    });

    // List conversations
    this.app.get('/api/conversations', async (req: Request<{}, {}, {}, ConversationListQuery>, res, next) => {
      try {
        const result = await this.historyReader.listConversations(req.query);
        res.json(result);
      } catch (error) {
        next(error);
      }
    });

    // Get conversation details
    this.app.get('/api/conversations/:sessionId', async (req, res, next) => {
      try {
        const messages = await this.historyReader.fetchConversation(req.params.sessionId);
        const metadata = await this.historyReader.getConversationMetadata(req.params.sessionId);
        
        if (!metadata) {
          throw new CCUIError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
        }
        
        res.json({
          messages,
          ...metadata
        });
      } catch (error) {
        next(error);
      }
    });

    // Continue conversation
    this.app.post('/api/conversations/:sessionId/continue', async (req: Request<{ sessionId: string }, {}, ContinueConversationRequest>, res, next) => {
      try {
        await this.processManager.sendInput(req.params.sessionId, req.body.prompt);
        res.json({ 
          streamUrl: `/api/stream/${req.params.sessionId}` 
        });
      } catch (error) {
        next(error);
      }
    });

    // Stop conversation
    this.app.post('/api/conversations/:sessionId/stop', async (req, res, next) => {
      try {
        const success = await this.processManager.stopConversation(req.params.sessionId);
        res.json({ success });
      } catch (error) {
        next(error);
      }
    });
  }

  private setupPermissionRoutes(): void {
    // List pending permissions
    this.app.get('/api/permissions', (req, res) => {
      const permissions = this.mcpServer.getPendingRequests();
      const filtered = req.query.sessionId 
        ? permissions.filter(p => p.sessionId === req.query.sessionId)
        : permissions;
      res.json({ permissions: filtered });
    });

    // Handle permission decision
    this.app.post('/api/permissions/:requestId', (req: Request<{ requestId: string }, {}, PermissionDecisionRequest>, res, next) => {
      try {
        const success = this.mcpServer.handleDecision(
          req.params.requestId,
          req.body.action,
          req.body.modifiedInput
        );
        res.json({ success });
      } catch (error) {
        next(error);
      }
    });
  }

  private setupSystemRoutes(): void {
    // Get system status
    this.app.get('/api/system/status', async (req, res, next) => {
      try {
        // TODO: Implement actual system status checks
        res.json({
          claudeVersion: '1.0.0',
          claudePath: '/usr/local/bin/claude',
          configPath: process.env.CLAUDE_HOME_PATH || '~/.claude',
          activeConversations: this.processManager.getActiveSessions().length
        });
      } catch (error) {
        next(error);
      }
    });

    // Get available models
    this.app.get('/api/models', (req, res) => {
      // TODO: Get actual available models
      res.json({
        models: ['claude-opus-4-20250514', 'claude-3-5-sonnet-20241022'],
        defaultModel: 'claude-opus-4-20250514'
      });
    });
  }

  private setupStreamingRoute(): void {
    this.app.get('/api/stream/:sessionId', (req, res) => {
      const { sessionId } = req.params;
      this.streamManager.addClient(sessionId, res);
    });
  }

  private setupMCPIntegration(): void {
    // Forward permission requests to stream
    this.mcpServer.on('permission-request', (request) => {
      this.streamManager.broadcast(request.sessionId, {
        type: 'permission_request',
        data: request,
        sessionId: request.sessionId,
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupProcessManagerIntegration(): void {
    // Forward Claude messages to stream
    this.processManager.on('claude-message', ({ sessionId, message }) => {
      this.streamManager.broadcast(sessionId, {
        type: 'claude_message',
        data: message,
        sessionId,
        timestamp: new Date().toISOString()
      });
    });

    // Handle process closure
    this.processManager.on('process-closed', ({ sessionId }) => {
      this.streamManager.closeSession(sessionId);
    });

    // Handle process errors
    this.processManager.on('process-error', ({ sessionId, error }) => {
      this.streamManager.broadcast(sessionId, {
        type: 'error',
        error,
        sessionId,
        timestamp: new Date().toISOString()
      });
    });
  }
}