import express, { Express } from 'express';
import { ClaudeProcessManager } from './services/claude-process-manager';
import { StreamManager } from './services/stream-manager';
import { ClaudeHistoryReader } from './services/claude-history-reader';
import { ConversationStatusTracker } from './services/conversation-status-tracker';
import { PermissionTracker } from './services/permission-tracker';
import { MCPConfigGenerator } from './services/mcp-config-generator';
import { FileSystemService } from './services/file-system-service';
import { logStreamBuffer } from './services/log-stream-buffer';
import { ConfigService } from './services/config-service';
import { SessionInfoService } from './services/session-info-service';
import { OptimisticConversationService } from './services/optimistic-conversation-service';
import { WorkingDirectoriesService } from './services/working-directories-service';
import { ToolMetricsService } from './services/ToolMetricsService';
import { 
  StreamEvent,
  CCUIError,
  PermissionRequest
} from './types';
import { createLogger, type Logger } from './services/logger';
import { createConversationRoutes } from './routes/conversation.routes';
import { createSystemRoutes } from './routes/system.routes';
import { createPermissionRoutes } from './routes/permission.routes';
import { createFileSystemRoutes } from './routes/filesystem.routes';
import { createLogRoutes } from './routes/log.routes';
import { createStreamingRoutes } from './routes/streaming.routes';
import { createWorkingDirectoriesRoutes } from './routes/working-directories.routes';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { createCorsMiddleware } from './middleware/cors-setup';

// Conditionally import ViteExpress only in non-test environments
let ViteExpress: any;
if (process.env.NODE_ENV !== 'test') {
  ViteExpress = require('vite-express');
}

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
  private permissionTracker: PermissionTracker;
  private mcpConfigGenerator: MCPConfigGenerator;
  private fileSystemService: FileSystemService;
  private configService: ConfigService;
  private sessionInfoService: SessionInfoService;
  private optimisticConversationService: OptimisticConversationService;
  private workingDirectoriesService: WorkingDirectoriesService;
  private toolMetricsService: ToolMetricsService;
  private logger: Logger;
  private port: number;
  private host: string;
  private configOverrides?: { port?: number; host?: string };

  constructor(configOverrides?: { port?: number; host?: string }) {
    this.app = express();
    this.configOverrides = configOverrides;
    
    this.logger = createLogger('CCUIServer');
    
    // TEST: Add debug log right at the start
    this.logger.debug('🔍 TEST: CCUIServer constructor started - this should be visible if debug logging works');
    
    // Initialize config service first
    this.configService = ConfigService.getInstance();
    
    // Will be set after config is loaded
    this.port = 0;
    this.host = '';
    
    this.logger.debug('Initializing CCUIServer', {
      nodeEnv: process.env.NODE_ENV,
      configOverrides
    });
    
    // Initialize services
    this.logger.debug('Initializing services');
    this.historyReader = new ClaudeHistoryReader();
    this.statusTracker = new ConversationStatusTracker();
    this.toolMetricsService = new ToolMetricsService();
    this.processManager = new ClaudeProcessManager(this.historyReader, this.statusTracker, undefined, undefined, this.toolMetricsService);
    this.streamManager = new StreamManager();
    this.permissionTracker = new PermissionTracker();
    this.mcpConfigGenerator = new MCPConfigGenerator();
    this.fileSystemService = new FileSystemService();
    this.sessionInfoService = SessionInfoService.getInstance();
    this.optimisticConversationService = new OptimisticConversationService(this.statusTracker);
    this.workingDirectoriesService = new WorkingDirectoriesService(this.historyReader, this.logger);
    this.logger.debug('Services initialized successfully');
    
    this.setupMiddleware();
    // Routes will be set up in start() to allow tests to override services
    this.setupProcessManagerIntegration();
    this.setupPermissionTrackerIntegration();
    this.processManager.setOptimisticConversationService(this.optimisticConversationService);
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    this.logger.debug('Start method called');
    try {
      // Initialize configuration first
      this.logger.debug('Initializing configuration');
      await this.configService.initialize();
      const config = this.configService.getConfig();
      
      // Initialize session info service
      this.logger.debug('Initializing session info service');
      await this.sessionInfoService.initialize();
      this.logger.debug('Session info service initialized successfully');
      
      // Apply overrides if provided (for tests and CLI options)
      this.port = this.configOverrides?.port ?? config.server.port;
      this.host = this.configOverrides?.host ?? config.server.host;
      
      this.logger.info('Configuration loaded', {
        machineId: config.machine_id,
        port: this.port,
        host: this.host,
        overrides: this.configOverrides ? Object.keys(this.configOverrides) : []
      });

      // Set up routes after services are initialized
      // This allows tests to override services before routes are created
      this.logger.debug('Setting up routes');
      this.setupRoutes();
      
      // Generate MCP config before starting server
      this.logger.debug('Generating MCP config');
      const mcpConfigPath = this.mcpConfigGenerator.generateConfig(this.port);
      this.processManager.setMCPConfigPath(mcpConfigPath);
      this.logger.info('MCP config generated and set', { path: mcpConfigPath });

      // Start Express server
      const isTestEnv = process.env.NODE_ENV === 'test';
      this.logger.info(`Starting HTTP server${!isTestEnv ? ' with Vite' : ''} on ${this.host}:${this.port}...`);
      this.logger.debug('Creating HTTP server listener', { 
        useViteExpress: !isTestEnv,
        environment: process.env.NODE_ENV 
      });
      
      await new Promise<void>((resolve, reject) => {
        // Use ViteExpress in non-test environments, regular Express in tests
        if (!isTestEnv && ViteExpress) {
          try {
            // ViteExpress.listen returns a promise in newer versions
            this.server = this.app.listen(this.port, this.host, () => {
              this.logger.info(`CCUI server with Vite running on ${this.host}:${this.port}`);
              this.logger.debug('Server successfully bound to port', {
                port: this.port,
                host: this.host,
                address: this.server?.address()
              });
              resolve();
            });
            
            // Configure ViteExpress to use existing server
            ViteExpress.config({
              mode: 'development',
              viteConfigFile: 'vite.config.ts'
            });
            
            ViteExpress.bind(this.app, this.server);
          } catch (error) {
            this.logger.error('Failed to start ViteExpress server', error);
            reject(error);
          }
        } else {
          this.server = this.app.listen(this.port, this.host, () => {
            this.logger.info(`CCUI server running on ${this.host}:${this.port}`);
            this.logger.debug('Server successfully bound to port', {
              port: this.port,
              host: this.host,
              address: this.server?.address()
            });
            resolve();
          });
        }

        if (this.server) {
          this.server.on('error', (error: Error) => {
            this.logger.error('Failed to start HTTP server:', error, {
              errorCode: (error as any).code,
              errorSyscall: (error as any).syscall,
              port: this.port,
              host: this.host
            });
            reject(new CCUIError('HTTP_SERVER_START_FAILED', `Failed to start HTTP server: ${error.message}`, 500));
          });
        }
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
    
    // Clean up MCP config
    this.logger.debug('Cleaning up MCP config');
    this.mcpConfigGenerator.cleanup();
    
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
    this.app.use(createCorsMiddleware());
    this.app.use(express.json());
    
    // In test environment, serve static files normally
    // In production/dev, ViteExpress handles static file serving
    if (process.env.NODE_ENV === 'test') {
      this.app.use(express.static('public'));
    }
    
    // Request logging
    this.app.use(requestLogger);
    
  }

  private setupRoutes(): void {
    // System routes (includes health check)
    this.app.use('/api/system', createSystemRoutes(this.processManager, this.historyReader));
    this.app.use('/', createSystemRoutes(this.processManager, this.historyReader)); // For /health at root
    
    // API routes
    this.app.use('/api/conversations', createConversationRoutes(
      this.processManager,
      this.historyReader,
      this.statusTracker,
      this.sessionInfoService,
      this.optimisticConversationService,
      this.toolMetricsService
    ));
    
    this.app.use('/api/permissions', createPermissionRoutes(this.permissionTracker));
    this.app.use('/api/filesystem', createFileSystemRoutes(this.fileSystemService));
    this.app.use('/api/logs', createLogRoutes());
    this.app.use('/api/stream', createStreamingRoutes(this.streamManager));
    this.app.use('/api/working-directories', createWorkingDirectoriesRoutes(this.workingDirectoriesService));
    
    // ViteExpress handles React app routing automatically
    
    // Error handling - MUST be last
    this.app.use(errorHandler);
  }

  private setupProcessManagerIntegration(): void {
    this.logger.debug('Setting up ProcessManager integration with StreamManager');
    
    // Set up tool metrics service to listen to claude messages
    this.toolMetricsService.listenToClaudeMessages(this.processManager);
    
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
      
      // Clean up optimistic context
      this.optimisticConversationService.cleanupOptimisticContext(streamingId);
      
      // Clean up permissions for this streaming session
      const removedCount = this.permissionTracker.removePermissionsByStreamingId(streamingId);
      if (removedCount > 0) {
        this.logger.debug('Cleaned up permissions for closed session', { 
          streamingId, 
          removedPermissions: removedCount 
        });
      }
      
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
      
      // Clean up optimistic context on error
      this.optimisticConversationService.cleanupOptimisticContext(streamingId);
      
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

  private setupPermissionTrackerIntegration(): void {
    this.logger.debug('Setting up PermissionTracker integration');
    
    // Forward permission events to stream
    this.permissionTracker.on('permission_request', (request: PermissionRequest) => {
      this.logger.debug('Permission request event received', {
        id: request.id,
        toolName: request.toolName,
        streamingId: request.streamingId
      });
      
      // Broadcast to the appropriate streaming session
      if (request.streamingId && request.streamingId !== 'unknown') {
        const event: StreamEvent = {
          type: 'permission_request',
          data: request,
          streamingId: request.streamingId,
          timestamp: new Date().toISOString()
        };
        
        this.streamManager.broadcast(request.streamingId, event);
      }
    });
    
    this.logger.debug('PermissionTracker integration setup complete');
  }
}