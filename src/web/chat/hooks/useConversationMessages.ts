import { useState, useCallback } from 'react';
import type { ChatMessage, StreamEvent } from '../types';
import type { ContentBlock, ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';

interface ToolResult {
  status: 'pending' | 'completed';
  result?: string | ContentBlockParam[];
}

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
  const [toolResults, setToolResults] = useState<Record<string, ToolResult>>({});

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages(prev => {
      console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → 0 (reason: Clearing all messages)`);
      return [];
    });
    setToolResults({});
  }, []);

  // Add a message
  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → ${prev.length + 1} (reason: Adding new message)`);
      return [...prev, message];
    });

    // Track tool uses in assistant messages
    if (message.type === 'assistant' && Array.isArray(message.content)) {
      const toolUseIds: string[] = [];
      message.content.forEach((block) => {
        if (block.type === 'tool_use' && block.id) {
          toolUseIds.push(block.id);
        }
      });

      if (toolUseIds.length > 0) {
        setToolResults(prev => {
          const updates: Record<string, ToolResult> = {};
          toolUseIds.forEach(id => {
            if (!prev[id]) {
              updates[id] = { status: 'pending' };
            }
          });
          return { ...prev, ...updates };
        });
        console.debug(`[useConversationMessages] Tracked ${toolUseIds.length} new tool uses:`, toolUseIds);
      }
    }
  }, []);

  // Handle streaming messages
  const handleStreamMessage = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case 'connected':
        // Stream connected
        break;

      case 'user':
        // Drop user events from display but capture tool results
        console.debug('[useConversationMessages] Processing user event from stream for tool results');
        
        // Extract tool results from user messages
        if (event.message && Array.isArray(event.message.content)) {
          const toolResultUpdates: Record<string, ToolResult> = {};
          
          event.message.content.forEach((block) => {
            if (block.type === 'tool_result' && 'tool_use_id' in block) {
              const toolUseId = block.tool_use_id;
              let result: string | ContentBlockParam[] = '';
              
              // Extract result content
              if (typeof block.content === 'string') {
                result = block.content;
              } else if (Array.isArray(block.content)) {
                result = block.content;
              }
              
              toolResultUpdates[toolUseId] = {
                status: 'completed',
                result
              };
            }
          });
          
          if (Object.keys(toolResultUpdates).length > 0) {
            setToolResults(prev => ({ ...prev, ...toolResultUpdates }));
            console.debug(`[useConversationMessages] Updated tool results:`, Object.keys(toolResultUpdates));
          }
        }
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

    // Build tool results from loaded messages in chronological order
    const newToolResults: Record<string, ToolResult> = {};
    
    // Process messages in order to properly track tool use/result pairs
    newMessages.forEach(message => {
      if (message.type === 'assistant' && Array.isArray(message.content)) {
        // Track tool uses from assistant messages
        message.content.forEach(block => {
          if (block.type === 'tool_use' && block.id) {
            newToolResults[block.id] = { status: 'pending' };
          }
        });
      } else if (message.type === 'user' && Array.isArray(message.content)) {
        // Update with tool results from user messages
        message.content.forEach(block => {
          if (block.type === 'tool_result' && 'tool_use_id' in block) {
            const toolUseId = block.tool_use_id;
            
            // Only update if we've seen this tool use before
            if (newToolResults[toolUseId]) {
              let result: string | ContentBlockParam[] = '';
              
              if (typeof block.content === 'string') {
                result = block.content;
              } else if (Array.isArray(block.content)) {
                result = block.content;
              }
              
              newToolResults[toolUseId] = {
                status: 'completed',
                result
              };
            }
          }
        });
      }
    });

    setToolResults(newToolResults);
    console.debug(`[useConversationMessages] Built tool results from ${Object.keys(newToolResults).length} tool uses`);
  }, []);

  return {
    messages,
    toolResults,
    addMessage,
    clearMessages,
    handleStreamMessage,
    setAllMessages,
  };
}