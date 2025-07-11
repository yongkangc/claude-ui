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

  // Set all messages at once (for loading from API)
  const setAllMessages = useCallback((newMessages: ChatMessage[]) => {
    setMessages(prev => {
      console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → ${newMessages.length} (reason: Loading conversation from API)`);
      return newMessages;
    });
  }, []);

  // Add or update a message
  const upsertMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      const existingIndex = prev.findIndex(m => m.id === message.id);
      if (existingIndex !== -1) {
        // Update existing message
        console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → ${prev.length} (reason: Updating existing message ${message.id})`);
        return prev.map((m, i) => i === existingIndex ? message : m);
      }
      // Add new message
      console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → ${prev.length + 1} (reason: Adding new message via upsertMessage)`);
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
        // Generate a stable ID for user messages based on content hash
        const userMessageId = event.message.id || `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const userMessage: ChatMessage = {
          id: userMessageId,
          type: 'user',
          content: event.message.content,
          timestamp: new Date().toISOString(),
        };
        
        setMessages(prev => {
          // Check for duplicate user message ID
          const existingIndex = prev.findIndex(m => m.id === userMessageId);
          if (existingIndex !== -1) {
            const newMessages = [...prev];
            newMessages[existingIndex] = userMessage;
            console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → ${prev.length} (reason: Updated existing user message ${userMessageId})`);
            return newMessages;
          }
          
          // Replace pending message or add new one
          const pendingIndex = prev.findIndex(m => m.id.startsWith('user-pending-'));
          if (pendingIndex !== -1) {
            const newMessages = [...prev];
            newMessages[pendingIndex] = userMessage;
            console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → ${prev.length} (reason: Replaced pending user message with actual)`);
            return newMessages;
          }
          
          console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → ${prev.length + 1} (reason: Adding new user message from stream)`);
          return [...prev, userMessage];
        });
        
        options.onUserMessage?.(userMessage);
        break;

      case 'assistant':
        let assistantId = event.message.id;
        
        setMessages(prev => {
          // Check for duplicate IDs (should never happen by design)
          const existingIndex = prev.findIndex(m => m.id === assistantId);
          if (existingIndex !== -1) {
            // Assign a new unique ID to avoid duplicate
            const newAssistantId = `${assistantId}-dup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            assistantId = newAssistantId;
          }
          
          // Always add as new message
          const assistantMessage: ChatMessage = {
            id: assistantId,
            type: 'assistant',
            content: Array.isArray(event.message.content) ? event.message.content : [event.message.content],
            timestamp: new Date().toISOString(),
            isStreaming: event.message.stop_reason === null,
          };
          
          options.onAssistantMessage?.(assistantMessage);
          console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → ${prev.length + 1} (reason: Adding new assistant message from stream)`);
          return [...prev, assistantMessage];
        });
        break;

      case 'result':
        // Mark streaming as complete
        setMessages(prev => prev.map(m => ({ ...m, isStreaming: false })));
        
        if (event.session_id) {
          options.onResult?.(event.session_id);
        }
        break;

      case 'error':
        options.onError?.(event.error);
        break;

      case 'closed':
        // Stream closed
        options.onClosed?.();
        break;
    }
  }, [options]);

  // Add a pending user message
  const addPendingUserMessage = useCallback((content: string) => {
    const tempUserMessage: ChatMessage = {
      id: `user-pending-${Date.now()}`,
      type: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => {
      console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → ${prev.length + 1} (reason: Adding pending user message)`);
      return [...prev, tempUserMessage];
    });
  }, []);

  // Mark all messages as not streaming
  const markAllMessagesAsComplete = useCallback(() => {
    setMessages(prev => {
      console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → ${prev.length} (reason: Marking all messages as complete)`);
      return prev.map(m => ({ ...m, isStreaming: false }));
    });
  }, []);

  return {
    messages,
    clearMessages,
    setAllMessages,
    upsertMessage,
    handleStreamMessage,
    addPendingUserMessage,
    markAllMessagesAsComplete,
  };
}