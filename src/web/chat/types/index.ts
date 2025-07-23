// Re-export necessary types from backend
import type {
  ConversationSummary,
  ConversationMessage,
  StartConversationRequest,
  StartConversationResponse,
  ResumeConversationRequest,
  ConversationDetailsResponse,
  StreamEvent,
  AssistantStreamMessage,
  UserStreamMessage,
  ResultStreamMessage,
  SystemInitMessage,
  PermissionDecisionRequest,
  PermissionDecisionResponse,
} from '@/types';

// Import ContentBlock from Anthropic SDK
import type { ContentBlock, ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';

export type {
  ConversationSummary,
  ConversationMessage,
  StartConversationRequest,
  StartConversationResponse,
  ResumeConversationRequest,
  ConversationDetailsResponse,
  StreamEvent,
  AssistantStreamMessage,
  UserStreamMessage,
  ResultStreamMessage,
  SystemInitMessage,
  PermissionDecisionRequest,
  PermissionDecisionResponse,
};

// Chat-specific types
export interface ChatMessage {
  id: string; // Backend message ID (may not be unique, empty for pending user messages)
  messageId: string; // Client-side unique ID for React rendering
  type: 'user' | 'assistant' | 'system' | 'error';
  content: string | ContentBlock[];
  timestamp: string;
  workingDirectory?: string; // Working directory when the message was created
  parentToolUseId?: string; // For nested messages from Task tool use
  // isStreaming removed
}

export interface ConversationState {
  sessionId: string | null;
  streamingId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
}

export interface Theme {
  mode: 'light' | 'dark';
  toggle: () => void;
}

export interface ApiError {
  error: string;
  code?: string;
}

// Working directories types
export interface WorkingDirectory {
  path: string;              // Full absolute path
  shortname: string;         // Smart suffix
  lastDate: string;          // ISO timestamp
  conversationCount: number; // Total conversations
}

export interface WorkingDirectoriesResponse {
  directories: WorkingDirectory[];
  totalCount: number;
}

// Tool result types
export interface ToolResult {
  status: 'pending' | 'completed';
  result?: string | ContentBlockParam[];
  is_error?: boolean;
}