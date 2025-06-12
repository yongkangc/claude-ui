#!/usr/bin/env node

import { CCUIMCPServer } from './ccui-mcp-server';

async function main() {
  const server = new CCUIMCPServer();

  try {
    console.log('Starting CCUI MCP server...');
    await server.start();
    console.log('CCUI MCP server is running');
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down MCP server...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down MCP server...');
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();