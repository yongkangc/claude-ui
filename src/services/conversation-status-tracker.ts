import { EventEmitter } from 'events';
import { createLogger, type Logger } from './logger';

/**
 * Context data stored for active conversations
 */
export interface ConversationContext {
  initialPrompt: string;
  workingDirectory: string;
  model: string;
  timestamp: string;
}

/**
 * Tracks the mapping between Claude session IDs and active CCUI streaming IDs
 * to determine conversation status (ongoing vs completed)
 */
export class ConversationStatusTracker extends EventEmitter {
  // Maps Claude session ID -> CCUI streaming ID
  private sessionToStreaming: Map<string, string> = new Map();
  // Maps CCUI streaming ID -> Claude session ID (reverse lookup)
  private streamingToSession: Map<string, string> = new Map();
  // Maps Claude session ID -> conversation context for active sessions
  private sessionContext: Map<string, ConversationContext> = new Map();
  // Temporary storage for context before session ID is known (maps streaming ID -> context)
  private pendingContext: Map<string, ConversationContext> = new Map();
  private logger: Logger;

  constructor() {
    super();
    this.logger = createLogger('ConversationStatusTracker');
  }

  /**
   * Register a new active streaming session
   * This is called when we extract the session_id from the first stream message
   */
  registerActiveSession(streamingId: string, claudeSessionId: string): void {
    this.logger.debug('Registering active session', { 
      streamingId, 
      claudeSessionId 
    });

    // Remove any existing mapping for this Claude session
    const existingStreamingId = this.sessionToStreaming.get(claudeSessionId);
    if (existingStreamingId && existingStreamingId !== streamingId) {
      this.logger.debug('Removing existing mapping for Claude session', { 
        claudeSessionId, 
        oldStreamingId: existingStreamingId,
        newStreamingId: streamingId
      });
      this.streamingToSession.delete(existingStreamingId);
    }

    // Remove any existing mapping for this streaming ID
    const existingClaudeSessionId = this.streamingToSession.get(streamingId);
    if (existingClaudeSessionId && existingClaudeSessionId !== claudeSessionId) {
      this.logger.debug('Removing existing mapping for streaming ID', { 
        streamingId, 
        oldClaudeSessionId: existingClaudeSessionId,
        newClaudeSessionId: claudeSessionId
      });
      this.sessionToStreaming.delete(existingClaudeSessionId);
      this.sessionContext.delete(existingClaudeSessionId);
    }

    // Set the new mapping
    this.sessionToStreaming.set(claudeSessionId, streamingId);
    this.streamingToSession.set(streamingId, claudeSessionId);

    // Check if we have pending context for this streaming ID
    const pendingContext = this.pendingContext.get(streamingId);
    if (pendingContext) {
      this.logger.debug('Transferring pending context to session', {
        streamingId,
        claudeSessionId,
        hasInitialPrompt: !!pendingContext.initialPrompt
      });
      this.sessionContext.set(claudeSessionId, pendingContext);
      this.pendingContext.delete(streamingId);
    }

    this.logger.info('Active session registered', { 
      streamingId, 
      claudeSessionId,
      totalActiveSessions: this.sessionToStreaming.size,
      hadPendingContext: !!pendingContext
    });

    this.emit('session-started', { streamingId, claudeSessionId });
  }

  /**
   * Register conversation context for an active session
   * This should be called when starting a new conversation
   */
  registerConversationContext(claudeSessionId: string, context: ConversationContext): void {
    this.logger.debug('Registering conversation context', {
      claudeSessionId,
      hasInitialPrompt: !!context.initialPrompt,
      workingDirectory: context.workingDirectory,
      model: context.model
    });

    this.sessionContext.set(claudeSessionId, context);

    this.logger.info('Conversation context registered', {
      claudeSessionId,
      contextTimestamp: context.timestamp
    });
  }

  /**
   * Register pending conversation context using streaming ID
   * This is used when we start a conversation but don't yet have the Claude session ID
   */
  registerPendingContext(streamingId: string, context: ConversationContext): void {
    this.logger.debug('Registering pending conversation context', {
      streamingId,
      hasInitialPrompt: !!context.initialPrompt,
      workingDirectory: context.workingDirectory,
      model: context.model
    });

    this.pendingContext.set(streamingId, context);

    this.logger.info('Pending conversation context registered', {
      streamingId,
      contextTimestamp: context.timestamp,
      pendingCount: this.pendingContext.size
    });
  }

  /**
   * Unregister an active streaming session when it ends
   */
  unregisterActiveSession(streamingId: string): void {
    const claudeSessionId = this.streamingToSession.get(streamingId);
    
    if (claudeSessionId) {
      this.logger.debug('Unregistering active session', { 
        streamingId, 
        claudeSessionId 
      });

      this.sessionToStreaming.delete(claudeSessionId);
      this.streamingToSession.delete(streamingId);
      this.sessionContext.delete(claudeSessionId);

      this.logger.info('Active session unregistered', { 
        streamingId, 
        claudeSessionId,
        totalActiveSessions: this.sessionToStreaming.size
      });

      this.emit('session-ended', { streamingId, claudeSessionId });
    } else {
      this.logger.warn('Attempted to unregister unknown streaming session', { streamingId });
    }
    
    // Also clean up any pending context
    if (this.pendingContext.has(streamingId)) {
      this.logger.debug('Removing pending context for streaming ID', { streamingId });
      this.pendingContext.delete(streamingId);
    }
  }

  /**
   * Get conversation context for an active session
   */
  getConversationContext(claudeSessionId: string): ConversationContext | undefined {
    const context = this.sessionContext.get(claudeSessionId);
    this.logger.debug('Getting conversation context', {
      claudeSessionId,
      hasContext: !!context
    });
    return context;
  }

  /**
   * Check if a Claude session ID is currently active (has ongoing stream)
   */
  isSessionActive(claudeSessionId: string): boolean {
    const isActive = this.sessionToStreaming.has(claudeSessionId);
    this.logger.debug('Checking session active status', { 
      claudeSessionId, 
      isActive 
    });
    return isActive;
  }

  /**
   * Get the streaming ID for an active Claude session
   */
  getStreamingId(claudeSessionId: string): string | undefined {
    const streamingId = this.sessionToStreaming.get(claudeSessionId);
    this.logger.debug('Getting streaming ID for Claude session', { 
      claudeSessionId, 
      streamingId: streamingId || 'not found' 
    });
    return streamingId;
  }

  /**
   * Get the Claude session ID for an active streaming session
   */
  getSessionId(streamingId: string): string | undefined {
    const claudeSessionId = this.streamingToSession.get(streamingId);
    this.logger.debug('Getting Claude session ID for streaming ID', { 
      streamingId, 
      claudeSessionId: claudeSessionId || 'not found' 
    });
    return claudeSessionId;
  }

  /**
   * Get all active Claude session IDs
   */
  getActiveSessionIds(): string[] {
    const sessions = Array.from(this.sessionToStreaming.keys());
    this.logger.debug('Getting all active session IDs', { 
      count: sessions.length,
      sessions 
    });
    return sessions;
  }

  /**
   * Get all active streaming IDs
   */
  getActiveStreamingIds(): string[] {
    const streamingIds = Array.from(this.streamingToSession.keys());
    this.logger.debug('Getting all active streaming IDs', { 
      count: streamingIds.length,
      streamingIds 
    });
    return streamingIds;
  }

  /**
   * Get conversation status for a Claude session ID
   */
  getConversationStatus(claudeSessionId: string): 'completed' | 'ongoing' | 'pending' {
    const isActive = this.isSessionActive(claudeSessionId);
    const status = isActive ? 'ongoing' : 'completed';
    
    this.logger.debug('Getting conversation status', { 
      claudeSessionId, 
      status 
    });
    
    return status;
  }

  /**
   * Clear all mappings (useful for testing)
   */
  clear(): void {
    this.logger.debug('Clearing all session mappings');
    this.sessionToStreaming.clear();
    this.streamingToSession.clear();
    this.sessionContext.clear();
    this.pendingContext.clear();
  }

  /**
   * Get statistics about tracked sessions
   */
  getStats(): {
    activeSessionsCount: number;
    activeStreamingIdsCount: number;
    activeContextsCount: number;
    activeSessions: Array<{ claudeSessionId: string; streamingId: string }>;
  } {
    const activeSessions = Array.from(this.sessionToStreaming.entries()).map(
      ([claudeSessionId, streamingId]) => ({ claudeSessionId, streamingId })
    );

    return {
      activeSessionsCount: this.sessionToStreaming.size,
      activeStreamingIdsCount: this.streamingToSession.size,
      activeContextsCount: this.sessionContext.size,
      activeSessions
    };
  }
}