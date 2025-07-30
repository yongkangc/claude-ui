import { NotificationService } from '@/services/notification-service';
import { PreferencesService } from '@/services/preferences-service';
import { PermissionRequest } from '@/types';
import { generateMachineId } from '@/utils/machine-id';

// Mock dependencies
jest.mock('@/services/preferences-service');
jest.mock('@/services/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }))
}));

// Mock the machine-id module before importing the service
jest.mock('@/utils/machine-id', () => ({
  generateMachineId: jest.fn().mockResolvedValue('test-machine-12345678')
}));

// Mock fetch
global.fetch = jest.fn();

describe('NotificationService', () => {
  let service: NotificationService;
  let mockPreferencesService: jest.Mocked<PreferencesService>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocked preferences service
    mockPreferencesService = {
      getPreferences: jest.fn().mockResolvedValue({
        colorScheme: 'system',
        language: 'en',
        notifications: {
          enabled: true,
          ntfyUrl: 'https://ntfy.sh'
        }
      })
    } as any;
    
    // Create service instance for each test
    service = new NotificationService(mockPreferencesService);
    
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('Success')
    });
  });

  describe('sendPermissionNotification', () => {
    const mockPermissionRequest: PermissionRequest = {
      id: 'perm-123',
      streamingId: 'stream-456',
      toolName: 'Bash',
      toolInput: { command: 'npm install express' },
      timestamp: '2024-01-01T00:00:00Z',
      status: 'pending'
    };

    it('should send permission notification when enabled', async () => {
      await service.sendPermissionNotification(mockPermissionRequest, 'session-789');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/ntfy\.sh\/cui-.+$/),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Title': 'CUI Permission Request',
            'Priority': 'default',
            'Tags': 'cui-permission',
            'X-CUI-SessionId': 'session-789',
            'X-CUI-StreamingId': 'stream-456',
            'X-CUI-PermissionRequestId': 'perm-123'
          }),
          body: expect.stringContaining('Bash tool: ')
        })
      );
    });

    it('should skip notification when disabled', async () => {
      mockPreferencesService.getPreferences.mockResolvedValue({
        colorScheme: 'system',
        language: 'en',
        notifications: {
          enabled: false
        }
      });

      await service.sendPermissionNotification(mockPermissionRequest, undefined);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(service.sendPermissionNotification(mockPermissionRequest, undefined, undefined))
        .resolves.not.toThrow();
    });

    it('should handle non-ok responses', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Server error')
      });

      // Should not throw
      await expect(service.sendPermissionNotification(mockPermissionRequest, undefined, undefined))
        .resolves.not.toThrow();
    });

    it('should use custom ntfy URL if provided', async () => {
      mockPreferencesService.getPreferences.mockResolvedValue({
        colorScheme: 'system',
        language: 'en',
        notifications: {
          enabled: true,
          ntfyUrl: 'https://custom.ntfy.server'
        }
      });

      await service.sendPermissionNotification(mockPermissionRequest, undefined, undefined);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/custom\.ntfy\.server\/cui-.+$/),
        expect.any(Object)
      );
    });

    it('should include summary in message when provided', async () => {
      await service.sendPermissionNotification(mockPermissionRequest, 'session-789', 'Working on authentication');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: 'Working on authentication - Bash'
        })
      );
    });

    it('should show tool input when summary not provided', async () => {
      await service.sendPermissionNotification(mockPermissionRequest, 'session-789');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Bash tool: {"command":"npm install express"}')
        })
      );
    });
  });

  describe('sendConversationEndNotification', () => {
    it('should send conversation end notification when enabled', async () => {
      await service.sendConversationEndNotification(
        'stream-123',
        'session-456',
        'Fixed authentication bug'
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/ntfy\.sh\/cui-.+$/),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Title': 'Task Finished',
            'Priority': 'default',
            'Tags': 'cui-complete',
            'X-CUI-SessionId': 'session-456',
            'X-CUI-StreamingId': 'stream-123'
          }),
          body: 'Fixed authentication bug'
        })
      );
    });

    it('should use default message when summary not provided', async () => {
      await service.sendConversationEndNotification(
        'stream-123',
        'session-456'
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: 'Task completed'
        })
      );
    });

    it('should skip notification when disabled', async () => {
      mockPreferencesService.getPreferences.mockResolvedValue({
        colorScheme: 'system',
        language: 'en',
        notifications: {
          enabled: false
        }
      });

      await service.sendConversationEndNotification('stream-123', 'session-456');

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Should not throw even if notification fails
      await expect(service.sendConversationEndNotification('stream-123', 'session-456'))
        .resolves.not.toThrow();
    });
  });

  describe('notification preferences', () => {
    it('should not send any notifications when preferences not set', async () => {
      mockPreferencesService.getPreferences.mockResolvedValue({
        colorScheme: 'system',
        language: 'en'
        // notifications field not set
      });

      const mockRequest: PermissionRequest = {
        id: 'perm-123',
        streamingId: 'stream-456',
        toolName: 'Bash',
        toolInput: { command: 'ls' },
        timestamp: '2024-01-01T00:00:00Z',
        status: 'pending'
      };

      await service.sendPermissionNotification(mockRequest, undefined);
      await service.sendConversationEndNotification('stream-123', 'session-456');

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});