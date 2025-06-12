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
  ConversationDetailsResponse,
  SystemStatusResponse,
  CCUIError 
} from './types';
import pino from 'pino';

/**
 * Main CCUI server class
 */
export class CCUIServer {
  private app: Express;
  private server?: import('http').Server;
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
    testMode?: boolean;
  }) {
    this.port = config?.port || parseInt(process.env.PORT || '3001');
    this.app = express();
    
    // Initialize services with test mode support
    const testMode = config?.testMode || false;
    const testClaudeHome = testMode ? config?.claudeHomePath : undefined;
    
    this.processManager = new ClaudeProcessManager(config?.mcpConfigPath, testMode, testClaudeHome);
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
        this.server = this.app.listen(this.port, () => {
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
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    this.logger.info('Starting graceful shutdown...');
    
    // Stop accepting new connections
    if (this.server) {
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
      await Promise.allSettled(
        activeSessions.map(sessionId => 
          this.processManager.stopConversation(sessionId)
            .catch(error => this.logger.error(`Error stopping session ${sessionId}:`, error))
        )
      );
    }
    
    // Disconnect all streaming clients
    this.streamManager.disconnectAll();
    
    // Stop MCP server
    await this.mcpServer.stop();
    
    this.logger.info('Graceful shutdown complete');
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
        
        res.json(response);
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
        const systemStatus = await this.getSystemStatus();
        res.json(systemStatus);
      } catch (error) {
        next(error);
      }
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
      // Stream the Claude message directly as documented
      this.streamManager.broadcast(sessionId, message);
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
      } catch (error) {
        this.logger.warn('Failed to get Claude version information');
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