import { ConversationSummary, ConversationMessage, ConversationDetailsResponse } from '@/types';
import { ConversationStatusTracker } from './conversation-status-tracker';
import { createLogger, type Logger } from './logger';

/**
 * Context information for optimistic conversations
 * This is stored when a conversation starts but hasn't appeared in history yet
 */
export interface OptimisticContext {
  initialPrompt: string;
  workingDirectory: string;
  model?: string;
  timestamp: string;
}

/**
 * Service to manage optimistic conversation rendering
 * 
 * Optimistic conversations are active sessions that haven't yet appeared in the Claude CLI history files.
 * This service provides temporary representations of these conversations for immediate UI feedback.
 */
export class OptimisticConversationService {
  private logger: Logger;
  private optimisticContexts: Map<string, OptimisticContext> = new Map();

  constructor(private statusTracker: ConversationStatusTracker) {
    this.logger = createLogger('OptimisticConversationService');
  }

  /**
   * Register optimistic context when a conversation starts
   * This is called by the process manager when it receives a system init message
   */
  registerOptimisticContext(streamingId: string, sessionId: string, context: OptimisticContext): void {
    this.logger.debug('Registering optimistic context', {
      streamingId,
      sessionId,
      workingDirectory: context.workingDirectory,
      model: context.model,
      hasInitialPrompt: !!context.initialPrompt
    });

    // Store the context
    this.optimisticContexts.set(streamingId, context);

    // Also register with status tracker
    this.statusTracker.registerActiveSession(streamingId, sessionId, context);
  }

  /**
   * Clean up optimistic context when conversation ends
   */
  cleanupOptimisticContext(streamingId: string): void {
    this.logger.debug('Cleaning up optimistic context', { streamingId });
    this.optimisticContexts.delete(streamingId);
  }

  /**
   * Get optimistic conversations that haven't appeared in history yet
   * Used by the conversation list endpoint
   */
  getOptimisticConversations(existingSessionIds: Set<string>): ConversationSummary[] {
    const activeSessionIds = this.statusTracker.getActiveSessionIds();
    
    const optimisticConversations = activeSessionIds
      .filter(sessionId => !existingSessionIds.has(sessionId))
      .map(sessionId => {
        const context = this.statusTracker.getConversationContext(sessionId);
        const streamingId = this.statusTracker.getStreamingId(sessionId);
        
        if (context && streamingId) {
          // Create optimistic conversation entry
          const optimisticConversation: ConversationSummary = {
            sessionId,
            projectPath: context.workingDirectory,
            summary: '', // No summary for active conversation
            sessionInfo: {
              custom_name: '', // No custom name yet
              created_at: context.timestamp,
              updated_at: context.timestamp,
              version: 2,
              pinned: false,
              archived: false,
              continuation_session_id: '',
              initial_commit_head: ''
            },
            createdAt: context.timestamp,
            updatedAt: context.timestamp,
            messageCount: 1, // At least the initial user message
            totalDuration: 0, // No duration yet
            model: context.model || 'unknown',
            status: 'ongoing' as const,
            streamingId
          };
          
          this.logger.debug('Created optimistic conversation', {
            sessionId,
            streamingId,
            workingDirectory: context.workingDirectory,
            model: context.model
          });
          
          return optimisticConversation;
        }
        
        return null;
      })
      .filter((conversation): conversation is ConversationSummary => conversation !== null);

    this.logger.debug('Generated optimistic conversations', {
      activeSessionCount: activeSessionIds.length,
      existingSessionCount: existingSessionIds.size,
      optimisticCount: optimisticConversations.length
    });

    return optimisticConversations;
  }

  /**
   * Get optimistic conversation details if session is active but not in history
   * Used by the conversation details endpoint
   */
  getOptimisticConversationDetails(sessionId: string): ConversationDetailsResponse | null {
    const isActive = this.statusTracker.isSessionActive(sessionId);
    const context = this.statusTracker.getConversationContext(sessionId);
    
    this.logger.debug('Checking for optimistic conversation details', {
      sessionId,
      isActive,
      hasContext: !!context
    });
    
    if (!isActive || !context) {
      return null;
    }

    // Create optimistic response for active session
    const optimisticMessage: ConversationMessage = {
      uuid: `optimistic-${sessionId}-user`,
      type: 'user',
      message: {
        role: 'user',
        content: context.initialPrompt
      },
      timestamp: context.timestamp,
      sessionId: sessionId,
      cwd: context.workingDirectory
    };
    
    const response: ConversationDetailsResponse = {
      messages: [optimisticMessage],
      summary: '', // No summary for active conversation
      projectPath: context.workingDirectory,
      metadata: {
        totalDuration: 0,
        model: context.model || 'unknown'
      }
    };
    
    this.logger.debug('Created optimistic conversation details', {
      sessionId,
      workingDirectory: context.workingDirectory,
      model: context.model
    });
    
    return response;
  }
}