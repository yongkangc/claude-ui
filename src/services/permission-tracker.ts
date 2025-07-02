import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { PermissionRequest } from '@/types';
import { logger } from '@/services/logger';

/**
 * Service to track permission requests from Claude CLI via MCP
 */
export class PermissionTracker extends EventEmitter {
  private permissionRequests: Map<string, PermissionRequest> = new Map();

  constructor() {
    super();
  }

  /**
   * Add a new permission request
   */
  addPermissionRequest(toolName: string, toolInput: any, streamingId?: string): PermissionRequest {
    const id = uuidv4();
    const request: PermissionRequest = {
      id,
      streamingId: streamingId || 'unknown',
      toolName,
      toolInput,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    this.permissionRequests.set(id, request);
    logger.info('Permission request added', { id, toolName, streamingId });

    // Emit event for new permission request
    this.emit('permission_request', request);

    return request;
  }

  /**
   * Get all permission requests
   */
  getAllPermissionRequests(): PermissionRequest[] {
    return Array.from(this.permissionRequests.values());
  }

  /**
   * Get permission requests filtered by criteria
   */
  getPermissionRequests(filter?: { streamingId?: string; status?: 'pending' | 'approved' | 'denied' }): PermissionRequest[] {
    let requests = Array.from(this.permissionRequests.values());

    if (filter?.streamingId) {
      requests = requests.filter(req => req.streamingId === filter.streamingId);
    }

    if (filter?.status) {
      requests = requests.filter(req => req.status === filter.status);
    }

    return requests;
  }

  /**
   * Get a specific permission request by ID
   */
  getPermissionRequest(id: string): PermissionRequest | undefined {
    return this.permissionRequests.get(id);
  }

  /**
   * Update permission request status (for future use when we implement approval/denial)
   */
  updatePermissionStatus(
    id: string, 
    status: 'approved' | 'denied', 
    options?: { modifiedInput?: any; denyReason?: string }
  ): boolean {
    const request = this.permissionRequests.get(id);
    if (!request) {
      logger.warn('Permission request not found', { id });
      return false;
    }

    request.status = status;
    if (status === 'approved' && options?.modifiedInput) {
      request.modifiedInput = options.modifiedInput;
    }
    if (status === 'denied' && options?.denyReason) {
      request.denyReason = options.denyReason;
    }

    logger.info('Permission request updated', { id, status });
    this.emit('permission_updated', request);

    return true;
  }

  /**
   * Clear all permission requests (for testing)
   */
  clear(): void {
    this.permissionRequests.clear();
  }

  /**
   * Get the number of permission requests
   */
  size(): number {
    return this.permissionRequests.size;
  }
}