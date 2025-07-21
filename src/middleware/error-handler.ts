import { Request, Response, NextFunction } from 'express';
import { CCUIError } from '@/types';
import { createLogger } from '@/services/logger';

const logger = createLogger('ErrorHandler');

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  const requestId = (req as any).requestId || 'unknown';
  
  if (err instanceof CCUIError) {
    logger.warn('CCUIError in request', {
      requestId,
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      url: req.url,
      method: req.method
    });
    res.status(err.statusCode).json({ error: err.message, code: err.code });
  } else {
    logger.error('Unhandled error', err, {
      requestId,
      url: req.url,
      method: req.method,
      errorType: err.constructor.name
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}