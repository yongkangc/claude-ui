import React, { useRef, useEffect } from 'react';
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
  const previousMessageCount = useRef(0);
  
  console.debug('[MessageList] Rendering with', messages.length, 'messages, isLoading:', isLoading, 'isStreaming:', isStreaming, 'toolResults:', Object.keys(toolResults).length);

  // Auto-scroll to bottom when messages are first loaded (navigation to conversation)
  useEffect(() => {
    // Only scroll if we're going from 0 messages to some messages (initial load)
    if (previousMessageCount.current === 0 && messages.length > 0 && containerRef.current) {
      // Scroll to bottom without animation
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      console.debug('[MessageList] Auto-scrolled to bottom on initial load');
    }
    previousMessageCount.current = messages.length;
  }, [messages.length]);

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

  // Group consecutive messages by type to create message groups
  const messageGroups: Array<{type: 'user' | 'assistant' | 'error' | 'system', messages: ChatMessage[]}> = [];
  displayMessages.forEach((message) => {
    const lastGroup = messageGroups[messageGroups.length - 1];
    if (lastGroup && lastGroup.type === message.type) {
      lastGroup.messages.push(message);
    } else {
      messageGroups.push({ type: message.type, messages: [message] });
    }
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
        {messageGroups.map((group, groupIndex) => (
          <div key={`group-${groupIndex}`} className={styles.messageGroup}>
            {group.messages.map((message, messageIndex) => (
              <MessageItem 
                key={message.messageId} 
                message={message} 
                toolResults={toolResults}
                isFirstInGroup={messageIndex === 0}
                isLastInGroup={messageIndex === group.messages.length - 1}
              />
            ))}
            {((groupIndex < messageGroups.length - 1 && 
              group.type === 'user' && 
              messageGroups[groupIndex + 1].type === 'assistant') ||
             (group.type === 'user' && 
              groupIndex === messageGroups.length - 1 && 
              isStreaming)) && (
              <div className={styles.messageDivider} />
            )}
          </div>
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
        
        {!isLoading && isStreaming && messageGroups.length > 0 && (
          <div className={styles.streamingIndicator}>
            <div className={styles.streamingDot} />
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>

    </div>
  );
};