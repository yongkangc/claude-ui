import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

export class MockChildProcess extends EventEmitter {
  public pid: number | undefined = 12345;
  public killed = false;
  public stdin: Writable;
  public stdout: Readable;
  public stderr: Readable;
  public _timeouts: NodeJS.Timeout[] = [];
  public _immediates: NodeJS.Immediate[] = [];

  constructor(command: string, args: string[], options: any) {
    super();
    
    // Check for error conditions that should fail at spawn time
    const addDirIndex = args.indexOf('--add-dir');
    const workingDir = addDirIndex !== -1 && addDirIndex + 1 < args.length ? args[addDirIndex + 1] : undefined;
    if (workingDir === '/nonexistent/directory/that/does/not/exist') {
      this.pid = undefined;
    }
    
    // Create mock streams
    this.stdin = new Writable({
      write(chunk, encoding, callback) {
        callback();
      }
    });
    
    this.stdout = new Readable({
      read() {
        // Required method for Readable streams
      }
    });
    
    // Store reference to the original push method
    const originalPush = this.stdout.push.bind(this.stdout);
    
    // Override push to work properly in tests
    (this.stdout as any).push = (data: any) => {
      if (data === null) {
        // End the stream
        return originalPush(null);
      } else if (data) {
        // Push data to stream
        return originalPush(Buffer.from(data));
      }
      return true;
    };
    
    this.stderr = new Readable({
      read() {
        // Required method for Readable streams
      }
    });
    
    // Store reference to the original push method
    const originalStderrPush = this.stderr.push.bind(this.stderr);
    
    // Override push to work properly in tests  
    (this.stderr as any).push = (data: any) => {
      if (data === null) {
        // End the stream
        return originalStderrPush(null);
      } else if (data) {
        // Push data to stream
        return originalStderrPush(Buffer.from(data));
      }
      return true;
    };

    // Simulate process startup
    console.log('[MOCK] Setting up immediate for simulateClaudeResponse');
    const immediate = setImmediate(() => {
      console.log('[MOCK] Running simulateClaudeResponse');
      this.simulateClaudeResponse(args);
    });
    this._immediates.push(immediate);
  }

  private simulateClaudeResponse(args: string[]) {
    const workingDir = this.getWorkingDirFromArgs(args);
    const initialPrompt = args[args.length - 1]; // Last argument is the prompt
    
    // Check for error conditions first - only for runtime errors (not spawn-time failures)
    if (workingDir === '/nonexistent/directory') {
      setImmediate(() => {
        this.stderr.push('Error: Directory does not exist\n');
        this.emit('error', new Error('ENOENT: no such file or directory'));
        this.emit('exit', 1, null);
        this.emit('close', 1, null);
      });
      return;
    }

    // Simulate successful Claude response
    const sessionId = 'test-session-' + Date.now();
    
    // Send system init message
    const initMessage = {
      type: 'system',
      subtype: 'init',
      cwd: workingDir || process.cwd(),
      session_id: sessionId,
      tools: ['Task', 'Bash', 'Glob', 'Grep', 'LS', 'Read', 'Edit', 'MultiEdit', 'Write'],
      mcp_servers: [],
      model: 'claude-opus-4-20250514',
      permissionMode: 'default',
      apiKeySource: 'none'
    };
    
    setImmediate(() => {
      console.log('[MOCK] Pushing init message to stdout');
      const result = this.stdout.push(JSON.stringify(initMessage) + '\n');
      console.log('[MOCK] Push result:', result);
    });

    // Send assistant response after a short delay
    const responseTimeout = setTimeout(() => {
      const responseMessage = {
        type: 'assistant',
        message: {
          id: 'msg_test_' + Date.now(),
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-20250514',
          content: [{ type: 'text', text: this.generateResponseText(initialPrompt) }],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 5 }
        },
        parent_tool_use_id: null,
        session_id: sessionId
      };
      
      console.log('[MOCK] Pushing response message to stdout');
      const result = this.stdout.push(JSON.stringify(responseMessage) + '\n');
      console.log('[MOCK] Response push result:', result);
      
      // Send result message
      const resultTimeout = setTimeout(() => {
        const resultMessage = {
          type: 'result',
          subtype: 'success',
          cost_usd: 0.001,
          is_error: false,
          duration_ms: 1000,
          duration_api_ms: 800,
          num_turns: 1,
          result: this.generateResponseText(initialPrompt),
          session_id: sessionId,
          total_cost: 0.001,
          usage: { input_tokens: 10, output_tokens: 5 }
        };
        
        this.stdout.push(JSON.stringify(resultMessage) + '\n');
        this.stdout.push(null); // End stream
        
        // Simulate process completion after sending result
        const exitTimeout = setTimeout(() => {
          this.emit('exit', 0, null);
          this.emit('close', 0, null);
        }, 50);
        this._timeouts.push(exitTimeout);
      }, 25);
      this._timeouts.push(resultTimeout);
    }, 25);
    this._timeouts.push(responseTimeout);
  }

  private getWorkingDirFromArgs(args: string[]): string | undefined {
    const addDirIndex = args.indexOf('--add-dir');
    if (addDirIndex !== -1 && addDirIndex + 1 < args.length) {
      return args[addDirIndex + 1];
    }
    return undefined;
  }

  private generateResponseText(prompt: string): string {
    if (prompt.includes('just "Hello"')) {
      return 'Hello';
    }
    if (prompt.includes('just "test"')) {
      return 'test';
    }
    if (prompt.includes('just "received"')) {
      return 'received';
    }
    return 'Hello, I understand your request.';
  }

  kill(signal?: string | number) {
    this.killed = true;
    
    // Clear any pending timeouts
    this._timeouts.forEach(timeout => clearTimeout(timeout));
    this._timeouts.length = 0;
    
    // Clear any pending immediates
    this._immediates.forEach(immediate => clearImmediate(immediate));
    this._immediates.length = 0;
    
    // Simulate process termination
    const exitImmediate = setImmediate(() => {
      const exitCode = signal === 'SIGKILL' ? 137 : 0;
      this.emit('exit', exitCode, signal);
      this.emit('close', exitCode, signal);
    });
    this._immediates.push(exitImmediate);
    
    return true;
  }

}

// Track spawned processes for testing
const spawnedProcesses: MockChildProcess[] = [];

export function spawn(command: string, args: string[] = [], options: any = {}): MockChildProcess {
  console.log('[MOCK SPAWN] Creating mock process for command:', command);
  const mockProcess = new MockChildProcess(command, args, options);
  spawnedProcesses.push(mockProcess);
  console.log('[MOCK SPAWN] Mock process created, total processes:', spawnedProcesses.length);
  return mockProcess;
}

// Helper for tests to get the last spawned process
export function getLastSpawnedProcess(): MockChildProcess | undefined {
  return spawnedProcesses[spawnedProcesses.length - 1];
}

// Helper for tests to clean up
export function clearSpawnedProcesses(): void {
  // Kill all processes to clean up their timeouts and immediates
  spawnedProcesses.forEach(process => {
    if (!process.killed) {
      process.kill();
    }
    // Extra safety: manually clear any remaining timeouts and immediates
    if (process._timeouts) {
      process._timeouts.forEach(timeout => clearTimeout(timeout));
      process._timeouts.length = 0;
    }
    if (process._immediates) {
      process._immediates.forEach(immediate => clearImmediate(immediate));
      process._immediates.length = 0;
    }
  });
  spawnedProcesses.length = 0;
}

// Mock other child_process methods
export function exec() { return new MockChildProcess('', [], {}); }
export function execFile() { return new MockChildProcess('', [], {}); }
export function fork() { return new MockChildProcess('', [], {}); }
export const execSync = jest.fn(() => Buffer.from(''));
export function execFileSync() { return Buffer.from(''); }
export function spawnSync() { 
  return { 
    pid: 12345, 
    output: [], 
    stdout: Buffer.from(''), 
    stderr: Buffer.from(''), 
    status: 0, 
    signal: null, 
    error: undefined 
  }; 
}