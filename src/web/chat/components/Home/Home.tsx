import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConversations } from '../../contexts/ConversationsContext';
import { api } from '../../services/api';
import { Header } from './Header';
import { Composer } from './Composer';
import { TaskTabs } from './TaskTabs';
import { TaskList } from './TaskList';
import styles from './Home.module.css';

export function Home() {
  const navigate = useNavigate();
  const { 
    conversations, 
    loading, 
    loadingMore, 
    hasMore, 
    error, 
    loadConversations, 
    loadMoreConversations 
  } = useConversations();
  const [activeTab, setActiveTab] = useState<'tasks' | 'archive'>('tasks');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  // Get the most recent working directory from conversations
  const recentWorkingDirectory = conversations.length > 0 
    ? conversations[0].projectPath 
    : undefined;

  const handleComposerSubmit = async (text: string, workingDirectory: string, branch: string, model: string) => {
    setIsSubmitting(true);
    
    try {
      const response = await api.startConversation({
        workingDirectory,
        initialPrompt: text,
        model: model === 'default' ? undefined : model,
      });
      
      // Navigate to the conversation page
      navigate(`/c/${response.sessionId}`);
    } catch (error) {
      console.error('Failed to start conversation:', error);
      // You might want to show an error message to the user here
      alert(`Failed to start conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsSubmitting(false);
    }
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
                  isSubmitting={isSubmitting}
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
              loadingMore={loadingMore}
              hasMore={hasMore}
              error={error}
              activeTab={activeTab}
              onLoadMore={loadMoreConversations}
            />
          </div>
        </div>
      </main>
    </div>
  );
}