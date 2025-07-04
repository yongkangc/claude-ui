import React, { useRef, useEffect } from 'react';
import { MessageItem } from './MessageItem';
import type { ChatMessage } from '../../types';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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
}