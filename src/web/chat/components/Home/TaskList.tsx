import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TaskItem } from './TaskItem';
import styles from './TaskList.module.css';
import type { ConversationSummary } from '../../types';
import { useConversations } from '../../contexts/ConversationsContext';

interface TaskListProps {
  conversations: ConversationSummary[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  activeTab: 'tasks' | 'archive';
  onLoadMore: () => void;
}

export function TaskList({ 
  conversations, 
  loading, 
  loadingMore, 
  hasMore, 
  error, 
  activeTab, 
  onLoadMore 
}: TaskListProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const { recentDirectories } = useConversations();

  // Filter conversations based on active tab
  // For now, we'll show all conversations in "Tasks" and none in "Archive"
  const filteredConversations = activeTab === 'tasks' ? conversations : [];

  const handleTaskClick = (sessionId: string) => {
    navigate(`/c/${sessionId}`);
  };

  const handleCancelTask = (sessionId: string) => {
    // Mock cancel functionality
    console.log('Cancel task:', sessionId);
  };

  // Intersection Observer for infinite scrolling
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
        onLoadMore();
      }
    },
    [hasMore, loadingMore, loading, onLoadMore]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      root: scrollRef.current,
      rootMargin: '100px',
      threshold: 0.1,
    });

    const currentLoadingRef = loadingRef.current;
    if (currentLoadingRef) {
      observer.observe(currentLoadingRef);
    }

    return () => {
      if (currentLoadingRef) {
        observer.unobserve(currentLoadingRef);
      }
    };
  }, [handleIntersection]);

  if (loading && conversations.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.message}>Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (filteredConversations.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.message}>
          {activeTab === 'tasks' ? 'No active tasks.' : 'No archived tasks.'}
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={styles.container}>
      {filteredConversations.map((conversation) => (
        <TaskItem
          key={conversation.sessionId}
          id={conversation.sessionId}
          title={conversation.summary}
          timestamp={conversation.updatedAt}
          projectPath={conversation.projectPath}
          recentDirectories={recentDirectories}
          status={conversation.status}
          onClick={() => handleTaskClick(conversation.sessionId)}
          onCancel={
            conversation.status === 'ongoing' 
              ? () => handleCancelTask(conversation.sessionId)
              : undefined
          }
        />
      ))}
      
      {/* Loading indicator for infinite scroll */}
      {hasMore && (
        <div ref={loadingRef} className={styles.loadingMore}>
          {loadingMore && (
            <div className={styles.loadingSpinner}>
              Loading more tasks...
            </div>
          )}
        </div>
      )}
      
      {/* End of list message */}
      {!hasMore && filteredConversations.length > 0 && (
        <div className={styles.endMessage}>
          No more tasks to load
        </div>
      )}
    </div>
  );
}