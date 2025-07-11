import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { MessageList } from '../MessageList/MessageList';
import { InputArea } from '../InputArea/InputArea';
import { api } from '../../services/api';
import { useStreaming } from '../../hooks/useStreaming';
import { groupMessages } from '../../utils/message-grouping';
import type { ChatMessage, StreamEvent, ConversationDetailsResponse } from '../../types';
import styles from './ConversationView.module.css';

export function ConversationView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [groupedMessages, setGroupedMessages] = useState<ChatMessage[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setMessages([]);
      setGroupedMessages([]);
      setStreamingId(null);
    };
  }, [sessionId]);

  // Apply message grouping whenever messages change
  useEffect(() => {
    const grouped = groupMessages(messages);
    setGroupedMessages(grouped);
  }, [messages]);

  // Load conversation history
  useEffect(() => {
    const loadConversation = async () => {
      if (!sessionId) return;
      
      setIsLoading(true);
      setError(null);

      try {
        const details = await api.getConversationDetails(sessionId);
        const chatMessages = convertToChatlMessages(details);
        
        // Always load fresh messages from backend
        setMessages(chatMessages);
        
        // Check if this conversation has an active stream
        const conversationsResponse = await api.getConversations({ limit: 100 });
        const currentConversation = conversationsResponse.conversations.find(
          conv => conv.sessionId === sessionId
        );
        
        if (currentConversation?.status === 'ongoing' && currentConversation.streamingId) {
          // Automatically connect to the existing stream
          console.log(`[ConversationView] Auto-connecting to ongoing stream: ${currentConversation.streamingId}`);
          setStreamingId(currentConversation.streamingId);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load conversation');
      } finally {
        setIsLoading(false);
      }
    };

    loadConversation();
  }, [sessionId]);

  // Handle streaming messages
  const handleStreamMessage = useCallback((event: StreamEvent) => {
    switch (event.type) {
      case 'connected':
        console.log('Stream connected');
        break;

      case 'user': {
        // Extract tool_use_id from tool_result content if present
        let extractedParentToolUseId: string | null = event.parent_tool_use_id || null;
        
        // Check if content contains tool_result blocks and extract tool_use_id
        const messageContent = event.message.content;
        if (Array.isArray(messageContent)) {
          for (const block of messageContent) {
            if (block && 
                typeof block === 'object' && 
                'type' in block && 
                block.type === 'tool_result' && 
                'tool_use_id' in block) {
              extractedParentToolUseId = block.tool_use_id as string;
              break;
            }
          }
        } else if (messageContent && 
                   typeof messageContent === 'object' && 
                   'type' in messageContent && 
                   messageContent.type === 'tool_result' && 
                   'tool_use_id' in messageContent) {
          extractedParentToolUseId = messageContent.tool_use_id as string;
        }
        
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          type: 'user',
          content: event.message.content,
          timestamp: new Date().toISOString(),
          parent_tool_use_id: extractedParentToolUseId,
        };
        setMessages(prev => {
          // Replace pending message or add new one
          const pendingIndex = prev.findIndex(m => m.id.startsWith('user-pending-'));
          if (pendingIndex !== -1) {
            return prev.map((m, i) => i === pendingIndex ? userMessage : m);
          }
          return [...prev, userMessage];
        });
        break;
      }

      case 'assistant': {
        const assistantId = event.message.id;
        setMessages(prev => {
          const existing = prev.find(m => m.id === assistantId);
          if (existing) {
            // Update existing message - accumulate content blocks instead of replacing
            return prev.map(m => 
              m.id === assistantId 
                ? { 
                    ...m, 
                    content: [
                      ...(Array.isArray(existing.content) ? existing.content : []),
                      ...(Array.isArray(event.message.content) ? event.message.content : [event.message.content])
                    ],
                    isStreaming: event.message.stop_reason === null 
                  }
                : m
            );
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
            return [...prev, assistantMessage];
          }
        });
        break;
      }

      case 'result': {
        // Mark streaming as complete and navigate to new session if needed
        setMessages(prev => prev.map(m => ({ ...m, isStreaming: false })));
        
        // Navigate to the new session page if session changed
        if (event.session_id && event.session_id !== sessionId) {
          navigate(`/c/${event.session_id}`, { 
            state: { 
              fromConversation: true 
            } 
          });
        }
        
        setStreamingId(null);
        break;
      }

      case 'error':
        setError(event.error);
        setStreamingId(null);
        break;

      case 'closed':
        console.log('Stream closed');
        setStreamingId(null);
        break;
    }
  }, [navigate, sessionId]);

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
    const tempUserMessage: ChatMessage = {
      id: `user-pending-${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

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
      setMessages(prev => prev.map(m => ({ ...m, isStreaming: false })));
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
      
      // Check if it's in the ConversationMessage structure
      if (msg.parentUuid) {
        // Note: parentUuid might be the parent message UUID, not the tool_use_id
        // This would require additional logic to resolve the actual tool_use_id
        // For now, we'll use it as-is and let the grouping algorithm handle it
        parentToolUseId = msg.parentUuid;
      }
      
      // Check if it's in the message content (Anthropic format)
      if (typeof msg.message === 'object' && 'parent_tool_use_id' in msg.message) {
        parentToolUseId = msg.message.parent_tool_use_id as string;
      }
      
      // For tool_result content, extract the tool_use_id as parent reference
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block && 
              typeof block === 'object' && 
              'type' in block && 
              block.type === 'tool_result' && 
              'tool_use_id' in block && 
              !parentToolUseId) {
            parentToolUseId = block.tool_use_id as string;
            break;
          }
        }
      } else if (content && 
                 typeof content === 'object' && 
                 'type' in content && 
                 content.type === 'tool_result' && 
                 'tool_use_id' in content && 
                 !parentToolUseId) {
        parentToolUseId = content.tool_use_id as string;
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