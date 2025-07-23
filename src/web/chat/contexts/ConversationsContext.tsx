import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../services/api';
import type { ConversationSummary, WorkingDirectory } from '../types';

interface RecentDirectory {
  lastDate: string;
  shortname: string;
}

interface ConversationsContextType {
  conversations: ConversationSummary[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  recentDirectories: Record<string, RecentDirectory>;
  loadConversations: (limit?: number) => Promise<void>;
  loadMoreConversations: () => Promise<void>;
  getMostRecentWorkingDirectory: () => string | null;
}

const ConversationsContext = createContext<ConversationsContextType | undefined>(undefined);

const INITIAL_LIMIT = 50;
const LOAD_MORE_LIMIT = 100;

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentDirectories, setRecentDirectories] = useState<Record<string, RecentDirectory>>({});

  const loadWorkingDirectories = async (): Promise<Record<string, RecentDirectory> | null> => {
    try {
      const response = await api.getWorkingDirectories();
      const directories: Record<string, RecentDirectory> = {};
      
      response.directories.forEach(dir => {
        directories[dir.path] = {
          lastDate: dir.lastDate,
          shortname: dir.shortname
        };
      });
      
      return directories;
    } catch (err) {
      console.error('Failed to load working directories from API:', err);
      return null;
    }
  };

  const updateRecentDirectories = (convs: ConversationSummary[], apiDirectories?: Record<string, RecentDirectory> | null) => {
    const newDirectories: Record<string, RecentDirectory> = {};
    
    // First, add API directories if available
    if (apiDirectories) {
      Object.assign(newDirectories, apiDirectories);
    }
    
    // Then, process conversations and merge with API data
    convs.forEach(conv => {
      if (conv.projectPath) {
        const pathParts = conv.projectPath.split('/');
        const shortname = pathParts[pathParts.length - 1] || conv.projectPath;
        
        // If API didn't provide this directory, or if conversation is more recent
        if (!newDirectories[conv.projectPath] || 
            new Date(conv.updatedAt) > new Date(newDirectories[conv.projectPath].lastDate)) {
          newDirectories[conv.projectPath] = {
            lastDate: conv.updatedAt,
            shortname: apiDirectories?.[conv.projectPath]?.shortname || shortname
          };
        }
      }
    });
    
    setRecentDirectories(newDirectories);
  };

  const loadConversations = async (limit?: number) => {
    setLoading(true);
    setError(null);
    try {
      const loadLimit = limit || INITIAL_LIMIT;
      // Load working directories from API in parallel with conversations
      const [data, apiDirectories] = await Promise.all([
        api.getConversations({ 
          limit: loadLimit,
          offset: 0,
          sortBy: 'updated',
          order: 'desc'
        }),
        loadWorkingDirectories()
      ]);
      
      setConversations(data.conversations);
      updateRecentDirectories(data.conversations, apiDirectories);
      setHasMore(data.conversations.length === loadLimit);
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
        // When loading more, we don't need to fetch API directories again
        updateRecentDirectories([...conversations, ...data.conversations]);
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
        recentDirectories,
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