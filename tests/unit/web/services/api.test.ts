import { api } from '@/web/chat/services/api';
import type { 
  PermissionDecisionRequest, 
  PermissionDecisionResponse,
  FileSystemListQuery,
  FileSystemListResponse 
} from '@/types';

// Mock fetch globally
global.fetch = jest.fn();

describe('API Service - Permission Decisions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('sendPermissionDecision', () => {
    it('should send approval decision successfully', async () => {
      const requestId = 'test-request-id';
      const decision: PermissionDecisionRequest = {
        action: 'approve',
        modifiedInput: { test: 'modified' },
      };

      const mockResponse: PermissionDecisionResponse = {
        success: true,
        message: 'Permission approved successfully',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await api.sendPermissionDecision(requestId, decision);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/permissions/${requestId}/decision`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(decision),
        })
      );
    });

    it('should send deny decision successfully', async () => {
      const requestId = 'test-request-id';
      const decision: PermissionDecisionRequest = {
        action: 'deny',
        denyReason: 'User denied this action',
      };

      const mockResponse: PermissionDecisionResponse = {
        success: true,
        message: 'Permission denied successfully',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await api.sendPermissionDecision(requestId, decision);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/permissions/${requestId}/decision`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(decision),
        })
      );
    });

    it('should handle API errors', async () => {
      const requestId = 'test-request-id';
      const decision: PermissionDecisionRequest = {
        action: 'approve',
      };

      const errorResponse = {
        error: 'Permission request not found',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => errorResponse,
      });

      await expect(api.sendPermissionDecision(requestId, decision))
        .rejects
        .toThrow('Permission request not found');

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/permissions/${requestId}/decision`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(decision),
        })
      );
    });

    it('should handle network errors', async () => {
      const requestId = 'test-request-id';
      const decision: PermissionDecisionRequest = {
        action: 'approve',
      };

      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(api.sendPermissionDecision(requestId, decision))
        .rejects
        .toThrow('Network error');
    });

    it('should make POST request with correct parameters', async () => {
      const requestId = 'test-request-id';
      const decision: PermissionDecisionRequest = {
        action: 'approve',
      };

      const mockResponse: PermissionDecisionResponse = {
        success: true,
        message: 'Permission approved successfully',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await api.sendPermissionDecision(requestId, decision);

      // Check that fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/permissions/${requestId}/decision`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(decision),
        }
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe('listDirectory', () => {
    it('should list directory with basic path', async () => {
      const query: FileSystemListQuery = {
        path: '/home/user/project',
      };

      const mockResponse: FileSystemListResponse = {
        path: '/home/user/project',
        entries: [
          {
            name: 'src',
            type: 'directory',
            lastModified: '2025-01-23T10:00:00Z',
          },
          {
            name: 'package.json',
            type: 'file',
            size: 1234,
            lastModified: '2025-01-23T09:00:00Z',
          },
        ],
        total: 2,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await api.listDirectory(query);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/filesystem/list?path=%2Fhome%2Fuser%2Fproject',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should list directory with recursive and gitignore options', async () => {
      const query: FileSystemListQuery = {
        path: '/home/user/project',
        recursive: true,
        respectGitignore: true,
      };

      const mockResponse: FileSystemListResponse = {
        path: '/home/user/project',
        entries: [
          {
            name: 'src',
            type: 'directory',
            lastModified: '2025-01-23T10:00:00Z',
          },
          {
            name: 'src/index.ts',
            type: 'file',
            size: 567,
            lastModified: '2025-01-23T10:30:00Z',
          },
        ],
        total: 2,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await api.listDirectory(query);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/filesystem/list?path=%2Fhome%2Fuser%2Fproject&recursive=true&respectGitignore=true',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle API errors when listing directory', async () => {
      const query: FileSystemListQuery = {
        path: '/nonexistent/path',
      };

      const errorResponse = {
        error: 'Directory not found',
        code: 'PATH_NOT_FOUND',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => errorResponse,
      });

      await expect(api.listDirectory(query))
        .rejects
        .toThrow('Directory not found');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/filesystem/list?path=%2Fnonexistent%2Fpath',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle network errors when listing directory', async () => {
      const query: FileSystemListQuery = {
        path: '/home/user/project',
      };

      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(api.listDirectory(query))
        .rejects
        .toThrow('Network error');
    });

    it('should properly encode special characters in path', async () => {
      const query: FileSystemListQuery = {
        path: '/home/user/my project/with spaces',
      };

      const mockResponse: FileSystemListResponse = {
        path: '/home/user/my project/with spaces',
        entries: [],
        total: 0,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await api.listDirectory(query);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/filesystem/list?path=%2Fhome%2Fuser%2Fmy+project%2Fwith+spaces',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });
});