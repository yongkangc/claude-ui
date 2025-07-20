import React from 'react';
import { X } from 'lucide-react';
import styles from './TaskItem.module.css';

interface TaskItemProps {
  id: string;
  title: string;
  timestamp: string;
  projectPath: string;
  status: 'ongoing' | 'completed' | 'error';
  onClick: () => void;
  onCancel?: () => void;
}

export function TaskItem({ 
  id, 
  title, 
  timestamp, 
  projectPath, 
  status, 
  onClick,
  onCancel 
}: TaskItemProps) {
  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className={styles.container}>
      <a 
        className={styles.link} 
        onClick={(e) => {
          e.preventDefault();
          onClick();
        }}
        href="#"
      >
        <div className={styles.content}>
          <div className={styles.details}>
            <div className={styles.titleRow}>
              <div className={styles.title}>
                <span>{title || 'New conversation'}</span>
              </div>
            </div>
            <div className={styles.metadata}>
              <span className={styles.timestamp}>
                {formatTimestamp(timestamp)}
              </span>
              <span className={styles.separator}>·</span>
              <span className={styles.projectPath}>
                {projectPath || 'No project'}
              </span>
            </div>
          </div>
          
          {status === 'ongoing' && (
            <div className={styles.statusSection}>
              <span className={styles.statusText}>Starting container</span>
              <button
                className={styles.cancelButton}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCancel?.();
                }}
                aria-label="Cancel task"
                type="button"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
        
        {/* Hover effect overlay */}
        <div className={styles.hoverOverlay} />
      </a>
    </div>
  );
}