import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TaskItem } from './TaskItem';
import styles from './TaskList.module.css';
import type { ConversationSummary } from '../../types';
import { useConversations } from '../../contexts/ConversationsContext';
import { api } from '../../services/api';

interface TaskListProps {
  conversations: ConversationSummary[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  activeTab: 'tasks' | 'history' | 'archive';
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
  const { recentDirectories, loadConversations } = useConversations();

  // Filter conversations based on active tab
  const filteredConversations = conversations.filter(conv => {
    if (activeTab === 'archive') {
      return conv.sessionInfo.archived === true;
    } else if (activeTab === 'history') {
      return !conv.sessionInfo.archived && conv.sessionInfo.continuation_session_id !== '';
    } else { // tasks
      return !conv.sessionInfo.archived && conv.sessionInfo.continuation_session_id === '';
    }
  });

  // Sort ongoing tasks to the top in the Tasks tab
  const sortedConversations = activeTab === 'tasks' 
    ? [...filteredConversations].sort((a, b) => {
        // Ongoing tasks first
        if (a.status === 'ongoing' && b.status !== 'ongoing') return -1;
        if (a.status !== 'ongoing' && b.status === 'ongoing') return 1;
        // Then by updated date (already sorted by backend)
        return 0;
      })
    : filteredConversations;

  const handleTaskClick = (sessionId: string) => {
    navigate(`/c/${sessionId}`);
  };

  const handleCancelTask = (sessionId: string) => {
    // Mock cancel functionality
    console.log('Cancel task:', sessionId);
  };

  const handleArchiveTask = async (sessionId: string) => {
    // Optimistically remove the item from the current view
    const element = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (element) {
      element.style.display = 'none';
    }
    
    try {
      // Call the API to persist the change
      await api.updateSession(sessionId, { archived: true });
      
      // Refresh the conversations list to ensure consistency
      loadConversations();
    } catch (error) {
      console.error('Failed to archive task:', error);
      // Restore visibility if the API call fails
      if (element) {
        element.style.display = '';
      }
    }
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

  if (sortedConversations.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.message}>
          {activeTab === 'tasks' ? 'No active tasks.' : activeTab === 'history' ? 'No history tasks.' : 'No archived tasks.'}
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={styles.container}>
      {sortedConversations.map((conversation) => (
        <div key={conversation.sessionId} data-session-id={conversation.sessionId}>
          <TaskItem
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
            onArchive={
              conversation.status === 'completed'
                ? () => handleArchiveTask(conversation.sessionId)
                : undefined
            }
          />
        </div>
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
      {!hasMore && sortedConversations.length > 0 && (
        <div className={styles.endMessage}>
          No more tasks to load
        </div>
      )}
    </div>
  );
}