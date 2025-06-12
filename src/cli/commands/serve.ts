import { CCUIServer } from '../../ccui-server';

interface ServeOptions {
  port: string;
  mcpConfig: string;
  claudeHome?: string;
}

export async function serveCommand(options: ServeOptions): Promise<void> {
  const server = new CCUIServer({
    port: parseInt(options.port),
    mcpConfigPath: options.mcpConfig,
    claudeHomePath: options.claudeHome
  });

  try {
    console.log(`Starting CCUI server on port ${options.port}...`);
    await server.start();
    console.log(`CCUI server is running at http://localhost:${options.port}`);
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\nSIGTERM received, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('\nSIGINT received, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}