import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { MessageList } from '../MessageList/MessageList';
import { InputArea } from '../InputArea/InputArea';
import { api } from '../../services/api';
import { useStreaming } from '../../hooks/useStreaming';
import type { ChatMessage, StreamEvent, ConversationDetailsResponse } from '../../types';
import styles from './ConversationView.module.css';

export function ConversationView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if we have a streamingId from navigation state
  useEffect(() => {
    const state = location.state as { streamingId?: string } | null;
    if (state?.streamingId) {
      setStreamingId(state.streamingId);
      // Clear the state to prevent issues on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Load conversation history
  useEffect(() => {
    const loadConversation = async () => {
      if (!sessionId) return;

      setIsLoading(true);
      setError(null);

      try {
        const details = await api.getConversationDetails(sessionId);
        const chatMessages = convertToChatlMessages(details);
        setMessages(chatMessages);
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
        setMessages(prev => [...prev, userMessage]);
        break;

      case 'assistant':
        const assistantId = event.message.id;
        setMessages(prev => {
          const existing = prev.find(m => m.id === assistantId);
          if (existing) {
            // Update existing message
            return prev.map(m => 
              m.id === assistantId 
                ? { ...m, content: event.message.content, isStreaming: event.message.stop_reason === null }
                : m
            );
          } else {
            // Add new message
            const assistantMessage: ChatMessage = {
              id: assistantId,
              type: 'assistant',
              content: event.message.content,
              timestamp: new Date().toISOString(),
              isStreaming: event.message.stop_reason === null,
            };
            return [...prev, assistantMessage];
          }
        });
        break;

      case 'result':
        // Mark streaming as complete
        setMessages(prev => 
          prev.map(m => ({ ...m, isStreaming: false }))
        );
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
  }, []);

  const { isConnected } = useStreaming(streamingId, {
    onMessage: handleStreamMessage,
    onError: (err) => {
      setError(err.message);
      setStreamingId(null);
    },
  });

  const handleSendMessage = async (message: string) => {
    if (!sessionId) return;

    setError(null);

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

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <MessageList 
        messages={messages} 
        isLoading={isLoading}
      />

      <InputArea
        onSubmit={handleSendMessage}
        isLoading={isConnected}
        placeholder="Continue the conversation..."
      />
    </div>
  );
}

// Helper function to convert API response to chat messages
function convertToChatlMessages(details: ConversationDetailsResponse): ChatMessage[] {
  return details.messages.map(msg => {
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