import { CCUIMCPServer } from '../../mcp-server/ccui-mcp-server';

interface McpOptions {
  config?: string;
}

export async function mcpCommand(options: McpOptions): Promise<void> {
  const server = new CCUIMCPServer();

  try {
    console.log('Starting CCUI MCP server...');
    await server.start();
    console.log('CCUI MCP server is running');
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\nSIGTERM received, shutting down MCP server...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('\nSIGINT received, shutting down MCP server...');
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}