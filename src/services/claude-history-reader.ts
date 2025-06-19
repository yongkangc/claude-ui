import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ConversationSummary, ConversationMessage, ConversationListQuery, CCUIError } from '@/types';
import { createLogger } from './logger';
import type { Logger } from 'pino';

/**
 * Reads conversation history from Claude's local storage
 */
export class ClaudeHistoryReader {
  private claudeHomePath: string;
  private logger: Logger;
  
  constructor() {
    this.claudeHomePath = path.join(os.homedir(), '.claude');
    this.logger = createLogger('ClaudeHistoryReader');
  }

  get homePath(): string {
    return this.claudeHomePath;
  }

  /**
   * List all conversations with optional filtering
   */
  async listConversations(filter?: ConversationListQuery): Promise<{
    conversations: ConversationSummary[];
    total: number;
  }> {
    try {
      const projectsPath = path.join(this.claudeHomePath, 'projects');
      const projects = await this.readDirectory(projectsPath);
      
      const allConversations: ConversationSummary[] = [];
      
      // Process each project directory
      for (const project of projects) {
        const projectPath = path.join(projectsPath, project);
        const stats = await fs.stat(projectPath);
        
        if (!stats.isDirectory()) continue;
        
        const conversations = await this.readProjectConversations(projectPath, project);
        allConversations.push(...conversations);
      }
      
      // Apply filters and pagination
      const filtered = this.applyFilters(allConversations, filter);
      const paginated = this.applyPagination(filtered, filter);
      
      return {
        conversations: paginated,
        total: filtered.length
      };
    } catch (error) {
      throw new CCUIError('HISTORY_READ_FAILED', `Failed to read conversation history: ${error}`, 500);
    }
  }

  /**
   * Fetch full conversation details
   */
  async fetchConversation(sessionId: string): Promise<ConversationMessage[]> {
    try {
      const filePath = await this.findConversationFile(sessionId);
      if (!filePath) {
        throw new CCUIError('CONVERSATION_NOT_FOUND', `Conversation ${sessionId} not found`, 404);
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      const messages: ConversationMessage[] = [];
      
      // Parse each line as JSON
      const lines = content.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type !== 'summary') {
            messages.push(this.parseMessage(entry));
          }
        } catch (parseError) {
          this.logger.warn('Failed to parse line from conversation', parseError, { sessionId, line: line.substring(0, 100) });
        }
      }
      
      return messages;
    } catch (error) {
      if (error instanceof CCUIError) throw error;
      throw new CCUIError('CONVERSATION_READ_FAILED', `Failed to read conversation: ${error}`, 500);
    }
  }

  /**
   * Get conversation metadata
   */
  async getConversationMetadata(sessionId: string): Promise<{
    summary: string;
    projectPath: string;
    model: string;
    totalCost: number;
    totalDuration: number;
  } | null> {
    try {
      const filePath = await this.findConversationFile(sessionId);
      if (!filePath) {
        return null;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      let summary = 'No summary available';
      let projectPath = '';
      let model = '';
      let totalCost = 0;
      let totalDuration = 0;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          
          // Extract summary from first entry
          if (entry.type === 'summary') {
            summary = entry.summary || summary;
          }
          
          // Extract project path and model from messages
          if (entry.cwd) {
            projectPath = entry.cwd;
          }
          
          if (entry.message?.model) {
            model = entry.message.model;
          }
          
          // Accumulate costs and durations
          if (entry.costUSD) {
            totalCost += entry.costUSD;
          }
          
          if (entry.durationMs) {
            totalDuration += entry.durationMs;
          }
        } catch {
          // Skip invalid JSON lines
        }
      }

      return {
        summary,
        projectPath,
        model,
        totalCost,
        totalDuration
      };
    } catch (error) {
      this.logger.error('Error getting metadata for conversation', error, { sessionId });
      return null;
    }
  }

  private async readDirectory(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async readProjectConversations(projectPath: string, encodedProject: string): Promise<ConversationSummary[]> {
    try {
      const conversations: ConversationSummary[] = [];
      const files = await this.readDirectory(projectPath);
      
      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        
        const sessionId = path.basename(file, '.jsonl');
        const filePath = path.join(projectPath, file);
        
        try {
          // Get file stats for timestamps
          const stats = await fs.stat(filePath);
          
          // Read first line for summary
          const firstLine = await this.readFirstLine(filePath);
          const summaryData = JSON.parse(firstLine);
          
          // Count messages in the file
          const messageCount = await this.countMessages(filePath);
          
          conversations.push({
            sessionId,
            projectPath: this.decodeProjectPath(encodedProject),
            summary: summaryData.summary || 'No summary available',
            createdAt: stats.birthtime.toISOString(),
            updatedAt: stats.mtime.toISOString(),
            messageCount
          });
        } catch (error) {
          this.logger.error('Error reading conversation', error, { sessionId, projectPath });
          // Continue with other conversations even if one fails
        }
      }
      
      return conversations;
    } catch (error) {
      this.logger.error('Error reading project conversations', error, { projectPath });
      return [];
    }
  }

  private async findConversationFile(sessionId: string): Promise<string | null> {
    try {
      const projectsPath = path.join(this.claudeHomePath, 'projects');
      const projects = await this.readDirectory(projectsPath);
      
      // Search through all project directories
      for (const project of projects) {
        const projectPath = path.join(projectsPath, project);
        const stats = await fs.stat(projectPath);
        
        if (!stats.isDirectory()) continue;
        
        const conversationFile = path.join(projectPath, `${sessionId}.jsonl`);
        
        try {
          await fs.access(conversationFile);
          return conversationFile;
        } catch {
          // File doesn't exist, continue searching
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error('Error searching for conversation', error, { sessionId });
      return null;
    }
  }

  private parseMessage(entry: any): ConversationMessage {
    return {
      uuid: entry.uuid,
      type: entry.type as 'user' | 'assistant' | 'system',
      message: entry.message,
      timestamp: entry.timestamp,
      sessionId: entry.sessionId,
      parentUuid: entry.parentUuid,
      isSidechain: entry.isSidechain,
      userType: entry.userType,
      cwd: entry.cwd,
      version: entry.version,
      costUSD: entry.costUSD,
      durationMs: entry.durationMs
    };
  }

  private applyFilters(conversations: ConversationSummary[], filter?: ConversationListQuery): ConversationSummary[] {
    if (!filter) return conversations;
    
    let filtered = [...conversations];
    
    // Filter by project path
    if (filter.projectPath) {
      filtered = filtered.filter(c => c.projectPath === filter.projectPath);
    }
    
    // Sort
    if (filter.sortBy) {
      filtered.sort((a, b) => {
        const field = filter.sortBy === 'created' ? 'createdAt' : 'updatedAt';
        const aVal = new Date(a[field]).getTime();
        const bVal = new Date(b[field]).getTime();
        return filter.order === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }
    
    return filtered;
  }

  private applyPagination(conversations: ConversationSummary[], filter?: ConversationListQuery): ConversationSummary[] {
    if (!filter) return conversations;
    
    const limit = filter.limit || 20;
    const offset = filter.offset || 0;
    
    return conversations.slice(offset, offset + limit);
  }

  private decodeProjectPath(encoded: string): string {
    // Claude encodes directory paths by replacing '/' with '-'
    return encoded.replace(/-/g, '/');
  }

  private async readFirstLine(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        return line;
      }
    }
    throw new Error('No non-empty lines found in file');
  }

  private async countMessages(filePath: string): Promise<number> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    let messageCount = 0;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'summary') {
          messageCount++;
        }
      } catch {
        // Skip invalid JSON lines
      }
    }
    
    return messageCount;
  }
}