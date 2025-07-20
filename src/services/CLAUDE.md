# Services Architecture

This directory contains the core business logic services for CCUI backend.

## Service Overview

- **ClaudeProcessManager** (`claude-process-manager.ts`) - Manages Claude CLI process lifecycle
- **StreamManager** (`stream-manager.ts`) - Handles client streaming connections  
- **ClaudeHistoryReader** (`claude-history-reader.ts`) - Reads conversation history from ~/.claude and provides working directory lookup
- **ConversationStatusTracker** (`conversation-status-tracker.ts`) - Tracks conversation status based on active streams
- **JsonLinesParser** (`json-lines-parser.ts`) - Parses JSONL streams from Claude CLI
- **JsonFileManager** (`json-file-manager.ts`) - Lightweight JSON file manager for atomic file operations
- **ConfigService** (`config-service.ts`) - Centralized configuration management using ~/.ccui/config.json
- **LogStreamBuffer** (`log-stream-buffer.ts`) - Circular buffer for capturing and streaming server logs

## Claude Process Management

Each conversation runs as a separate `claude` CLI child process with these characteristics:

```typescript
class ClaudeProcessManager {
  private processes: Map<string, ChildProcess> = new Map();
  private outputBuffers: Map<string, string> = new Map();
  private timeouts: Map<string, NodeJS.Timeout[]> = new Map();
  
  async startConversation(config: ConversationConfig): Promise<string> {
    const streamingId = uuidv4(); // CCUI's internal streaming identifier
    
    // Build Claude CLI command with required flags
    const args = [
      '-p',                            // Print mode for programmatic use
      config.initialPrompt,            // Initial prompt immediately after -p
      '--output-format', 'stream-json', // JSONL output format
      '--verbose',                     // Required when using stream-json with print mode
      '--add-dir', config.workingDirectory
    ];
    
    if (config.model) {
      args.push('--model', config.model);
    }
    
    const process = spawn('claude', args, {
      cwd: config.workingDirectory,
      stdio: ['inherit', 'pipe', 'pipe']
    });
    
    this.processes.set(streamingId, process);
    this.setupProcessHandlers(streamingId, process);
    return streamingId;
  }
}
```

**Process Lifecycle:**
- Spawn with `child_process.spawn()` for real-time output streaming  
- Each Claude CLI call is independent - starts, runs, outputs result, exits
- Parse JSONL output incrementally using custom `JsonLinesParser`
- Handle graceful shutdown with SIGTERM/SIGKILL fallback
- Automatic cleanup on process termination

**Important:** Claude CLI in print mode (`-p`) runs once and exits. It does not accept stdin input for continuing conversations.

**Race Condition Fix:** The service includes a fix for a streaming parent message race condition. When parsing streaming messages, the system now properly associates thinking blocks with their parent messages by buffering blocks until the parent message is available. This ensures proper message grouping even when blocks arrive before their parent message in the stream.

## JsonFileManager

**Purpose:** Lightweight JSON file manager for atomic file operations without external dependencies.

**Key Features:**
- **Atomic writes** using write-rename pattern
- **File locking** to prevent concurrent modifications
- **Write queue** for serialized operations
- **Process liveness detection** using PIDs
- **Zero external dependencies** - built with Node.js core modules only

**Implementation:**
```typescript
class JsonFileManager<T> {
  private writeQueue: Array<() => Promise<void>> = [];
  private isWriting = false;
  private lockFilePath: string;
  
  constructor(private filePath: string, private defaultData: T) {
    this.lockFilePath = `${filePath}.lock`;
  }
  
  async read(): Promise<T> {
    // Returns data from file or defaultData if file doesn't exist
    // Handles JSON parsing errors gracefully
  }
  
  async write(data: T): Promise<void> {
    // Queues write operation
    // Uses atomic write with temp file + rename
    // Manages lock files with PID-based stale lock cleanup
  }
  
  private async acquireLock(): Promise<void> {
    // Creates lock file with current process PID
    // Checks for stale locks from dead processes
    // Retries with exponential backoff
  }
}
```

**Usage Example:**
```typescript
const manager = new JsonFileManager('/path/to/data.json', { users: [] });
const data = await manager.read();
data.users.push({ id: 1, name: 'Alice' });
await manager.write(data);
```

## ConfigService

**Purpose:** Centralized configuration management using `~/.ccui/config.json`, replacing environment variable-based configuration.

**Key Features:**
- **Auto-generated machine ID** on first startup
- **File-based configuration** stored in user's home directory
- **Constructor override support** for testing
- **Singleton pattern** for consistent configuration access
- **Automatic directory and file creation**

**Configuration Structure:**
```typescript
interface CCUIConfig {
  machine_id: string;  // Auto-generated: {hostname}-{8char_hash}
  server: {
    host: string;      // Default: 'localhost'
    port: number;      // Default: 3001
  };
}
```

**Machine ID Generation:**
```typescript
private generateMachineId(): string {
  const hostname = os.hostname().toLowerCase();
  const interfaces = os.networkInterfaces();
  
  // Find primary MAC address (non-internal, non-zero)
  let primaryMac = '';
  for (const [name, ifaces] of Object.entries(interfaces)) {
    if (!ifaces) continue;
    for (const iface of ifaces) {
      if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
        primaryMac = iface.mac;
        break;
      }
    }
    if (primaryMac) break;
  }
  
  // Generate hash from MAC address
  const hash = crypto.createHash('sha256').update(primaryMac).digest('hex');
  return `${hostname}-${hash.substring(0, 8)}`;
}
```

**Usage:**
```typescript
// In application startup
const configService = ConfigService.getInstance();
const config = configService.getConfig();

// For testing with custom config path
const testConfig = new ConfigService('/tmp/test-config.json');
```

## LogStreamBuffer

**Purpose:** Circular buffer for capturing and streaming server logs to web clients.

**Key Features:**
- **Real-time streaming** via Server-Sent Events (SSE)
- **Pino logger integration** with custom stream transport
- **Circular buffer** with configurable size (default: 1000 entries)
- **JSONL format** for structured log entries
- **Graceful client disconnection handling**

**Implementation:**
```typescript
class LogStreamBuffer {
  private buffer: string[] = [];
  private clients: Set<ServerResponse> = new Set();
  private bufferSize: number;
  
  constructor(bufferSize = 1000) {
    this.bufferSize = bufferSize;
  }
  
  addLog(logEntry: string): void {
    // Add to circular buffer
    this.buffer.push(logEntry);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
    
    // Broadcast to all connected clients
    this.broadcast(logEntry);
  }
  
  streamToClient(res: ServerResponse): void {
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    // Send buffered logs
    for (const log of this.buffer) {
      res.write(`data: ${log}\n\n`);
    }
    
    this.clients.add(res);
  }
}
```

**Logger Integration:**
```typescript
// Create custom Pino transport
const customTransport = pino.transport({
  target: path.join(__dirname, 'log-transport.js'),
  options: { /* transport config */ }
});

// In transport implementation
process.on('message', (log) => {
  const formatted = formatLog(log);
  logBuffer.addLog(formatted);
  process.stdout.write(formatted + '\n');
});
```

## Service Method Signatures

```typescript
// ClaudeProcessManager key methods
class ClaudeProcessManager {
  async startConversation(config: ConversationConfig): Promise<string>
  async resumeConversation(sessionId: string, message: string): Promise<string>
  async stopConversation(streamingId: string): Promise<boolean>
  getActiveConversations(): Map<string, ChildProcess>
}

// StreamManager key methods
class StreamManager {
  addClient(streamingId: string, response: Response): void
  removeClient(streamingId: string, response: Response): void
  broadcast(streamingId: string, event: StreamEvent): void
  getClientCount(streamingId: string): number
}

// ClaudeHistoryReader key methods
class ClaudeHistoryReader {
  async getAllConversations(query?: ConversationListQuery): Promise<ConversationSummary[]>
  async getConversationDetails(sessionId: string): Promise<ConversationDetailsResponse>
  async getConversationWorkingDirectory(sessionId: string): Promise<string | null>
}

// ConversationStatusTracker key methods
class ConversationStatusTracker {
  registerActiveSession(streamingId: string, claudeSessionId: string): void
  unregisterActiveSession(streamingId: string): void
  getConversationStatus(claudeSessionId: string): 'completed' | 'ongoing' | 'pending'
  getStreamingIdForSession(claudeSessionId: string): string | undefined
}

// JsonFileManager key methods
class JsonFileManager<T> {
  constructor(filePath: string, defaultData: T)
  async read(): Promise<T>
  async write(data: T): Promise<void>
}

// ConfigService key methods
class ConfigService {
  static getInstance(): ConfigService
  getConfig(): CCUIConfig
  getPort(): number
  getHost(): string
  getLogLevel(): string
  getMachineId(): string
}

// LogStreamBuffer key methods
class LogStreamBuffer {
  constructor(bufferSize?: number)
  addLog(logEntry: string): void
  getRecentLogs(limit?: number): string[]
  streamToClient(res: ServerResponse): void
  removeClient(res: ServerResponse): void
}
```

## Conversation Status Tracking

The backend automatically tracks conversation status based on active streaming connections:

**Status Values:**
- `completed`: Conversation has finished and no active stream exists (default)
- `ongoing`: Conversation has an active streaming connection (currently being processed)
- `pending`: Reserved for future features (not currently used)

**Implementation:**
```typescript
class ConversationStatusTracker {
  // Maps Claude session ID -> CCUI streaming ID
  private sessionToStreaming: Map<string, string> = new Map();
  
  // Maps CCUI streaming ID -> Claude session ID (reverse lookup)
  private streamingToSession: Map<string, string> = new Map();
  
  registerActiveSession(streamingId: string, claudeSessionId: string): void
  unregisterActiveSession(streamingId: string): void
  getConversationStatus(claudeSessionId: string): 'completed' | 'ongoing' | 'pending'
}
```

**Integration:**
- Session IDs are extracted from stream messages and registered automatically
- Status is updated in real-time when streams start/end
- Conversation list endpoint includes current status for each conversation
- **Streaming ID field**: Ongoing conversations include an optional `streamingId` field in API responses that provides the CCUI internal streaming identifier for connecting to active streams or stopping conversations
- Status tracking handles process errors and cleanup gracefully
- Rich metadata support including conversation summaries, message counts, and cost tracking

## Data Flow Architecture

1. **Frontend** makes REST API calls to start/manage conversations
2. **Backend** spawns Claude CLI processes independently
3. **Claude CLI** outputs JSONL streams that are parsed and forwarded
4. **JsonLinesParser** transforms Claude output into structured events
5. **StreamManager** provides real-time updates to connected web clients via HTTP streaming

## Session ID Architecture

CCUI maintains **two separate session ID systems**:

1. **CCUI Streaming ID** (`streamingId`): Internal UUID for managing active processes and streaming connections
2. **Claude CLI Session ID** (`session_id`): Claude's internal session tracking, used in history files

```typescript
// API flow example
const startResponse = await fetch('/api/conversations/start', { ... });
const { streamingId, streamUrl } = await startResponse.json();
// streamingId: CCUI's internal ID (e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")

// In stream messages
const streamMessage = JSON.parse(streamLine);
const claudeSessionId = streamMessage.session_id;
// claudeSessionId: Claude CLI's session ID (used for history files)

// Resume using Claude's session ID
const resumeResponse = await fetch('/api/conversations/resume', {
  method: 'POST',
  body: JSON.stringify({
    sessionId: claudeSessionId,  // From conversation history
    message: 'Continue this conversation'
  })
});
```

## Error Handling Patterns

```typescript
// Custom error class
export class CCUIError extends Error {
  constructor(public code: string, message: string, public statusCode: number = 500) {
    super(message);
    this.name = 'CCUIError';
  }
}

// Common error codes
const ERROR_CODES = {
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  PROCESS_START_FAILED: 'PROCESS_START_FAILED',
  SYSTEM_STATUS_ERROR: 'SYSTEM_STATUS_ERROR',
  MODELS_ERROR: 'MODELS_ERROR',
  PERMISSION_REQUEST_NOT_FOUND: 'PERMISSION_REQUEST_NOT_FOUND'
};

// Error response format
interface ErrorResponse {
  error: string;               // Human-readable error message
  code?: string;               // Machine-readable error code
}
```

## Important Notes

- **Logging**: Always use `@/services/logger.ts` for logging. NEVER USE CONSOLE.LOG in production code
  - Log level controlled via `LOG_LEVEL` environment variable (debug, info, warn, error, silent)
  - Logger reads environment variable at startup - no dynamic updates
- **Process Independence**: Each conversation runs as a separate Claude CLI child process
- **Event-driven architecture** using Node.js EventEmitter
- **Stateless design** for scalability