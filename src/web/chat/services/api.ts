import type {
  ConversationSummary,
  StartConversationRequest,
  StartConversationResponse,
  ConversationDetailsResponse,
  ApiError,
  WorkingDirectoriesResponse,
  PermissionRequest,
  PermissionDecisionRequest,
  PermissionDecisionResponse,
  FileSystemListQuery,
  FileSystemListResponse,
} from '../types';
import type { CommandsResponse, GeminiHealthResponse } from '@/types';
import { getAuthToken } from '../../hooks/useAuth';

class ApiService {
  private baseUrl = '';

  private async apiCall<T>(
    url: string,
    options?: RequestInit
  ): Promise<T> {
    const fullUrl = `${this.baseUrl}${url}`;
    const method = options?.method || 'GET';
    
    // Log request
    console.log(`[API] ${method} ${fullUrl}`, options?.body ? JSON.parse(options.body as string) : '');
    
    // Get auth token for Bearer authorization
    const authToken = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };
    
    // Add Bearer token if available
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    
    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers,
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // If we get HTML instead of JSON, it usually means the API endpoint doesn't exist
        const text = await response.text();
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          throw new Error(`API endpoint not found: ${fullUrl}. Server returned HTML instead of JSON.`);
        }
        throw new Error(`Expected JSON response but got ${contentType || 'unknown content type'}: ${text.substring(0, 200)}`);
      }

      const data = await response.json();
      
      // Log response
      console.log(`[API Response] ${fullUrl}:`, data);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized');
        }
        throw new Error((data as ApiError).error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      // Enhanced error logging for JSON parsing issues
      if (error instanceof SyntaxError && error.message.includes('Unexpected token')) {
        console.error(`[API Error] JSON parsing failed for ${fullUrl}:`, error.message);
        throw new Error(`Invalid JSON response from ${fullUrl}. This usually means the API endpoint doesn't exist or returned HTML instead of JSON.`);
      }
      // console.error(`[API Error] ${fullUrl}:`, error);
      throw error;
    }
  }

  async getConversations(params?: {
    limit?: number;
    offset?: number;
    projectPath?: string;
    hasContinuation?: boolean;
    archived?: boolean;
    pinned?: boolean;
  }): Promise<{ conversations: ConversationSummary[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.projectPath) searchParams.append('projectPath', params.projectPath);
    if (params?.hasContinuation !== undefined) searchParams.append('hasContinuation', params.hasContinuation.toString());
    if (params?.archived !== undefined) searchParams.append('archived', params.archived.toString());
    if (params?.pinned !== undefined) searchParams.append('pinned', params.pinned.toString());
    searchParams.append('sortBy', 'updated');
    searchParams.append('order', 'desc');

    return this.apiCall(`/api/conversations?${searchParams}`);
  }

  async getConversationDetails(sessionId: string): Promise<ConversationDetailsResponse> {
    return this.apiCall(`/api/conversations/${sessionId}`);
  }

  async startConversation(request: StartConversationRequest): Promise<StartConversationResponse> {
    return this.apiCall('/api/conversations/start', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }


  async stopConversation(streamingId: string): Promise<{ success: boolean }> {
    return this.apiCall(`/api/conversations/${streamingId}/stop`, {
      method: 'POST',
    });
  }

  getStreamUrl(streamingId: string): string {
    return `/api/stream/${streamingId}`;
  }

  async getWorkingDirectories(): Promise<WorkingDirectoriesResponse> {
    return this.apiCall('/api/working-directories');
  }

  async getPermissions(params?: { 
    streamingId?: string; 
    status?: 'pending' | 'approved' | 'denied' 
  }): Promise<{ permissions: PermissionRequest[] }> {
    const searchParams = new URLSearchParams();
    if (params?.streamingId) searchParams.append('streamingId', params.streamingId);
    if (params?.status) searchParams.append('status', params.status);
    
    return this.apiCall(`/api/permissions?${searchParams}`);
  }

  async sendPermissionDecision(
    requestId: string,
    decision: PermissionDecisionRequest
  ): Promise<PermissionDecisionResponse> {
    return this.apiCall(`/api/permissions/${requestId}/decision`, {
      method: 'POST',
      body: JSON.stringify(decision),
    });
  }

  async updateSession(
    sessionId: string,
    updates: {
      customName?: string;
      pinned?: boolean;
      archived?: boolean;
      continuationSessionId?: string;
      initialCommitHead?: string;
    }
  ): Promise<{ success: boolean; sessionId: string; updatedFields: Record<string, unknown> }> {
    return this.apiCall(`/api/conversations/${sessionId}/update`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async getPreferences(): Promise<import('../types').Preferences> {
    return this.apiCall('/api/preferences');
  }

  async updatePreferences(updates: Partial<import('../types').Preferences>): Promise<import('../types').Preferences> {
    return this.apiCall('/api/preferences', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async listDirectory(params: FileSystemListQuery): Promise<FileSystemListResponse> {
    const searchParams = new URLSearchParams();
    searchParams.append('path', params.path);
    if (params.recursive !== undefined) searchParams.append('recursive', params.recursive.toString());
    if (params.respectGitignore !== undefined) searchParams.append('respectGitignore', params.respectGitignore.toString());
    
    return this.apiCall(`/api/filesystem/list?${searchParams}`);
  }

  async getCommands(workingDirectory?: string): Promise<CommandsResponse> {
    const searchParams = new URLSearchParams();
    if (workingDirectory) {
      searchParams.append('workingDirectory', workingDirectory);
    }
    
    return this.apiCall(`/api/system/commands?${searchParams}`);
  }

  async getSystemStatus(): Promise<any> {
    return this.apiCall('/api/system/status');
  }

  async getRecentLogs(limit?: number): Promise<{ logs: string[] }> {
    const searchParams = new URLSearchParams();
    if (limit !== undefined) searchParams.append('limit', limit.toString());
    return this.apiCall(`/api/logs/recent?${searchParams}`);
  }

  getLogStreamUrl(): string {
    return '/api/logs/stream';
  }

  async readFile(path: string): Promise<{ content: string }> {
    const searchParams = new URLSearchParams();
    searchParams.append('path', path);
    return this.apiCall(`/api/filesystem/read?${searchParams}`);
  }

  async archiveAllSessions(): Promise<{ success: boolean; archivedCount: number }> {
    return this.apiCall('/api/conversations/archive-all', {
      method: 'POST',
    });
  }

  async transcribeAudio(audioBase64: string, mimeType: string): Promise<{ text: string }> {
    return this.apiCall('/api/gemini/transcribe', {
      method: 'POST',
      body: JSON.stringify({
        audio: audioBase64,
        mimeType: mimeType
      }),
    });
  }

  async getGeminiHealth(): Promise<GeminiHealthResponse> {
    return this.apiCall<GeminiHealthResponse>('/api/gemini/health');
  }

  // For endpoints that need direct fetch with auth (like SSE streams)
  async fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
    const authToken = getAuthToken();
    const headers: Record<string, string> = {
      ...options?.headers as Record<string, string>,
    };
    
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    
    return fetch(url, {
      ...options,
      headers,
    });
  }
}

export const api = new ApiService();