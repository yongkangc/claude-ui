import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConversations } from '../../contexts/ConversationsContext';
import { api } from '../../services/api';
import { Header } from './Header';
import { Composer } from '@/web/common/components/Composer';
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
    loadMoreConversations,
    recentDirectories,
    getMostRecentWorkingDirectory 
  } = useConversations();
  const [activeTab, setActiveTab] = useState<'tasks' | 'history' | 'archive'>('tasks');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const conversationCountRef = useRef(conversations.length);

  // Update the ref whenever conversations change
  useEffect(() => {
    conversationCountRef.current = conversations.length;
  }, [conversations.length]);

  // Auto-refresh on navigation back to Home
  useEffect(() => {
    // Refresh on component mount if we have conversations
    if (conversationCountRef.current > 0) {
      loadConversations(conversationCountRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array means this runs only on mount

  // Auto-refresh on focus
  useEffect(() => {
    const handleFocus = () => {
      // Only refresh if we have loaded conversations before
      if (conversationCountRef.current > 0) {
        loadConversations(conversationCountRef.current);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && conversationCountRef.current > 0) {
        loadConversations(conversationCountRef.current);
      }
    };

    // Listen for window focus
    window.addEventListener('focus', handleFocus);
    // Listen for tab visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadConversations]);

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
                  isLoading={isSubmitting}
                  placeholder="Describe another task"
                  showDirectorySelector={true}
                  showModelSelector={true}
                  enableFileAutocomplete={true}
                  recentDirectories={recentDirectories}
                  getMostRecentWorkingDirectory={getMostRecentWorkingDirectory}
                  onFetchFileSystem={async (directory) => {
                    const response = await api.listDirectory({
                      path: directory,
                      recursive: true,
                      respectGitignore: true,
                    });
                    return response.entries;
                  }}
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