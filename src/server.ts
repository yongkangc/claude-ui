#!/usr/bin/env node

import { CCUIServer } from './ccui-server';
import { createLogger } from './services/logger';

const logger = createLogger('server');

async function main() {
  try {
    const server = new CCUIServer();
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