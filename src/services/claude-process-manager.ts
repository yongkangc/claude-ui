import { ChildProcess, spawn } from 'child_process';
import { ConversationConfig, CCUIError } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { JsonLinesParser } from './json-lines-parser';

/**
 * Manages Claude CLI processes and their lifecycle
 */
export class ClaudeProcessManager extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map();
  private outputBuffers: Map<string, string> = new Map();
  private mcpConfigPath: string;

  constructor(mcpConfigPath: string = './mcp-config.json') {
    super();
    this.mcpConfigPath = mcpConfigPath;
  }

  /**
   * Start a new Claude conversation
   */
  async startConversation(config: ConversationConfig): Promise<string> {
    const sessionId = uuidv4();
    
    try {
      const args = this.buildClaudeArgs(config);
      const process = this.spawnClaudeProcess(config, args);
      
      this.processes.set(sessionId, process);
      this.setupProcessHandlers(sessionId, process);
      
      return sessionId;
    } catch (error) {
      throw new CCUIError('PROCESS_START_FAILED', `Failed to start Claude process: ${error}`, 500);
    }
  }

  /**
   * Send input to a conversation
   */
  async sendInput(sessionId: string, input: string): Promise<void> {
    const process = this.processes.get(sessionId);
    if (!process) {
      throw new CCUIError('SESSION_NOT_FOUND', `No active session found: ${sessionId}`, 404);
    }

    if (!process.stdin) {
      throw new CCUIError('STDIN_UNAVAILABLE', 'Process stdin is not available', 500);
    }

    try {
      // Send input followed by newline to Claude process
      process.stdin.write(input + '\n');
    } catch (error) {
      throw new CCUIError('INPUT_SEND_FAILED', `Failed to send input: ${error}`, 500);
    }
  }

  /**
   * Stop a conversation
   */
  async stopConversation(sessionId: string): Promise<boolean> {
    const process = this.processes.get(sessionId);
    if (!process) {
      return false;
    }

    try {
      // Attempt graceful shutdown first
      if (process.stdin && !process.stdin.destroyed) {
        process.stdin.end();
      }

      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Force kill if still running
      if (!process.killed) {
        process.kill('SIGTERM');
        
        // If SIGTERM doesn't work, use SIGKILL
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
      }

      // Clean up
      this.processes.delete(sessionId);
      this.outputBuffers.delete(sessionId);
      
      return true;
    } catch (error) {
      console.error(`Error stopping conversation ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.processes.keys());
  }

  /**
   * Check if a session is active
   */
  isSessionActive(sessionId: string): boolean {
    return this.processes.has(sessionId);
  }

  private buildClaudeArgs(config: ConversationConfig): string[] {
    const args: string[] = [
      '-p', // Print mode - required for programmatic use
      '--output-format', 'stream-json', // JSONL output format
    ];

    // Add MCP configuration if available
    if (this.mcpConfigPath) {
      args.push('--mcp-config', this.mcpConfigPath);
      args.push('--permission-prompt-tool', 'mcp__ccui__permission_prompt');
    }

    // Add working directory access
    if (config.workingDirectory) {
      args.push('--add-dir', config.workingDirectory);
    }

    // Add model specification
    if (config.model) {
      args.push('--model', config.model);
    }

    // Add allowed tools
    if (config.allowedTools && config.allowedTools.length > 0) {
      args.push('--allowedTools', config.allowedTools.join(','));
    }

    // Add disallowed tools
    if (config.disallowedTools && config.disallowedTools.length > 0) {
      args.push('--disallowedTools', config.disallowedTools.join(','));
    }

    // Add system prompt
    if (config.systemPrompt) {
      args.push('--system-prompt', config.systemPrompt);
    }

    // Add the initial prompt as the final argument
    args.push(config.initialPrompt);

    return args;
  }

  private spawnClaudeProcess(config: ConversationConfig, args: string[]): ChildProcess {
    try {
      const claudeProcess = spawn('claude', args, {
        cwd: config.workingDirectory || process.cwd(),
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'], // We'll handle all I/O streams
        shell: false
      });
      
      if (!claudeProcess.pid) {
        throw new Error('Failed to spawn Claude process');
      }

      return claudeProcess;
    } catch (error) {
      throw new CCUIError('PROCESS_SPAWN_FAILED', `Failed to spawn Claude process: ${error}`, 500);
    }
  }

  private setupProcessHandlers(sessionId: string, process: ChildProcess): void {
    // Create JSONL parser for Claude output
    const parser = new JsonLinesParser();
    
    // Initialize output buffer for this session
    this.outputBuffers.set(sessionId, '');

    // Pipe stdout through JSONL parser
    if (process.stdout) {
      process.stdout.pipe(parser);

      // Handle parsed JSONL messages from Claude
      parser.on('data', (message) => {
        this.handleClaudeMessage(sessionId, message);
      });

      parser.on('error', (error) => {
        this.handleProcessError(sessionId, error);
      });
    }

    // Handle stderr output
    if (process.stderr) {
      process.stderr.on('data', (data) => {
        this.handleProcessError(sessionId, data);
      });
    }

    // Handle process termination
    process.on('close', (code, signal) => {
      this.handleProcessClose(sessionId, code);
    });

    process.on('error', (error) => {
      this.handleProcessError(sessionId, error);
    });

    // Handle process exit
    process.on('exit', (code, signal) => {
      this.handleProcessClose(sessionId, code);
    });
  }

  private handleClaudeMessage(sessionId: string, message: any): void {
    this.emit('claude-message', { sessionId, message });
  }

  private handleProcessClose(sessionId: string, code: number | null): void {
    this.processes.delete(sessionId);
    this.outputBuffers.delete(sessionId);
    this.emit('process-closed', { sessionId, code });
  }

  private handleProcessError(sessionId: string, error: Error | Buffer): void {
    this.emit('process-error', { sessionId, error: error.toString() });
  }
}