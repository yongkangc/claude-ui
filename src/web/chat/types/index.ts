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
} from '@/types';

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
};

// Chat-specific types
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'error';
  content: any;
  timestamp: string;
  isStreaming?: boolean;
  subMessages?: ChatMessage[];
  parent_tool_use_id?: string | null;
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