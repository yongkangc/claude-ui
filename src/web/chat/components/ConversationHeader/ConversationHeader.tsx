import React from 'react';
import { ArrowLeft, Archive, Share, Github, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './ConversationHeader.module.css';

interface ConversationHeaderProps {
  title: string;
  subtitle?: {
    date?: string;
    repo?: string;
    branch?: string;
    changes?: {
      additions: number;
      deletions: number;
    };
  };
}

export function ConversationHeader({ title, subtitle }: ConversationHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/');
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
              {subtitle.branch && (
                <span className={styles.subtitleItem}>{subtitle.branch}</span>
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
        <button className={styles.actionButton} aria-label="Archive Task">
          <Archive size={20} />
          <span>Archive</span>
        </button>
        
        <button className={styles.actionButton} aria-label="Share task">
          <Share size={20} />
          <span>Share</span>
        </button>
        
        <div className={styles.createPRButton}>
          <button className={styles.primaryButton}>
            <Github size={20} />
            <span>Create PR</span>
          </button>
          <button className={styles.dropdownButton} aria-label="Open git action menu">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.5 5.5L8 9L11.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </button>
        </div>
        
        <button className={styles.notificationButton} aria-label="Open notifications">
          <Bell size={20} />
        </button>
      </div>
    </div>
  );
}