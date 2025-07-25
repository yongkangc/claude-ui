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
  onLoadMore: (filters?: {
    hasContinuation?: boolean;
    archived?: boolean;
    pinned?: boolean;
  }) => void;
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

  // Get filter parameters based on active tab
  const getFiltersForTab = (tab: 'tasks' | 'history' | 'archive') => {
    switch (tab) {
      case 'tasks':
        return { archived: false, hasContinuation: false };
      case 'history':
        return { archived: false, hasContinuation: true };
      case 'archive':
        return { archived: true };
      default:
        return {};
    }
  };

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
      loadConversations(undefined, getFiltersForTab(activeTab));
    } catch (error) {
      console.error('Failed to archive task:', error);
      // Restore visibility if the API call fails
      if (element) {
        element.style.display = '';
      }
    }
  };

  const handleUnarchiveTask = async (sessionId: string) => {
    // Optimistically remove the item from the current view
    const element = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (element) {
      element.style.display = 'none';
    }
    
    try {
      // Call the API to persist the change
      await api.updateSession(sessionId, { archived: false });
      
      // Refresh the conversations list to ensure consistency
      loadConversations(undefined, getFiltersForTab(activeTab));
    } catch (error) {
      console.error('Failed to unarchive task:', error);
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
        onLoadMore(getFiltersForTab(activeTab));
      }
    },
    [hasMore, loadingMore, loading, onLoadMore, activeTab]
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

  if (conversations.length === 0) {
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
      {conversations.map((conversation) => (
        <div key={conversation.sessionId} data-session-id={conversation.sessionId}>
          <TaskItem
            id={conversation.sessionId}
            title={conversation.summary}
            timestamp={conversation.updatedAt}
            projectPath={conversation.projectPath}
            recentDirectories={recentDirectories}
            status={conversation.status}
            messageCount={conversation.messageCount}
            toolMetrics={conversation.toolMetrics}
            liveStatus={conversation.liveStatus}
            isArchived={activeTab === 'archive'}
            onClick={() => handleTaskClick(conversation.sessionId)}
            onCancel={
              conversation.status === 'ongoing' 
                ? () => handleCancelTask(conversation.sessionId)
                : undefined
            }
            onArchive={
              conversation.status === 'completed' && activeTab !== 'archive'
                ? () => handleArchiveTask(conversation.sessionId)
                : undefined
            }
            onUnarchive={
              conversation.status === 'completed' && activeTab === 'archive'
                ? () => handleUnarchiveTask(conversation.sessionId)
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
      {!hasMore && conversations.length > 0 && (
        <div className={styles.endMessage}>
          No more tasks to load
        </div>
      )}
    </div>
  );
}