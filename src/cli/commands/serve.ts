import { CCUIServer } from '../../ccui-server';

interface ServeOptions {
  port: string;
}

export async function serveCommand(options: ServeOptions): Promise<void> {
  try {
    const server = new CCUIServer({
      port: parseInt(options.port)
    });

    console.log(`Starting CCUI server on port ${options.port}...`);
    await server.start();
    console.log(`CCUI server is running at http://localhost:${options.port}`);
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\nSIGTERM received, shutting down gracefully...');
      try {
        await server.stop();
      } catch (stopError) {
        console.error('Error during server shutdown:', stopError);
      }
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('\nSIGINT received, shutting down gracefully...');
      try {
        await server.stop();
      } catch (stopError) {
        console.error('Error during server shutdown:', stopError);
      }
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}