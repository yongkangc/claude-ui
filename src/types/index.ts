// Core types and interfaces for CCUI backend
import Anthropic from '@anthropic-ai/sdk';

// Base conversation types
export interface ConversationSummary {
  sessionId: string; // Claude CLI's actual session ID (used for history files)
  projectPath: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ConversationMessage {
  uuid: string;
  type: 'user' | 'assistant' | 'system';
  message: Anthropic.Message | Anthropic.MessageParam;
  timestamp: string;
  sessionId: string; // Claude CLI's actual session ID
  parentUuid?: string;
  costUSD?: number;
  durationMs?: number;
}

// Stream message types
export interface StreamMessage {
  type: 'system' | 'assistant' | 'user' | 'result';
  session_id: string; // Claude CLI's session ID (in stream messages)
  parent_tool_use_id?: string | null;
}

export interface SystemInitMessage extends StreamMessage {
  type: 'system';
  subtype: 'init';
  cwd: string;
  tools: string[];
  mcp_servers: { name: string; status: string; }[];
  model: string;
  permissionMode: string;
  apiKeySource: string;
}

export interface AssistantStreamMessage extends StreamMessage {
  type: 'assistant';
  message: Anthropic.Message;
}

export interface UserStreamMessage extends StreamMessage {
  type: 'user';
  message: Anthropic.MessageParam;
}

export interface ResultStreamMessage extends StreamMessage {
  type: 'result';
  subtype: 'success' | 'error_max_turns';
  cost_usd: number;
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result?: string;
  total_cost: number;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    output_tokens: number;
    server_tool_use: {
      web_search_requests: number;
    };
  };
}

// Permission types
export interface PermissionRequest {
  id: string;
  streamingId: string; // CCUI's internal streaming identifier
  toolName: string;
  toolInput: any;
  timestamp: string;
  status: 'pending' | 'approved' | 'denied';
  modifiedInput?: any;
  denyReason?: string;
}

// Configuration types
export interface ConversationConfig {
  workingDirectory: string;
  initialPrompt: string;
  model?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  systemPrompt?: string;
}

// API request/response types
export interface StartConversationRequest {
  workingDirectory: string;
  initialPrompt: string;
  model?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  systemPrompt?: string;
}

export interface StartConversationResponse {
  sessionId: string; // CCUI's internal streaming identifier (exposed as sessionId in API)
  streamUrl: string;
}

export interface ConversationListQuery {
  projectPath?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'created' | 'updated';
  order?: 'asc' | 'desc';
}

export interface ConversationDetailsResponse {
  messages: ConversationMessage[];
  summary: string;
  projectPath: string;
  metadata: {
    totalCost: number;
    totalDuration: number;
    model: string;
  };
}


export interface PermissionDecisionRequest {
  action: 'approve' | 'deny';
  modifiedInput?: any;
}

export interface SystemStatusResponse {
  claudeVersion: string;
  claudePath: string;
  configPath: string;
  activeConversations: number;
}

export interface ModelsResponse {
  models: string[];
  defaultModel: string;
}

// MCP types
export interface MCPPermissionToolInput {
  tool_name: string;
  input: Record<string, any>;
  session_id: string; // Claude CLI's session ID
}

export interface MCPPermissionResponse {
  behavior: 'allow' | 'deny';
  updatedInput?: any;
  message?: string;
}

// Stream event types
export type StreamEvent = 
  | { type: 'connected'; streaming_id: string; timestamp: string }
  | { type: 'permission_request'; data: PermissionRequest; streamingId: string; timestamp: string }
  | { type: 'error'; error: string; streamingId: string; timestamp: string }
  | { type: 'closed'; streamingId: string; timestamp: string }
  | SystemInitMessage
  | AssistantStreamMessage
  | UserStreamMessage
  | ResultStreamMessage;

// Error types
export class CCUIError extends Error {
  constructor(public code: string, message: string, public statusCode: number = 500) {
    super(message);
    this.name = 'CCUIError';
  }
}