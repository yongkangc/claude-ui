import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TaskItem } from './TaskItem';
import styles from './TaskList.module.css';
import type { Conversation } from '../../types/conversation';

interface TaskListProps {
  conversations: Conversation[];
  loading: boolean;
  error: string | null;
  activeTab: 'tasks' | 'archive';
}

export function TaskList({ conversations, loading, error, activeTab }: TaskListProps) {
  const navigate = useNavigate();

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
    <div className={styles.container}>
      {filteredConversations.map((conversation) => (
        <TaskItem
          key={conversation.sessionId}
          id={conversation.sessionId}
          title={conversation.summary}
          timestamp={conversation.updatedAt}
          projectPath={conversation.projectPath}
          status={conversation.status}
          onClick={() => handleTaskClick(conversation.sessionId)}
          onCancel={
            conversation.status === 'ongoing' 
              ? () => handleCancelTask(conversation.sessionId)
              : undefined
          }
        />
      ))}
    </div>
  );
}