import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@/services/logger';

const logger = createLogger('RequestLogger');

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = Math.random().toString(36).substring(7);
  (req as any).requestId = requestId;
  
  logger.debug('Incoming request', { 
    method: req.method, 
    url: req.url,
    requestId,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    },
    query: req.query,
    ip: req.ip
  });
  
  // Log response when finished
  const startTime = Date.now();
  res.on('finish', () => {
    logger.debug('Request completed', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: Date.now() - startTime,
      contentLength: res.get('content-length')
    });
  });
  
  next();
}