import { api } from '@/web/chat/services/api';
import type { PermissionDecisionRequest, PermissionDecisionResponse } from '@/types';

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

    it('should log API calls', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
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

      await api.sendPermissionDecision(requestId, decision);

      // Check that the API call was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        `[API] POST /api/permissions/${requestId}/decision`,
        decision
      );

      // Check that the response was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        `[API Response] /api/permissions/${requestId}/decision:`,
        mockResponse
      );

      consoleSpy.mockRestore();
    });
  });
});