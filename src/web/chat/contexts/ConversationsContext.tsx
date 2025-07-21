import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';
import type { ConversationSummary } from '../types';

interface ConversationsContextType {
  conversations: ConversationSummary[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadConversations: () => Promise<void>;
  loadMoreConversations: () => Promise<void>;
  getMostRecentWorkingDirectory: () => string | null;
}

const ConversationsContext = createContext<ConversationsContextType | undefined>(undefined);

const INITIAL_LIMIT = 10;
const LOAD_MORE_LIMIT = 10;

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getConversations({ 
        limit: INITIAL_LIMIT,
        offset: 0,
        sortBy: 'updated',
        order: 'desc'
      });
      setConversations(data.conversations);
      setHasMore(data.conversations.length === INITIAL_LIMIT);
    } catch (err) {
      setError('Failed to load conversations');
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreConversations = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    setError(null);
    try {
      const data = await api.getConversations({ 
        limit: LOAD_MORE_LIMIT,
        offset: conversations.length,
        sortBy: 'updated',
        order: 'desc'
      });
      
      if (data.conversations.length === 0) {
        setHasMore(false);
      } else {
        setConversations(prev => [...prev, ...data.conversations]);
        setHasMore(data.conversations.length === LOAD_MORE_LIMIT);
      }
    } catch (err) {
      setError('Failed to load more conversations');
      console.error('Error loading more conversations:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const getMostRecentWorkingDirectory = (): string | null => {
    if (conversations.length === 0) return null;
    
    // Sort by updatedAt to get the most recently used
    const sorted = [...conversations].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    
    return sorted[0]?.projectPath || null;
  };

  useEffect(() => {
    loadConversations();
  }, []);

  return (
    <ConversationsContext.Provider 
      value={{ 
        conversations, 
        loading, 
        loadingMore, 
        hasMore, 
        error, 
        loadConversations, 
        loadMoreConversations, 
        getMostRecentWorkingDirectory 
      }}
    >
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const context = useContext(ConversationsContext);
  if (context === undefined) {
    throw new Error('useConversations must be used within a ConversationsProvider');
  }
  return context;
}