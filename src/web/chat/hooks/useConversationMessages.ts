import { useState, useCallback } from 'react';
import type { ChatMessage, StreamEvent, ToolResult } from '../types';
import type { ContentBlock, ContentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages';
import type { PermissionRequest } from '@/types';

interface UseConversationMessagesOptions {
  onUserMessage?: (message: ChatMessage) => void;
  onAssistantMessage?: (message: ChatMessage) => void;
  onResult?: (sessionId: string) => void;
  onError?: (error: string) => void;
  onClosed?: () => void;
  onPermissionRequest?: (permission: PermissionRequest) => void;
}

/**
 * Shared hook for managing conversation messages
 * Handles message state and streaming events
 */
export function useConversationMessages(options: UseConversationMessagesOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolResults, setToolResults] = useState<Record<string, ToolResult>>({});
  const [currentWorkingDirectory, setCurrentWorkingDirectory] = useState<string | undefined>();
  const [currentPermissionRequest, setCurrentPermissionRequest] = useState<PermissionRequest | null>(null);
  const [childrenMessages, setChildrenMessages] = useState<Record<string, ChatMessage[]>>({});
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages(prev => {
      console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → 0 (reason: Clearing all messages)`);
      return [];
    });
    setToolResults({});
    setCurrentWorkingDirectory(undefined);
    setCurrentPermissionRequest(null);
    setChildrenMessages({});
    setExpandedTasks(new Set());
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
      
      case 'system_init':
        // Capture working directory from system init
        console.debug('[useConversationMessages] System init event, working directory:', event.cwd);
        setCurrentWorkingDirectory(event.cwd);
        break;

      case 'user':
        // Process tool results first - if this message contains tool results, handle them and return early
        if (event.message && Array.isArray(event.message.content)) {
          const toolResultUpdates: Record<string, ToolResult> = {};
          let hasToolResults = false;
          
          event.message.content.forEach((block) => {
            if (block.type === 'tool_result' && 'tool_use_id' in block) {
              hasToolResults = true;
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
                result,
                is_error: block.is_error
              };
            }
          });
          
          if (hasToolResults) {
            setToolResults(prev => ({ ...prev, ...toolResultUpdates }));
            console.debug(`[useConversationMessages] Updated tool results:`, Object.keys(toolResultUpdates));
            // Tool result messages should not be added as child messages - return early
            break;
          }
        }
        
        // If no tool results, check if this is a child message
        const userParentToolUseId = event.parent_tool_use_id;
        
        if (userParentToolUseId) {
          // This is a child message - create a user message and add to childrenMessages
          const userMessage: ChatMessage = {
            id: '',
            messageId: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'user',
            content: event.message.content,
            timestamp: new Date().toISOString(),
            workingDirectory: currentWorkingDirectory,
            parentToolUseId: userParentToolUseId,
          };
          
          setChildrenMessages(prev => {
            const newChildren = { ...prev };
            if (!newChildren[userParentToolUseId]) {
              newChildren[userParentToolUseId] = [];
            }
            newChildren[userParentToolUseId] = [...newChildren[userParentToolUseId], userMessage];
            console.debug(`[useConversationMessages] Added child user message to parent ${userParentToolUseId}`);
            return newChildren;
          });
        }
        break;

      case 'assistant':
        // Check if this is a child message
        const parentToolUseId = event.parent_tool_use_id;
        const assistantMessage: ChatMessage = {
          id: event.message.id,
          messageId: `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'assistant',
          content: Array.isArray(event.message.content) ? event.message.content : [event.message.content],
          timestamp: new Date().toISOString(),
          workingDirectory: currentWorkingDirectory,
          parentToolUseId,
        };
        
        if (parentToolUseId) {
          // This is a child message - add to childrenMessages instead
          setChildrenMessages(prev => {
            const newChildren = { ...prev };
            if (!newChildren[parentToolUseId]) {
              newChildren[parentToolUseId] = [];
            }
            newChildren[parentToolUseId] = [...newChildren[parentToolUseId], assistantMessage];
            console.debug(`[useConversationMessages] Added child message to parent ${parentToolUseId}`);
            return newChildren;
          });
        } else {
          // Regular message - add to main list
          addMessage(assistantMessage);
          options.onAssistantMessage?.(assistantMessage);
        }
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
        // Clear permission request when stream closes
        setCurrentPermissionRequest(null);
        break;

      case 'permission_request':
        // Handle permission request
        console.debug('[useConversationMessages] Permission request received:', event.data);
        setCurrentPermissionRequest(event.data);
        options.onPermissionRequest?.(event.data);
        break;
    }
  }, [addMessage, options, currentWorkingDirectory]);

  // Set all messages at once (for loading from API)
  const setAllMessages = useCallback((newMessages: ChatMessage[]) => {
    // Separate parent and child messages
    const parentMessages: ChatMessage[] = [];
    const newChildrenMessages: Record<string, ChatMessage[]> = {};
    
    newMessages.forEach(message => {
      if (message.parentToolUseId) {
        // This is a child message
        if (!newChildrenMessages[message.parentToolUseId]) {
          newChildrenMessages[message.parentToolUseId] = [];
        }
        newChildrenMessages[message.parentToolUseId].push(message);
      } else {
        // This is a parent message
        parentMessages.push(message);
      }
    });
    
    setMessages(prev => {
      console.debug(`[useConversationMessages] Message list length changed: ${prev.length} → ${parentMessages.length} (reason: Loading conversation from API, filtering out ${Object.values(newChildrenMessages).flat().length} child messages)`);
      return parentMessages;
    });
    
    setChildrenMessages(newChildrenMessages);
    console.debug(`[useConversationMessages] Loaded ${Object.keys(newChildrenMessages).length} parent tools with children`);

    // Extract the working directory from the loaded messages (use the most recent one)
    const mostRecentWorkingDir = newMessages
      .slice()
      .reverse()
      .find(msg => msg.workingDirectory)?.workingDirectory;
    
    if (mostRecentWorkingDir) {
      console.debug('[useConversationMessages] Set working directory from loaded messages:', mostRecentWorkingDir);
      setCurrentWorkingDirectory(mostRecentWorkingDir);
    }

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
              console.debug('Adding tool result', block);
              
              newToolResults[toolUseId] = {
                status: 'completed',
                result,
                is_error: block.is_error
              };
            }
          }
        });
      }
    });

    setToolResults(newToolResults);
    console.debug(`[useConversationMessages] Built tool results from ${Object.keys(newToolResults).length} tool uses`);
  }, []);

  // Toggle task expansion
  const toggleTaskExpanded = useCallback((toolUseId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(toolUseId)) {
        next.delete(toolUseId);
      } else {
        next.add(toolUseId);
      }
      return next;
    });
  }, []);

  // Clear current permission request
  const clearPermissionRequest = useCallback(() => {
    setCurrentPermissionRequest(null);
  }, []);

  return {
    messages,
    toolResults,
    currentPermissionRequest,
    childrenMessages,
    expandedTasks,
    addMessage,
    clearMessages,
    handleStreamMessage,
    setAllMessages,
    toggleTaskExpanded,
    clearPermissionRequest,
  };
}