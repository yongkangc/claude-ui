import { ChildProcess, spawn } from 'child_process';
import { ConversationConfig, CCUIError } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { JsonLinesParser } from './json-lines-parser';
import { createLogger } from './logger';
import type { Logger } from 'pino';

/**
 * Manages Claude CLI processes and their lifecycle
 */
export class ClaudeProcessManager extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map();
  private outputBuffers: Map<string, string> = new Map();
  private timeouts: Map<string, NodeJS.Timeout[]> = new Map();
  private claudeExecutablePath: string;
  private logger: Logger;
  private envOverrides: Record<string, string | undefined>;

  constructor(claudeExecutablePath?: string, envOverrides?: Record<string, string | undefined>) {
    super();
    this.claudeExecutablePath = claudeExecutablePath || 'claude';
    this.logger = createLogger('ClaudeProcessManager');
    this.envOverrides = envOverrides || {};
  }


  /**
   * Resume an existing Claude conversation
   */
  async resumeConversation(config: { sessionId: string; message: string }): Promise<string> {
    this.logger.debug('Resume conversation requested', { 
      sessionId: config.sessionId, 
      messageLength: config.message?.length,
      claudePath: this.claudeExecutablePath 
    });
    
    const args = this.buildResumeArgs(config);
    const spawnConfig = {
      executablePath: this.claudeExecutablePath,
      cwd: process.cwd(),
      env: { ...process.env }
    };
    
    this.logger.debug('Resume spawn config prepared', {
      executablePath: spawnConfig.executablePath,
      cwd: spawnConfig.cwd,
      envKeys: Object.keys(spawnConfig.env)
    });
    
    return this.executeConversationFlow(
      'resuming',
      { resumeSessionId: config.sessionId },
      config,
      args,
      spawnConfig,
      'PROCESS_RESUME_FAILED',
      'Failed to resume Claude process'
    );
  }

  /**
   * Start a new Claude conversation
   */
  async startConversation(config: ConversationConfig): Promise<string> {
    this.logger.debug('Start conversation requested', { 
      hasInitialPrompt: !!config.initialPrompt,
      promptLength: config.initialPrompt?.length,
      workingDirectory: config.workingDirectory,
      model: config.model,
      allowedTools: config.allowedTools,
      disallowedTools: config.disallowedTools,
      hasSystemPrompt: !!config.systemPrompt,
      claudePath: config.claudeExecutablePath || this.claudeExecutablePath
    });
    
    const args = this.buildStartArgs(config);
    const spawnConfig = {
      executablePath: config.claudeExecutablePath || this.claudeExecutablePath,
      cwd: config.workingDirectory || process.cwd(),
      env: { ...process.env, ...this.envOverrides }
    };
    
    this.logger.debug('Start spawn config prepared', {
      executablePath: spawnConfig.executablePath,
      cwd: spawnConfig.cwd,
      hasEnvOverrides: Object.keys(this.envOverrides).length > 0,
      envOverrideKeys: Object.keys(this.envOverrides)
    });
    
    return this.executeConversationFlow(
      'starting',
      {},
      config,
      args,
      spawnConfig,
      'PROCESS_START_FAILED',
      'Failed to start Claude process'
    );
  }


  /**
   * Stop a conversation
   */
  async stopConversation(streamingId: string): Promise<boolean> {
    const sessionLogger = this.logger.child({ streamingId });
    sessionLogger.debug('Stopping conversation');
    const process = this.processes.get(streamingId);
    if (!process) {
      sessionLogger.warn('No process found for conversation');
      return false;
    }

    try {
      // Wait a bit for graceful shutdown
      sessionLogger.debug('Waiting for graceful shutdown');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Force kill if still running
      if (!process.killed) {
        sessionLogger.debug('Process still running, sending SIGTERM', { pid: process.pid });
        process.kill('SIGTERM');
        
        // If SIGTERM doesn't work, use SIGKILL
        const killTimeout = setTimeout(() => {
          if (!process.killed) {
            sessionLogger.warn('Process not responding to SIGTERM, sending SIGKILL', { pid: process.pid });
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
      
      sessionLogger.info('Stopped and cleaned up process');
      return true;
    } catch (error) {
      sessionLogger.error('Error stopping conversation', error);
      return false;
    }
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): string[] {
    const sessions = Array.from(this.processes.keys());
    this.logger.debug('Getting active sessions', { sessionCount: sessions.length });
    return sessions;
  }

  /**
   * Check if a session is active
   */
  isSessionActive(streamingId: string): boolean {
    const active = this.processes.has(streamingId);
    this.logger.debug('Checking session active status', { streamingId, active });
    return active;
  }

  /**
   * Execute common conversation flow for both start and resume operations
   */
  private async executeConversationFlow(
    operation: string,
    loggerContext: Record<string, any>,
    config: any,
    args: string[],
    spawnConfig: { executablePath: string; cwd: string; env: Record<string, any> },
    errorCode: string,
    errorPrefix: string
  ): Promise<string> {
    const streamingId = uuidv4(); // CCUI's internal streaming identifier
    const sessionLogger = this.logger.child({ streamingId, ...loggerContext });
    
    try {
      sessionLogger.debug(`${operation.charAt(0).toUpperCase() + operation.slice(1)} conversation`, { 
        operation,
        configKeys: Object.keys(config),
        argCount: args.length 
      });
      sessionLogger.debug(`Built Claude ${operation} args`, { 
        args,
        argsString: args.join(' ') 
      });
      
      const process = this.spawnProcess(spawnConfig, args, sessionLogger);
      
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
      sessionLogger.debug('Waiting for spawn validation');
      const delayPromise = new Promise<string>(resolve => {
        setTimeout(() => {
          sessionLogger.debug('Spawn validation period passed, process appears stable');
          this.removeAllListeners('spawn-error');
          resolve(streamingId);
        }, 100);
      });
      
      const result = await Promise.race([spawnErrorPromise, delayPromise]);
      sessionLogger.info(`${operation.charAt(0).toUpperCase() + operation.slice(1)} conversation successfully`, {
        streamingId: result,
        processCount: this.processes.size
      });
      
      return result;
    } catch (error) {
      sessionLogger.error(`Error ${operation} conversation`, error, {
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: error instanceof CCUIError ? error.code : undefined
      });
      if (error instanceof CCUIError) {
        throw error;
      }
      throw new CCUIError(errorCode, `${errorPrefix}: ${error}`, 500);
    }
  }

  private buildBaseArgs(): string[] {
    return [
      '-p', // Print mode - required for programmatic use
    ];
  }

  private buildResumeArgs(config: { sessionId: string; message: string }): string[] {
    this.logger.debug('Building Claude resume args', { 
      sessionId: config.sessionId,
      messagePreview: config.message.substring(0, 50) + (config.message.length > 50 ? '...' : '')
    });
    const args = this.buildBaseArgs();
    
    args.push(
      '--resume', config.sessionId, // Resume existing session
      config.message, // Message to continue with
      '--output-format', 'stream-json', // JSONL output format
      '--verbose' // Required when using stream-json with print mode
    );

    this.logger.debug('Built Claude resume args', { args });
    return args;
  }

  private buildStartArgs(config: ConversationConfig): string[] {
    this.logger.debug('Building Claude start args', { 
      hasInitialPrompt: !!config.initialPrompt,
      promptPreview: config.initialPrompt ? config.initialPrompt.substring(0, 50) + (config.initialPrompt.length > 50 ? '...' : '') : null,
      workingDirectory: config.workingDirectory,
      model: config.model
    });
    const args = this.buildBaseArgs();

    // Add initial prompt immediately after -p
    if (config.initialPrompt) {
      args.push(config.initialPrompt);
    }

    args.push(
      '--output-format', 'stream-json', // JSONL output format
      '--verbose', // Required when using stream-json with print mode
      '--max-turns', '10' // Allow multiple turns to see Claude responses in tests
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

    this.logger.debug('Built Claude args', { args });
    return args;
  }

  /**
   * Consolidated method to spawn Claude processes for both start and resume operations
   */
  private spawnProcess(
    spawnConfig: { executablePath: string; cwd: string; env: Record<string, any> },
    args: string[],
    sessionLogger: Logger
  ): ChildProcess {
    const { executablePath, cwd, env } = spawnConfig;
    sessionLogger.debug('Spawning Claude process', { 
      executablePath, 
      args, 
      cwd,
      PATH: env.PATH,
      nodeVersion: process.version,
      platform: process.platform
    });
    
    try {
      sessionLogger.debug('Calling spawn() with stdio configuration', {
        stdin: 'inherit',
        stdout: 'pipe', 
        stderr: 'pipe'
      });
      
      const claudeProcess = spawn(executablePath, args, {
        cwd,
        env,
        stdio: ['inherit', 'pipe', 'pipe'] // stdin inherited, stdout/stderr piped for capture
      });
      
      // Handle spawn errors (like ENOENT when claude is not found)
      claudeProcess.on('error', (error: any) => {
        sessionLogger.error('Claude process spawn error', error, {
          errorCode: error.code,
          errorErrno: error.errno,
          errorSyscall: error.syscall,
          errorPath: error.path,
          errorSpawnargs: error.spawnargs
        });
        // Emit error event instead of throwing synchronously in callback
        if (error.code === 'ENOENT') {
          sessionLogger.error('Claude executable not found', {
            attemptedPath: executablePath,
            PATH: env.PATH
          });
          this.emit('spawn-error', new CCUIError('CLAUDE_NOT_FOUND', 'Claude CLI not found. Please ensure Claude is installed and in PATH.', 500));
        } else {
          this.emit('spawn-error', new CCUIError('PROCESS_SPAWN_FAILED', `Failed to spawn Claude process: ${error.message}`, 500));
        }
      });
      
      if (!claudeProcess.pid) {
        sessionLogger.error('Failed to spawn Claude process - no PID assigned', {
          killed: claudeProcess.killed,
          exitCode: claudeProcess.exitCode,
          signalCode: claudeProcess.signalCode
        });
        throw new Error('Failed to spawn Claude process - no PID assigned');
      }
      
      sessionLogger.info('Claude process spawned successfully', { 
        pid: claudeProcess.pid,
        spawnfile: claudeProcess.spawnfile,
        spawnargs: claudeProcess.spawnargs
      });
      return claudeProcess;
    } catch (error) {
      sessionLogger.error('Error in spawnProcess', error);
      if (error instanceof CCUIError) {
        throw error;
      }
      throw new CCUIError('PROCESS_SPAWN_FAILED', `Failed to spawn Claude process: ${error}`, 500);
    }
  }

  private setupProcessHandlers(streamingId: string, process: ChildProcess): void {
    const sessionLogger = this.logger.child({ streamingId, pid: process.pid });
    sessionLogger.debug('Setting up process handlers');
    
    // Create JSONL parser for Claude output
    const parser = new JsonLinesParser();
    
    // Initialize output buffer for this session
    this.outputBuffers.set(streamingId, '');

    // Handle stdout - pipe through JSONL parser
    if (process.stdout) {
      sessionLogger.debug('Setting up stdout handler');
      process.stdout.setEncoding('utf8');
      process.stdout.pipe(parser);

      // Handle parsed JSONL messages from Claude
      parser.on('data', (message) => {
        sessionLogger.debug('Received Claude message', { 
          messageType: message?.type,
          hasContent: !!message?.content,
          contentLength: message?.content?.length,
          messageKeys: message ? Object.keys(message) : [],
          timestamp: new Date().toISOString()
        });
        this.handleClaudeMessage(streamingId, message);
      });

      parser.on('error', (error) => {
        sessionLogger.error('Parser error', error, {
          errorType: error.name,
          errorMessage: error.message,
          bufferState: this.outputBuffers.get(streamingId)?.length || 0
        });
        this.handleProcessError(streamingId, error);
      });
    } else {
      sessionLogger.warn('No stdout stream available');
    }

    // Handle stderr output
    if (process.stderr) {
      sessionLogger.debug('Setting up stderr handler');
      process.stderr.setEncoding('utf8');
      process.stderr.on('data', (data) => {
        const stderrContent = data.toString();
        sessionLogger.warn('Process stderr output', { 
          data: stderrContent,
          dataLength: stderrContent.length,
          preview: stderrContent.substring(0, 200) + (stderrContent.length > 200 ? '...' : '')
        });
        this.handleProcessError(streamingId, data);
      });
    } else {
      sessionLogger.warn('No stderr stream available');
    }

    // Handle process termination
    process.on('close', (code, signal) => {
      sessionLogger.info('Process closed', { 
        exitCode: code,
        signal: signal,
        wasKilled: process.killed
      });
      this.handleProcessClose(streamingId, code);
    });

    process.on('error', (error) => {
      sessionLogger.error('Process error', error);
      this.handleProcessError(streamingId, error);
    });

    // Handle process exit
    process.on('exit', (code, signal) => {
      sessionLogger.info('Process exited', { 
        exitCode: code,
        signal: signal,
        normalExit: code === 0,
        timestamp: new Date().toISOString()
      });
      this.handleProcessClose(streamingId, code);
    });
  }

  private handleClaudeMessage(streamingId: string, message: any): void {
    this.logger.debug('Handling Claude message', { 
      streamingId, 
      messageType: message?.type,
      isError: message?.type === 'error',
      isCompletion: message?.type === 'completion',
      hasToolUse: message?.tool_use !== undefined
    });
    this.emit('claude-message', { streamingId, message });
  }

  private handleProcessClose(streamingId: string, code: number | null): void {
    const hadProcess = this.processes.has(streamingId);
    const hadBuffer = this.outputBuffers.has(streamingId);
    
    this.logger.info('Process closed, cleaning up', { 
      streamingId, 
      exitCode: code,
      exitStatus: code === 0 ? 'success' : 'failure',
      hadActiveProcess: hadProcess,
      hadOutputBuffer: hadBuffer,
      remainingProcesses: this.processes.size - (hadProcess ? 1 : 0)
    });
    
    this.processes.delete(streamingId);
    this.outputBuffers.delete(streamingId);
    this.emit('process-closed', { streamingId, code });
  }

  private handleProcessError(streamingId: string, error: Error | Buffer): void {
    const errorMessage = error.toString();
    const isBuffer = Buffer.isBuffer(error);
    
    this.logger.error('Process error occurred', { 
      streamingId, 
      error: errorMessage,
      errorType: isBuffer ? 'stderr-output' : error.constructor.name,
      errorLength: errorMessage.length,
      processStillActive: this.processes.has(streamingId),
      timestamp: new Date().toISOString()
    });
    
    this.emit('process-error', { streamingId, error: errorMessage });
  }
}