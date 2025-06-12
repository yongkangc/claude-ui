import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';

export class MockChildProcess extends EventEmitter {
  public pid: number | undefined = 12345;
  public killed = false;
  public stdin: Writable;
  public stdout: Readable;
  public stderr: Readable;
  private _timeouts: NodeJS.Timeout[] = [];

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
        // Will be controlled by test scenarios
      }
    });
    
    this.stderr = new Readable({
      read() {
        // Will be controlled by test scenarios
      }
    });

    // Simulate process startup
    setImmediate(() => {
      this.simulateClaudeResponse(args);
    });
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
      this.stdout.push(JSON.stringify(initMessage) + '\n');
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
      
      this.stdout.push(JSON.stringify(responseMessage) + '\n');
      
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
      }, 100);
      this._timeouts.push(resultTimeout);
    }, 200);
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
    
    // Simulate process termination
    setImmediate(() => {
      this.emit('exit', signal === 'SIGKILL' ? 137 : 0, signal);
      this.emit('close', signal === 'SIGKILL' ? 137 : 0, signal);
    });
    
    return true;
  }

  // Mock method to simulate input
  simulateInput(input: string) {
    const sessionId = 'test-session-' + Date.now();
    
    const inputTimeout = setTimeout(() => {
      const responseMessage = {
        type: 'assistant',
        message: {
          id: 'msg_test_input_' + Date.now(),
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-20250514',
          content: [{ type: 'text', text: this.generateResponseText(input) }],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 5, output_tokens: 3 }
        },
        parent_tool_use_id: null,
        session_id: sessionId
      };
      
      this.stdout.push(JSON.stringify(responseMessage) + '\n');
    }, 100);
    this._timeouts.push(inputTimeout);
  }
}

// Track spawned processes for testing
const spawnedProcesses: MockChildProcess[] = [];

export function spawn(command: string, args: string[] = [], options: any = {}): MockChildProcess {
  const process = new MockChildProcess(command, args, options);
  spawnedProcesses.push(process);
  return process;
}

// Helper for tests to get the last spawned process
export function getLastSpawnedProcess(): MockChildProcess | undefined {
  return spawnedProcesses[spawnedProcesses.length - 1];
}

// Helper for tests to clean up
export function clearSpawnedProcesses(): void {
  // Kill all processes to clean up their timeouts
  spawnedProcesses.forEach(process => {
    if (!process.killed) {
      process.kill();
    }
  });
  spawnedProcesses.length = 0;
}

// Mock other child_process methods
export function exec() { return new MockChildProcess('', [], {}); }
export function execFile() { return new MockChildProcess('', [], {}); }
export function fork() { return new MockChildProcess('', [], {}); }
export function execSync() { return Buffer.from(''); }
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