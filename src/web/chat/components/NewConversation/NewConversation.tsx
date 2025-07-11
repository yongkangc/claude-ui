import React, { useState, useCallback, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MessageList } from '../MessageList/MessageList';
import { InputArea } from '../InputArea/InputArea';
import { api } from '../../services/api';
import { useStreaming, useConversationMessages } from '../../hooks';
import { useConversations } from '../../contexts/ConversationsContext';
import type { StartConversationRequest, ChatMessage } from '../../types';
import styles from './NewConversation.module.css';

export function NewConversation() {
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

  // Use shared conversation messages hook
  const {
    messages,
    addMessage,
    clearMessages,
    handleStreamMessage,
  } = useConversationMessages({
    onResult: (sessionId) => {
      // Navigate to the session page - let ConversationView load fresh data from backend
      navigate(`/c/${sessionId}`, {
        state: {
          fromNewConversation: true
        }
      });
    },
    onError: (err) => {
      setError(err);
      setStreamingId(null);
    },
    onClosed: () => {
      setStreamingId(null);
    },
  });

  // Clear messages when component unmounts
  useEffect(() => {
    return () => {
      clearMessages();
    };
  }, [clearMessages]);
  
  // Update working directory when returning to new conversation page if it's still empty
  useEffect(() => {
    if (!workingDirectory) {
      const recentPath = getMostRecentWorkingDirectory();
      if (recentPath) {
        setWorkingDirectory(recentPath);
      }
    }
  }, [getMostRecentWorkingDirectory]);

  const { isConnected, disconnect } = useStreaming(streamingId, {
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
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMessage);

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

  const handleStop = async () => {
    if (!streamingId) return;

    try {
      // Call the API to stop the conversation
      await api.stopConversation(streamingId);
      
      // Disconnect the streaming connection
      disconnect();
      
      // Clear the streaming ID
      setStreamingId(null);
      
      // Streaming has stopped
    } catch (err: any) {
      console.error('Failed to stop conversation:', err);
      setError(err.message || 'Failed to stop conversation');
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
        onStop={handleStop}
        isLoading={isConnected}
        placeholder="What would you like Claude to help you with?"
      />
    </div>
  );
}