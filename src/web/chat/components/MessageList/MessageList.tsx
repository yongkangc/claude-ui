import React, { useRef } from 'react';
import { MessageItem } from './MessageItem';
import type { ChatMessage } from '../../types';
import styles from './MessageList.module.css';

export interface MessageListProps {
  messages: ChatMessage[];
  toolResults?: Record<string, { status: 'pending' | 'completed'; result?: string | any[] }>;
  isLoading?: boolean;
  isStreaming?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, toolResults = {}, isLoading, isStreaming }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  console.debug('[MessageList] Rendering with', messages.length, 'messages, isLoading:', isLoading, 'isStreaming:', isStreaming, 'toolResults:', Object.keys(toolResults).length);

  // Filter out user messages that only contain tool_result blocks
  const displayMessages = messages.filter(message => {
    if (message.type === 'user' && Array.isArray(message.content)) {
      const allToolResults = message.content.every((block: any) => block.type === 'tool_result');
      if (allToolResults) {
        return false; // Don't display tool result messages
      }
    }
    return true;
  });

  if (displayMessages.length === 0 && !isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>No messages yet. Start by typing a message below.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.messageList}>
        {displayMessages.map((message) => (
          <MessageItem key={message.messageId} message={message} toolResults={toolResults} />
        ))}
        
        {isLoading && (
          <div className={styles.loadingMessage}>
            <div className={styles.loadingSpinner}>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>Connecting to Claude...</span>
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>

    </div>
  );
};