import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Clock, Zap, Sun, Moon } from 'lucide-react';
import { useConversations } from '../../contexts/ConversationsContext';
import { useTheme } from '../../hooks/useTheme';
import styles from './Home.module.css';

export function Home() {
  const navigate = useNavigate();
  const { conversations, loading, error, loadConversations } = useConversations();
  const theme = useTheme();

  useEffect(() => {
    loadConversations();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const handleNewConversation = () => {
    // For now, just show an alert since new conversation functionality is removed
    alert('New conversation functionality is temporarily disabled');
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>CCUI</h1>
        <button
          className={styles.themeButton}
          onClick={theme.toggle}
          aria-label={`Switch to ${theme.mode === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme.mode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </header>

      <div className={styles.content}>
        <button
          className={styles.newButton}
          onClick={handleNewConversation}
          aria-label="New conversation"
        >
          <Plus size={20} />
          <span>New Conversation</span>
        </button>

        <div className={styles.list}>
          {loading && conversations.length === 0 && (
            <div className={styles.loading}>Loading conversations...</div>
          )}

          {error && (
            <div className={styles.error}>{error}</div>
          )}

          {conversations.map((conversation) => (
            <button
              key={conversation.sessionId}
              className={styles.item}
              onClick={() => navigate(`/c/${conversation.sessionId}`)}
              title={`${conversation.projectPath}\n${conversation.summary}`}
            >
              <div className={styles.itemIcon}>
                {conversation.status === 'ongoing' ? (
                  <Zap size={20} className={styles.ongoingIcon} />
                ) : (
                  <MessageSquare size={20} />
                )}
              </div>
              
              <div className={styles.itemContent}>
                <div className={styles.itemHeader}>
                  <span className={`${styles.status} ${styles[conversation.status]}`}>
                    {conversation.status}
                  </span>
                  <span className={styles.time}>
                    <Clock size={12} />
                    {formatDate(conversation.updatedAt)}
                  </span>
                </div>
                
                <div className={styles.summary} title={conversation.summary}>
                  {conversation.summary || 'No summary'}
                </div>
                
                <div className={styles.path} title={conversation.projectPath}>
                  {conversation.projectPath}
                </div>
              </div>
            </button>
          ))}

          {!loading && conversations.length === 0 && (
            <div className={styles.empty}>
              No conversations yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}