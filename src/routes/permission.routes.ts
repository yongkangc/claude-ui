import { Router } from 'express';
import { CCUIError } from '@/types';
import { PermissionTracker } from '@/services/permission-tracker';
import { createLogger, type Logger } from '@/services/logger';

export function createPermissionRoutes(
  permissionTracker: PermissionTracker
): Router {
  const router = Router();
  const logger = createLogger('PermissionRoutes');

  // Notify endpoint - called by MCP server when permission is requested
  router.post('/notify', async (req, res, next) => {
    const requestId = (req as any).requestId;
    logger.debug('Permission notification received', {
      requestId,
      body: req.body
    });
    
    try {
      const { toolName, toolInput, streamingId } = req.body;
      
      if (!toolName) {
        throw new CCUIError('MISSING_TOOL_NAME', 'toolName is required', 400);
      }
      
      // Add permission request with the provided streamingId
      const request = permissionTracker.addPermissionRequest(toolName, toolInput, streamingId);
      
      logger.debug('Permission request tracked', {
        requestId,
        permissionId: request.id,
        toolName,
        streamingId: request.streamingId
      });
      
      res.json({ success: true, id: request.id });
    } catch (error) {
      logger.debug('Permission notification failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  // List permissions
  router.get('/', async (req, res, next) => {
    const requestId = (req as any).requestId;
    logger.debug('List permissions request', {
      requestId,
      query: req.query
    });
    
    try {
      const { streamingId, status } = req.query as { streamingId?: string; status?: 'pending' | 'approved' | 'denied' };
      
      const permissions = permissionTracker.getPermissionRequests({ streamingId, status });
      
      logger.debug('Permissions listed successfully', {
        requestId,
        count: permissions.length,
        filter: { streamingId, status }
      });
      
      res.json({ permissions });
    } catch (error) {
      logger.debug('List permissions failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  return router;
}