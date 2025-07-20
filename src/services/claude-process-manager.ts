import { ChildProcess, spawn } from 'child_process';
import { ConversationConfig, CCUIError, SystemInitMessage, StreamEvent } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { existsSync, readFileSync } from 'fs';
import { JsonLinesParser } from './json-lines-parser';
import { createLogger } from './logger';
import type { Logger } from 'pino';
import { ClaudeHistoryReader } from './claude-history-reader';

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
  private historyReader: ClaudeHistoryReader;
  private mcpConfigPath?: string;

  constructor(historyReader: ClaudeHistoryReader, claudeExecutablePath?: string, envOverrides?: Record<string, string | undefined>) {
    super();
    this.historyReader = historyReader;
    this.claudeExecutablePath = claudeExecutablePath || 'claude';
    this.logger = createLogger('ClaudeProcessManager');
    this.envOverrides = envOverrides || {};
  }

  /**
   * Set the MCP config path to be used for all conversations
   */
  setMCPConfigPath(path: string): void {
    this.mcpConfigPath = path;
    this.logger.debug('MCP config path set', { path });
  }


  /**
   * Resume an existing Claude conversation
   */
  async resumeConversation(config: { sessionId: string; message: string }): Promise<{streamingId: string; systemInit: SystemInitMessage}> {
    const timestamp = new Date().toISOString();
    this.logger.info('Resume conversation requested', { 
      timestamp,
      sessionId: config.sessionId, 
      messageLength: config.message?.length,
      messagePreview: config.message?.substring(0, 50) + (config.message?.length > 50 ? '...' : ''),
      activeProcessCount: this.processes.size,
      claudePath: this.claudeExecutablePath 
    });
    
    // Fetch the original conversation's working directory
    const workingDirectory = await this.historyReader.getConversationWorkingDirectory(config.sessionId);
    
    if (!workingDirectory) {
      throw new CCUIError(
        'CONVERSATION_NOT_FOUND',
        `Could not find working directory for session ${config.sessionId}`,
        404
      );
    }
    
    this.logger.debug('Found working directory for resume session', {
      sessionId: config.sessionId,
      workingDirectory
    });
    
    // Create a full ConversationConfig from the resume parameters
    const fullConfig: ConversationConfig = {
      workingDirectory,
      initialPrompt: config.message
    };
    
    const args = this.buildResumeArgs(config);
    const spawnConfig = {
      executablePath: this.claudeExecutablePath,
      cwd: workingDirectory, // Use the original conversation's working directory
      env: { ...process.env } as NodeJS.ProcessEnv
    };
    
    this.logger.debug('Resume spawn config prepared', {
      executablePath: spawnConfig.executablePath,
      cwd: spawnConfig.cwd,
      envKeys: Object.keys(spawnConfig.env)
    });
    
    return this.executeConversationFlow(
      'resuming',
      { resumeSessionId: config.sessionId },
      fullConfig,
      args,
      spawnConfig,
      'PROCESS_RESUME_FAILED',
      'Failed to resume Claude process'
    );
  }

  /**
   * Start a new Claude conversation
   */
  async startConversation(config: ConversationConfig): Promise<{streamingId: string; systemInit: SystemInitMessage}> {
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
      env: { ...process.env, ...this.envOverrides } as NodeJS.ProcessEnv
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
   * Wait for the system init message from Claude CLI
   * This should always be the first message in the stream
   */
  async waitForSystemInit(streamingId: string): Promise<SystemInitMessage> {
    const sessionLogger = this.logger.child({ streamingId });
    sessionLogger.debug('Waiting for system init message');

    return new Promise<SystemInitMessage>((resolve, reject) => {
      let isResolved = false;
      let stderrOutput = '';
      
      // Set up timeout (15 seconds)
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          sessionLogger.error('Timeout waiting for system init message', {
            stderrOutput: stderrOutput || '(no stderr output)'
          });
          
          // Include stderr output in error message if available
          let errorMessage = 'Timeout waiting for system initialization from Claude CLI';
          if (stderrOutput) {
            errorMessage += `. Error output: ${stderrOutput}`;
          }
          
          reject(new CCUIError('SYSTEM_INIT_TIMEOUT', errorMessage, 500));
        }
      }, 15000);
      
      // Cleanup function to remove all listeners
      const cleanup = () => {
        clearTimeout(timeout);
        this.removeListener('claude-message', messageHandler);
        this.removeListener('process-closed', processClosedHandler);
        this.removeListener('process-error', processErrorHandler);
      };
      
      // Register timeout for cleanup on process termination
      const existingTimeouts = this.timeouts.get(streamingId) || [];
      existingTimeouts.push(timeout);
      this.timeouts.set(streamingId, existingTimeouts);

      // Listen for process exit before system init is received
      const processClosedHandler = ({ streamingId: closedStreamingId, code }: { streamingId: string; code: number | null }) => {
        if (closedStreamingId !== streamingId || isResolved) {
          return; // Not our process or already resolved
        }

        isResolved = true;
        cleanup();
        
        sessionLogger.error('Claude process exited before system init message', {
          exitCode: code,
          stderrOutput: stderrOutput || '(no stderr output)'
        });

        // Create error message with Claude CLI output if available
        let errorMessage = 'Claude CLI process exited before sending system initialization message';
        if (stderrOutput) {
          // Extract Claude CLI's actual output from parser errors
          const claudeOutputMatch = stderrOutput.match(/Invalid JSON: (.+)/);
          if (claudeOutputMatch) {
            errorMessage += `. Claude CLI said: "${claudeOutputMatch[1]}"`;
          } else {
            errorMessage += `. Error output: ${stderrOutput}`;
          }
        }
        if (code !== null) {
          errorMessage += `. Exit code: ${code}`;
        }

        reject(new CCUIError('CLAUDE_PROCESS_EXITED_EARLY', errorMessage, 500));
      };

      // Listen for process errors (including stderr output)
      const processErrorHandler = ({ streamingId: errorStreamingId, error }: { streamingId: string; error: string }) => {
        if (errorStreamingId !== streamingId) {
          return; // Not our process
        }

        // Capture stderr output for error context
        stderrOutput += error;
        sessionLogger.debug('Captured stderr output during system init wait', {
          errorLength: error.length,
          totalStderrLength: stderrOutput.length
        });
      };

      // Listen for the first claude-message event for this streamingId
      const messageHandler = ({ streamingId: msgStreamingId, message }: { streamingId: string; message: StreamEvent }) => {
        if (msgStreamingId !== streamingId) {
          return; // Not for our session
        }

        if (isResolved) {
          return; // Already resolved
        }

        isResolved = true;
        cleanup();

        sessionLogger.debug('Received first message from Claude CLI', {
          messageType: message?.type,
          messageSubtype: 'subtype' in message ? message.subtype : undefined,
          hasSessionId: 'session_id' in message ? !!message.session_id : false
        });

        // Validate that the first message is a system init message
        if (!message || message.type !== 'system' || !('subtype' in message) || message.subtype !== 'init') {
          sessionLogger.error('First message is not system init', {
            actualType: message?.type,
            actualSubtype: 'subtype' in message ? message.subtype : undefined,
            expectedType: 'system',
            expectedSubtype: 'init'
          });
          reject(new CCUIError('INVALID_SYSTEM_INIT', `Expected system init message as first message, but got: ${message?.type}/${'subtype' in message ? message.subtype : 'undefined'}`, 500));
          return;
        }

        // At this point, TypeScript knows message is SystemInitMessage
        const systemInitMessage = message as SystemInitMessage;
        
        // Validate required fields
        const requiredFields = ['session_id', 'cwd', 'tools', 'mcp_servers', 'model', 'permissionMode', 'apiKeySource'] as const;
        const missingFields = requiredFields.filter(field => systemInitMessage[field] === undefined);
        
        if (missingFields.length > 0) {
          sessionLogger.error('System init message missing required fields', {
            missingFields,
            availableFields: Object.keys(systemInitMessage)
          });
          reject(new CCUIError('INCOMPLETE_SYSTEM_INIT', `System init message missing required fields: ${missingFields.join(', ')}`, 500));
          return;
        }

        sessionLogger.info('Successfully received valid system init message', {
          sessionId: systemInitMessage.session_id,
          cwd: systemInitMessage.cwd,
          model: systemInitMessage.model,
          toolCount: systemInitMessage.tools?.length || 0,
          mcpServerCount: systemInitMessage.mcp_servers?.length || 0
        });

        resolve(systemInitMessage);
      };

      // Set up all event listeners
      this.on('claude-message', messageHandler);
      this.on('process-closed', processClosedHandler);
      this.on('process-error', processErrorHandler);
    });
  }

  /**
   * Execute common conversation flow for both start and resume operations
   */
  private async executeConversationFlow(
    operation: string,
    loggerContext: Record<string, any>,
    config: ConversationConfig,
    args: string[],
    spawnConfig: { executablePath: string; cwd: string; env: NodeJS.ProcessEnv },
    errorCode: string,
    errorPrefix: string
  ): Promise<{streamingId: string; systemInit: SystemInitMessage}> {
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
      
      // Set up system init promise before spawning process
      const systemInitPromise = this.waitForSystemInit(streamingId);
      
      // Add streamingId to environment for MCP server to use
      const envWithStreamingId = {
        ...spawnConfig.env,
        CCUI_STREAMING_ID: streamingId
      };
      
      const process = this.spawnProcess(
        { ...spawnConfig, env: envWithStreamingId }, 
        args, 
        sessionLogger
      );
      
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
      
      await Promise.race([spawnErrorPromise, delayPromise]);
      
      // Now wait for the system init message
      sessionLogger.debug('Process spawned successfully, waiting for system init message');
      const systemInit = await systemInitPromise;
      
      sessionLogger.info(`${operation.charAt(0).toUpperCase() + operation.slice(1)} conversation successfully`, {
        streamingId,
        sessionId: systemInit.session_id,
        model: systemInit.model,
        cwd: systemInit.cwd,
        processCount: this.processes.size
      });
      
      return { streamingId, systemInit };
    } catch (error) {
      sessionLogger.error(`Error ${operation} conversation`, error, {
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: error instanceof CCUIError ? error.code : undefined
      });
      
      // Clean up any resources if process fails
      const timeouts = this.timeouts.get(streamingId);
      if (timeouts) {
        timeouts.forEach(timeout => clearTimeout(timeout));
        this.timeouts.delete(streamingId);
      }
      this.processes.delete(streamingId);
      this.outputBuffers.delete(streamingId);
      
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

    // Add MCP config if available for resume
    if (this.mcpConfigPath) {
      args.push('--mcp-config', this.mcpConfigPath);
      // Add the permission prompt tool flag
      args.push('--permission-prompt-tool', 'mcp__ccui-permissions__approval_prompt');
      // Allow the MCP permission tool
      args.push('--allowedTools', 'mcp__ccui-permissions__approval_prompt');
    }

    this.logger.debug('Built Claude resume args', { args, hasMCPConfig: !!this.mcpConfigPath });
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
      '--verbose' // Required when using stream-json with print mode
    );

    // Add working directory access
    // if (config.workingDirectory) {
    //   args.push('--add-dir', config.workingDirectory);
    // }

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

    // Add MCP config if available
    if (this.mcpConfigPath) {
      args.push('--mcp-config', this.mcpConfigPath);
      // Add the permission prompt tool flag
      args.push('--permission-prompt-tool', 'mcp__ccui-permissions__approval_prompt');
      // Allow the MCP permission tool
      const currentAllowedTools = config.allowedTools || [];
      if (!currentAllowedTools.includes('mcp__ccui-permissions__approval_prompt')) {
        args.push('--allowedTools', 'mcp__ccui-permissions__approval_prompt');
      }
    }

    this.logger.debug('Built Claude args', { args, hasMCPConfig: !!this.mcpConfigPath });
    return args;
  }

  /**
   * Consolidated method to spawn Claude processes for both start and resume operations
   */
  private spawnProcess(
    spawnConfig: { executablePath: string; cwd: string; env: NodeJS.ProcessEnv },
    args: string[],
    sessionLogger: Logger
  ): ChildProcess {
    const { executablePath, cwd, env } = spawnConfig;
    
    // Check if MCP config is in args and validate it
    const mcpConfigIndex = args.indexOf('--mcp-config');
    if (mcpConfigIndex !== -1 && mcpConfigIndex + 1 < args.length) {
      const mcpConfigPath = args[mcpConfigIndex + 1];
      sessionLogger.info('MCP config specified', { 
        mcpConfigPath,
        exists: existsSync(mcpConfigPath)
      });
      
      // Try to read and log the MCP config content
      try {
        const mcpConfigContent = readFileSync(mcpConfigPath, 'utf-8');
        sessionLogger.debug('MCP config content', { 
          mcpConfig: JSON.parse(mcpConfigContent) 
        });
      } catch (error) {
        sessionLogger.error('Failed to read MCP config', { error });
      }
    }
    
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
      
      // Log the exact command for debugging
      const fullCommand = `${executablePath} ${args.join(' ')}`;
      sessionLogger.error('SPAWNING CLAUDE COMMAND: ' + fullCommand, { 
        fullCommand,
        executablePath,
        args,
        cwd,
        env: Object.keys(env)
      });
      
      const claudeProcess = spawn(executablePath, args, {
        cwd,
        env,
        stdio: ['inherit', 'pipe', 'pipe'] // stdin inherited, stdout/stderr piped for capture
      });
      
      // Handle spawn errors (like ENOENT when claude is not found)
      claudeProcess.on('error', (error: Error & NodeJS.ErrnoException) => {
        sessionLogger.error('Claude process spawn error', error, {
          errorCode: error.code,
          errorErrno: error.errno,
          errorSyscall: error.syscall,
          errorPath: error.path,
          errorSpawnargs: (error as Error & NodeJS.ErrnoException & { spawnargs?: string[] }).spawnargs // spawnargs is not in the type definition but exists at runtime
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
      let stderrBuffer = '';
      
      process.stderr.on('data', (data) => {
        const stderrContent = data.toString();
        stderrBuffer += stderrContent;
        
        // ALWAYS log stderr content at error level for visibility
        sessionLogger.error('Process stderr output received', { 
          stderr: stderrContent,
          dataLength: stderrContent.length,
          fullStderr: stderrBuffer,
          containsMCP: stderrContent.toLowerCase().includes('mcp'),
          containsPermission: stderrContent.toLowerCase().includes('permission'),
          containsError: stderrContent.toLowerCase().includes('error')
        });
        
        // Store stderr for debugging
        const existingBuffer = this.outputBuffers.get(streamingId) || '';
        this.outputBuffers.set(streamingId, existingBuffer + '\n[STDERR]: ' + stderrContent);
        
        // Emit stderr for error tracking
        this.emit('process-error', { streamingId, error: stderrContent });
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
      sessionLogger.error('Process exited', { 
        exitCode: code,
        signal: signal,
        normalExit: code === 0,
        timestamp: new Date().toISOString(),
        outputBuffer: this.outputBuffers.get(streamingId) || 'No output captured'
      });
      this.handleProcessClose(streamingId, code);
    });
  }

  private handleClaudeMessage(streamingId: string, message: StreamEvent): void {
    this.logger.debug('Handling Claude message', { 
      streamingId, 
      messageType: message?.type,
      isError: message?.type === 'error',
      isResult: message?.type === 'result'
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
    
    // Clear any pending timeouts for this session
    const timeouts = this.timeouts.get(streamingId);
    if (timeouts) {
      timeouts.forEach(timeout => clearTimeout(timeout));
      this.timeouts.delete(streamingId);
    }
    
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