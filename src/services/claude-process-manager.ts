import { ChildProcess, spawn } from 'child_process';
import { ConversationConfig, CCUIError } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { JsonLinesParser } from './json-lines-parser';
import { MCPConfigValidator } from '@/utils/mcp-config-validator';

/**
 * Manages Claude CLI processes and their lifecycle
 */
export class ClaudeProcessManager extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map();
  private outputBuffers: Map<string, string> = new Map();
  private timeouts: Map<string, NodeJS.Timeout[]> = new Map();
  private mcpConfigPath: string;
  private testMode: boolean;
  private testClaudeHome?: string;

  constructor(mcpConfigPath: string = './mcp-config.json', testMode: boolean = false, testClaudeHome?: string) {
    super();
    this.mcpConfigPath = mcpConfigPath;
    this.testMode = testMode;
    this.testClaudeHome = testClaudeHome;
  }

  /**
   * Validate MCP configuration if not in test mode
   */
  async validateMCPConfig(): Promise<void> {
    if (this.testMode || !this.mcpConfigPath) {
      return; // Skip validation in test mode or if no config path
    }

    try {
      const config = await MCPConfigValidator.validateConfig(this.mcpConfigPath);
      const validation = await MCPConfigValidator.validateAllServers(config);
      
      // Log warnings for invalid servers but don't fail
      Object.entries(validation.errors).forEach(([serverName, error]) => {
        console.warn(`MCP server '${serverName}' validation warning: ${error}`);
      });
      
      // Check if the CCUI server is configured correctly
      if (!config.mcpServers.ccui) {
        throw new CCUIError(
          'MCP_CCUI_SERVER_NOT_CONFIGURED',
          'CCUI MCP server not found in configuration. Permission handling will not work.',
          400
        );
      }
    } catch (error) {
      if (error instanceof CCUIError) {
        throw error;
      }
      throw new CCUIError(
        'MCP_CONFIG_VALIDATION_FAILED',
        `MCP configuration validation failed: ${error}`,
        500
      );
    }
  }

  /**
   * Start a new Claude conversation
   */
  async startConversation(config: ConversationConfig): Promise<string> {
    const streamingId = uuidv4(); // CCUI's internal streaming identifier
    
    try {
      // Validate MCP configuration before starting if using MCP
      await this.validateMCPConfig();
      
      const args = this.buildClaudeArgs(config);
      const process = this.spawnClaudeProcess(config, args);
      
      this.processes.set(streamingId, process);
      this.setupProcessHandlers(streamingId, process);
      
      // Send initial prompt via stdin
      if (process.stdin && config.initialPrompt) {
        process.stdin.write(config.initialPrompt + '\n');
      }
      
      return streamingId;
    } catch (error) {
      throw new CCUIError('PROCESS_START_FAILED', `Failed to start Claude process: ${error}`, 500);
    }
  }

  /**
   * Send input to a conversation
   */
  async sendInput(streamingId: string, input: string): Promise<void> {
    const process = this.processes.get(streamingId);
    if (!process) {
      throw new CCUIError('SESSION_NOT_FOUND', `No active session found: ${streamingId}`, 404);
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
  async stopConversation(streamingId: string): Promise<boolean> {
    const process = this.processes.get(streamingId);
    if (!process) {
      return false;
    }

    try {
      // Attempt graceful shutdown first
      if (process.stdin && !process.stdin.destroyed) {
        process.stdin.end();
      }

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
    return Array.from(this.processes.keys());
  }

  /**
   * Check if a session is active
   */
  isSessionActive(streamingId: string): boolean {
    return this.processes.has(streamingId);
  }

  private buildClaudeArgs(config: ConversationConfig): string[] {
    const args: string[] = [
      '-p', // Print mode - required for programmatic use
      '--output-format', 'stream-json', // JSONL output format
      '--verbose', // Required when using stream-json with print mode
      '--max-turns', '5', // Allow multiple turns to see Claude responses in tests
    ];

    // Add MCP configuration if available (skip in test mode to avoid MCP server dependency)
    if (this.mcpConfigPath && !this.testMode) {
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

    // Note: In print mode (-p), the prompt should be sent via stdin, not as an argument

    return args;
  }

  private spawnClaudeProcess(config: ConversationConfig, args: string[]): ChildProcess {
    try {
      // Prepare environment variables
      const env = this.testMode && this.testClaudeHome ? {
        ...process.env,  // Preserve all existing environment variables (especially PATH)
        HOME: this.testClaudeHome  // Override HOME for test isolation
      } : { ...process.env };

      if (this.testMode) {
        console.log(`[Claude]: Spawning process with args:`, ['claude', ...args]);
      }

      const claudeProcess = spawn('claude', args, {
        cwd: config.workingDirectory || process.cwd(),
        env,
        stdio: ['pipe', 'pipe', 'pipe'], // We'll handle all I/O streams
        shell: false
      });
      
      // Handle spawn errors (like ENOENT when claude is not found)
      claudeProcess.on('error', (error: any) => {
        if (error.code === 'ENOENT') {
          throw new CCUIError('CLAUDE_NOT_FOUND', 'Claude CLI not found. Please ensure Claude is installed and in PATH.', 500);
        } else {
          throw new CCUIError('PROCESS_SPAWN_FAILED', `Failed to spawn Claude process: ${error.message}`, 500);
        }
      });
      
      if (!claudeProcess.pid) {
        throw new Error('Failed to spawn Claude process - no PID assigned');
      }

      return claudeProcess;
    } catch (error) {
      if (error instanceof CCUIError) {
        throw error;
      }
      throw new CCUIError('PROCESS_SPAWN_FAILED', `Failed to spawn Claude process: ${error}`, 500);
    }
  }

  private setupProcessHandlers(streamingId: string, process: ChildProcess): void {
    // Create JSONL parser for Claude output
    const parser = new JsonLinesParser();
    
    // Initialize output buffer for this session
    this.outputBuffers.set(streamingId, '');

    // Pipe stdout through JSONL parser
    if (process.stdout) {
      process.stdout.pipe(parser);

      // Handle parsed JSONL messages from Claude
      parser.on('data', (message) => {
        this.handleClaudeMessage(streamingId, message);
      });

      parser.on('error', (error) => {
        this.handleProcessError(streamingId, error);
      });
    }

    // Handle stderr output
    if (process.stderr) {
      process.stderr.on('data', (data) => {
        this.handleProcessError(streamingId, data);
      });
    }

    // Handle process termination
    process.on('close', (code, _signal) => {
      this.handleProcessClose(streamingId, code);
    });

    process.on('error', (error) => {
      this.handleProcessError(streamingId, error);
    });

    // Handle process exit
    process.on('exit', (code, _signal) => {
      this.handleProcessClose(streamingId, code);
    });
  }

  private handleClaudeMessage(streamingId: string, message: any): void {
    // Log Claude output for debugging
    if (this.testMode) {
      console.log(`[Claude ${streamingId}]:`, JSON.stringify(message, null, 2));
    }
    this.emit('claude-message', { streamingId, message });
  }

  private handleProcessClose(streamingId: string, code: number | null): void {
    if (this.testMode) {
      console.log(`[Claude ${streamingId}]: Process closed with code ${code}`);
    }
    this.processes.delete(streamingId);
    this.outputBuffers.delete(streamingId);
    this.emit('process-closed', { streamingId, code });
  }

  private handleProcessError(streamingId: string, error: Error | Buffer): void {
    const errorMessage = error.toString();
    if (this.testMode) {
      console.error(`[Claude ${streamingId}]: Error -`, errorMessage);
    }
    this.emit('process-error', { streamingId, error: errorMessage });
  }
}