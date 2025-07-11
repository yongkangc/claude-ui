import { useState, useEffect, useCallback } from 'react';
import { groupMessages } from '../utils/message-grouping';
import type { ChatMessage, StreamEvent } from '../types';

interface UseConversationMessagesOptions {
  onUserMessage?: (message: ChatMessage) => void;
  onAssistantMessage?: (message: ChatMessage) => void;
  onResult?: (sessionId: string) => void;
  onError?: (error: string) => void;
  onClosed?: () => void;
}

/**
 * Shared hook for managing conversation messages and grouping
 * Handles both raw messages and grouped messages state
 * Provides common handlers for streaming events
 */
export function useConversationMessages(options: UseConversationMessagesOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [groupedMessages, setGroupedMessages] = useState<ChatMessage[]>([]);

  // Apply message grouping whenever messages change
  useEffect(() => {
    console.log('[useConversationMessages] Applying groupMessages to', messages.length, 'messages');
    const grouped = groupMessages(messages);
    setGroupedMessages(grouped);
  }, [messages]);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    setGroupedMessages([]);
  }, []);

  // Set all messages at once (for loading from API)
  const setAllMessages = useCallback((newMessages: ChatMessage[]) => {
    setMessages(newMessages);
  }, []);

  // Add or update a message
  const upsertMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      const existingIndex = prev.findIndex(m => m.id === message.id);
      if (existingIndex !== -1) {
        // Update existing message
        return prev.map((m, i) => i === existingIndex ? message : m);
      }
      // Add new message
      return [...prev, message];
    });
  }, []);

  // Handle streaming messages
  const handleStreamMessage = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case 'connected':
        console.log('[useConversationMessages] Stream connected');
        break;

      case 'user':
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          type: 'user',
          content: event.message.content,
          timestamp: new Date().toISOString(),
          parent_tool_use_id: event.parent_tool_use_id || null,
        };
        
        setMessages(prev => {
          // Replace pending message or add new one
          const pendingIndex = prev.findIndex(m => m.id.startsWith('user-pending-'));
          if (pendingIndex !== -1) {
            return prev.map((m, i) => i === pendingIndex ? userMessage : m);
          }
          return [...prev, userMessage];
        });
        
        options.onUserMessage?.(userMessage);
        break;

      case 'assistant':
        const assistantId = event.message.id;
        
        setMessages(prev => {
          const existing = prev.find(m => m.id === assistantId);
          
          if (existing) {
            // Update existing message - accumulate content blocks instead of replacing
            const updatedMessage: ChatMessage = {
              ...existing,
              content: [
                ...(Array.isArray(existing.content) ? existing.content : []),
                ...(Array.isArray(event.message.content) ? event.message.content : [event.message.content])
              ],
              isStreaming: event.message.stop_reason === null,
              parent_tool_use_id: event.parent_tool_use_id || existing.parent_tool_use_id || null,
            };
            
            options.onAssistantMessage?.(updatedMessage);
            return prev.map(m => m.id === assistantId ? updatedMessage : m);
          } else {
            // Add new message
            const assistantMessage: ChatMessage = {
              id: assistantId,
              type: 'assistant',
              content: Array.isArray(event.message.content) ? event.message.content : [event.message.content],
              timestamp: new Date().toISOString(),
              isStreaming: event.message.stop_reason === null,
              parent_tool_use_id: event.parent_tool_use_id || null,
            };
            
            options.onAssistantMessage?.(assistantMessage);
            return [...prev, assistantMessage];
          }
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
        console.log('[useConversationMessages] Stream closed');
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
    setMessages(prev => [...prev, tempUserMessage]);
  }, []);

  // Mark all messages as not streaming
  const markAllMessagesAsComplete = useCallback(() => {
    setMessages(prev => prev.map(m => ({ ...m, isStreaming: false })));
  }, []);

  return {
    messages,
    groupedMessages,
    clearMessages,
    setAllMessages,
    upsertMessage,
    handleStreamMessage,
    addPendingUserMessage,
    markAllMessagesAsComplete,
  };
}