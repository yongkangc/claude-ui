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

// Import ContentBlock from Anthropic SDK
import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages/messages';

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
  id: string; // Backend message ID (may not be unique, empty for pending user messages)
  messageId: string; // Client-side unique ID for React rendering
  type: 'user' | 'assistant' | 'system' | 'error';
  content: string | ContentBlock[];
  timestamp: string;
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