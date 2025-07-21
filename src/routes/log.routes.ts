import { Router } from 'express';
import { logStreamBuffer } from '@/services/log-stream-buffer';
import { createLogger, type Logger } from '@/services/logger';

export function createLogRoutes(): Router {
  const router = Router();
  const logger = createLogger('LogRoutes');

  // Get recent logs
  router.get('/recent', (req, res) => {
    const requestId = (req as any).requestId;
    const limitParam = req.query.limit as string;
    const limit = limitParam !== undefined ? parseInt(limitParam) : 100;
    const validLimit = isNaN(limit) ? 100 : limit;
    
    logger.debug('Get recent logs request', {
      requestId,
      limit: validLimit
    });
    
    try {
      const logs = logStreamBuffer.getRecentLogs(validLimit);
      res.json({ logs });
    } catch (error) {
      logger.error('Failed to get recent logs', error, { requestId });
      res.status(500).json({ error: 'Failed to retrieve logs' });
    }
  });
  
  // Stream logs via SSE
  router.get('/stream', (req, res) => {
    const requestId = (req as any).requestId;
    
    logger.debug('Log stream connection request', {
      requestId,
      headers: {
        'accept': req.headers.accept,
        'user-agent': req.headers['user-agent']
      }
    });
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable proxy buffering
    });
    
    // Send initial connection confirmation
    res.write('data: {"type":"connected"}\n\n');
    
    // Create log listener
    const logListener = (logLine: string) => {
      res.write(`data: ${logLine}\n\n`);
    };
    
    // Subscribe to log events
    logStreamBuffer.on('log', logListener);
    
    // Handle client disconnect
    req.on('close', () => {
      logger.debug('Log stream connection closed', { requestId });
      logStreamBuffer.removeListener('log', logListener);
    });
    
    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 30000);
    
    // Clean up heartbeat on disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
    });
  });

  return router;
}