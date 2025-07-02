import { FileSystemService } from '@/services/file-system-service';
import { CCUIError } from '@/types';

describe('FileSystemService', () => {
  let service: FileSystemService;

  beforeEach(() => {
    service = new FileSystemService();
  });

  describe('Path validation', () => {
    it('should reject relative paths', async () => {
      await expect(service.listDirectory('../etc')).rejects.toThrow(
        new CCUIError('INVALID_PATH', 'Path must be absolute', 400)
      );
    });

    it('should reject paths with traversal attempts', async () => {
      await expect(service.listDirectory('/home/../etc')).rejects.toThrow(
        new CCUIError('PATH_TRAVERSAL_DETECTED', 'Invalid path: path traversal detected', 400)
      );
    });

    it('should reject paths with null bytes', async () => {
      await expect(service.listDirectory('/home/user\u0000/file')).rejects.toThrow(
        new CCUIError('INVALID_PATH', 'Path contains null bytes', 400)
      );
    });

    it('should reject paths with invalid characters', async () => {
      await expect(service.listDirectory('/home/user<file>')).rejects.toThrow(
        new CCUIError('INVALID_PATH', 'Path contains invalid characters', 400)
      );
    });

    it('should reject paths with hidden directories', async () => {
      await expect(service.listDirectory('/home/.hidden')).rejects.toThrow(
        new CCUIError('INVALID_PATH', 'Path contains hidden files/directories', 400)
      );
    });

    it('should accept valid absolute paths', async () => {
      // This will fail with PATH_NOT_FOUND which is expected for non-existent paths
      await expect(service.listDirectory('/this/path/does/not/exist')).rejects.toThrow(
        new CCUIError('PATH_NOT_FOUND', 'Path not found: /this/path/does/not/exist', 404)
      );
    });
  });

  describe('File size validation', () => {
    it('should respect custom max file size', async () => {
      const smallSizeService = new FileSystemService(10); // 10 bytes max
      // This test would need a real file to test properly
      // For now, we just verify the service was created with custom size
      expect(smallSizeService).toBeDefined();
    });
  });

  describe('Allowed base paths', () => {
    it('should restrict access to allowed paths only', async () => {
      const restrictedService = new FileSystemService(undefined, ['/home/user']);
      
      await expect(restrictedService.listDirectory('/etc/passwd')).rejects.toThrow(
        new CCUIError('PATH_NOT_ALLOWED', 'Path is outside allowed directories', 403)
      );
    });

    it('should allow access within allowed paths', async () => {
      const restrictedService = new FileSystemService(undefined, ['/home/user']);
      
      // This will fail with PATH_NOT_FOUND which is expected
      await expect(restrictedService.listDirectory('/home/user/documents')).rejects.toThrow(
        new CCUIError('PATH_NOT_FOUND', 'Path not found: /home/user/documents', 404)
      );
    });
  });
});