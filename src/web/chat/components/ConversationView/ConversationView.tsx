import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { MessageList, MessageListRef } from '../MessageList/MessageList';
import { InputArea } from '../InputArea/InputArea';
import { api } from '../../services/api';
import { useStreaming } from '../../hooks/useStreaming';
import type { ChatMessage, StreamEvent, ConversationDetailsResponse } from '../../types';
import styles from './ConversationView.module.css';

export function ConversationView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const messageListRef = useRef<MessageListRef>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewMessagesButton, setShowNewMessagesButton] = useState(false);

  // Check if we have a streamingId or messages from navigation state
  useEffect(() => {
    const state = location.state as { 
      streamingId?: string;
      messages?: ChatMessage[];
      fromNewConversation?: boolean;
      fromConversation?: boolean;
    } | null;
    
    // Only use streamingId from navigation state if it's a new conversation
    // For resumed conversations, we'll get the streamingId from the API
    if (state?.streamingId && state.fromNewConversation) {
      setStreamingId(state.streamingId);
    }
    
    if (state?.messages && (state.fromNewConversation || state.fromConversation)) {
      // Set the messages from the previous screen
      setMessages(state.messages);
    }
    
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
      setStreamingId(null);
    };
  }, [sessionId]);

  // Load conversation history
  useEffect(() => {
    const loadConversation = async () => {
      if (!sessionId) return;

      // Skip loading if we already have messages from navigation
      const hasNavigationMessages = messages.length > 0;
      
      setIsLoading(true);
      setError(null);

      try {
        const details = await api.getConversationDetails(sessionId);
        const chatMessages = convertToChatlMessages(details);
        
        // Only set messages if we don't have any locally
        // This preserves messages that were added during streaming
        setMessages(prev => {
          if (prev.length === 0) {
            return chatMessages;
          }
          // If we already have messages, merge them intelligently
          // Keep existing messages that might not be in the backend yet
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = chatMessages.filter(m => !existingIds.has(m.id));
          return [...prev, ...newMessages];
        });
        
        // Check if this conversation has an active stream
        // First, get the conversation summary to check status
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

      case 'user':
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          type: 'user',
          content: event.message.content,
          timestamp: new Date().toISOString(),
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

      case 'assistant':
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
            };
            return [...prev, assistantMessage];
          }
        });
        break;

      case 'result':
        // Mark streaming as complete and navigate with current messages
        setMessages(prev => {
          const updatedMessages = prev.map(m => ({ ...m, isStreaming: false }));
          
          // Navigate to the new session page with current messages
          if (event.session_id && event.session_id !== sessionId) {
            navigate(`/c/${event.session_id}`, { 
              state: { 
                messages: updatedMessages,
                fromConversation: true 
              } 
            });
          }
          
          return updatedMessages;
        });
        setStreamingId(null);
        break;

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
        ref={messageListRef}
        messages={messages} 
        isLoading={isLoading}
        isStreaming={!!streamingId}
        onFollowingChange={(isFollowing, hasNewMessages) => {
          setShowNewMessagesButton(!!streamingId && !isFollowing && hasNewMessages);
        }}
      />

      <InputArea
        onSubmit={handleSendMessage}
        onStop={handleStop}
        isLoading={isConnected}
        placeholder="Continue the conversation..."
      />

      {/* New messages button */}
      {showNewMessagesButton && (
        <button 
          className={styles.newMessagesButton}
          onClick={() => messageListRef.current?.scrollToBottom()}
          aria-label="Scroll to new messages"
          title="New messages"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 4L10 16M10 16L15 11M10 16L5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
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
      
      return {
        id: msg.uuid,
        type: msg.type as 'user' | 'assistant' | 'system',
        content: content,
        timestamp: msg.timestamp,
      };
    });
}