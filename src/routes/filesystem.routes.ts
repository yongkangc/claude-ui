import { Router, Request } from 'express';
import { 
  CCUIError,
  FileSystemListQuery,
  FileSystemListResponse,
  FileSystemReadQuery,
  FileSystemReadResponse 
} from '@/types';
import { FileSystemService } from '@/services/file-system-service';
import { createLogger, type Logger } from '@/services/logger';

export function createFileSystemRoutes(
  fileSystemService: FileSystemService
): Router {
  const router = Router();
  const logger = createLogger('FileSystemRoutes');

  // List directory contents
  router.get('/list', async (req: Request<{}, FileSystemListResponse, {}, any>, res, next) => {
    const requestId = (req as any).requestId;
    logger.debug('List directory request', {
      requestId,
      path: req.query.path,
      recursive: req.query.recursive,
      respectGitignore: req.query.respectGitignore
    });
    
    try {
      // Validate required parameters
      if (!req.query.path) {
        throw new CCUIError('MISSING_PATH', 'path query parameter is required', 400);
      }
      
      const result = await fileSystemService.listDirectory(
        req.query.path as string,
        req.query.recursive === 'true',
        req.query.respectGitignore === 'true'
      );
      
      logger.debug('Directory listed successfully', {
        requestId,
        path: result.path,
        entryCount: result.entries.length
      });
      
      res.json(result);
    } catch (error) {
      logger.debug('List directory failed', {
        requestId,
        path: req.query.path,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  // Read file contents
  router.get('/read', async (req: Request<{}, FileSystemReadResponse, {}, FileSystemReadQuery>, res, next) => {
    const requestId = (req as any).requestId;
    logger.debug('Read file request', {
      requestId,
      path: req.query.path
    });
    
    try {
      // Validate required parameters
      if (!req.query.path) {
        throw new CCUIError('MISSING_PATH', 'path query parameter is required', 400);
      }
      
      const result = await fileSystemService.readFile(req.query.path);
      
      logger.debug('File read successfully', {
        requestId,
        path: result.path,
        size: result.size
      });
      
      res.json(result);
    } catch (error) {
      logger.debug('Read file failed', {
        requestId,
        path: req.query.path,
        error: error instanceof Error ? error.message : String(error)
      });
      next(error);
    }
  });

  return router;
}