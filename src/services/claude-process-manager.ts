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
  private timeouts: Map<string, NodeJS.Timeout[]> = new Map();
  private claudeExecutablePath: string;

  constructor(claudeExecutablePath?: string) {
    super();
    this.claudeExecutablePath = claudeExecutablePath || 'claude';
  }


  /**
   * Start a new Claude conversation
   */
  async startConversation(config: ConversationConfig): Promise<string> {
    // console.debug('[ClaudeProcessManager] startConversation called with config:', config);
    const streamingId = uuidv4(); // CCUI's internal streaming identifier
    
    try {
      const args = this.buildClaudeArgs(config);
      // console.debug(`[ClaudeProcessManager] Built Claude args:`, args);
      const process = this.spawnClaudeProcess(config, args);
      
      this.processes.set(streamingId, process);
      this.setupProcessHandlers(streamingId, process);
      
      // Handle spawn errors by listening for our custom event
      const spawnErrorPromise = new Promise<never>((_, reject) => {
        this.once('spawn-error', (error) => {
          this.processes.delete(streamingId);
          reject(error);
        });
      });
      
      // Wait a bit to see if spawn fails immediately
      const delayPromise = new Promise<string>(resolve => {
        setTimeout(() => {
          this.removeAllListeners('spawn-error');
          resolve(streamingId);
        }, 100);
      });
      
      const result = await Promise.race([spawnErrorPromise, delayPromise]);
      // console.debug(`[ClaudeProcessManager] Started conversation with streamingId: ${streamingId}`);
      
      return result;
    } catch (error) {
      // console.debug('[ClaudeProcessManager] Error in startConversation:', error);
      if (error instanceof CCUIError) {
        throw error;
      }
      throw new CCUIError('PROCESS_START_FAILED', `Failed to start Claude process: ${error}`, 500);
    }
  }


  /**
   * Stop a conversation
   */
  async stopConversation(streamingId: string): Promise<boolean> {
    // console.debug(`[ClaudeProcessManager] stopConversation called for streamingId: ${streamingId}`);
    const process = this.processes.get(streamingId);
    if (!process) {
      // console.debug(`[ClaudeProcessManager] No process found for streamingId: ${streamingId}`);
      return false;
    }

    try {
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 100));

      // Force kill if still running
      if (!process.killed) {
        process.kill('SIGTERM');
        
        // If SIGTERM doesn't work, use SIGKILL
        const killTimeout = setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
        
        // Track timeout for cleanup
        const sessionTimeouts = this.timeouts.get(streamingId) || [];
        sessionTimeouts.push(killTimeout);
        this.timeouts.set(streamingId, sessionTimeouts);
      }

      // Clean up timeouts
      const sessionTimeouts = this.timeouts.get(streamingId);
      if (sessionTimeouts) {
        sessionTimeouts.forEach(timeout => clearTimeout(timeout));
        this.timeouts.delete(streamingId);
      }

      // Clean up
      this.processes.delete(streamingId);
      this.outputBuffers.delete(streamingId);
      
      // console.debug(`[ClaudeProcessManager] Stopped and cleaned up process for streamingId: ${streamingId}`);
      return true;
    } catch (error) {
      console.error(`Error stopping conversation ${streamingId}:`, error);
      return false;
    }
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): string[] {
    const sessions = Array.from(this.processes.keys());
    // console.debug('[ClaudeProcessManager] getActiveSessions:', sessions);
    return sessions;
  }

  /**
   * Check if a session is active
   */
  isSessionActive(streamingId: string): boolean {
    const active = this.processes.has(streamingId);
    // console.debug(`[ClaudeProcessManager] isSessionActive(${streamingId}):`, active);
    return active;
  }

  private buildClaudeArgs(config: ConversationConfig): string[] {
    // console.debug('[ClaudeProcessManager] buildClaudeArgs called with config:', config);
    const args: string[] = [
      '-p', // Print mode - required for programmatic use
    ];

    // Add initial prompt immediately after -p
    if (config.initialPrompt) {
      args.push(config.initialPrompt);
    }

    args.push(
      '--output-format', 'stream-json', // JSONL output format
      '--verbose', // Required when using stream-json with print mode
      '--max-turns', '10', // Allow multiple turns to see Claude responses in tests
    );

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

    // console.debug('[ClaudeProcessManager] buildClaudeArgs result:', args);
    return args;
  }

  private spawnClaudeProcess(config: ConversationConfig, args: string[]): ChildProcess {
    // console.debug('[ClaudeProcessManager] spawnClaudeProcess called with args:', args, 'and config:', config);
    const executablePath = config.claudeExecutablePath || this.claudeExecutablePath;
    try {
      const claudeProcess = spawn(executablePath, args, {
        cwd: config.workingDirectory || process.cwd(),
        env: { ...process.env},
        stdio: ['inherit', 'pipe', 'pipe'], // stdin inherited, stdout/stderr piped for capture
        // shell: false
      });
      
      // Handle spawn errors (like ENOENT when claude is not found)
      claudeProcess.on('error', (error: any) => {
        // console.debug('[ClaudeProcessManager] Claude process spawn error:', error);
        // Emit error event instead of throwing synchronously in callback
        if (error.code === 'ENOENT') {
          this.emit('spawn-error', new CCUIError('CLAUDE_NOT_FOUND', 'Claude CLI not found. Please ensure Claude is installed and in PATH.', 500));
        } else {
          this.emit('spawn-error', new CCUIError('PROCESS_SPAWN_FAILED', `Failed to spawn Claude process: ${error.message}`, 500));
        }
      });
      
      if (!claudeProcess.pid) {
        // console.debug('[ClaudeProcessManager] Failed to spawn Claude process - no PID assigned');
        throw new Error('Failed to spawn Claude process - no PID assigned');
      }
      // console.debug('[ClaudeProcessManager] Claude process spawned with PID:', claudeProcess.pid);
      return claudeProcess;
    } catch (error) {
      // console.debug('[ClaudeProcessManager] Error in spawnClaudeProcess:', error);
      if (error instanceof CCUIError) {
        throw error;
      }
      throw new CCUIError('PROCESS_SPAWN_FAILED', `Failed to spawn Claude process: ${error}`, 500);
    }
  }

  private setupProcessHandlers(streamingId: string, process: ChildProcess): void {
    // console.debug(`[ClaudeProcessManager] setupProcessHandlers for streamingId: ${streamingId}, PID: ${process.pid}`);
    
    // Create JSONL parser for Claude output
    const parser = new JsonLinesParser();
    
    // Initialize output buffer for this session
    this.outputBuffers.set(streamingId, '');

    // Handle stdout - pipe through JSONL parser
    if (process.stdout) {
      // console.debug(`[ClaudeProcessManager] [${streamingId}] Setting up stdout handler`);
      process.stdout.setEncoding('utf8');
      process.stdout.pipe(parser);

      // Handle parsed JSONL messages from Claude
      parser.on('data', (message) => {
        // console.debug(`[ClaudeProcessManager] [${streamingId}] Received Claude message:`, message);
        this.handleClaudeMessage(streamingId, message);
      });

      parser.on('error', (error) => {
        // console.debug(`[ClaudeProcessManager] [${streamingId}] Parser error:`, error);
        this.handleProcessError(streamingId, error);
      });
    } else {
      // console.debug(`[ClaudeProcessManager] [${streamingId}] No stdout stream available`);
    }

    // Handle stderr output
    if (process.stderr) {
      // console.debug(`[ClaudeProcessManager] [${streamingId}] Setting up stderr handler`);
      process.stderr.setEncoding('utf8');
      process.stderr.on('data', (data) => {
        // console.debug(`[ClaudeProcessManager] [${streamingId}] STDERR:`, data.toString());
        this.handleProcessError(streamingId, data);
      });
    } else {
      // console.debug(`[ClaudeProcessManager] [${streamingId}] No stderr stream available`);
    }

    // Handle process termination
    process.on('close', (code, _signal) => {
      // console.debug(`[ClaudeProcessManager] [${streamingId}] Process closed with code:`, code);
      this.handleProcessClose(streamingId, code);
    });

    process.on('error', (error) => {
      // console.debug(`[ClaudeProcessManager] [${streamingId}] Process error:`, error);
      this.handleProcessError(streamingId, error);
    });

    // Handle process exit
    process.on('exit', (code, _signal) => {
      // console.debug(`[ClaudeProcessManager] [${streamingId}] Process exited with code:`, code);
      this.handleProcessClose(streamingId, code);
    });
  }

  private handleClaudeMessage(streamingId: string, message: any): void {
    // console.debug(`[ClaudeProcessManager] handleClaudeMessage for streamingId: ${streamingId}`, message);
    this.emit('claude-message', { streamingId, message });
  }

  private handleProcessClose(streamingId: string, code: number | null): void {
    // console.debug(`[ClaudeProcessManager] handleProcessClose for streamingId: ${streamingId}, code:`, code);
    this.processes.delete(streamingId);
    this.outputBuffers.delete(streamingId);
    this.emit('process-closed', { streamingId, code });
  }

  private handleProcessError(streamingId: string, error: Error | Buffer): void {
    const errorMessage = error.toString();
    // console.debug(`[ClaudeProcessManager] handleProcessError for streamingId: ${streamingId}, error:`, errorMessage);
    this.emit('process-error', { streamingId, error: errorMessage });
  }
}