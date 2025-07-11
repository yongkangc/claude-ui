import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { MessageList } from '../MessageList/MessageList';
import { InputArea } from '../InputArea/InputArea';
import { api } from '../../services/api';
import { useStreaming, useConversationMessages } from '../../hooks';
import type { ChatMessage, ConversationDetailsResponse, ConversationMessage } from '../../types';
import styles from './ConversationView.module.css';

export function ConversationView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use shared conversation messages hook
  const {
    groupedMessages,
    clearMessages,
    setAllMessages,
    handleStreamMessage,
    addPendingUserMessage,
    markAllMessagesAsComplete,
  } = useConversationMessages({
    onResult: (newSessionId) => {
      // Navigate to the new session page if session changed
      if (newSessionId && newSessionId !== sessionId) {
        navigate(`/c/${newSessionId}`, {
          state: {
            fromConversation: true
          }
        });
      }
    },
    onError: (err) => {
      setError(err);
      setStreamingId(null);
    },
    onClosed: () => {
      setStreamingId(null);
    },
  });

  // Clear navigation state to prevent issues on refresh
  useEffect(() => {
    const state = location.state as { 
      fromNewConversation?: boolean;
      fromConversation?: boolean;
    } | null;
    
    if (state) {
      // Clear the state to prevent issues on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Clear messages and streaming when navigating away or sessionId changes
  useEffect(() => {
    // Clear streamingId when sessionId changes
    setStreamingId(null);
    
    return () => {
      // Clear messages and streaming on cleanup
      clearMessages();
      setStreamingId(null);
    };
  }, [sessionId, clearMessages]);

  // Load conversation history
  useEffect(() => {
    const loadConversation = async () => {
      if (!sessionId) return;
      
      setIsLoading(true);
      setError(null);

      try {
        const details = await api.getConversationDetails(sessionId);
        console.debug('[ConversationView] Loaded conversation details with', details.messages.length, 'raw messages');
        const chatMessages = convertToChatlMessages(details);
        console.debug('[ConversationView] Converted to', chatMessages.length, 'chat messages (after filtering sidechains)');
        
        // Always load fresh messages from backend
        setAllMessages(chatMessages);
        
        // Check if this conversation has an active stream
        const conversationsResponse = await api.getConversations({ limit: 100 });
        const currentConversation = conversationsResponse.conversations.find(
          conv => conv.sessionId === sessionId
        );
        
        if (currentConversation?.status === 'ongoing' && currentConversation.streamingId) {
          // Automatically connect to the existing stream
          console.debug(`[ConversationView] Auto-connecting to ongoing stream: ${currentConversation.streamingId}`);
          setStreamingId(currentConversation.streamingId);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load conversation');
      } finally {
        setIsLoading(false);
      }
    };

    loadConversation();
  }, [sessionId, setAllMessages]);

  const { isConnected, disconnect } = useStreaming(streamingId, {
    onMessage: handleStreamMessage,
    onError: (err) => {
      setError(err.message);
      setStreamingId(null);
    },
  });

  const handleSendMessage = async (message: string) => {
    if (!sessionId) return;

    setError(null);

    // Add user message immediately
    addPendingUserMessage(message);

    try {
      const response = await api.resumeConversation({
        sessionId,
        message,
      });

      setStreamingId(response.streamingId);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    }
  };

  const handleStop = async () => {
    if (!streamingId) return;

    try {
      // Call the API to stop the conversation
      await api.stopConversation(streamingId);
      
      // Disconnect the streaming connection
      disconnect();
      
      // Clear the streaming ID
      setStreamingId(null);
      
      // Mark all messages as not streaming
      markAllMessagesAsComplete();
    } catch (err: any) {
      console.error('Failed to stop conversation:', err);
      setError(err.message || 'Failed to stop conversation');
    }
  };

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <MessageList 
        messages={groupedMessages} 
        isLoading={isLoading}
        isStreaming={!!streamingId}
      />

      <InputArea
        onSubmit={handleSendMessage}
        onStop={handleStop}
        isLoading={isConnected}
        placeholder="Continue the conversation..."
      />

    </div>
  );
}

// Helper function to convert API response to chat messages
function convertToChatlMessages(details: ConversationDetailsResponse): ChatMessage[] {
  // Create a map for quick parent message lookup
  const messageMap = new Map<string, ConversationMessage>();
  details.messages.forEach(msg => messageMap.set(msg.uuid, msg));

  return details.messages
    .filter(msg => !msg.isSidechain) // Filter out sidechain messages
    .map(msg => {
      // Extract content from the message structure
      let content = msg.message;
      
      // Handle Anthropic message format
      if (typeof msg.message === 'object' && 'content' in msg.message) {
        content = msg.message.content;
      }
      
      // Extract parent_tool_use_id from multiple possible sources
      let parentToolUseId: string | null = null;
      
      // First, check if parent_tool_use_id is directly available in the message
      if (typeof msg.message === 'object' && 'parent_tool_use_id' in msg.message) {
        parentToolUseId = msg.message.parent_tool_use_id as string;
      }
      
      // If not found and we have a parentUuid, try to resolve it from the parent message
      if (!parentToolUseId && msg.parentUuid) {
        const parentMessage = messageMap.get(msg.parentUuid);
        if (parentMessage && parentMessage.type === 'assistant') {
          // Look for tool_use content in the parent assistant message
          const parentContent = parentMessage.message && 
            typeof parentMessage.message === 'object' && 
            'content' in parentMessage.message 
            ? parentMessage.message.content 
            : parentMessage.message;
            
          if (Array.isArray(parentContent)) {
            // Find the last tool_use block in parent message
            for (let i = parentContent.length - 1; i >= 0; i--) {
              const block = parentContent[i];
              if (block && 
                  typeof block === 'object' && 
                  'type' in block && 
                  block.type === 'tool_use' && 
                  'id' in block) {
                parentToolUseId = block.id as string;
                break;
              }
            }
          }
        }
      }
      
      return {
        id: msg.uuid,
        type: msg.type as 'user' | 'assistant' | 'system',
        content: content,
        timestamp: msg.timestamp,
        parent_tool_use_id: parentToolUseId,
      };
    });
}