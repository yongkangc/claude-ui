import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, MessageSquare, Clock, Zap } from 'lucide-react';
import { api } from '../../services/api';
import type { ConversationSummary } from '../../types';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getConversations({ limit: 50 });
      setConversations(data.conversations);
    } catch (err) {
      setError('Failed to load conversations');
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
    
    // Refresh conversations every 10 seconds if there are ongoing conversations
    const interval = setInterval(() => {
      if (conversations.some(c => c.status === 'ongoing')) {
        loadConversations();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Reload conversations when a new conversation starts
  useEffect(() => {
    const handleNewConversation = () => {
      loadConversations();
    };

    // Listen for navigation to conversation pages
    if (location.pathname.startsWith('/c/')) {
      handleNewConversation();
    }
  }, [location.pathname]);

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

  const isActive = (sessionId: string) => {
    return location.pathname === `/c/${sessionId}`;
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.newButton}
        onClick={() => navigate('/new')}
        aria-label="New conversation"
      >
        <Plus size={18} />
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
            className={`${styles.item} ${isActive(conversation.sessionId) ? styles.active : ''}`}
            onClick={() => navigate(`/c/${conversation.sessionId}`)}
            title={`${conversation.projectPath}\n${conversation.summary}`}
          >
            <div className={styles.itemIcon}>
              {conversation.status === 'ongoing' ? (
                <Zap size={16} className={styles.ongoingIcon} />
              ) : (
                <MessageSquare size={16} />
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
            No conversations yet. Start a new one!
          </div>
        )}
      </div>
    </div>
  );
}