import { CCUIServer } from '../../ccui-server';
import { createLogger } from '../../services/logger';

interface ServeOptions {
  port: string;
}

export async function serveCommand(options: ServeOptions): Promise<void> {
  const logger = createLogger('ServeCommand');
  
  try {
    const server = new CCUIServer({
      port: parseInt(options.port)
    });

    logger.info(`Starting CCUI server on port ${options.port}`);
    await server.start();
    logger.info(`CCUI server is running at http://localhost:${options.port}`);
    
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