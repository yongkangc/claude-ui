import React, { useState, useCallback, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MessageList } from '../MessageList/MessageList';
import { InputArea } from '../InputArea/InputArea';
import { api } from '../../services/api';
import { useStreaming } from '../../hooks/useStreaming';
import { useConversations } from '../../contexts/ConversationsContext';
import type { ChatMessage, StreamEvent, StartConversationRequest } from '../../types';
import styles from './NewConversation.module.css';

export function NewConversation() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getMostRecentWorkingDirectory } = useConversations();
  
  // Initialize working directory with the most recent project path
  const [workingDirectory, setWorkingDirectory] = useState(() => {
    const recentPath = getMostRecentWorkingDirectory();
    if (recentPath) return recentPath;
    return process.env.NODE_ENV === 'development' ? '/tmp' : '';
  });
  
  const [showWorkingDirInput, setShowWorkingDirInput] = useState(true);
  const navigate = useNavigate();

  // Clear messages when component unmounts
  useEffect(() => {
    return () => {
      // Clear messages on cleanup
      setMessages([]);
    };
  }, []);
  
  // Update working directory when returning to new conversation page if it's still empty
  useEffect(() => {
    if (!workingDirectory) {
      const recentPath = getMostRecentWorkingDirectory();
      if (recentPath) {
        setWorkingDirectory(recentPath);
      }
    }
  }, [getMostRecentWorkingDirectory]);

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
          
          // Navigate to the session page with current messages and streamingId
          if (event.session_id) {
            navigate(`/c/${event.session_id}`, { 
              state: { 
                messages: updatedMessages,
                fromNewConversation: true,
                streamingId: streamingId 
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
  }, [navigate]);

  const { isConnected } = useStreaming(streamingId, {
    onMessage: handleStreamMessage,
    onError: (err) => {
      setError(err.message);
      setStreamingId(null);
    },
  });

  const handleSendMessage = async (message: string) => {
    if (!workingDirectory) {
      setError('Please set a working directory first');
      return;
    }

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
      // Always start a new conversation
      const response = await api.startConversation({
        workingDirectory,
        initialPrompt: message,
        model: '',
        systemPrompt: '',
      });
      setStreamingId(response.streamingId);
      setShowWorkingDirInput(false);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    }
  };

  const selectDirectory = async () => {
    const dir = prompt('Enter working directory path:', workingDirectory);
    if (dir) {
      setWorkingDirectory(dir);
    }
  };

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {showWorkingDirInput && (
        <div className={styles.workingDirHeader}>
          <div className={styles.field}>
            <label htmlFor="workingDirectory">
              <FolderOpen size={16} />
              Working Directory
              <span className={styles.required}>*</span>
            </label>
            <div className={styles.inputGroup}>
              <input
                id="workingDirectory"
                type="text"
                value={workingDirectory}
                onChange={(e) => setWorkingDirectory(e.target.value)}
                placeholder="/path/to/project"
                required
              />
              <button
                type="button"
                className={styles.browseButton}
                onClick={selectDirectory}
                title="Browse for directory"
              >
                <FolderOpen size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <MessageList 
        messages={messages} 
        isLoading={false}
      />

      <InputArea
        onSubmit={handleSendMessage}
        isLoading={isConnected}
        placeholder="What would you like Claude to help you with?"
      />
    </div>
  );
}