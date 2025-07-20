import React from 'react';
import styles from './TaskTabs.module.css';

interface TaskTabsProps {
  activeTab: 'tasks' | 'archive';
  onTabChange: (tab: 'tasks' | 'archive') => void;
}

export function TaskTabs({ activeTab, onTabChange }: TaskTabsProps) {
  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <div className={styles.tabWrapper}>
          <button
            className={`${styles.tab} ${activeTab === 'tasks' ? styles.active : ''}`}
            onClick={() => onTabChange('tasks')}
            aria-label="Tab selector to view all tasks"
          >
            Tasks
          </button>
          {activeTab === 'tasks' && (
            <div className={styles.activeIndicator} />
          )}
        </div>
        
        <div className={styles.tabWrapper}>
          <button
            className={`${styles.tab} ${activeTab === 'archive' ? styles.active : ''}`}
            onClick={() => onTabChange('archive')}
            aria-label="Tab selector to view archived tasks"
          >
            Archive
          </button>
          {activeTab === 'archive' && (
            <div className={styles.activeIndicator} />
          )}
        </div>
      </div>
    </div>
  );
}