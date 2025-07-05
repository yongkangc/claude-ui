import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';
import type { ConversationSummary } from '../types';

interface ConversationsContextType {
  conversations: ConversationSummary[];
  loading: boolean;
  error: string | null;
  loadConversations: () => Promise<void>;
  getMostRecentWorkingDirectory: () => string | null;
}

const ConversationsContext = createContext<ConversationsContextType | undefined>(undefined);

export function ConversationsProvider({ children }: { children: ReactNode }) {
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
      value={{ conversations, loading, error, loadConversations, getMostRecentWorkingDirectory }}
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