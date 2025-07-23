import React, { useState } from 'react';
import { StopCircle, Archive } from 'lucide-react';
import styles from './TaskItem.module.css';

interface TaskItemProps {
  id: string;
  title: string;
  timestamp: string;
  projectPath: string;
  recentDirectories: Record<string, { lastDate: string; shortname: string }>;
  status: 'ongoing' | 'completed' | 'error';
  onClick: () => void;
  onCancel?: () => void;
  onArchive?: () => void;
}

export function TaskItem({ 
  id: _id, 
  title, 
  timestamp, 
  projectPath, 
  recentDirectories,
  status, 
  onClick,
  onCancel,
  onArchive 
}: TaskItemProps) {
  const [isHovered, setIsHovered] = useState(false);
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
    <div 
      className={styles.container}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
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
                {projectPath 
                  ? (recentDirectories[projectPath]?.shortname || projectPath.split('/').pop() || projectPath)
                  : 'No project'}
              </span>
            </div>
          </div>
          
          {status === 'ongoing' && (
            <div className={styles.statusSection}>
              <span className={styles.statusText}>Running</span>
              <button
                className={styles.stopButton}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onCancel?.();
                }}
                aria-label="Stop task"
                type="button"
              >
                <StopCircle size={24} />
              </button>
            </div>
          )}
          
          {status === 'completed' && isHovered && (
            <div className={styles.statusSection}>
              <button
                className={styles.archiveButton}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onArchive?.();
                }}
                aria-label="Archive task"
                type="button"
              >
                <Archive size={17} />
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