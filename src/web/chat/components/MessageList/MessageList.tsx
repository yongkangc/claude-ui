import React, { useRef } from 'react';
import { MessageItem } from './MessageItem';
import type { ChatMessage } from '../../types';
import styles from './MessageList.module.css';

export interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  isStreaming?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ messages, isLoading, isStreaming }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (messages.length === 0 && !isLoading) {
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
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
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