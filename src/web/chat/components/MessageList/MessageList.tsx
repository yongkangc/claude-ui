import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { MessageItem } from './MessageItem';
import type { ChatMessage } from '../../types';
import styles from './MessageList.module.css';

export interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  isStreaming?: boolean;
  onFollowingChange?: (isFollowing: boolean, hasNewMessages: boolean) => void;
}

export interface MessageListRef {
  scrollToBottom: () => void;
}

export const MessageList = forwardRef<MessageListRef, MessageListProps>(
  ({ messages, isLoading, isStreaming, onFollowingChange }, ref) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const scrollThreshold = 100; // pixels from bottom to consider "near bottom"

  // Check if user is near bottom of scroll
  const checkIsNearBottom = useCallback(() => {
    if (!containerRef.current) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= scrollThreshold;
  }, []);

  // Handle scroll events to track following state
  const handleScroll = useCallback(() => {
    const nearBottom = checkIsNearBottom();
    setIsFollowing(nearBottom);
    
    // Reset hasNewMessages if scrolled to bottom
    if (nearBottom) {
      setHasNewMessages(false);
    }
    
    // Notify parent component
    onFollowingChange?.(nearBottom, !nearBottom && hasNewMessages);
  }, [checkIsNearBottom, hasNewMessages, onFollowingChange]);

  // Debounced scroll handler for performance
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout;
    const debouncedScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(handleScroll, 50);
    };

    container.addEventListener('scroll', debouncedScroll);
    
    // Also check on resize
    const handleResize = () => {
      handleScroll();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('scroll', debouncedScroll);
      window.removeEventListener('resize', handleResize);
      clearTimeout(scrollTimeout);
    };
  }, [handleScroll]);

  // Auto-scroll logic
  useEffect(() => {
    if (!bottomRef.current) return;

    // Always scroll instantly when not streaming (navigation)
    if (!isStreaming) {
      bottomRef.current.scrollIntoView({ behavior: 'instant' });
      setIsFollowing(true);
      setHasNewMessages(false);
    } 
    // During streaming, only scroll if following
    else if (isFollowing) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      // User is reading above, mark that we have new messages
      setHasNewMessages(true);
      onFollowingChange?.(false, true);
    }
  }, [messages, isStreaming, isFollowing, onFollowingChange]);

  // Scroll to bottom and re-enable following
  const scrollToBottom = useCallback(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      setIsFollowing(true);
      setHasNewMessages(false);
    }
  }, []);

  // Expose scrollToBottom to parent
  useImperativeHandle(ref, () => ({
    scrollToBottom
  }), [scrollToBottom]);

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
});

MessageList.displayName = 'MessageList';