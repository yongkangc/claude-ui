import { CCUIServer } from './ccui-server';

async function main() {
  const server = new CCUIServer({
    port: parseInt(process.env.PORT || '3001'),
    mcpConfigPath: process.env.MCP_CONFIG_PATH || './mcp-config.json',
    claudeHomePath: process.env.CLAUDE_HOME_PATH
  });

  try {
    await server.start();
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();