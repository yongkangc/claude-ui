#!/usr/bin/env node

import { CCUIServer } from './ccui-server';
import { createLogger } from './services/logger';

const logger = createLogger('server');

function parseArgs(): { port?: number; host?: string } {
  const args = process.argv.slice(2);
  const config: { port?: number; host?: string } = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      const portValue = parseInt(args[i + 1], 10);
      if (!isNaN(portValue) && portValue > 0 && portValue <= 65535) {
        config.port = portValue;
      } else {
        logger.warn(`Invalid port value: ${args[i + 1]}`);
      }
      i++; // Skip next argument since we consumed it
    } else if (args[i] === '--host' && i + 1 < args.length) {
      config.host = args[i + 1];
      i++; // Skip next argument since we consumed it
    }
  }
  
  // Also check environment variables
  if (!config.port && process.env.CCUI_PORT) {
    const envPort = parseInt(process.env.CCUI_PORT, 10);
    if (!isNaN(envPort) && envPort > 0 && envPort <= 65535) {
      config.port = envPort;
    }
  }
  
  if (!config.host && process.env.CCUI_HOST) {
    config.host = process.env.CCUI_HOST;
  }
  
  return config;
}

async function main() {
  try {
    const configOverrides = parseArgs();
    
    if (Object.keys(configOverrides).length > 0) {
      logger.info('Starting server with overrides:', configOverrides);
    }
    
    const server = new CCUIServer(configOverrides);
    await server.start();

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();