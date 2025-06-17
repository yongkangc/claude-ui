import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ClaudeProcessManager } from './services/claude-process-manager';
import { StreamManager } from './services/stream-manager';
import { ClaudeHistoryReader } from './services/claude-history-reader';
import { 
  StartConversationRequest, 
  ConversationListQuery,
  ConversationDetailsResponse,
  SystemStatusResponse,
  ModelsResponse,
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
  private logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  private port: number;

  constructor(config?: {
    port?: number;
  }) {
    this.port = config?.port || parseInt(process.env.PORT || '3001');
    this.app = express();
    
    // Initialize services
    this.processManager = new ClaudeProcessManager();
    this.streamManager = new StreamManager();
    this.historyReader = new ClaudeHistoryReader();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupProcessManagerIntegration();
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {

      // Start Express server
      this.logger.info(`Starting HTTP server on port ${this.port}...`);
      await new Promise<void>((resolve, reject) => {
        this.server = this.app.listen(this.port, () => {
          this.logger.info(`CCUI backend server running on port ${this.port}`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          this.logger.error('Failed to start HTTP server:', error);
          reject(new CCUIError('HTTP_SERVER_START_FAILED', `Failed to start HTTP server: ${error.message}`, 500));
        });
      });
    } catch (error) {
      this.logger.error('Failed to start server:', error);
      
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
        activeSessions.map(streamingId => 
          this.processManager.stopConversation(streamingId)
            .catch(error => this.logger.error(`Error stopping session ${streamingId}:`, error))
        )
      );
    }
    
    // Disconnect all streaming clients
    this.streamManager.disconnectAll();
    this.logger.info('Graceful shutdown complete');
  }

  /**
   * Cleanup resources during failed startup
   */
  private async cleanup(): Promise<void> {
    this.logger.info('Performing cleanup after startup failure...');
    
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
      this.logger.error('Error during cleanup:', error);
    }
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
    
    // System management routes
    this.setupSystemRoutes();
    
    // Streaming endpoint
    this.setupStreamingRoute();
  }

  private setupConversationRoutes(): void {
    // Start new conversation
    this.app.post('/api/conversations/start', async (req: Request<{}, {}, StartConversationRequest>, res, next) => {
      try {
        // Validate required fields
        if (!req.body.workingDirectory) {
          throw new CCUIError('MISSING_WORKING_DIRECTORY', 'workingDirectory is required', 400);
        }
        if (!req.body.initialPrompt) {
          throw new CCUIError('MISSING_INITIAL_PROMPT', 'initialPrompt is required', 400);
        }
        
        const streamingId = await this.processManager.startConversation(req.body);
        res.json({ 
          sessionId: streamingId, 
          streamUrl: `/api/stream/${streamingId}` 
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


    // Stop conversation
    this.app.post('/api/conversations/:streamingId/stop', async (req, res, next) => {
      try {
        const success = await this.processManager.stopConversation(req.params.streamingId);
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
    this.app.get('/api/stream/:streamingId', (req, res) => {
      const { streamingId } = req.params;
      this.streamManager.addClient(streamingId, res);
    });
  }

  private setupProcessManagerIntegration(): void {
    // Forward Claude messages to stream
    this.processManager.on('claude-message', ({ streamingId, message }) => {
      // Stream the Claude message directly as documented
      this.streamManager.broadcast(streamingId, message);
    });

    // Handle process closure
    this.processManager.on('process-closed', ({ streamingId }) => {
      this.streamManager.closeSession(streamingId);
    });

    // Handle process errors
    this.processManager.on('process-error', ({ streamingId, error }) => {
      this.streamManager.broadcast(streamingId, {
        type: 'error',
        error,
        streamingId: streamingId,
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