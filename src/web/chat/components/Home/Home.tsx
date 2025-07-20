import React, { useEffect, useState } from 'react';
import { useConversations } from '../../contexts/ConversationsContext';
import { Header } from './Header';
import { Composer } from './Composer';
import { TaskTabs } from './TaskTabs';
import { TaskList } from './TaskList';
import styles from './Home.module.css';

export function Home() {
  const { conversations, loading, error, loadConversations } = useConversations();
  const [activeTab, setActiveTab] = useState<'tasks' | 'archive'>('tasks');

  useEffect(() => {
    loadConversations();
  }, []);

  // Get the most recent working directory from conversations
  const recentWorkingDirectory = conversations.length > 0 
    ? conversations[0].projectPath 
    : undefined;

  const handleComposerSubmit = (text: string, workingDirectory: string, branch: string, model: string) => {
    // Mock submission - will be implemented later
    console.log('New task:', { text, workingDirectory, branch, model });
    alert('Task submission will be implemented soon');
  };

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        <div className={styles.mainContent}>
          <div className={styles.contentWrapper}>
            <div className={styles.inputSection}>
              <h1 className={styles.heading}>What are we coding next?</h1>
              
              <div className={styles.composerWrapper}>
                <Composer 
                  workingDirectory={recentWorkingDirectory}
                  onSubmit={handleComposerSubmit}
                />
              </div>

              <TaskTabs 
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </div>

            <TaskList 
              conversations={conversations}
              loading={loading}
              error={error}
              activeTab={activeTab}
            />
          </div>
        </div>
      </main>
    </div>
  );
}