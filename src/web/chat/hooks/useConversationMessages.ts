import { useState, useCallback } from 'react';
import type { ChatMessage, StreamEvent } from '../types';

interface UseConversationMessagesOptions {
  onUserMessage?: (message: ChatMessage) => void;
  onAssistantMessage?: (message: ChatMessage) => void;
  onResult?: (sessionId: string) => void;
  onError?: (error: string) => void;
  onClosed?: () => void;
}

/**
 * Shared hook for managing conversation messages
 * Handles message state and streaming events
 */
export function useConversationMessages(options: UseConversationMessagesOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages(prev => {
      console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → 0 (reason: Clearing all messages)`);
      return [];
    });
  }, []);

  // Add a message
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → ${prev.length + 1} (reason: Adding new message)`);
      return [...prev, message];
    });
  }, []);

  // Handle streaming messages
  const handleStreamMessage = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case 'connected':
        // Stream connected
        break;

      case 'user':
        // Drop user events completely
        console.debug('[useConversationMessages] Dropping user event from stream');
        break;

      case 'assistant':
        // Just add the message without any special handling
        const assistantMessage: ChatMessage = {
          id: event.message.id,
          messageId: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'assistant',
          content: Array.isArray(event.message.content) ? event.message.content : [event.message.content],
          timestamp: new Date().toISOString(),
        };
        
        addMessage(assistantMessage);
        options.onAssistantMessage?.(assistantMessage);
        break;

      case 'result':
        // Only update conversation status, don't update messages
        if (event.session_id) {
          options.onResult?.(event.session_id);
        }
        break;

      case 'error':
        // Add as a new error message
        const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const errorMessage: ChatMessage = {
          id: errorId,
          messageId: errorId, // For error messages, use the same ID for both
          type: 'error',
          content: event.error,
          timestamp: new Date().toISOString(),
        };
        
        addMessage(errorMessage);
        options.onError?.(event.error);
        break;

      case 'closed':
        // Stream closed
        options.onClosed?.();
        break;
    }
  }, [addMessage, options]);

  // Set all messages at once (for loading from API)
  const setAllMessages = useCallback((newMessages: ChatMessage[]) => {
    setMessages(prev => {
      console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → ${newMessages.length} (reason: Loading conversation from API)`);
      return newMessages;
    });
  }, []);

  return {
    messages,
    addMessage,
    clearMessages,
    handleStreamMessage,
    setAllMessages,
  };
}