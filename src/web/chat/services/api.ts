import type {
  ConversationSummary,
  StartConversationRequest,
  StartConversationResponse,
  ResumeConversationRequest,
  ConversationDetailsResponse,
  ApiError,
  WorkingDirectoriesResponse,
  PermissionDecisionRequest,
  PermissionDecisionResponse,
} from '../types';

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
    
    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      const data = await response.json();
      
      // Log response
      console.log(`[API Response] ${fullUrl}:`, data);

      if (!response.ok) {
        throw new Error((data as ApiError).error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`[API Error] ${fullUrl}:`, error);
      throw error;
    }
  }

  async getConversations(params?: {
    limit?: number;
    offset?: number;
    projectPath?: string;
  }): Promise<{ conversations: ConversationSummary[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.projectPath) searchParams.append('projectPath', params.projectPath);
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

  async resumeConversation(request: ResumeConversationRequest): Promise<StartConversationResponse> {
    console.log(`[API] Resume conversation called at ${new Date().toISOString()}:`, request);
    return this.apiCall('/api/conversations/resume', {
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
}

export const api = new ApiService();