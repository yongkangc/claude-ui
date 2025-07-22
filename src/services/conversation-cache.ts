import * as fs from 'fs/promises';
import * as path from 'path';
import { ConversationMessage } from '@/types';
import { createLogger, type Logger } from './logger';
import Anthropic from '@anthropic-ai/sdk';

export interface ConversationChain {
  sessionId: string;
  messages: ConversationMessage[];
  projectPath: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  totalDuration: number;
  model: string;
}

interface ConversationCacheData {
  data: ConversationChain[];
  fileModTimes: Map<string, number>; // filepath -> mtime in ms
  lastCacheTime: number;
}

/**
 * Service for managing conversation cache with file modification tracking
 */
export class ConversationCache {
  private cache: ConversationCacheData | null = null;
  private logger: Logger;

  constructor() {
    this.logger = createLogger('ConversationCache');
  }

  /**
   * Clear the conversation cache to force a refresh on next read
   */
  clear(): void {
    this.logger.debug('Clearing conversation cache');
    const previousCacheSize = this.cache?.data.length || 0;
    this.cache = null;
    this.logger.info('Conversation cache cleared', { 
      previousCacheSize,
      timestamp: new Date().toISOString() 
    });
  }

  /**
   * Get cached conversations if the cache is valid
   */
  async getCachedConversations(
    currentFileModTimes: Map<string, number>
  ): Promise<ConversationChain[] | null> {
    this.logger.debug('Attempting to retrieve cached conversations', {
      hasCachedData: !!this.cache,
      currentFileCount: currentFileModTimes.size
    });

    if (!this.cache) {
      this.logger.debug('No cache exists, returning null');
      return null;
    }

    const isValid = await this.isCacheValid(currentFileModTimes);
    if (!isValid) {
      this.logger.debug('Cache is invalid, returning null');
      return null;
    }

    this.logger.debug('Cache is valid, returning cached data', {
      conversationCount: this.cache.data.length,
      cacheAge: Date.now() - this.cache.lastCacheTime
    });

    return this.cache.data;
  }

  /**
   * Update the cache with new conversation data
   */
  updateCache(
    conversations: ConversationChain[],
    fileModTimes: Map<string, number>
  ): void {
    const startTime = Date.now();
    
    this.logger.debug('Updating cache', {
      conversationCount: conversations.length,
      fileCount: fileModTimes.size,
      previousCacheExists: !!this.cache
    });

    // Store previous cache info for comparison
    const previousCacheInfo = this.cache ? {
      conversationCount: this.cache.data.length,
      fileCount: this.cache.fileModTimes.size,
      lastCacheTime: this.cache.lastCacheTime
    } : null;

    // Update cache
    this.cache = {
      data: conversations,
      fileModTimes: new Map(fileModTimes), // Create a copy to avoid external modifications
      lastCacheTime: Date.now()
    };

    const updateDuration = Date.now() - startTime;

    this.logger.info('Cache updated successfully', {
      conversationCount: conversations.length,
      fileCount: fileModTimes.size,
      updateDurationMs: updateDuration,
      previousCacheInfo,
      timestamp: new Date(this.cache.lastCacheTime).toISOString()
    });
  }

  /**
   * Check if the cache is still valid by comparing file modification times
   */
  private async isCacheValid(currentModTimes: Map<string, number>): Promise<boolean> {
    if (!this.cache) {
      this.logger.debug('Cache validity check: No cache exists');
      return false;
    }

    this.logger.debug('Starting cache validity check', {
      cachedFileCount: this.cache.fileModTimes.size,
      currentFileCount: currentModTimes.size,
      cacheAge: Date.now() - this.cache.lastCacheTime
    });

    // Check if file counts differ
    if (currentModTimes.size !== this.cache.fileModTimes.size) {
      this.logger.info('Cache invalidated: File count changed', {
        cachedCount: this.cache.fileModTimes.size,
        currentCount: currentModTimes.size,
        difference: currentModTimes.size - this.cache.fileModTimes.size
      });
      return false;
    }

    // Check if any file has been modified
    for (const [filePath, currentMtime] of currentModTimes) {
      const cachedMtime = this.cache.fileModTimes.get(filePath);
      
      if (!cachedMtime) {
        this.logger.info('Cache invalidated: New file added', { 
          filePath,
          currentMtime: new Date(currentMtime).toISOString()
        });
        return false;
      }
      
      if (cachedMtime < currentMtime) {
        const timeDiff = currentMtime - cachedMtime;
        this.logger.info('Cache invalidated: File modified', { 
          filePath,
          cachedMtime: new Date(cachedMtime).toISOString(),
          currentMtime: new Date(currentMtime).toISOString(),
          timeDifferenceMs: timeDiff
        });
        return false;
      }
    }

    // Check if any cached files were removed
    for (const [filePath, cachedMtime] of this.cache.fileModTimes) {
      if (!currentModTimes.has(filePath)) {
        this.logger.info('Cache invalidated: File removed', { 
          filePath,
          cachedMtime: new Date(cachedMtime).toISOString()
        });
        return false;
      }
    }

    const cacheAge = Date.now() - this.cache.lastCacheTime;
    this.logger.debug('Cache is valid', {
      cacheAgeMs: cacheAge,
      cacheAgeMinutes: Math.floor(cacheAge / 60000),
      fileCount: this.cache.fileModTimes.size
    });

    return true;
  }

  /**
   * Get cache statistics for monitoring
   */
  getStats(): {
    isLoaded: boolean;
    conversationCount: number;
    fileCount: number;
    lastCacheTime: number | null;
    cacheAge: number | null;
  } {
    if (!this.cache) {
      return {
        isLoaded: false,
        conversationCount: 0,
        fileCount: 0,
        lastCacheTime: null,
        cacheAge: null
      };
    }

    return {
      isLoaded: true,
      conversationCount: this.cache.data.length,
      fileCount: this.cache.fileModTimes.size,
      lastCacheTime: this.cache.lastCacheTime,
      cacheAge: Date.now() - this.cache.lastCacheTime
    };
  }
}