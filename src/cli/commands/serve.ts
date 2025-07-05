import { CCUIServer } from '../../ccui-server';
import { createLogger } from '../../services/logger';

interface ServeOptions {
  port?: string;
}

export async function serveCommand(options: ServeOptions): Promise<void> {
  const logger = createLogger('ServeCommand');
  
  try {
    // Allow CLI to override config port
    const configOverrides = options.port ? { port: parseInt(options.port) } : undefined;
    const server = new CCUIServer(configOverrides);

    logger.info('Starting CCUI server...');
    await server.start();
    
    const displayPort = options.port || 'configured';
    logger.info(`CCUI server is running (port: ${displayPort})`);
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      try {
        await server.stop();
      } catch (stopError) {
        logger.error('Error during server shutdown', stopError);
      }
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      try {
        await server.stop();
      } catch (stopError) {
        logger.error('Error during server shutdown', stopError);
      }
      process.exit(0);
    });
  } catch (error) {
    logger.fatal('Failed to start server', error);
    process.exit(1);
  }
}