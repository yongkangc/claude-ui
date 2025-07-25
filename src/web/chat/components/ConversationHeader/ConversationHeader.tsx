import React from 'react';
import { ArrowLeft, Archive, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import styles from './ConversationHeader.module.css';

interface ConversationHeaderProps {
  title: string;
  sessionId?: string;
  isArchived?: boolean;
  subtitle?: {
    date?: string;
    repo?: string;
    commitSHA?: string;
    changes?: {
      additions: number;
      deletions: number;
    };
  };
}

export function ConversationHeader({ title, sessionId, isArchived = false, subtitle }: ConversationHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/');
  };

  const handleArchive = async () => {
    if (!sessionId) return;
    
    try {
      await api.updateSession(sessionId, { archived: !isArchived });
      navigate('/');
    } catch (err) {
      console.error(`Failed to ${isArchived ? 'unarchive' : 'archive'} session:`, err);
    }
  };

  return (
    <div className={styles.header}>
      <div className={styles.leftSection}>
        <button 
          className={styles.backButton} 
          onClick={handleBack}
          aria-label="Go back to tasks"
        >
          <ArrowLeft size={20} />
        </button>
        
        <div className={styles.separator} />
        
        <div className={styles.titleSection}>
          <div className={styles.titleRow}>
            <span className={styles.title}>{title}</span>
          </div>
          {subtitle && (
            <div className={styles.subtitle}>
              {subtitle.date && (
                <span className={styles.subtitleItem}>{subtitle.date}</span>
              )}
              {subtitle.repo && (
                <span className={styles.subtitleItem}>{subtitle.repo}</span>
              )}
              {subtitle.commitSHA && (
                <span className={styles.subtitleItem}>{subtitle.commitSHA.slice(0, 7)}</span>
              )}
              {subtitle.changes && (
                <span className={styles.changes}>
                  <span className={styles.additions}>+{subtitle.changes.additions}</span>
                  <span className={styles.deletions}>-{subtitle.changes.deletions}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.rightSection}>
        <button 
          className={styles.actionButton} 
          aria-label={isArchived ? "Unarchive Task" : "Archive Task"}
          onClick={handleArchive}
          disabled={!sessionId}
        >
          <Archive size={20} />
          <span>{isArchived ? 'Unarchive' : 'Archive'}</span>
        </button>
        
        <button className={styles.notificationButton} aria-label="Open notifications">
          <Bell size={20} />
        </button>
      </div>
    </div>
  );
}