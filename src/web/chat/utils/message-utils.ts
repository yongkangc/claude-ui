import type { ChatMessage, UserStreamMessage, AssistantStreamMessage } from '../types';

/**
 * Creates a user message from stream event data
 * Ensures consistent message structure with all required fields
 */
export function createUserMessageFromStream(
  event: { message: UserStreamMessage }
): ChatMessage {
  return {
    id: `user-${Date.now()}`,
    type: 'user',
    content: event.message.content,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Creates an assistant message from stream event data
 * Ensures consistent message structure with all required fields
 */
export function createAssistantMessageFromStream(
  event: { message: AssistantStreamMessage }
): ChatMessage {
  return {
    id: event.message.id,
    type: 'assistant',
    content: Array.isArray(event.message.content) 
      ? event.message.content 
      : [event.message.content],
    timestamp: new Date().toISOString(),
    isStreaming: event.message.stop_reason === null,
  };
}

/**
 * Creates a pending user message
 * Used for optimistic UI updates before server confirmation
 */
export function createPendingUserMessage(content: string): ChatMessage {
  return {
    id: `user-pending-${Date.now()}`,
    type: 'user',
    content,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Updates an existing message with new content
 * Properly handles content accumulation for assistant messages
 */
export function updateAssistantMessage(
  existing: ChatMessage,
  update: { content: any; stop_reason: string | null }
): ChatMessage {
  return {
    ...existing,
    content: [
      ...(Array.isArray(existing.content) ? existing.content : []),
      ...(Array.isArray(update.content) ? update.content : [update.content])
    ],
    isStreaming: update.stop_reason === null,
  };
}