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
    console.log(`[DEBUG] Starting conversation with sessionId: ${sessionId}`);
    
    try {
      console.log(`[DEBUG] Building claude args for config:`, config);
      const args = this.buildClaudeArgs(config);
      console.log(`[DEBUG] Claude args built:`, args);
      
      console.log(`[DEBUG] Spawning claude process...`);
      const process = this.spawnClaudeProcess(config, args);
      console.log(`[DEBUG] Claude process spawned with PID: ${process.pid}`);
      
      this.processes.set(sessionId, process);
      console.log(`[DEBUG] Setting up process handlers...`);
      this.setupProcessHandlers(sessionId, process);
      console.log(`[DEBUG] Process handlers set up. Returning sessionId: ${sessionId}`);
      
      return sessionId;
    } catch (error) {
      console.log(`[DEBUG] Error starting conversation:`, error);
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
      console.log(`[DEBUG] Spawning claude with args:`, args);
      console.log(`[DEBUG] Working directory:`, config.workingDirectory || process.cwd());
      
      const claudeProcess = spawn('claude', args, {
        cwd: config.workingDirectory || process.cwd(),
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'], // We'll handle all I/O streams
        shell: false
      });

      console.log(`[DEBUG] Spawn result - PID: ${claudeProcess.pid}`);
      
      if (!claudeProcess.pid) {
        throw new Error('Failed to spawn Claude process');
      }

      console.log(`[DEBUG] Claude process spawned successfully`);
      return claudeProcess;
    } catch (error) {
      console.log(`[DEBUG] Spawn error:`, error);
      throw new CCUIError('PROCESS_SPAWN_FAILED', `Failed to spawn Claude process: ${error}`, 500);
    }
  }

  private setupProcessHandlers(sessionId: string, process: ChildProcess): void {
    console.log(`[DEBUG] Setting up handlers for session: ${sessionId}`);
    
    // Create JSONL parser for Claude output
    const parser = new JsonLinesParser();
    console.log(`[DEBUG] Created JSONL parser`);
    
    // Initialize output buffer for this session
    this.outputBuffers.set(sessionId, '');
    console.log(`[DEBUG] Initialized output buffer`);

    // Pipe stdout through JSONL parser
    if (process.stdout) {
      console.log(`[DEBUG] Setting up stdout pipe`);
      process.stdout.pipe(parser);

      // Handle parsed JSONL messages from Claude
      parser.on('data', (message) => {
        console.log(`[DEBUG] Received parsed message:`, message);
        this.handleClaudeMessage(sessionId, message);
      });

      parser.on('error', (error) => {
        console.log(`[DEBUG] Parser error:`, error);
        this.handleProcessError(sessionId, error);
      });
    }

    // Handle stderr output
    if (process.stderr) {
      console.log(`[DEBUG] Setting up stderr handler`);
      process.stderr.on('data', (data) => {
        console.log(`[DEBUG] Stderr data:`, data.toString());
        this.handleProcessError(sessionId, data);
      });
    }

    // Handle process termination
    process.on('close', (code, signal) => {
      console.log(`[DEBUG] Process closed - code: ${code}, signal: ${signal}`);
      this.handleProcessClose(sessionId, code);
    });

    process.on('error', (error) => {
      console.log(`[DEBUG] Process error:`, error);
      this.handleProcessError(sessionId, error);
    });

    // Handle process exit
    process.on('exit', (code, signal) => {
      console.log(`[DEBUG] Process exit - code: ${code}, signal: ${signal}`);
      this.handleProcessClose(sessionId, code);
    });
    
    console.log(`[DEBUG] All handlers set up for session: ${sessionId}`);
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